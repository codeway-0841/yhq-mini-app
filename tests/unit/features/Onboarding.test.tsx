import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import Onboarding, { OB_TIMING } from '../../../src/features/onboarding/Onboarding'

/**
 * Onboarding — 13_brilliant-onboarding.mp4 (Brilliant 1:1) oqim testi.
 */
describe('Onboarding (13_brilliant-onboarding.mp4 1:1)', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('to\'liq 8 ta qadamdan o\'tib onDone chaqiriladi', async () => {
    const handleDone = vi.fn()
    const { container } = render(<Onboarding onDone={handleDone} />)

    // 0. Welcome Hero
    expect(container.querySelector('main.first-launch-screen')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'The best way to learn math and computer science',
    )
    expect(
      screen.getAllByText(
        'Effective, hands-on learning, while learning at your level with guided bite-sized lessons.',
      )[0],
    ).toBeInTheDocument()
    expect(screen.getByText('Log in')).toBeInTheDocument()

    // Continue bosiladi
    fireEvent.click(screen.getByRole('button', { name: /Continue|Davom etish/i }))

    // 1. Persona
    expect(await screen.findByText('Which describes you best?')).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /Student/i })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /Professional/i })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /Teacher/i })).toBeInTheDocument()

    // Bitta persona tanlanadi
    fireEvent.click(screen.getByRole('radio', { name: /Student/i }))
    fireEvent.click(screen.getByRole('button', { name: /Continue|Davom etish/i }))

    // 2. Interests
    expect(await screen.findByText('Which are you most interested in?')).toBeInTheDocument()
    expect(screen.getByText('Gain new skills to progress at work')).toBeInTheDocument()
    expect(screen.getByText('Explore new topics')).toBeInTheDocument()
    expect(screen.getByText('Refresh my math foundations')).toBeInTheDocument()

    // Bitta qiziqish tanlanadi
    fireEvent.click(screen.getByText('Explore new topics'))
    fireEvent.click(screen.getByRole('button', { name: /Continue|Davom etish/i }))

    // 3. Interstitial Place ("You're in the right place")
    expect(await screen.findByText("You're in the right place")).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Continue|Davom etish/i }))

    // 4. Daily Goal ("What's your daily learning goal?")
    expect(await screen.findByText("What's your daily learning goal?")).toBeInTheDocument()
    expect(screen.getByText('Regular')).toBeInTheDocument()
    expect(screen.getByText('10 min / day')).toBeInTheDocument()
    fireEvent.click(screen.getByText('Regular'))
    fireEvent.click(screen.getByRole('button', { name: /Continue|Davom etish/i }))

    // 5. Reminders ("Reach your daily goal with reminders")
    expect(await screen.findByRole('heading', { name: /Reach your daily goal/i })).toBeInTheDocument()
    expect(screen.getByText('Allow notifications')).toBeInTheDocument()
    expect(screen.getByText('No thanks')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Allow notifications/i }))

    // 6. Level Comfort ("What is your programming comfort level?")
    expect(await screen.findByRole('heading', { name: /What is your programming/i })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /Beginner/i })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /Novice/i })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /Intermediate/i })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /Advanced/i })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('radio', { name: /Novice/i }))
    fireEvent.click(screen.getByRole('button', { name: /Continue|Davom etish/i }))

    // 7. Interstitial Efficacy ("Learn 6x more effectively")
    expect(await screen.findByText(/Learn 6x more effectively/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Continue|Davom etish/i }))

    // 8. Testimonial ("You're on your way!")
    expect(await screen.findByText("You're on your way!")).toBeInTheDocument()
    expect(screen.getByText(/— Bob V\./i)).toBeInTheDocument()

    // Yakuniy Continue bosiladi
    fireEvent.click(screen.getByRole('button', { name: /Continue|Davom etish/i }))
    expect(handleDone).toHaveBeenCalledTimes(1)
  })

  it('orqaga qaytish tugmasi (<) oldingi bosqichga qaytaradi', async () => {
    render(<Onboarding onDone={vi.fn()} />)

    // Welcome -> Step 1
    fireEvent.click(screen.getByRole('button', { name: /Continue|Davom etish/i }))
    expect(await screen.findByText('Which describes you best?')).toBeInTheDocument()

    // Orqaga bosiladi (<)
    const backBtn = screen.getByRole('button', { name: /Orqaga|Back/i })
    fireEvent.click(backBtn)

    // Welcome ekranga qaytadi
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'The best way to learn math and computer science',
    )
  })

  it('Log in tugmasi to\'g\'ridan-to\'g\'ri onDone chaqiradi', () => {
    const handleDone = vi.fn()
    render(<Onboarding onDone={handleDone} />)

    fireEvent.click(screen.getByText('Log in'))
    expect(handleDone).toHaveBeenCalledTimes(1)
  })

  it('App gate: onboarding auth\'dan OLDIN turadi', () => {
    const app = readFileSync(resolve(process.cwd(), 'src/App.tsx'), 'utf8')
    const obIdx = app.indexOf('} else if (!onboarded) {')
    const authIdx = app.indexOf('} else if (!isAuthed) {')
    expect(obIdx).toBeGreaterThan(-1)
    expect(authIdx).toBeGreaterThan(obIdx)
    expect(app).toContain('<Onboarding onDone={finishOnboarding} authed={isAuthed} />')
  })

  it('taymline konstantalari eksport qilingan', () => {
    expect(OB_TIMING.slide).toBe(300)
    expect(OB_TIMING.reveal).toBe(250)
  })
})
