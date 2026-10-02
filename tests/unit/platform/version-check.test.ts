import { describe, it, expect } from 'vitest'
import { compareSemver } from '../../../src/platform/version-check'

describe('compareSemver', () => {
  it('equal versions → 0', () => {
    expect(compareSemver('1.0.0', '1.0.0')).toBe(0)
    expect(compareSemver('2.3.4', '2.3.4')).toBe(0)
  })

  it('a < b → -1 (major)', () => {
    expect(compareSemver('1.0.0', '2.0.0')).toBe(-1)
  })

  it('a < b → -1 (minor)', () => {
    expect(compareSemver('1.2.0', '1.3.0')).toBe(-1)
  })

  it('a < b → -1 (patch)', () => {
    expect(compareSemver('1.0.3', '1.0.4')).toBe(-1)
  })

  it('a > b → 1', () => {
    expect(compareSemver('2.0.0', '1.9.9')).toBe(1)
    expect(compareSemver('1.1.0', '1.0.9')).toBe(1)
    expect(compareSemver('1.0.4', '1.0.3')).toBe(1)
  })

  it('handles real-world versions', () => {
    // Joriy APK 1.0.3, server min 1.1.0 → force update
    expect(compareSemver('1.0.3', '1.1.0')).toBe(-1)
    // Joriy APK 1.1.0, server min 1.1.0 → ok
    expect(compareSemver('1.1.0', '1.1.0')).toBe(0)
    // Joriy APK 1.2.0, server min 1.1.0 → ok
    expect(compareSemver('1.2.0', '1.1.0')).toBe(1)
  })
})
