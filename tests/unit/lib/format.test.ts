import { describe, it, expect } from 'vitest'
import { formatCoins } from '../../../src/shared/lib/format'

describe('formatCoins — minglik ajratgich SSOT', () => {
  it('bo\u2019shliqli guruhlaydi', () => {
    expect(formatCoins(2400)).toBe('2 400')
    expect(formatCoins(1000000)).toBe('1 000 000')
  })

  it('kichik sonlar va manfiy o\u2019zgarishsiz', () => {
    expect(formatCoins(999)).toBe('999')
    expect(formatCoins(0)).toBe('0')
    expect(formatCoins(-2500)).toBe('-2 500')
  })

  it('kasrni kesadi, finite bo\u2019lmaganni 0 qiladi', () => {
    expect(formatCoins(1999.9)).toBe('1 999')
    expect(formatCoins(NaN)).toBe('0')
  })
})
