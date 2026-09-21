/**
 * Math Board — FloatingToolbar + BoardActionFab komponent testlari (Faza 3).
 *
 * Izoh: sahifa daraxtida KaTeX/MathML bo'lganda accessible-name query'lar
 * jsdom'da crash beradi — komponentlar izolyatsiyada name query bilan,
 * sahifa testlari text/selector bilan tekshiriladi.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import FloatingToolbar from '../../../src/features/math-board/components/FloatingToolbar'
import BoardActionFab from '../../../src/features/math-board/components/BoardActionFab'

const noop = (): void => {}
const labels = {
  pen: 'Qalam', eraser: 'Eraser', undo: 'Undo', redo: 'Redo',
  clear: 'Clear', keyboard: 'Keyboard', lassoSoon: 'Lasso soon',
}

describe('FloatingToolbar', () => {
  function renderBar(tool: 'pen' | 'eraser' = 'pen') {
    return render(
      <FloatingToolbar tool={tool} onTool={noop} canUndo canRedo canClear
        onUndo={noop} onRedo={noop} onClear={noop} onKeyboard={noop} labels={labels} />,
    )
  }

  it('asboblar + undo/redo/clear/keyboard + lasso soon', () => {
    renderBar()
    expect(screen.getByRole('button', { name: 'Qalam' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Eraser' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Undo' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Redo' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Clear' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Keyboard' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Lasso soon' })).toBeTruthy()
  })

  it('tanlangan asbob aria-pressed', () => {
    const { container } = renderBar('eraser')
    expect(container.querySelector('button[aria-label="Eraser"]')?.getAttribute('aria-pressed')).toBe('true')
    expect(container.querySelector('button[aria-label="Qalam"]')?.getAttribute('aria-pressed')).toBe('false')
  })

  it('tool tanlash callback', () => {
    const onTool = vi.fn()
    render(
      <FloatingToolbar tool="pen" onTool={onTool} canUndo={false} canRedo={false} canClear={false}
        onUndo={noop} onRedo={noop} onClear={noop} onKeyboard={noop} labels={labels} />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Eraser' }))
    expect(onTool).toHaveBeenCalledWith('eraser')
  })
})

describe('BoardActionFab', () => {
  function renderFab(disabled = true) {
    return render(
      <BoardActionFab recognizeLabel="Tanish" helpLabel="Yordam" closeLabel="Yopish" menuLabel="Amallar"
        recognizeDisabled={disabled} onRecognize={noop} onHelp={noop} />,
    )
  }

  it('menyu yopiq → ochish; Tanish/Yordam alohida', () => {
    renderFab()
    expect(screen.queryByRole('menu')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Amallar' }))
    expect(screen.getByRole('menu')).toBeTruthy()
    expect(screen.getByRole('menuitem', { name: 'Tanish' })).toBeTruthy()
    expect(screen.getByRole('menuitem', { name: 'Yordam' })).toBeTruthy()
  })

  it('Tanish disabled holati uzatiladi', () => {
    renderFab(true)
    fireEvent.click(screen.getByRole('button', { name: 'Amallar' }))
    expect(screen.getByRole('menuitem', { name: 'Tanish' }).hasAttribute('disabled')).toBe(true)
  })

  it('Escape yopadi', () => {
    renderFab()
    fireEvent.click(screen.getByRole('button', { name: 'Amallar' }))
    expect(screen.getByRole('menu')).toBeTruthy()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('menu')).toBeNull()
  })
})
