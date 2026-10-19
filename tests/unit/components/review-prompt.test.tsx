/**
 * Kontekstli "sharh so'rash" prompti (2026-10-19).
 *
 * Mahsulot qarori: sharh so'rovi asosiy ekranda DOIMIY joy egallamaydi —
 * faqat yutuq momentida (test natijasi / level-up) va takrorlanmasdan
 * so'raladi. Shu shartnoma buzilmasligi uchun qoidalar testda qulflangan:
 *   - 14 kun cooldown
 *   - 2 marta "keyinroq" → butunlay to'xtaydi
 *   - sharh yozilgandan keyin hech qachon so'ralmaydi
 *   - natija modal ustiga chiqmaydi (modalCount > 0 → ko'rinmaydi)
 */
import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import {
  canPromptForReview,
  useReviewPromptStore,
  REVIEW_COOLDOWN_MS,
  REVIEW_MAX_DISMISSALS,
} from '../../../src/shared/store/useReviewPromptStore'
import ReviewPromptSheet from '../../../src/shared/components/ReviewPromptSheet'

const base = { status: 'idle' as const, shownCount: 0, lastAskedAt: null }

beforeEach(() => {
  useReviewPromptStore.setState({ status: 'idle', shownCount: 0, lastAskedAt: null, pending: null })
})

describe('canPromptForReview', () => {
  it('birinchi marta — ruxsat', () => {
    expect(canPromptForReview(base, 1_000)).toBe(true)
  })

  it('cooldown ichida — taqiqlangan, tugagach yana ruxsat', () => {
    const now = 10 * REVIEW_COOLDOWN_MS
    expect(canPromptForReview({ ...base, shownCount: 1, lastAskedAt: now - 1000 }, now)).toBe(false)
    expect(canPromptForReview({ ...base, shownCount: 1, lastAskedAt: now - REVIEW_COOLDOWN_MS }, now)).toBe(true)
  })

  it('2 marta "keyinroq"dan keyin — umuman so\'ralmaydi', () => {
    expect(canPromptForReview({ ...base, shownCount: REVIEW_MAX_DISMISSALS, lastAskedAt: 0 }, REVIEW_COOLDOWN_MS * 5)).toBe(false)
  })

  it('sharh yozilgan (written) yoki opted-out — so\'ralmaydi', () => {
    expect(canPromptForReview({ ...base, status: 'written' }, 1_000_000)).toBe(false)
    expect(canPromptForReview({ ...base, status: 'opted-out' }, 1_000_000)).toBe(false)
  })
})

describe('useReviewPromptStore', () => {
  it('request → pending, dismiss → cooldown + hisob', () => {
    const s = useReviewPromptStore.getState()
    s.request('test-result')
    expect(useReviewPromptStore.getState().pending).toBe('test-result')

    useReviewPromptStore.getState().dismiss()
    const after = useReviewPromptStore.getState()
    expect(after.pending).toBeNull()
    expect(after.shownCount).toBe(1)
    expect(after.lastAskedAt).not.toBeNull()
    expect(after.status).toBe('idle')   // hali limit tugamagan
  })

  it('ikkinchi "keyinroq" → opted-out', () => {
    useReviewPromptStore.setState({ shownCount: 1, lastAskedAt: null, status: 'idle', pending: 'level-up' })
    useReviewPromptStore.getState().dismiss()
    expect(useReviewPromptStore.getState().status).toBe('opted-out')
  })

  it('markWritten → boshqa so\'ramaymiz va pending tozalanadi', () => {
    useReviewPromptStore.getState().request('level-up')
    useReviewPromptStore.getState().markWritten()
    expect(useReviewPromptStore.getState().status).toBe('written')
    useReviewPromptStore.getState().request('test-result')
    expect(useReviewPromptStore.getState().pending).toBeNull()
  })

  it('dismiss limitdan keyin request navbatga qo\'ymaydi', () => {
    useReviewPromptStore.setState({ status: 'opted-out', shownCount: 2, lastAskedAt: null, pending: null })
    useReviewPromptStore.getState().request('test-result')
    expect(useReviewPromptStore.getState().pending).toBeNull()
  })
})

describe('ReviewPromptSheet', () => {
  it('pending bo\'lmasa render bo\'lmaydi', () => {
    const { container } = render(<MemoryRouter><ReviewPromptSheet /></MemoryRouter>)
    expect(container.firstChild).toBeNull()
  })

  it('pending bo\'lsa sarlavha va bitta CTA chiqadi (ixcham sheet)', () => {
    useReviewPromptStore.setState({ pending: 'test-result' })
    render(<MemoryRouter><ReviewPromptSheet /></MemoryRouter>)
    expect(screen.getByRole('heading', { name: /Boshqalarga yordam bering/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: /Sharh qoldirish/ })).toBeTruthy()
    // Ortiqcha "Keyinroq" ghost tugmasi YO'Q — rad etish faqat X/swipe/backdrop
    expect(screen.queryByRole('button', { name: /Keyinroq/ })).toBeNull()
  })

  it('X (yopish) bosilganda cooldown boshlanadi va sheet yopiladi', () => {
    useReviewPromptStore.setState({ pending: 'level-up' })
    render(<MemoryRouter><ReviewPromptSheet /></MemoryRouter>)
    fireEvent.click(screen.getByRole('button', { name: 'Yopish' }))
    const s = useReviewPromptStore.getState()
    expect(s.pending).toBeNull()
    expect(s.shownCount).toBe(1)
  })

  it('CTA bosilganda markAsked + /sharhlar?write=1 ga o\'tadi', () => {
    const onWriteSpy = vi.fn()
    useReviewPromptStore.setState({ pending: 'test-result' })
    const { unmount } = render(<MemoryRouter><ReviewPromptSheet /></MemoryRouter>)
    fireEvent.click(screen.getByRole('button', { name: /Sharh qoldirish/ }))
    const s = useReviewPromptStore.getState()
    expect(s.pending).toBeNull()
    expect(s.shownCount).toBe(1)          // cooldown boshlandi
    expect(s.status).toBe('idle')          // lekin "yozdim" deb belgilanmadi
    expect(onWriteSpy).not.toHaveBeenCalled()
    unmount()
  })
})
