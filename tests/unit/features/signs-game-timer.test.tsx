/**
 * SpeedGame (belgilar o'yini) taymer regression testi — L11: state updater
 * ICHIDAGI side-effect'lar (rekord yozish, ovoz) StrictMode'da updater
 * double-invoke tufayli 2× ijro etilardi. Fix: updater sof (faqat t-1),
 * yakun logikasi alohida effect'da.
 *
 * Mutation-check: eski (updater-ichidagi) logika bilan bu test StrictMode'da
 * playSound('win') 2 marta chaqirilganini ko'rsatib FAIL bo'lardi.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act, cleanup, fireEvent } from '@testing-library/react'
import { StrictMode } from 'react'
import { MemoryRouter } from 'react-router-dom'

const { mockPlaySound } = vi.hoisted(() => ({ mockPlaySound: vi.fn() }))
vi.mock('../../../src/shared/lib/sounds', () => ({ playSound: mockPlaySound }))

import SignsGamePage from '../../../src/features/signs-game/SignsGamePage'

beforeEach(() => {
  vi.useFakeTimers()
  localStorage.clear()
  mockPlaySound.mockReset()
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

function enterSpeedMode() {
  render(
    <StrictMode>
      <MemoryRouter>
        <SignsGamePage />
      </MemoryRouter>
    </StrictMode>,
  )
  fireEvent.click(screen.getByText('Tezkor raund'))
}

describe('SpeedGame taymer (L11 — sof updater)', () => {
  it("vaqt tugaganda yakun logikasi (ovoz + rekord) FAQAT 1 marta ijro etiladi", () => {
    enterSpeedMode()

    // 60s to'liq o'tkazamiz
    act(() => { vi.advanceTimersByTime(60_000) })

    // StrictMode updater double-invoke'da eski kod 'win'ni 2× chalardi
    const winCalls = mockPlaySound.mock.calls.filter(([k]) => k === 'win')
    expect(winCalls).toHaveLength(1)
    // Rekord bir marta yozilgan (score=0, best=null → '0')
    expect(localStorage.getItem('yhq-signs-best-speed')).toBe('0')
    // Yakun ekrani ko'rinadi
    expect(screen.getByText('Vaqt tugadi!')).toBeTruthy()
  })

  it('taymer to\'g\'ri sanaydi (59s → 58s → ...)', () => {
    enterSpeedMode()
    expect(screen.getByText('60s')).toBeTruthy()
    act(() => { vi.advanceTimersByTime(2_000) })
    expect(screen.getByText('58s')).toBeTruthy()
  })
})
