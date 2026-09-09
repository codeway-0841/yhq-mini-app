/**
 * QuestionStrip — kichik total'larda to'liq render, marafon kabi katta
 * total'larda (5000+) faqat joriy savol atrofida oyna (DOM portlamasligi
 * uchun); indekslar absolut qoladi.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import QuestionStrip from '../../../src/features/test/QuestionStrip'

describe('QuestionStrip windowing', () => {
  it('kichik totalda barcha tugmalarni ko\'rsatadi', () => {
    render(<QuestionStrip total={20} current={3} answers={Array(20).fill(null)} onSelect={vi.fn()} />)
    expect(screen.getAllByRole('button')).toHaveLength(20)
    expect(screen.getByRole('button', { name: '1' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '20' })).toBeInTheDocument()
  })

  it('katta totalda faqat oyna atrofidagi tugmalarni render qiladi', () => {
    const total = 5000
    render(<QuestionStrip total={total} current={2500} answers={Array(total).fill(null)} onSelect={vi.fn()} />)
    const buttons = screen.getAllByRole('button')
    expect(buttons.length).toBeLessThanOrEqual(61)
    // Oyna joriy savolni o'rtada ushlaydi
    expect(screen.getByRole('button', { name: '2501' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '1' })).toBeNull()
    expect(screen.queryByRole('button', { name: String(total) })).toBeNull()
  })

  it('oyna boshi/oxirida absolut indeksni saqlaydi', () => {
    const onSelect = vi.fn()
    const view = render(<QuestionStrip total={5000} current={0} answers={Array(5000).fill(null)} onSelect={onSelect} />)
    // current=0 → oyna 0..60, birinchi tugma "1"
    fireEvent.click(screen.getByRole('button', { name: '61' }))
    expect(onSelect).toHaveBeenCalledWith(60)
    view.unmount()

    const onSelect2 = vi.fn()
    render(<QuestionStrip total={5000} current={4999} answers={Array(5000).fill(null)} onSelect={onSelect2} />)
    // current=total-1 → oyna oxirga yopishgan; oxirgi tugma "5000"
    fireEvent.click(screen.getAllByRole('button').at(-1)!)
    expect(onSelect2).toHaveBeenCalledWith(4999)
  })

  it('javob holatlari oynada ham to\'g\'ri ko\'rinadi', () => {
    const answers = Array(5000).fill(null)
    answers[2498] = 'correct'
    answers[2499] = 'wrong'
    render(<QuestionStrip total={5000} current={2500} answers={answers} onSelect={vi.fn()} />)
    expect(screen.getByRole('button', { name: '2499' }).className).toContain('bg-pprimary')
    expect(screen.getByRole('button', { name: '2500' }).className).toContain('bg-pdanger')
  })
})
