/**
 * Math Board — RecognitionReviewSheet (Faza 4).
 * Raqamlangan bloklar, tahrir, muqobil, failed qator, onUse.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import RecognitionReviewSheet from '../../../src/features/math-board/components/RecognitionReviewSheet'

vi.mock('mathlive', () => ({}))

const base = {
  title: 'Natija',
  failedLabel: 'Tanilmadi',
  useLabel: 'Ishlatish',
  closeLabel: 'Yopish',
  onClose: () => {},
  onUse: () => {},
}

const blocks = [
  { id: 'b1', order: 0, latex: 'x=1', alternatives: ['x = 1'], confidence: 0.9, failed: false },
  { id: 'b2', order: 1, latex: '', alternatives: [], confidence: 0, failed: true },
]

describe('RecognitionReviewSheet', () => {
  it('bloklar raqami + failed qator', () => {
    render(<RecognitionReviewSheet {...base} blocks={blocks} onUse={() => {}} />)
    // Ko'rinadigan sarlavha + sr-only a11y label (DialogOverlay labelId)
    expect(screen.getAllByText('Natija')).toHaveLength(2)
    expect(screen.getByText('Tanilmadi')).toBeTruthy()
    // Muqobil chip
    expect(screen.getByText('x = 1')).toBeTruthy()
  })

  it('onUse tahrirlangan latex bilan', () => {
    const onUse = vi.fn()
    render(
      <RecognitionReviewSheet {...base} blocks={[blocks[0]]} onUse={onUse} />,
    )
    // Sheet portal'da — screen query (container emas)
    fireEvent.click(screen.getByText('Ishlatish'))
    expect(onUse).toHaveBeenCalledWith('b1', 'x=1')
  })

  it('muqobil tanlash maydonni almashtiradi', () => {
    const onUse = vi.fn()
    render(
      <RecognitionReviewSheet {...base} blocks={[blocks[0]]} onUse={onUse} />,
    )
    fireEvent.click(screen.getByText('x = 1'))
    fireEvent.click(screen.getByText('Ishlatish'))
    expect(onUse).toHaveBeenCalledWith('b1', 'x = 1')
  })
})
