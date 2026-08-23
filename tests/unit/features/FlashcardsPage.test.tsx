/**
 * Flashcards — kategoriya tanlash, "Bilaman/Bilmadim" mantig'i va
 * o'zlashtirilgan belgilarning localStorage'da saqlanishi.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const { mockNavigate } = vi.hoisted(() => ({ mockNavigate: vi.fn() }))
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return { ...actual, useNavigate: () => mockNavigate }
})

import FlashcardsPage from '../../../src/features/flashcards/FlashcardsPage'
import { useAppStore } from '../../../src/shared/store/useAppStore'
import { signCategories, getSignsByCategory } from '../../../src/content/signs'

const firstCat = signCategories[0]!
const knownKey = (catId: string) => `yhq-flash-known-${catId}`

beforeEach(() => {
  mockNavigate.mockReset()
  localStorage.clear()
  useAppStore.setState({ settings: { ...useAppStore.getState().settings, language: 'uz' } })
})

describe('FlashcardsPage', () => {
  it('kategoriyalar ro\'yxati belgilar soni bilan chiqadi', () => {
    render(<FlashcardsPage />)

    expect(screen.getByText(firstCat.name)).toBeInTheDocument()
    expect(screen.getAllByText(new RegExp(`${firstCat.count} belgi`)).length).toBeGreaterThan(0)
  })

  it('avval o\'zlashtirilganlar foizi ko\'rsatiladi', () => {
    const signs = getSignsByCategory(firstCat.id)
    localStorage.setItem(knownKey(firstCat.id), JSON.stringify([signs[0]!.id]))

    render(<FlashcardsPage />)

    expect(screen.getByText(new RegExp(`1 o.zlashtirildi`))).toBeInTheDocument()
  })

  it('kategoriya tanlanganda dek ochiladi va karta bosilsa aylanadi', () => {
    render(<FlashcardsPage />)
    fireEvent.click(screen.getByText(firstCat.name))

    // Dek ekranida "Bilaman/Bilmadim" tugmalari bor
    expect(screen.getByText('Bilaman')).toBeInTheDocument()
    expect(screen.getByText('Bilmadim')).toBeInTheDocument()
  })

  it('"Bilaman" belgini localStorage\'ga yozadi', async () => {
    render(<FlashcardsPage />)
    fireEvent.click(screen.getByText(firstCat.name))
    fireEvent.click(screen.getByText('Bilaman'))

    await waitFor(() => {
      const saved = JSON.parse(localStorage.getItem(knownKey(firstCat.id)) ?? '[]')
      expect(saved).toHaveLength(1)
    })
  })

  it('"Bilmadim" belgini SAQLAMAYDI (dek oxiriga qaytadi)', async () => {
    render(<FlashcardsPage />)
    fireEvent.click(screen.getByText(firstCat.name))
    fireEvent.click(screen.getByText('Bilmadim'))

    await waitFor(() => expect(screen.getByText('Bilaman')).toBeInTheDocument())
    expect(localStorage.getItem(knownKey(firstCat.id))).toBeNull()
  })

  it('dek tugagach yakun ekrani chiqadi', async () => {
    // Bitta belgili kategoriyani topamiz yoki hammasini "bilaman" bilan o'tamiz
    render(<FlashcardsPage />)
    fireEvent.click(screen.getByText(firstCat.name))

    // Har "Bilaman"dan keyin komponent 160ms pauza bilan keyingi kartaga o'tadi
    const total = getSignsByCategory(firstCat.id).length
    for (let i = 0; i < total; i++) {
      const btn = screen.queryByText('Bilaman')
      if (!btn) break
      fireEvent.click(btn)
      await new Promise((r) => setTimeout(r, 200))
    }

    await waitFor(
      () => expect(screen.queryByText('Bilaman')).toBeNull(),
      { timeout: 5000 },
    )
  })
})
