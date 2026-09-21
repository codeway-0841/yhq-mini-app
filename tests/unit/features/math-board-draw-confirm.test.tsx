/**
 * Math Board — P1-1 multi-block grading (round-3 NAVBAT) + P1-2 draw undo.
 *
 * NAVBAT kontrakti:
 * - Recognition natijalari navbat sifatida ishlanadi: bitta blok confirm →
 *   sheet YOPILIB typed inputga shu blok chiqadi.
 * - Keyingi needs_review blok FAQAT check+accept'dan KEYIN ochiladi (auto).
 * - Keyingi confirm avvalgi inputni bosib ketmaydi (accept inputni tozalaydi).
 *
 * alg-1 (2x+3=11) 2-blok e2e:
 *   2*x=8 confirm → correct → accept → (auto) 2-blok ochiladi →
 *   x=4 confirm → correct → accept →
 *   steps.length=2, ikkala step o'z blockId'ida, ikkala blok grading=correct.
 *
 * P1-2 undo invariant:
 * - Draw accepted blok undo'da O'CHIRILMAYDI (stroke'lar canvasda): grading
 *   pending'ga qaytariladi, recognition=confirmed saqlanadi; input tiklanadi —
 *   qayta check/accept mumkin.
 * - Typed accepted blok undo'da o'chiriladi.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import MathBoardPage from '../../../src/features/math-board/MathBoardPage'
import { useBoardSession } from '../../../src/features/math-board/hooks/useBoardSession'
import { api } from '../../../src/shared/api'
import { STEP_DEBOUNCE_MS } from '../../../src/features/math-board/hooks/useStepCheck'

vi.mock('mathlive', () => ({}))

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

vi.mock('../../../src/features/math-board/components/BoardCanvas', () => ({
  default: ({ onStrokes }: { onStrokes: (s: unknown[]) => void }) => (
    <button
      type="button"
      data-testid="inject-strokes"
      onClick={() => onStrokes([
        { tool: 'pen', color: '#111827', width: 4, opacity: 1, points: [{ x: 0.2, y: 0.1 }, { x: 0.4, y: 0.15 }] },
        { tool: 'pen', color: '#111827', width: 4, opacity: 1, points: [{ x: 0.2, y: 0.5 }, { x: 0.4, y: 0.55 }] },
      ])}
    >
      chiz
    </button>
  ),
}))

vi.mock('../../../src/features/math-board/lib/snapshot', () => ({
  renderBlockToDataUrl: () => 'data:image/png;base64,AAAA',
  strokesForBlock: () => [],
}))

type RecogResult = { ok: true; results: { blockId: string; type: 'equation'; latex: string; confidence: number; alternatives: string[] }[] }

let resolveRec: ((v: RecogResult) => void) | null = null

function blocks(pid = 'alg-1') {
  return useBoardSession.getState().blocksByProblem[pid] ?? []
}

function drawBlockIds(pid = 'alg-1'): string[] {
  return blocks(pid).filter((b) => b.strokeIds.length > 0).map((b) => b.id)
}

function blockById(id: string, pid = 'alg-1') {
  return blocks(pid).find((b) => b.id === id)
}

function renderPage() {
  return render(
    <MemoryRouter>
      <MathBoardPage />
    </MemoryRouter>,
  )
}

function clickRecognize(container: HTMLElement) {
  fireEvent.click(container.querySelector('button[aria-label="Amallar"]') as Element)
  fireEvent.click(container.querySelectorAll('[role="menuitem"]')[0])
}

function advanceCheck() {
  act(() => {
    vi.advanceTimersByTime(STEP_DEBOUNCE_MS + 50)
  })
}

beforeEach(() => {
  resolveRec = null
  vi.useFakeTimers()
  useBoardSession.getState().reset()
  useBoardSession.setState({ problemId: 'alg-1' })
  vi.spyOn(api, 'recognizeBlocks').mockImplementation(
    () => new Promise<RecogResult>((resolve) => {
      resolveRec = resolve
    }),
  )
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

/** chizish → tanish → 2 blok needs_review (alg-1: 2*x=8 va x=4) */
async function runToReview(container: HTMLElement): Promise<string[]> {
  fireEvent.click(screen.getByText('Chizish'))
  fireEvent.click(screen.getByTestId('inject-strokes'))
  await act(async () => {})
  clickRecognize(container)
  const ids = drawBlockIds()
  await act(async () => {
    resolveRec?.({
      ok: true,
      results: [
        { blockId: ids[0], type: 'equation', latex: '2*x=8', confidence: 0.9, alternatives: [] },
        { blockId: ids[1], type: 'equation', latex: 'x=4', confidence: 0.9, alternatives: [] },
      ],
    })
  })
  return ids
}

