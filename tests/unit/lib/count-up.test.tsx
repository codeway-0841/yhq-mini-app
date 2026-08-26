/**
 * useCountUp — mount'da sanoq BO'LMASLIGI kerak.
 *
 * Ilgari hook har mount'da 0 dan boshlardi: Dashboard har ochilganda foiz
 * qaytadan "sanalardi", garchi qiymat o'zgarmagan bo'lsa ham. Savollar soni
 * asinxron kelgani uchun sanoq yana kech, ikkinchi marta ishga tushardi.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { useCountUp } from '../../../src/shared/hooks/useCountUp'

function Probe({ value }: { value: number }) {
  return <span data-testid="v">{useCountUp(value, 100)}</span>
}

const read = () => Number(screen.getByTestId('v').textContent)

beforeEach(() => {
  document.body.dataset.noAnimation = 'false'
  // matchMedia — jsdom'da yo'q; reduced-motion o'chiq deb qaytaramiz
  vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener() {}, removeEventListener() {} }))
})
afterEach(() => vi.unstubAllGlobals())

describe('useCountUp', () => {
  it('mount\'da target DARHOL ko\'rsatiladi — sanoq yo\'q', () => {
    render(<Probe value={51} />)
    expect(read()).toBe(51)
  })

  it('ma\'lumot kech kelsa (0 → 51) SAKRAYDI, sanamaydi', () => {
    const { rerender } = render(<Probe value={0} />)
    expect(read()).toBe(0)

    // Savollar yuklandi — birinchi ma'noli qiymat
    act(() => { rerender(<Probe value={51} />) })
    expect(read()).toBe(51)
  })

  it('sessiya ichida qiymat o\'zgarsa — animatsiya ISHLAYDI', async () => {
    const { rerender } = render(<Probe value={51} />)
    expect(read()).toBe(51)

    act(() => { rerender(<Probe value={80} />) })
    // Animatsiya boshlandi: hali 80 emas, lekin 51 dan yuqoriga qarab ketyapti
    await act(async () => { await new Promise((r) => setTimeout(r, 20)) })
    const mid = read()
    expect(mid).toBeGreaterThanOrEqual(51)
    expect(mid).toBeLessThan(80)

    await act(async () => { await new Promise((r) => setTimeout(r, 160)) })
    expect(read()).toBe(80)
  })

  it('noAnimation yoqilgan bo\'lsa — hech qachon sanamaydi', async () => {
    document.body.dataset.noAnimation = 'true'
    const { rerender } = render(<Probe value={51} />)
    act(() => { rerender(<Probe value={80} />) })
    expect(read()).toBe(80)
  })
})
