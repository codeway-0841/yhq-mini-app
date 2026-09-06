import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import TestDrawingLayer from '../../../src/features/test/components/TestDrawingLayer'

const context = {
  save: vi.fn(), restore: vi.fn(), setTransform: vi.fn(), clearRect: vi.fn(),
  beginPath: vi.fn(), arc: vi.fn(), fill: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(), stroke: vi.fn(),
  globalCompositeOperation: 'source-over', strokeStyle: '', fillStyle: '', lineWidth: 1, lineCap: 'butt', lineJoin: 'miter',
} as unknown as CanvasRenderingContext2D

function Drawing({ questionKey = '1' }: { questionKey?: string }) {
  const [open, setOpen] = React.useState(false)
  return <div style={{ width: 400, height: 800 }}><TestDrawingLayer open={open} onOpenChange={setOpen} questionKey={questionKey} language="uz" /></div>
}

beforeEach(() => {
  vi.clearAllMocks()
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
    fireEvent.click(screen.getByRole('button', { name: 'Qizil qalam' }))
    expect(screen.getByRole('button', { name: 'Qizil qalam' })).toHaveAttribute('aria-pressed', 'true')
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
})