describe('P1-1 multi-block grading NAVBAT (alg-1, 2 blok)', () => {
  it('STRICT QUEUE: x=4 birinchi TANLANMAYDI → 2*x=8 confirm→accept → x=4 confirm→accept → solved', async () => {
    const { container } = renderPage()
    const ids = await runToReview(container)
    // STRICT QUEUE (round-4): sheet bir vaqtda FAQAT birinchi needs_review
    // blokni ko'rsatadi — x=4 (ikkinchi blok) birinchi tanlash IMKONSIZ:
    // faqat 1 ta confirm tugmasi va u 2*x=8 ga tegishli
    expect(screen.getAllByText('Kiritishga o\'tkazish')).toHaveLength(1)
    const sheetField = document.querySelector('math-field') as unknown as { textContent: string }
    expect(sheetField.textContent).toBe('2*x=8')

    // ── NAVBAT 1: 2*x=8 confirm → sheet YOPILADI, typed inputga chiqadi ──
    fireEvent.click(screen.getAllByText('Kiritishga o\'tkazish')[0])
    let s = useBoardSession.getState()
    expect(blockById(ids[0])?.recognition.state).toBe('confirmed')
    expect(blockById(ids[0])?.latex).toBe('2*x=8')
    expect(blockById(ids[0])?.ascii).toBe('2*x=8')
    expect(s.inputLatex).toBe('2*x=8')
    expect(s.inputBlockId).toBe(ids[0])
    // Sheet yopildi — keyingi blok hali ochilmagan (navbat intizomi)
    expect(screen.queryByText('Kiritishga o\'tkazish')).toBeNull()
    // 2-blok needs_review holatida SAQLANIB qolgan (yo'qolmagan)
    expect(blockById(ids[1])?.recognition.state).toBe('needs_review')
    // Typed tabga o'tildi
    expect(screen.getByText('Qabul qilish')).toBeTruthy()

    // ── check → correct → accept ────────────────────────────────────────
    advanceCheck()
    fireEvent.click(screen.getByText('Qabul qilish'))
    s = useBoardSession.getState()
    expect(s.steps).toHaveLength(1)
    expect(s.steps[0].blockId).toBe(ids[0])
    expect(blockById(ids[0])?.grading.status).toBe('correct')
    // Accept inputni tozaladi — keyingi confirm avvalgi inputni bosmaydi
    expect(s.inputLatex).toBe('')

    // ── NAVBAT 2: accept'dan KEYIN keyingi needs_review blok AUTO ochiladi ──
    // Endi navbat x=4 da — sheet faqat SHU blokni ko'rsatadi
    expect(screen.getAllByText('Kiritishga o\'tkazish')).toHaveLength(1)
    const sheetField2 = document.querySelector('math-field') as unknown as { textContent: string }
    expect(sheetField2.textContent).toBe('x=4')
    fireEvent.click(screen.getAllByText('Kiritishga o\'tkazish')[0])
    s = useBoardSession.getState()
    expect(s.inputLatex).toBe('x=4')
    expect(s.inputBlockId).toBe(ids[1])
    expect(screen.queryByText('Kiritishga o\'tkazish')).toBeNull()

    // ── check → correct → accept ────────────────────────────────────────
    advanceCheck()
    fireEvent.click(screen.getByText('Qabul qilish'))
    s = useBoardSession.getState()
    expect(s.steps).toHaveLength(2)
    // Ikkala step O'Z blockId'iga bog'langan
    expect(s.steps[0].blockId).toBe(ids[0])
    expect(s.steps[1].blockId).toBe(ids[1])
    // Ikkala blok grading=correct; duplicate typed blok YO'Q (faqat 2 draw blok)
    expect(blockById(ids[0])?.grading.status).toBe('correct')
    expect(blockById(ids[1])?.grading.status).toBe('correct')
    expect(s.blocksByProblem['alg-1']).toHaveLength(2)
    // alg-1 yechildi (x=4, final 4)
    expect(screen.getByText('Yechildi!')).toBeTruthy()
    // Navbat tugadi — sheet qayta ochilmaydi
    expect(screen.queryByText('Kiritishga o\'tkazish')).toBeNull()
  })

  it('qo\'lda tahrir inputBlockId bog\'lanishini tozalaydi (accept typed blok yaratadi)', async () => {
    const { container } = renderPage()
    const ids = await runToReview(container)
    // Strict queue — faqat birinchi blok confirm mumkin
    fireEvent.click(screen.getAllByText('Kiritishga o\'tkazish')[0])
    expect(useBoardSession.getState().inputBlockId).toBe(ids[0])
    act(() => {
      useBoardSession.getState().setInput('2*x=9')
    })
    expect(useBoardSession.getState().inputBlockId).toBeNull()
  })
})

