/**
 * Math Board — HintCard KaTeX testi (skrinshot bugfix).
 *
 * AI savolidagi `$...$` LaTeX xom ko'rinmasligi, render bo'lishi shart.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import HintCard from '../../../src/features/math-board/components/HintCard'

const base = {
  title: 'Maslahat',
  offerAi: false,
  askingAi: false,
  aiQuestion: null as string | null,
  aiTitle: 'AI savoli',
  askLabel: 'Ask',
  askingLabel: 'Asking',
  fallback: 'Fallback',
  showFallback: false,
  onAskAi: () => {},
}

describe('HintCard KaTeX', () => {
  it('aiQuestion dagi $...$ render bo‘ladi (xom $ yo‘q)', () => {
    const { container } = render(
      <HintCard
        {...base}
        localHint={null}
        aiQuestion="Ta'rifga ko'ra, $10$ ni qanday darajaga oshirganda $1000$ hosil bo'ladi?"
      />,
    )
    expect(container.querySelector('.katex')).toBeTruthy()
    // Xom dollar matni ko'rinmasligi kerak
    expect(screen.queryByText(/\$10\$/)).toBeNull()
  })

  it('lokal hint va AI tugma ishlaydi', () => {
    const onAskAi = vi.fn()
    render(
      <HintCard
        {...base}
        localHint="Arifmetikani tekshiring."
        offerAi
        onAskAi={onAskAi}
      />,
    )
    expect(screen.getByText('Arifmetikani tekshiring.')).toBeTruthy()
    fireEvent.click(screen.getByText('Ask'))
    expect(onAskAi).toHaveBeenCalledTimes(1)
  })

  it('hech narsa yo‘q bo‘lsa render bo‘lmaydi', () => {
    const { container } = render(<HintCard {...base} localHint={null} />)
    expect(container.firstChild).toBeNull()
  })
})
