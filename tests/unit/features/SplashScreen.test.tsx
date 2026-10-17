import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import SplashScreen from '../../../src/features/onboarding/SplashScreen'
import LaunchExitOverlay from '../../../src/features/onboarding/LaunchExitOverlay'
import { notifyLaunchDismissed, onLaunchDismissed } from '../../../src/features/onboarding/launch-exit'

type SplashWindow = Window & { __kivviSplashStart?: number }

const styleOf = () => screen.getByRole('status', { name: 'KIVVI yuklanmoqda' }).getAttribute('style') ?? ''
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

afterEach(() => {
  delete (window as SplashWindow).__kivviSplashStart
})

describe('SplashScreen component', () => {
  it('katak (app icon) + belgi + matematik to\'r tuzilmasini chizadi', () => {
    render(<SplashScreen />)

    const status = screen.getByRole('status', { name: 'KIVVI yuklanmoqda' })
    const img = screen.getByAltText('KIVVI')

    expect(status).toHaveClass('splash-screen')
    // Matematik to'r: canvas foni + katak ichi
    expect(status.querySelector('.splash-grid')).toBeInTheDocument()
    expect(status.querySelector('.splash-cell-grid')).toBeInTheDocument()
    // Katak — kattalashib butun ekranni egallaydigan qatlam
    expect(img.closest('div')).toHaveClass('splash-cell')
    expect(img).toHaveClass('splash-mark')
    expect(img.closest('picture')?.querySelector('source')).toHaveAttribute('srcset', '/images/splash-mark.webp')
    // Referensda progress bar ham, matn ham yo'q — faqat belgi
    expect(screen.queryByText('Yuklanmoqda...')).not.toBeInTheDocument()
  })

  it('app.html boshidan o\'tgan vaqtga taymlineni siljitadi (uzluksiz ochilish)', () => {
    ;(window as SplashWindow).__kivviSplashStart = performance.now() - 2000
    render(<SplashScreen />)

    expect(styleOf()).toContain('--splash-shift')
    expect(styleOf()).toMatch(/--splash-shift:\s*-900ms/)
  })

  it('app.html bosqichi bo\'lmasa animatsiya 0 dan boshlanadi', () => {
    render(<SplashScreen />)
    expect(styleOf()).toMatch(/--splash-shift:\s*0ms/)
  })

  it('unmount bo\'lganda chiqish (cross-fade) signalini beradi', async () => {
    const seen = vi.fn()
    const off = onLaunchDismissed(seen)
    const { unmount } = render(<SplashScreen />)
    await wait(150) // bir kadrlik almashishda signal berilmaydi
    unmount()
    expect(seen).toHaveBeenCalledTimes(1)
    off()
  })
})

describe('LaunchExitOverlay', () => {
  it('signal kelganda splash\'ning so\'nayotgan nusxasini chizadi', () => {
    const { container } = render(<LaunchExitOverlay />)
    expect(container.querySelector('.splash-exit')).toBeNull()

    act(() => { notifyLaunchDismissed() })

    expect(container.querySelector('.splash-exit')).toBeInTheDocument()
    expect(screen.getByAltText('KIVVI')).toBeInTheDocument()
  })
})
