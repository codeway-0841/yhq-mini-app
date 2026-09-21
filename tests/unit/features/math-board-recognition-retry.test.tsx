/**
 * Math Board — P1-1 recognition retry (deferred-promise).
 *
 * Kontrakt:
 * - Recognition boshlanganda o'zgargan bloklar request-owned revision bilan
 *   belgilanadi (faqat shu request ularni qaytara oladi).
 * - Network reject/timeout → faqat o'sha request bloklari `failed` — "Tanish"
 *   qayta bosilganda request QAYTA ketadi (pending filter failed'ni qamraydi).
 * - Stale javob (accept / masala almashish) → natija tashlanadi, bloklar
 *   `unrecognized`'ga qaytariladi — hech bir blok recognizing'da YETIM qolmaydi.
 *
 * BoardCanvas stroke-injector bilan mock'lanadi (jsdom'da pointer-chizish yo'q);
 * snapshot render mock'lanadi (jsdom'da canvas 2d yo'q).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import MathBoardPage from '../../../src/features/math-board/MathBoardPage'
import { useBoardSession } from '../../../src/features/math-board/hooks/useBoardSession'
import { api } from '../../../src/shared/api'

vi.mock('mathlive', () => ({}))

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

// Ikki alohida blok hosil qiluvchi stroke'lar (y-bo'shliq katta)
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

const OK = { status: 'correct', detail: 'identical_exact' } as const

type RecogResult = { ok: true; results: { blockId: string; type: 'equation'; latex: string; confidence: number; alternatives: string[] }[] }

let resolveRec: ((v: RecogResult) => void) | null = null
let rejectRec: ((e: Error) => void) | null = null

function mockRecognizeDeferred() {
  return vi.spyOn(api, 'recognizeBlocks').mockImplementation(
    () => new Promise<RecogResult>((resolve, reject) => {
      resolveRec = resolve
      rejectRec = reject
    }),
  )
}

function drawBlocks(problemId = 'log-1') {
  return (useBoardSession.getState().blocksByProblem[problemId] ?? []).filter((b) => b.strokeIds.length > 0)
}

function states(problemId = 'log-1'): string[] {
  return drawBlocks(problemId).map((b) => b.recognition.state)
}

function resultsFor(ids: string[]): RecogResult {
  return {
    ok: true,
    results: ids.map((blockId, i) => ({
      blockId, type: 'equation' as const, latex: i === 0 ? 'x=1' : 'y=2', confidence: 0.9, alternatives: [],
    })),
  }
}

function renderPage() {
  return render(
    <MemoryRouter>
      <MathBoardPage />
    </MemoryRouter>,
  )
}

async function injectStrokes() {
  fireEvent.click(screen.getByText('Chizish'))
  fireEvent.click(screen.getByTestId('inject-strokes'))
  await act(async () => {})
}

function clickRecognize(container: HTMLElement) {
  fireEvent.click(container.querySelector('button[aria-label="Amallar"]') as Element)
  const items = container.querySelectorAll('[role="menuitem"]')
  fireEvent.click(items[0])
}

beforeEach(() => {
  resolveRec = null
  rejectRec = null
  useBoardSession.getState().reset()
  useBoardSession.setState({ problemId: 'log-1' })
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('P1-1 recognition retry', () => {
  it('success: bloklar needs_review + review sheet ochiladi', async () => {
    const spy = mockRecognizeDeferred()
    const { container } = renderPage()
    await injectStrokes()
    expect(states()).toEqual(['unrecognized', 'unrecognized'])

    clickRecognize(container)
    expect(spy).toHaveBeenCalledTimes(1)
    expect(states()).toEqual(['recognizing', 'recognizing'])

    const ids = drawBlocks().map((b) => b.id)
    await act(async () => {
      resolveRec?.(resultsFor(ids))
    })
    expect(states()).toEqual(['needs_review', 'needs_review'])
    // Review sheet ochildi (sarlavha: sr-only + ko'rinadigan)
    expect(screen.getAllByText("Tanish natijasi — tekshirib to'g'rilang").length).toBeGreaterThan(0)
  })

  it('server qaytarmagan blok failed bo\'ladi (recognizing\'da yetim qolmaydi)', async () => {
    mockRecognizeDeferred()
    const { container } = renderPage()
    await injectStrokes()
    clickRecognize(container)
    const ids = drawBlocks().map((b) => b.id)
    // Faqat 1-blok qaytadi — 2-si server javobida YO'Q
    await act(async () => {
      resolveRec?.(resultsFor([ids[0]]))
    })
    expect(states()).toEqual(['needs_review', 'failed'])
  })

  it('reject: bloklar failed + xato ko\'rinadi; "Tanish" qayta bosilsa request QAYTA ketadi', async () => {
    const spy = mockRecognizeDeferred()
    const { container } = renderPage()
    await injectStrokes()
    clickRecognize(container)

    await act(async () => {
      rejectRec?.(new Error('network'))
    })
    // Bloklar recognizing'da yetim qolmadi — failed (retry mumkin)
    expect(states()).toEqual(['failed', 'failed'])
    expect(screen.getByText('Qayta urinish')).toBeTruthy()

    // RETRY — "Tanish" qayta bosilganda request qayta ketadi
    clickRecognize(container)
    expect(spy).toHaveBeenCalledTimes(2)
    expect(states()).toEqual(['recognizing', 'recognizing'])

    const ids = drawBlocks().map((b) => b.id)
    await act(async () => {
      resolveRec?.(resultsFor(ids))
    })
    expect(states()).toEqual(['needs_review', 'needs_review'])
  })

  it('stale-on-accept: javob tashlanadi, bloklar unrecognized\'ga qaytariladi', async () => {
    const spy = mockRecognizeDeferred()
    const { container } = renderPage()
    await injectStrokes()
    clickRecognize(container)
    expect(states()).toEqual(['recognizing', 'recognizing'])

    // So'rov havoda — qadam qabul qilindi (acceptedStepsRevision o'zgardi)
    act(() => {
      useBoardSession.getState().acceptStep('x=1', 'x=1', { ...OK }, false)
    })

    const ids = drawBlocks().map((b) => b.id)
    await act(async () => {
      resolveRec?.(resultsFor(ids))
    })
    // Stale javob yozilmadi — lekin bloklar yetim ham qolmadi
    expect(states()).toEqual(['unrecognized', 'unrecognized'])
    expect(screen.queryByText("Tanish natijasi — tekshirib to'g'rilang")).toBeNull()
    // Qayta tanish mumkin (pending filter unrecognized'ni qamraydi)
    clickRecognize(container)
    expect(spy).toHaveBeenCalledTimes(2)
  })

  it('stale-on-problem-switch: eski masala bloklari unrecognized\'ga qaytariladi', async () => {
    mockRecognizeDeferred()
    const { container } = renderPage()
    await injectStrokes()
    clickRecognize(container)
    expect(states('log-1')).toEqual(['recognizing', 'recognizing'])

    // So'rov havoda — masala almashdi (sessionRevision o'zgardi)
    act(() => {
      useBoardSession.getState().selectProblem('log-2')
    })

    const ids = drawBlocks('log-1').map((b) => b.id)
    await act(async () => {
      resolveRec?.(resultsFor(ids))
    })
    // Eski masalaning bloklari recognizing'da YETIM qolmadi
    expect(states('log-1')).toEqual(['unrecognized', 'unrecognized'])
    expect(screen.queryByText("Tanish natijasi — tekshirib to'g'rilang")).toBeNull()
  })

  it('P2-2 (round-3): problem switch eski requestni DARHOL bekor qiladi — yangi masalada Tanish kechikishsiz ishlaydi', async () => {
    // Har chaqiruvga alohida resolver (2 request: eski A + yangi B)
    const resolvers: Array<(v: RecogResult) => void> = []
    const spy = vi.spyOn(api, 'recognizeBlocks').mockImplementation(
      () => new Promise<RecogResult>((resolve) => {
        resolvers.push(resolve)
      }),
    )
    const { container } = renderPage()
    await injectStrokes() // log-1
    clickRecognize(container) // request A (havoda)
    expect(states('log-1')).toEqual(['recognizing', 'recognizing'])

    // Masala almash — eski request hali tugamagan
    const picker = screen.getByRole('group', { name: 'Masala' })
    fireEvent.click(picker.querySelectorAll('button')[1])
    await act(async () => {})

    // Yangi masalada "Tanish" DARHOL ishlaydi — recognizing qolib ketmagan.
    // Eski request resolve qilinISHIDAN OLDIN yangi recognition boshlanadi:
    clickRecognize(container) // request B
    expect(spy).toHaveBeenCalledTimes(2)
    expect(states('log-2')).toEqual(['recognizing', 'recognizing'])

    // ESKI request A resolve — yangi request/UI state'ga YOZMAYDI
    const idsA = drawBlocks('log-1').map((b) => b.id)
    await act(async () => {
      resolvers[0]?.(resultsFor(idsA))
    })
    // Yangi request hali recognizing'da (buzilmagan); eski bloklar yetim emas
    expect(states('log-2')).toEqual(['recognizing', 'recognizing'])
    expect(states('log-1')).toEqual(['unrecognized', 'unrecognized'])
    // Eski javob review sheet ochmadi
    expect(screen.queryByText("Tanish natijasi — tekshirib to'g'rilang")).toBeNull()

    // YANGI request B resolve — faqat u yozadi
    const idsB = drawBlocks('log-2').map((b) => b.id)
    await act(async () => {
      resolvers[1]?.(resultsFor(idsB))
    })
    expect(states('log-2')).toEqual(['needs_review', 'needs_review'])
    expect(states('log-1')).toEqual(['unrecognized', 'unrecognized'])
  })

  it('stale reject (masala almashgan): jim yutiladi, bloklar unrecognized', async () => {
    mockRecognizeDeferred()
    const { container } = renderPage()
    await injectStrokes()
    clickRecognize(container)

    act(() => {
      useBoardSession.getState().selectProblem('log-2')
    })
    await act(async () => {
      rejectRec?.(new Error('network'))
    })
    // Stale reject yangi kontekstga xato yozmaydi; bloklar qayta tanishga tayyor
    expect(states('log-1')).toEqual(['unrecognized', 'unrecognized'])
    expect(screen.queryByText('Qayta urinish')).toBeNull()
  })
})
