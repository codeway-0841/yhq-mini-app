import React from 'react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import TestToolsHub from '../../../src/features/test/components/TestToolsHub'
import TestCalculatorSheet from '../../../src/features/test/components/TestCalculatorSheet'
import TestFormulasSheet from '../../../src/features/test/components/TestFormulasSheet'

describe('TestToolsHub', () => {
  const defaultProps = {
    onOpenDrawing: vi.fn(),
    onOpenScratchpad: vi.fn(),
    onOpenCalculator: vi.fn(),
    onOpenFormulas: vi.fn(),
    onToggleSave: vi.fn(),
    isSaved: false,
    hasStrokes: false,
    drawingsVisible: true,
    onToggleVisibility: vi.fn(),
    language: 'uz' as const,
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders drawing trigger and opens drawing on click', () => {
    render(<TestToolsHub {...defaultProps} />)
    const drawBtn = screen.getByRole('button', { name: 'Chizib yechish' })
    expect(drawBtn).toBeInTheDocument()

    fireEvent.click(drawBtn)
    expect(defaultProps.onOpenDrawing).toHaveBeenCalledTimes(1)
  })

  it('opens menu and triggers calculator and formulas', () => {
    render(<TestToolsHub {...defaultProps} hasStrokes={true} />)
    const menuTrigger = screen.getByRole('button', { name: 'Yordamchilar' })
    expect(menuTrigger).toBeInTheDocument()

    // Menyu ochish
    fireEvent.click(menuTrigger)
    expect(screen.getByRole('menu', { name: 'Yordamchilar' })).toBeInTheDocument()

    // Kalkulyator
    const calcBtn = screen.getByRole('menuitem', { name: /Kalkulyator/ })
    fireEvent.click(calcBtn)
    expect(defaultProps.onOpenCalculator).toHaveBeenCalledTimes(1)

    // Qayta ochish va Formulalar
    fireEvent.click(menuTrigger)
    const formBtn = screen.getByRole('menuitem', { name: /Formulalar/ })
    fireEvent.click(formBtn)
    expect(defaultProps.onOpenFormulas).toHaveBeenCalledTimes(1)

    // Qayta ochish va Qoralama
    fireEvent.click(menuTrigger)
    const scratchBtn = screen.getByRole('menuitem', { name: /Qoralama/ })
    fireEvent.click(scratchBtn)
    expect(defaultProps.onOpenScratchpad).toHaveBeenCalledTimes(1)

    // Ko'z (chizmalarni yashirish)
    fireEvent.click(menuTrigger)
    const eyeBtn = screen.getByRole('menuitem', { name: /Chizmalarni yashirish/ })
    fireEvent.click(eyeBtn)
    expect(defaultProps.onToggleVisibility).toHaveBeenCalledTimes(1)
  })

  it('applies dynamic theme accent styling to buttons and speed dial badges', () => {
    render(<TestToolsHub {...defaultProps} />)
    const drawBtn = screen.getByRole('button', { name: 'Chizib yechish' })
    expect(drawBtn.className).toContain('bg-pprimary')
    expect(drawBtn.className).toContain('text-ponprimary')

    const menuTrigger = screen.getByRole('button', { name: 'Yordamchilar' })
    expect(menuTrigger.className).toContain('text-pprimary')

    // Menyu ochilganda
    fireEvent.click(menuTrigger)
    expect(menuTrigger.className).toContain('bg-pprimary')
    expect(menuTrigger.className).toContain('text-ponprimary')

    // Speed dial badgelarida ham pprimary ishlatiladi
    const formulasItem = screen.getByRole('menuitem', { name: /Formulalar/ })
    const badge = formulasItem.querySelector('span.text-pprimary')
    expect(badge).not.toBeNull()
  })
})

describe('TestCalculatorSheet', () => {
  it('performs calculations via UI buttons', () => {
    render(
      <TestCalculatorSheet
        open={true}
        onClose={vi.fn()}
        language="uz"
      />
    )

    expect(screen.getByText('Kalkulyator')).toBeInTheDocument()

    // 8 × 7 = 56
    fireEvent.click(screen.getByRole('button', { name: '8' }))
    fireEvent.click(screen.getByRole('button', { name: '×' }))
    fireEvent.click(screen.getByRole('button', { name: '7' }))
    fireEvent.click(screen.getByRole('button', { name: '=' }))

    expect(screen.getByText('56')).toBeInTheDocument()
  })

  it('shows disabled message in official exam mode', () => {
    render(
      <TestCalculatorSheet
        open={true}
        onClose={vi.fn()}
        language="uz"
        disabledReason="Rasmiy imtihon rejimida kalkulyatordan foydalanish taqiqlangan."
      />
    )

    expect(screen.getAllByText(/kalkulyatordan foydalanish taqiqlangan/i)[0]).toBeInTheDocument()
  })
})

describe('TestFormulasSheet', () => {
  it('renders formulas and supports search', () => {
    render(
      <TestFormulasSheet
        open={true}
        onClose={vi.fn()}
        language="uz"
        subjectId="matematika"
      />
    )

    expect(screen.getByText('Formulalar va qoidalar')).toBeInTheDocument()
    // Kvadrat tenglama formulasi ko'rinishi kerak
    expect(screen.getByText('Kvadrat tenglama')).toBeInTheDocument()

    // Qidiruv
    const searchInput = screen.getByPlaceholderText('Formulalarni qidirish...')
    fireEvent.change(searchInput, { target: { value: 'Pifagor' } })
    expect(screen.getByText('Pifagor teoremasi')).toBeInTheDocument()
  })
})
