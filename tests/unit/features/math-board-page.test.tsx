/**
 * Math Board — sahifa render testi (Faza 3–4).
 *
 * `mathlive` web-component mock'lanadi (jsdom'da haqiqiy upgrade shart emas).
 *
 * MUHIM (jsdom cheklovi): sahifada KaTeX (`<math>` MathML) va `<math-field>`
 * custom element bor — jsdom `getComputedStyle` bunday elementlarda crash
 * beradi (`style-rules.js` forEach null). Shuning uchun accessible-name
 * hisoblaydigan query'lar (`getByRole(..., {name})`) ISHLATILMAYDI; o'rniga
 * `getByText` (matn mosligi, nom hisoblamaydi) va `querySelector` ishlatiladi.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import MathBoardPage from '../../../src/features/math-board/MathBoardPage'
import { useBoardSession } from '../../../src/features/math-board/hooks/useBoardSession'
import { useAppStore } from '../../../src/shared/store/useAppStore'
import { api } from '../../../src/shared/api'
import { STEP_DEBOUNCE_MS } from '../../../src/features/math-board/hooks/useStepCheck'

vi.mock('mathlive', () => ({}))

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

beforeEach(() => {
  mockNavigate.mockClear()
  useAppStore.setState({ settings: { ...useAppStore.getState().settings, language: 'uz' } })
  useBoardSession.getState().reset()
  useBoardSession.setState({ problemId: 'log-1' })
})

function renderPage() {
  return render(
    <MemoryRouter>
      <MathBoardPage />
    </MemoryRouter>,
  )
}

describe('MathBoardPage', () => {
  it('sarlavha, masala chiziqlari va kiritish blokini render qiladi', () => {
    const { container } = renderPage()
    expect(screen.getByText('Matematik doska')).toBeTruthy()
    expect(screen.getByText('Keyingi qadamni yozing')).toBeTruthy()
    expect(screen.getByText('Qabul qilish').closest('button')).toBeTruthy()
    expect(container.querySelector('button[aria-label="Oxirgisini o\'chirish"]')).toBeTruthy()
  })

  it('masala tanlash store ni almashtiradi va qadamlarni tozalaydi', () => {
    useBoardSession.getState().acceptStep('a', 'a', { status: 'correct', detail: 'identical_exact' }, false)
    renderPage()
    const picker = screen.getByRole('group', { name: 'Masala' })
    const chips = picker.querySelectorAll('button')
    expect(chips.length).toBeGreaterThan(1)
    fireEvent.click(chips[1])
    expect(useBoardSession.getState().steps).toHaveLength(0)
  })

  it('back tugmasi /rejimlar ga qaytaradi', () => {
    const { container } = renderPage()
    const back = container.querySelector('button[aria-label="Orqaga"]')
    expect(back).toBeTruthy()
    fireEvent.click(back as Element)
    expect(mockNavigate).toHaveBeenCalledWith('/rejimlar')
  })

  it("bo'sh holatda Qabul o'chiq (noto'g'ri qadam qabul qilinmaydi)", () => {
    renderPage()
    const accept = screen.getByText('Qabul qilish').closest('button')
    expect(accept?.hasAttribute('disabled')).toBe(true)
  })
})

describe('MathBoardPage completion (Faza 6: solve → next → solution)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  function solveLog1(): void {
    const mf = document.querySelector('math-field') as unknown as { value: string }
    mf.value = 'log(2,32)=5'
    fireEvent.input(mf as unknown as Element)
    act(() => {
      vi.advanceTimersByTime(STEP_DEBOUNCE_MS + 50)
    })
    fireEvent.click(screen.getByText('Qabul qilish'))
  }

  it('togri qadam → solved banner + confetti', () => {
    renderPage()
    solveLog1()
    expect(screen.getByText('Yechildi!')).toBeTruthy()
    expect(screen.getByText('Keyingi masala')).toBeTruthy()
    expect(screen.getByText("Yechimni ko'rish")).toBeTruthy()
  })

  it('Yechimni korish — faqat accepted steps', () => {
    renderPage()
    solveLog1()
    fireEvent.click(screen.getByText("Yechimni ko'rish"))
    // Ko'rinadigan sarlavha + sr-only a11y label
    expect(screen.getAllByText('Qabul qilingan yechim')).toHaveLength(2)
  })

  it('Keyingi masala — katalog tartibida', () => {
    renderPage()
    solveLog1()
    fireEvent.click(screen.getByText('Keyingi masala'))
    expect(useBoardSession.getState().problemId).toBe('log-2')
    expect(useBoardSession.getState().solved).toBe(false)
  })

  it('notogri qadam — qizil status + Qabul o‘chiq + lokal hint', () => {
    renderPage()
    const mf = document.querySelector('math-field') as unknown as { value: string }
    mf.value = '2+2=5'
    fireEvent.input(mf as unknown as Element)
    act(() => {
      vi.advanceTimersByTime(STEP_DEBOUNCE_MS + 50)
    })
    expect(screen.getByText("Noto'g'ri")).toBeTruthy()
    const accept = screen.getByText('Qabul qilish').closest('button')
    expect(accept?.hasAttribute('disabled')).toBe(true)
    expect(screen.getByText(/Arifmetikani qayta tekshiring/)).toBeTruthy()
  })
})

describe('MathBoardPage chizish rejimi (Faza 3-4)', () => {
  it('Yozish/Chizish tugmalar bor; FAB menyuda Tanish chizmasiz o‘chiq', () => {
    const { container } = renderPage()
    expect(screen.getByText('Yozish')).toBeTruthy()
    fireEvent.click(screen.getByText('Chizish'))
    expect(screen.getByText('Barmoq/stylus bilan bitta ifodani yozing')).toBeTruthy()
    const fab = container.querySelector('button[aria-label="Amallar"]')
    expect(fab).toBeTruthy()
    fireEvent.click(fab as Element)
    const items = container.querySelectorAll('[role="menuitem"]')
    const names = [...items].map((el) => el.textContent)
    expect(names).toContain('Tanish')
    expect(names).toContain('Yordam')
    expect(items[0].hasAttribute('disabled')).toBe(true)
  })

  it('FAB Yordam typed tabga o‘tkazadi', () => {
    const { container } = renderPage()
    fireEvent.click(screen.getByText('Chizish'))
    const fab = container.querySelector('button[aria-label="Amallar"]')
    fireEvent.click(fab as Element)
    const items = container.querySelectorAll('[role="menuitem"]')
    fireEvent.click(items[1])
    expect(screen.getByText('Keyingi qadamni yozing')).toBeTruthy()
  })
})

describe('MathBoardPage stale hint (P2-D, deferred-promise)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  function typeMath(text: string): void {
    const mf = document.querySelector('math-field') as unknown as { value: string }
    mf.value = text
    fireEvent.input(mf as unknown as Element)
  }

  it('P0-D: undo paytida kelgan eski hint javobi chiqmaydi', async () => {
    // Accepted qadam bor → undo tugmasi faol
    useBoardSession.getState().acceptStep('x=1', 'x=1', { status: 'correct', detail: 'identical_exact' }, false)
    let resolveHint: ((v: { ok: true; question: string }) => void) | null = null
    const hintSpy = vi.spyOn(api, 'getBoardHint').mockImplementation(
      () => new Promise((resolve) => {
        resolveHint = resolve as (v: { ok: true; question: string }) => void
      }),
    )
    renderPage()

    typeMath('x+')
    act(() => {
      vi.advanceTimersByTime(STEP_DEBOUNCE_MS + 50)
    })
    typeMath('y+')
    act(() => {
      vi.advanceTimersByTime(STEP_DEBOUNCE_MS + 50)
    })
    fireEvent.click(screen.getByText("AI'dan so'rash"))
    expect(hintSpy).toHaveBeenCalledTimes(1)

    // So'rov havoda — UNDO (acceptedStepsRevision bump)
    const undoBtn = document.querySelector('button[aria-label="Oxirgisini o\'chirish"]')
    expect(undoBtn).toBeTruthy()
    fireEvent.click(undoBtn as Element)

    await act(async () => {
      resolveHint?.({ ok: true, question: 'Eski savol?' })
    })
    expect(screen.queryByText('Eski savol?')).toBeNull()
  })

  it('kiritish almashgach kelgan eski hint javobi chiqmaydi', async () => {
    let resolveHint: ((v: { ok: true; question: string }) => void) | null = null
    const hintSpy = vi.spyOn(api, 'getBoardHint').mockImplementation(
      () => new Promise((resolve) => {
        resolveHint = resolve as (v: { ok: true; question: string }) => void
      }),
    )
    renderPage()

    // Ikkita ketma-ket syntax xato → AI tugma (count 2)
    typeMath('x+')
    act(() => {
      vi.advanceTimersByTime(STEP_DEBOUNCE_MS + 50)
    })
    typeMath('y+')
    act(() => {
      vi.advanceTimersByTime(STEP_DEBOUNCE_MS + 50)
    })
    fireEvent.click(screen.getByText("AI'dan so'rash"))
    expect(screen.getByText("AI o'ylamoqda…")).toBeTruthy()
    expect(hintSpy).toHaveBeenCalledTimes(1)

    // So'rov havoda — kiritish almashadi (yangi xato)
    typeMath('q+')
    act(() => {
      vi.advanceTimersByTime(STEP_DEBOUNCE_MS + 50)
    })

    // Eski so'rov muvaffaqiyat bilan kelsa ham — stale, savol chiqmaydi
    await act(async () => {
      resolveHint?.({ ok: true, question: 'Eski savol?' })
    })
    expect(screen.queryByText('Eski savol?')).toBeNull()
  })

  it('bir xil kontekstda reject → deterministik fallback chiqadi (over-guard yo‘q)', async () => {
    vi.spyOn(api, 'getBoardHint').mockRejectedValue(new Error('network'))
    renderPage()

    typeMath('x+')
    act(() => {
      vi.advanceTimersByTime(STEP_DEBOUNCE_MS + 50)
    })
    typeMath('y+')
    act(() => {
      vi.advanceTimersByTime(STEP_DEBOUNCE_MS + 50)
    })
    fireEvent.click(screen.getByText("AI'dan so'rash"))

    await act(async () => {})
    // Kontekst o'zgarmagan — fallback ko'rinadi (guard faqat stale'ni yutadi)
    expect(screen.queryByText(/kichikroq/)).not.toBeNull()
  })

  it('stale reject (masala almashgan) — shared isCurrent guard orqali yutiladi', async () => {
    // Kuzatiladigan UI farqi: guard bo'lmasa aiFailed=true qolib, KEYINGI
    // xatoda (effect tozalamaguncha) fallback miltillaydi. Bu yerda kontrakt:
    // stale reject'dan keyin yangi masalada toza holat.
    let rejectHint: ((e: Error) => void) | null = null
    vi.spyOn(api, 'getBoardHint').mockImplementation(
      () => new Promise((_, reject) => {
        rejectHint = reject as (e: Error) => void
      }),
    )
    renderPage()

    typeMath('x+')
    act(() => {
      vi.advanceTimersByTime(STEP_DEBOUNCE_MS + 50)
    })
    typeMath('y+')
    act(() => {
      vi.advanceTimersByTime(STEP_DEBOUNCE_MS + 50)
    })
    fireEvent.click(screen.getByText("AI'dan so'rash"))

    const picker = screen.getByRole('group', { name: 'Masala' })
    fireEvent.click(picker.querySelectorAll('button')[1])

    await act(async () => {
      rejectHint?.(new Error('network'))
    })
    act(() => {
      vi.advanceTimersByTime(STEP_DEBOUNCE_MS + 50)
    })
    // Yangi masala bo'sh — hech qanday xato/fallback/savol yo'q
    expect(screen.queryByText(/kichikroq/)).toBeNull()
    expect(screen.queryByText('Qayta urinish')).toBeNull()
  })
})
