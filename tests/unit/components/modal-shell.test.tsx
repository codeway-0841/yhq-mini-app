/**
 * ModalShell — barcha modal/sheet'lar uchun yagona qobiq.
 * Shartnoma: markazdagi sarlavha (17px), dumaloq oq X, to'r fon, scroll body,
 * ixtiyoriy sticky footer, to'g'ri aria bog'lanish.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ModalShell from '../../../src/shared/components/ModalShell'

describe('ModalShell', () => {
  it('sarlavha, subtitle va aria-labelledby bog\'lanishi', () => {
    render(
      <ModalShell title="To'lovlar tarixi" subtitle="Barcha to'lovlaringiz" onClose={() => {}}>
        <p>kontent</p>
      </ModalShell>,
    )

    const dialog = screen.getByRole('dialog')
    const heading = screen.getByRole('heading', { name: "To'lovlar tarixi" })
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(dialog.getAttribute('aria-labelledby')).toBe(heading.id)
    expect(screen.getByText("Barcha to'lovlaringiz")).toBeInTheDocument()
    expect(screen.getByText('kontent')).toBeInTheDocument()
  })

  it('dumaloq X yopadi (aria-label bilan)', () => {
    const onClose = vi.fn()
    render(<ModalShell title="Sozlamalar" onClose={onClose} />)

    fireEvent.click(screen.getByRole('button', { name: 'Yopish' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('footer alohida (sticky) zonada render bo\'ladi', () => {
    render(
      <ModalShell title="Sozlamalar" onClose={() => {}} footer={<button>Saqlash</button>}>
        <p>body</p>
      </ModalShell>,
    )

    expect(screen.getByRole('button', { name: 'Saqlash' })).toBeInTheDocument()
  })

  it('toza silliq fon va tortish dastagi bor', () => {
    render(<ModalShell title="T" onClose={() => {}} />)

    expect(document.querySelector('[data-drag-handle]')).not.toBeNull()
    // Toza fon — matematik to'r chizilmaydi
    const grids = Array.from(document.querySelectorAll('[aria-hidden="true"]'))
    expect(grids.some((el) => (el as HTMLElement).style.backgroundImage?.includes('linear-gradient'))).toBe(false)
  })

  it('showHandle={false} da dastak chizilmaydi', () => {
    render(<ModalShell title="T" onClose={() => {}} showHandle={false} />)
    expect(document.querySelector('[data-drag-handle]')).toBeNull()
  })

  it('vizual sarlavhasiz ham dialog nomi va yopish tugmasi mavjud', () => {
    const onClose = vi.fn()
    render(<ModalShell title="Yordamchi" onClose={onClose} showHeader={false} />)
    const dialog = screen.getByRole('dialog', { name: 'Yordamchi' })
    expect(dialog).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Yopish' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
