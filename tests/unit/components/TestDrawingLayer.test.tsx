import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import TestDrawingLayer from '../../../src/features/test/components/TestDrawingLayer'

const context = {
  save: vi.fn(), restore: vi.fn(), setTransform: vi.fn(), clearRect: vi.fn(),
  beginPath: vi.fn(), arc: vi.fn(), ellipse: vi.fn(), rect: vi.fn(), fill: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(), stroke: vi.fn(),
  globalCompositeOperation: 'source-over', globalAlpha: 1, strokeStyle: '', fillStyle: '', lineWidth: 1, lineCap: 'butt', lineJoin: 'miter',
} as unknown as CanvasRenderingContext2D

function Drawing({ questionKey = '1' }: { questionKey?: string }) {
  const [open, setOpen] = React.useState(false)
  return <div style={{ width: 400, height: 800 }}><TestDrawingLayer open={open} onOpenChange={setOpen} questionKey={questionKey} sessionKey="test-session" language="uz" /></div>
}

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  vi.stubGlobal('PointerEvent', MouseEvent)
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context)
  vi.spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect').mockReturnValue({
    x: 0, y: 0, top: 0, left: 0, right: 400, bottom: 800, width: 400, height: 800, toJSON: () => ({}),
  })
})

describe('TestDrawingLayer', () => {
  it('opens an accessible toolbar and switches tools', () => {
    render(<Drawing />)
    fireEvent.click(screen.getByRole('button', { name: 'Chizib yechish' }))
    expect(screen.getByRole('toolbar', { name: 'Chizish asboblari' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Qalam' }))
    const penButton = screen.getByRole('button', { name: 'Qalam' })
    expect(penButton).toHaveAttribute('aria-pressed', 'true')
    expect(penButton.className).toContain('bg-pprimary')
    expect(penButton.className).toContain('text-ponprimary')
    fireEvent.click(screen.getByRole('button', { name: 'Qizil rang' }))
    expect(screen.getByRole('button', { name: 'Qizil rang' })).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(screen.getByRole('button', { name: 'Sahifani boshqarish' }))
    expect(screen.getByLabelText('Chizish maydoni')).toHaveClass('pointer-events-none')
  })

  it('draws with pointer events and supports undo/redo', () => {
    render(<Drawing />)
    fireEvent.click(screen.getByRole('button', { name: 'Chizib yechish' }))
    const canvas = screen.getByLabelText('Chizish maydoni')
    fireEvent.pointerDown(canvas, { pointerId: 1, pointerType: 'touch', clientX: 10, clientY: 20 })
    fireEvent.pointerMove(canvas, { pointerId: 1, pointerType: 'touch', clientX: 30, clientY: 40 })
    fireEvent.pointerUp(canvas, { pointerId: 1, pointerType: 'touch', clientX: 30, clientY: 40 })
    expect(context.lineTo).toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Bekor qilish' })).toBeEnabled()
    fireEvent.click(screen.getByRole('button', { name: 'Bekor qilish' }))
    expect(screen.getByRole('button', { name: 'Qaytarish' })).toBeEnabled()
  })

  it('keeps drawing history separate for each question', () => {
    const view = render(<Drawing questionKey="1" />)
    fireEvent.click(screen.getByRole('button', { name: 'Chizib yechish' }))
    const canvas = screen.getByLabelText('Chizish maydoni')
    fireEvent.pointerDown(canvas, { pointerId: 1, pointerType: 'touch', clientX: 10, clientY: 20 })
    fireEvent.pointerUp(canvas, { pointerId: 1, pointerType: 'touch', clientX: 10, clientY: 20 })
    expect(screen.getByRole('button', { name: 'Bekor qilish' })).toBeEnabled()

    view.rerender(<Drawing questionKey="2" />)
    expect(screen.getByRole('button', { name: 'Bekor qilish' })).toBeDisabled()
    view.rerender(<Drawing questionKey="1" />)
    expect(screen.getByRole('button', { name: 'Bekor qilish' })).toBeEnabled()
  })

  it('clears drawings and can undo the clear action', () => {
    render(<Drawing />)
    fireEvent.click(screen.getByRole('button', { name: 'Chizib yechish' }))
    const canvas = screen.getByLabelText('Chizish maydoni')
    fireEvent.pointerDown(canvas, { pointerId: 1, pointerType: 'touch', clientX: 10, clientY: 20 })
    fireEvent.pointerUp(canvas, { pointerId: 1, pointerType: 'touch', clientX: 10, clientY: 20 })
    fireEvent.click(screen.getByRole('button', { name: 'Chizmalarni tozalash' }))
    expect(screen.getByRole('button', { name: 'Chizmalarni tozalash' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Bekor qilish' }))
    expect(screen.getByRole('button', { name: 'Chizmalarni tozalash' })).toBeEnabled()
  })

  it('draws geometric shapes with a live endpoint', () => {
    render(<Drawing />)
    fireEvent.click(screen.getByRole('button', { name: 'Chizib yechish' }))
    fireEvent.click(screen.getByRole('button', { name: 'To‘rtburchak' }))
    const canvas = screen.getByLabelText('Chizish maydoni')
    fireEvent.pointerDown(canvas, { pointerId: 2, pointerType: 'touch', clientX: 20, clientY: 30 })
    fireEvent.pointerMove(canvas, { pointerId: 2, pointerType: 'touch', clientX: 160, clientY: 180 })
    fireEvent.pointerUp(canvas, { pointerId: 2, pointerType: 'touch', clientX: 160, clientY: 180 })
    expect(context.rect).toHaveBeenCalled()
  })

  it('opens a separate scratchpad with the same drawing tools', () => {
    render(<Drawing />)
    fireEvent.click(screen.getByRole('button', { name: 'Chizib yechish' }))
    fireEvent.click(screen.getByRole('button', { name: 'Qoralama' }))
    expect(screen.getByRole('dialog', { name: 'Qoralama doskasi' })).toBeInTheDocument()
    expect(screen.getByLabelText('Qoralama chizish maydoni')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Qoralamani yopish' }))
    expect(screen.queryByRole('dialog', { name: 'Qoralama doskasi' })).not.toBeInTheDocument()
  })

  it('restores persisted drawings after remount', () => {
    const view = render(<Drawing />)
    fireEvent.click(screen.getByRole('button', { name: 'Chizib yechish' }))
    const canvas = screen.getByLabelText('Chizish maydoni')
    fireEvent.pointerDown(canvas, { pointerId: 3, pointerType: 'touch', clientX: 10, clientY: 20 })
    fireEvent.pointerUp(canvas, { pointerId: 3, pointerType: 'touch', clientX: 10, clientY: 20 })
    expect(localStorage.getItem('yhq-test-drawing-v2:test-session')).toContain('question:1')
    view.unmount()

    render(<Drawing />)
    fireEvent.click(screen.getByRole('button', { name: 'Chizib yechish' }))
    expect(screen.getByRole('button', { name: 'Bekor qilish' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Chizmalarni tozalash' })).toBeEnabled()
  })
})
