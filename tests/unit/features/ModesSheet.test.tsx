/**
 * ModesSheet — "Rejimlar / Yana" bosilganda ochiladigan to'liq rejimlar
 * panjarasi: barcha kartalar render bo'ladi, karta bosilsa sheet yopilib
 * rejim onClick'i ishga tushadi, yopish tugmasi onClose'ni chaqiradi.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { BookOpen, Ticket, Hash } from 'lucide-react'

import ModesSheet from '../../../src/features/dashboard/components/ModesSheet'
import { useAppStore } from '../../../src/shared/store/useAppStore'

beforeEach(() => {
  useAppStore.setState({ settings: { ...useAppStore.getState().settings, language: 'uz' } })
})

function makeItems() {
  return [
    { icon: BookOpen, label: 'Mavzular', onClick: vi.fn() },
    { icon: Ticket,   label: 'Biletlar', onClick: vi.fn() },
    { icon: Hash,     label: 'Raqamli savollar', onClick: vi.fn() },
  ]
}

describe('ModesSheet', () => {
  it('sarlavha va barcha rejim kartalarini ko\'rsatadi', () => {
    render(<ModesSheet title="Rejimlar" items={makeItems()} onClose={vi.fn()} />)

    expect(screen.getByText('Rejimlar')).toBeTruthy()
    expect(screen.getByText('Mavzular')).toBeTruthy()
    expect(screen.getByText('Biletlar')).toBeTruthy()
    expect(screen.getByText('Raqamli savollar')).toBeTruthy()
  })

  it('karta bosilsa — avval onClose, keyin rejim onClick ishlaydi', () => {
    const items = makeItems()
    const onClose = vi.fn()
    render(<ModesSheet title="Rejimlar" items={items} onClose={onClose} />)

    fireEvent.click(screen.getByRole('button', { name: 'Biletlar' }))

    expect(onClose).toHaveBeenCalledTimes(1)
    expect(items[1]!.onClick).toHaveBeenCalledTimes(1)
    expect(items[0]!.onClick).not.toHaveBeenCalled()
  })

  it('orqaga (←) tugmasi onClose\'ni chaqiradi', () => {
    const onClose = vi.fn()
    render(<ModesSheet title="Rejimlar" items={makeItems()} onClose={onClose} />)

    fireEvent.click(screen.getByRole('button', { name: 'Orqaga' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
