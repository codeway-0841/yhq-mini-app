import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import Onboarding, { OB_TIMING } from '../../../src/features/onboarding/Onboarding'
import { SyncScreen } from '../../../src/features/onboarding/components/SyncScreen'
import { useSubjectStore } from '../../../src/shared/store/useSubjectStore'
import { SUBJECTS } from '../../../src/shared/config/subjects'

/**
 * Onboarding — IMG_0928.MOV bilan 1:1 oqim qo'riqchisi.
 * Testlarda `isUnitTest` tufayli animatsiya kechikishlari 0 ga tushadi,
 * lekin BOSQICHLAR ketma-ketligi va taymline konstantalari tekshiriladi.
 */
describe('Onboarding (IMG_0928.MOV 1:1)', () => {
  beforeEach(() => {
    localStorage.clear()
    useSubjectStore.setState({ subjectId: 'yhq' })
  })

  it('welcome → sync → fan → makon → onDone', async () => {
    const handleDone = vi.fn()
    const { container } = render(<Onboarding onDone={handleDone} />)

    // 1. Welcome
    expect(container.querySelector('main.first-launch-screen')).toBeInTheDocument()
    expect(
      screen
        .getByAltText('KIVVI')
        .closest('picture')
        ?.querySelector('source'),
    ).toHaveAttribute('srcset', '/images/splash-mark.webp')
    expect(screen.getByText(/Xush/i)).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/Barchasi oson/i)
    expect(screen.getByText('AI tahlil va maslahatchi')).toBeInTheDocument()
    expect(screen.getByText('Raqobat va o\'sish')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Boshlash/i }))

    // 2. Fan tanlash — to'g'ridan-to'g'ri (loading endi OXIRIDA)
    expect(await screen.findByText('Fanni tanlang')).toBeInTheDocument()
    expect(screen.queryByText(/tekshirilmoqda/i)).toBeNull()
    const radios = screen.getAllByRole('radio')
    expect(radios.length).toBeGreaterThan(3)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /Yo'l harakati qoidalari/i })).toHaveAttribute(
      'aria-checked',
      'true',
    )

    // Fan ekranda almashtiriladi (modal ochilmaydi)
    fireEvent.click(screen.getByRole('radio', { name: 'Matematika' }))
    expect(useSubjectStore.getState().subjectId).toBe('matematika')
    expect(screen.getByRole('radio', { name: 'Matematika' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Davom etish/i }))

    // 4. Telegram orqali kirish (3-qadam)
    expect(await screen.findByRole('heading', { name: 'Telegram orqali kirish' })).toBeInTheDocument()
    expect(screen.getByText('Ulanmagan')).toBeInTheDocument()

    // 5. Boshqa usul → LOADING (oxirgi qadam) → onboarding yakunlanadi
    fireEvent.click(screen.getByRole('button', { name: /Boshqa usul bilan kirish/i }))
    expect(await screen.findByText(/tekshirilmoqda/i)).toBeInTheDocument()
    expect(screen.getByRole('status')).toBeInTheDocument()

    await waitFor(() => expect(handleDone).toHaveBeenCalledTimes(1))
  })

  it('ulangan foydalanuvchida 3-qadam "Boshlash" CTA bilan tugaydi', async () => {
    const handleDone = vi.fn()
    render(<Onboarding onDone={handleDone} authed />)

    fireEvent.click(screen.getByRole('button', { name: /Boshlash/i }))
    await screen.findByText('Fanni tanlang')
    fireEvent.click(screen.getByRole('button', { name: /Davom etish/i }))

    expect(await screen.findByRole('heading', { name: 'Telegram orqali kirish' })).toBeInTheDocument()
    expect(screen.getByText('Ulangan')).toBeInTheDocument()
    // Login paneli ko'rsatilmaydi — faqat yakuniy CTA
    expect(screen.queryByRole('button', { name: /Boshqa usul bilan kirish/i })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: /Boshlash/i }))
    await waitFor(() => expect(handleDone).toHaveBeenCalledTimes(1))
  })

  it('fanga qaytish: fan ekranidan welcome\'ga orqaga', async () => {
    const handleDone = vi.fn()
    render(<Onboarding onDone={handleDone} />)

    fireEvent.click(screen.getByRole('button', { name: /Boshlash/i }))
    expect(await screen.findByText('Fanni tanlang')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Orqaga/i }))
    await waitFor(() => expect(screen.getByText(/Xush/i)).toBeInTheDocument())
  })

  it('fan tanlovi modal emas — ekrandagi ro\'yxatdan tanlanadi', async () => {
    render(<Onboarding onDone={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /Boshlash/i }))
    await screen.findByText('Fanni tanlang')

    // Modal/sheet umuman ochilmaydi
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    // Barcha fanlar bir ekranda; "Tez kunda" (available: false) — disabled
    const radios = screen.getAllByRole('radio') as HTMLButtonElement[]
    expect(radios.length).toBe(SUBJECTS.length)
    expect(radios.filter((r) => r.disabled).length).toBe(
      SUBJECTS.filter((s) => !s.available).length,
    )

    fireEvent.click(screen.getByRole('radio', { name: 'Fizika' }))
    expect(useSubjectStore.getState().subjectId).toBe('fizika')
    expect(screen.getByRole('radio', { name: 'Fizika' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('radio', { name: /Yo'l harakati qoidalari/i })).toHaveAttribute(
      'aria-checked',
      'false',
    )
    // Tanlov mobil ro'yxatda, sahifa scroll'i emas — ichki scroll konteyneri
    const group = screen.getByRole('radiogroup')
    expect(group.className).toContain('overflow-y-auto')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('video taymline konstantalari muzlatilgan (regressiya qo\'riqchisi)', () => {
    // IMG_0928.MOV: chiqish 12.15→12.45 (300ms), sync 13.0→18.6 (5400ms),
    // CTA spinneri ≈420ms, welcome stagger 9.70→10.95.
    expect(OB_TIMING.exit).toBe(300)
    expect(OB_TIMING.syncHold).toBe(5400)
    expect(OB_TIMING.finish).toBe(120)
    expect(OB_TIMING.welcome.logo).toBe(0)
    expect(OB_TIMING.welcome.title).toBeGreaterThan(200)
    expect(OB_TIMING.welcome.cardStep).toBeGreaterThan(80)
    expect(OB_TIMING.welcome.button).toBeGreaterThan(OB_TIMING.welcome.cardFirst)
  })

  it('App gate: onboarding auth\'dan OLDIN turadi (3-qadam = Telegram login)', () => {
    const app = readFileSync(resolve(process.cwd(), 'src/App.tsx'), 'utf8')
    const obIdx = app.indexOf('} else if (!onboarded) {')
    const authIdx = app.indexOf('} else if (!isAuthed) {')
    expect(obIdx).toBeGreaterThan(-1)
    expect(authIdx).toBeGreaterThan(obIdx)
    expect(app).toContain('<Onboarding onDone={finishOnboarding} authed={isAuthed} />')
  })

  it('CSS animatsiya qatlami mavjud (blur-in / blur-out / pill / spinner)', () => {
    const css = readFileSync(resolve(process.cwd(), 'src/index.css'), 'utf8')
    expect(css).toContain('@keyframes ob-reveal')
    expect(css).toContain('@keyframes ob-hide')
    expect(css).toContain('.ob-reveal')
    expect(css).toContain(".ob-stage[data-phase='exit'] .ob-reveal")
    expect(css).toContain('@keyframes ob-spin')
    expect(css).toContain(".ob-pill i[data-active='true']")
    expect(css).toContain('prefers-reduced-motion')
  })
})

describe('SyncScreen', () => {
  it('spinner, sarlavha va izohni chizadi', () => {
    render(<SyncScreen instant />)
    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(screen.getByText(/tekshirilmoqda/i)).toBeInTheDocument()
    expect(screen.getByText(/sinxronlanmoqda/i)).toBeInTheDocument()
  })
})
