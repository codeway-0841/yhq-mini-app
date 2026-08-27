import { describe, it, expect } from 'vitest'
import { UZ, RU, t, useT, Keys } from '../../../src/shared/i18n'

describe('i18n Localization Integrity & Parity', () => {
  const uzKeys = Object.keys(UZ) as Keys[]
  const ruKeys = Object.keys(RU) as Keys[]

  it('has identical key count in both UZ and RU localization tables', () => {
    expect(uzKeys.length).toBeGreaterThan(0)
    expect(ruKeys.length).toBe(uzKeys.length)
  })

  it('has 100% bi-directional key parity (no missing or orphaned keys)', () => {
    const uzSet = new Set(uzKeys)
    const ruSet = new Set(ruKeys)

    const missingInRu = uzKeys.filter((k) => !ruSet.has(k))
    const missingInUz = ruKeys.filter((k) => !uzSet.has(k))

    expect(missingInRu, `Keys present in UZ but missing in RU: ${missingInRu.join(', ')}`).toEqual([])
    expect(missingInUz, `Keys present in RU but missing in UZ: ${missingInUz.join(', ')}`).toEqual([])
  })

  it('contains non-empty, trimmed translations without blank values', () => {
    for (const key of uzKeys) {
      const uzVal = UZ[key]
      const ruVal = RU[key]

      expect(typeof uzVal, `UZ.${key} must be a string`).toBe('string')
      expect(typeof ruVal, `RU.${key} must be a string`).toBe('string')

      expect(uzVal.trim().length, `UZ.${key} must not be empty or whitespace only`).toBeGreaterThan(0)
      expect(ruVal.trim().length, `RU.${key} must not be empty or whitespace only`).toBeGreaterThan(0)
    }
  })

  it('preserves interpolation parameters and placeholders across locales', () => {
    const extractPlaceholders = (text: string): string[] => {
      const matches = text.match(/\{[a-zA-Z0-9_]+\}/g)
      return matches ? Array.from(matches).sort() : []
    }

    for (const key of uzKeys) {
      const uzPlaceholders = extractPlaceholders(UZ[key])
      const ruPlaceholders = extractPlaceholders(RU[key])

      expect(
        uzPlaceholders,
        `Placeholder mismatch in key "${key}": UZ has [${uzPlaceholders.join(', ')}] but RU has [${ruPlaceholders.join(', ')}]`
      ).toEqual(ruPlaceholders)
    }
  })

  it('t() and useT() helper functions resolve correctly with fallbacks', () => {
    expect(t('uz', 'home')).toBe('Bosh sahifa')
    expect(t('ru', 'home')).toBe('Главная')

    const translateUz = useT('uz')
    const translateRu = useT('ru')

    expect(translateUz('profile')).toBe('Profil')
    expect(translateRu('profile')).toBe('Профиль')

    // Unsupported/fallback language safely defaults to UZ
    // @ts-expect-error testing invalid language code fallback
    expect(t('en', 'home')).toBe('Bosh sahifa')
  })
})
