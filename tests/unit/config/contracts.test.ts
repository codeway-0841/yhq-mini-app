/**
 * Unit tests for shared API contracts — server javob formati drift
 * bo'lsa client validation uni ushlaydi.
 * Run with: npx vitest tests/unit/config/contracts.test.ts
 */

import { describe, it, expect } from 'vitest'
import { FullProfileSchema } from '../../../shared/contracts/profile'

const VALID_PROFILE = {
  user: {
    id: '123', firstName: 'Anvar', lastName: 'Karimov', username: 'anvar_k',
    photoUrl: '', phone: null, tariff: 'free', isAdmin: true,
  },
  progress: {
    totalCorrect: 10, totalWrong: 2, totalAnswered: 12, streak: 3,
    wrongByTicket: { 'yhq:42': 2 },
  },
  settings: {
    autoNextCorrect: true, autoNextWrong: false, noAnimation: false,
    shuffleOptions: false, fontSize: 'medium', fontStyle: 'default',
    language: 'uz', theme: 'dark', offlineMode: true,
  },
  savedQuestions: ['yhq:7', 'fizika:7'],
}

describe('FullProfileSchema (contract validation)', () => {
  it("to'g'ri server javobi o'tadi", () => {
    const parsed = FullProfileSchema.safeParse(VALID_PROFILE)
    expect(parsed.success).toBe(true)
  })

  it('DRIFT: wrongByTicket kaliti tekis bo\'lsa ham o\'tadi (backward-compat), lekin tip noto\'g\'ri bo\'lsa — yo\'q', () => {
    const bad = { ...VALID_PROFILE, progress: { ...VALID_PROFILE.progress, totalCorrect: '10' } }
    expect(FullProfileSchema.safeParse(bad).success).toBe(false)
  })

  it('DRIFT: savedQuestions number[] qaytsa (eski format) — rad etiladi', () => {
    const bad = { ...VALID_PROFILE, savedQuestions: [7] }
    expect(FullProfileSchema.safeParse(bad).success).toBe(false)
  })

  it('DRIFT: tariff noma\'lum qiymat bo\'lsa — rad etiladi', () => {
    const bad = { ...VALID_PROFILE, user: { ...VALID_PROFILE.user, tariff: 'gold' } }
    expect(FullProfileSchema.safeParse(bad).success).toBe(false)
  })

  it('REGRESSIYA: server yuborgan xp PARSE natijasida saqlanadi', () => {
    // Zod noma'lum maydonlarni tashlab yuboradi: xp sxemada e'lon qilinmagan
    // paytda refreshdan keyin XP/level 0 bo'lib ko'rinardi (server bazasida
    // 60 bo'lsa ham) — shu test o'sha regressiyani ushlaydi.
    const parsed = FullProfileSchema.safeParse({
      ...VALID_PROFILE,
      progress: { ...VALID_PROFILE.progress, xp: 60 },
    })
    expect(parsed.success).toBe(true)
    expect(parsed.data?.progress.xp).toBe(60)
  })

  it('xp yo\'q bo\'lsa ham o\'tadi (eski server javobi)', () => {
    const parsed = FullProfileSchema.safeParse(VALID_PROFILE)
    expect(parsed.success).toBe(true)
    expect(parsed.data?.progress.xp).toBeUndefined()
  })

  it('isAdmin va phone ixtiyoriy (yo\'q bo\'lsa ham o\'tadi)', () => {
    const { isAdmin: _a, ...userNoAdmin } = VALID_PROFILE.user
    const p = FullProfileSchema.safeParse({ ...VALID_PROFILE, user: userNoAdmin })
    expect(p.success).toBe(true)
  })
})
