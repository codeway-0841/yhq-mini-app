/**
 * CoinIcon — global tanga vizuali (2026-10: SVG → emoji tanga).
 *
 * Achievements'dagi ko'rinish tanlangani uchun butun ilova shu komponentga
 * o'tdi. Test "qaysi ikonka" emas, KOMPONENTNING SHARTNOMASI'ni qulflaydi:
 *  - `size` (px) → emoji shrift o'lchamiga aylanadi (vizual balandlik mos),
 *  - `className` to'liq saqlanadi (layout + rang klasslari),
 *  - `strokeWidth`/`fill` kabi SVG-only proplar DOM'ga chiqmaydi
 *    (aks holda React "unknown prop" ogohlantirishi — Profil `Item`
 *    komponenti ularni har doim uzatadi),
 *  - dekorativ (`aria-hidden`) — yonida har doim raqam matni bo'ladi.
 */
import { describe, it, expect } from 'vitest'
import React from 'react'
import { render } from '@testing-library/react'
import { CoinIcon } from '../../../src/shared/components/CoinIcon'

describe('shared/components/CoinIcon', () => {
  it('emoji tanga render qiladi va size → shrift o\'lchamiga aylanadi', () => {
    const { container } = render(<CoinIcon size={20} className="test-coin-icon" />)
    const span = container.firstElementChild as HTMLElement
    expect(span).not.toBeNull()
    expect(span.textContent).toBe('🪙')
    // 20 * 0.92 = 18.4px
    expect(span.style.fontSize).toBe('18.4px')
    expect(span.classList.contains('test-coin-icon')).toBe(true)
    expect(span.getAttribute('aria-hidden')).toBe('true')
  })

  it('default o\'lcham 16 (SVG API saqlangan)', () => {
    const { container } = render(<CoinIcon />)
    const span = container.firstElementChild as HTMLElement
    expect(span.style.fontSize).toBe('14.72px')
    expect(span.textContent).toBe('🪙')
  })

  it('SVG-only proplar (strokeWidth/fill) DOM\'ga chiqmaydi', () => {
    // Profil `Item` komponenti icon'ga doim strokeWidth uzatadi — ogohlantirish
    // yoki noto'g'ri atribut chiqmasligi SHART
    const { container } = render(<CoinIcon size={20} strokeWidth={1.75} fill="currentColor" />)
    const span = container.firstElementChild as HTMLElement
    expect(span.hasAttribute('strokeWidth')).toBe(false)
    expect(span.hasAttribute('strokewidth')).toBe(false)
    expect(span.hasAttribute('fill')).toBe(false)
    expect(container.querySelector('svg')).toBeNull()
  })

  it('className saqlanadi — layout va rang klasslari yo\'qolmaydi', () => {
    // Eslatma: `shrink-0` va `flex-none` BIR XIL twMerge guruhida — ikkalasini
    // birga yozish sun'iy holat, shuning uchun real ishlatilish tekshiriladi.
    const { container } = render(<CoinIcon className="shrink-0 text-pgold" />)
    const span = container.firstElementChild as HTMLElement
    expect(span.classList.contains('shrink-0')).toBe(true)
    expect(span.classList.contains('text-pgold')).toBe(true)
    // Baza klasslar ham joyida
    expect(span.classList.contains('inline-flex')).toBe(true)
    expect(span.classList.contains('leading-none')).toBe(true)
  })

  it('em o\'lcham birligi saqlanadi (rem/em bilan masshtablash)', () => {
    const { container } = render(<CoinIcon size="1em" />)
    const span = container.firstElementChild as HTMLElement
    expect(span.style.fontSize).toBe('0.92em')
  })
})
