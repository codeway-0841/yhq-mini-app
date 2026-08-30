import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import LandingPage from '../../../src/features/landing/LandingPage'
import { useAppStore } from '../../../src/shared/store/useAppStore'

describe('LandingPage component', () => {
  beforeEach(() => {
    localStorage.clear()
    useAppStore.setState({
      settings: {
        theme: 'dark',
        language: 'uz',
        fontStyle: 'default',
        soundEnabled: true,
        vibrationEnabled: true,
        autoAdvance: false,
        noAnimation: false,
      },
    })
  })

  it('renders all key sections correctly in Uzbek by default', () => {
    render(<LandingPage />)

    // Hero headline (universal exam platform)
    expect(screen.getByText(/Imtihonlarga tayyorlanishning/i)).toBeInTheDocument()
    expect(screen.getAllByText(/eng zamonaviy/i).length).toBeGreaterThan(0)

    // Key section titles
    expect(screen.getByText(/Do'stingiz bilan real vaqtda bellashing/i)).toBeInTheDocument()
    expect(screen.getByText(/Nega aynan KIWI bilan tayyorlanish kerak\?/i)).toBeInTheDocument()
    expect(screen.getByText(/Imtihonga tayyorgarlik darajangizni aniqlang/i)).toBeInTheDocument()
    expect(screen.getByText(/Qulay, tezkor va zamonaviy interfeys/i)).toBeInTheDocument()
    expect(screen.getByText(/Barcha asosiy fanlar bitta platformada/i)).toBeInTheDocument()
    expect(screen.getByText(/Oddiy kitoblar vs KIWI/i)).toBeInTheDocument()
    expect(screen.getByText(/O'quvchilarimiz va ustozlar nima deydi\?/i)).toBeInTheDocument()
    expect(screen.getByText(/Oddiy, shaffof va qulay narxlar/i)).toBeInTheDocument()
    expect(screen.getAllByText(/Ko'p beriladigan savollar/i).length).toBeGreaterThan(0)
  })

  it('allows switching language to Russian and updates section texts', () => {
    render(<LandingPage />)

    // Find and click Russian language button in navbar
    const ruBtn = screen.getByRole('button', { name: 'RU' })
    fireEvent.click(ruBtn)

    expect(screen.getByText(/Самый современный и/i)).toBeInTheDocument()
    expect(screen.getByText(/Почему выбирают платформу KIWI\?/i)).toBeInTheDocument()
    expect(screen.getByText(/Часто задаваемые вопросы/i)).toBeInTheDocument()
  })

  it('handles interactive question answering inside the hero multi-subject simulator', () => {
    render(<LandingPage />)

    // Initially explanation is not shown
    expect(screen.queryByText(/Qonuniy \/ Ilmiy tushuntirish:/i)).not.toBeInTheDocument()

    // Click the correct answer ("Он начал внимательно читать новую книгу.")
    const correctOption = screen.getByText(/Он начал внимательно читать новую книгу/i)
    fireEvent.click(correctOption)

    // Explanation should appear
    expect(screen.getByText(/Qonuniy \/ Ilmiy tushuntirish:/i)).toBeInTheDocument()
  })

  it('opens and closes the Android APK download modal', () => {
    render(<LandingPage />)

    // Modal is initially closed
    expect(screen.queryByText(/Android APK Yuklab Olish/i)).not.toBeInTheDocument()

    // Click APK button in navbar or hero
    const apkButtons = screen.getAllByRole('button', { name: /APK/i })
    fireEvent.click(apkButtons[0])

    // Modal should now be open
    expect(screen.getByText(/Android APK Yuklab Olish/i)).toBeInTheDocument()
    expect(screen.getByText(/To'g'ridan-to'g'ri Yuklab Olish \(APK\)/i)).toBeInTheDocument()

    // Click close button
    const closeBtn = screen.getByLabelText(/Close modal/i)
    fireEvent.click(closeBtn)

    // Modal should be closed
    expect(screen.queryByText(/Android APK Yuklab Olish/i)).not.toBeInTheDocument()
  })

  it('calls onOpenAuth callback when clicking web login button', () => {
    const handleAuth = vi.fn()
    render(<LandingPage onOpenAuth={handleAuth} />)

    const webLoginBtns = screen.getAllByRole('button', { name: /Veb-versiyaga kirish|Veb-kirish|Veb-versiya/i })
    expect(webLoginBtns.length).toBeGreaterThan(0)
    fireEvent.click(webLoginBtns[0])

    expect(handleAuth).toHaveBeenCalled()
  })

  it('toggles dark and light theme', () => {
    render(<LandingPage />)

    const themeBtn = screen.getByLabelText(/Toggle Theme/i)
    fireEvent.click(themeBtn)

    expect(useAppStore.getState().settings.theme).toBe('light')
  })
})