describe('P1-2 draw undo invariant (round-3)', () => {
  it('draw-confirm → accept → undo: blok O\'CHMAYDI (grading=pending, confirmed), qayta accept mumkin', async () => {
    const { container } = renderPage()
    const ids = await runToReview(container)
    fireEvent.click(screen.getAllByText('Kiritishga o\'tkazish')[0])
    advanceCheck()
    fireEvent.click(screen.getByText('Qabul qilish'))
    expect(useBoardSession.getState().steps).toHaveLength(1)
    expect(blockById(ids[0])?.grading.status).toBe('correct')

    // UNDO — draw-blok stroke'lari canvasda qolgani uchun O'CHIRILMAYDI
    fireEvent.click(screen.getByText('Yozish'))
    fireEvent.click(container.querySelector('button[aria-label="Oxirgisini o\'chirish"]') as Element)
    const s = useBoardSession.getState()
    expect(s.steps).toHaveLength(0)
    // MathBlock saqlanadi: recognition=confirmed, grading=pending
    expect(blockById(ids[0])?.recognition.state).toBe('confirmed')
    expect(blockById(ids[0])?.grading.status).toBe('pending')
    // 2-blok (needs_review) ham saqlanib qolgan
    expect(blockById(ids[1])?.recognition.state).toBe('needs_review')
    // changedBlockIds — haqiqiy o'zgargan blockId
    expect(s.turns[s.turns.length - 1].changedBlockIds).toEqual([ids[0]])
    // Input tiklandi — draw qadam qayta check/accept qilinishi mumkin
    expect(s.inputLatex).toBe('2*x=8')
    expect(s.inputBlockId).toBe(ids[0])

    // QAYTA check → correct → accept (undo'dan keyin oqim ishlaydi)
    advanceCheck()
    fireEvent.click(screen.getByText('Qabul qilish'))
    const s2 = useBoardSession.getState()
    expect(s2.steps).toHaveLength(1)
    expect(s2.steps[0].blockId).toBe(ids[0])
    expect(blockById(ids[0])?.grading.status).toBe('correct')
  })

  it('accept → undo (typed): typed blok o\'chadi — steps/blocks desync yo\'q', async () => {
    renderPage()
    const mf = document.querySelector('math-field') as unknown as { value: string }
    mf.value = '2*x=8'
    fireEvent.input(mf as unknown as Element)
    advanceCheck()
    fireEvent.click(screen.getByText('Qabul qilish'))
    let s = useBoardSession.getState()
    expect(s.steps).toHaveLength(1)
    const blockId = s.steps[0].blockId
    expect(blockId).toBeTruthy()
    expect(blocks().some((b) => b.id === blockId)).toBe(true)

    fireEvent.click(document.querySelector('button[aria-label="Oxirgisini o\'chirish"]') as Element)
    s = useBoardSession.getState()
    expect(s.steps).toHaveLength(0)
    expect(blocks().some((b) => b.id === blockId)).toBe(false)
    expect(s.turns[s.turns.length - 1].changedBlockIds).toEqual([blockId])
  })
})
