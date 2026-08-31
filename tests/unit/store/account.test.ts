/**
 * Unit tests for account isolation (P1: user-scoped persisted state).
 * Account switch'da barcha account-scoped store'lar atomik tozalanishi,
 * warm start faqat ayni akkaunt cache'i bilan ruxsat etilishi shart.
 * Run with: npx vitest tests/unit/store/account.test.ts
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { ensureAccountOwner, resetAccountState, ACCOUNT_STORAGE_KEYS } from '../../../src/shared/store/account'
import { useAppStore }         from '../../../src/shared/store/useAppStore'
import { useDailyStore }       from '../../../src/shared/store/useDailyStore'
import { useAdaptiveStore }    from '../../../src/shared/store/useAdaptiveStore'
import { useTestSessionStore } from '../../../src/shared/store/useTestSessionStore'
import type { ApiUser } from '../../../src/shared/api'

const userA: ApiUser = {
  id:        '111',
  firstName: 'Anvar',
  lastName:  'Karimov',
  username:  'anvar_k',
  photoUrl:  '',
  phone:     undefined,
  tariff:    'premium',
  isAdmin:   false,
}

/** Har test oldidan barcha store'lar toza holatda */
beforeEach(() => {
  resetAccountState()
  useAppStore.setState({ initialized: false })
})

function seedUserA(): void {
  useAppStore.setState({ user: userA, tariff: 'premium', streak: 7, xp: 60, league: 'gold', totalCorrect: 42, displayName: 'Anvar_aka' })
  useDailyStore.setState({ streaks: { yhq: 5 }, activityKey: '2026-08-07|yhq' })
  useAdaptiveStore.setState({ cardsBySubject: { yhq: { 1: {} as never } } })
  useTestSessionStore.getState().save({ mode: 'exam', index: 3 } as never)
}

describe('ensureAccountOwner', () => {
  it('cache bo\'sh bo\'lsa — true (birinch kirish, tozalashsiz)', () => {
    expect(ensureAccountOwner('111')).toBe(true)
  })

  it('ayni akkaunt — true, barcha state saqlanadi (warm start)', () => {
    seedUserA()
    expect(ensureAccountOwner('111')).toBe(true)
    expect(useAppStore.getState().user?.id).toBe('111')
    expect(useAppStore.getState().totalCorrect).toBe(42)
    expect(useDailyStore.getState().streaks.yhq).toBe(5)
  })

  it('boshqa akkaunt — false va barcha account-scoped state ATOMIK tozalanadi', () => {
    seedUserA()
    expect(ensureAccountOwner('222')).toBe(false)

    const app = useAppStore.getState()
    expect(app.user).toBeNull()
    expect(app.tariff).toBe('free')
    expect(app.streak).toBe(0)
    expect(app.xp).toBe(0)
    expect(app.league).toBe('bronze')
    expect(app.totalCorrect).toBe(0)
    expect(app.displayName).toBeNull()
    expect(useDailyStore.getState().streaks).toEqual({})
    expect(useAdaptiveStore.getState().cardsBySubject).toEqual({})
    expect(useTestSessionStore.getState().session).toBeNull()
  })

  it('mismatch keyingi chaqiruv — false qaytgach warm start yo\'q', () => {
    seedUserA()
    ensureAccountOwner('222')
    // Reset'dan keyin cache bo'sh: yangi akkaunt uchun warm start bo'lmasligi kerak
    expect(useAppStore.getState().user).toBeNull()
  })
})

describe('resetAccountState', () => {
  it('ACCOUNT_STORAGE_KEYS barcha account-scoped store persist nomlarini qamraydi', () => {
    expect(ACCOUNT_STORAGE_KEYS).toContain('yhq-app-store')
    expect(ACCOUNT_STORAGE_KEYS).toContain('yhq-daily')
    expect(ACCOUNT_STORAGE_KEYS).toContain('yhq-adaptive-store')
    expect(ACCOUNT_STORAGE_KEYS).toContain('yhq-test-session')
    expect(ACCOUNT_STORAGE_KEYS).toContain('yhq-session')   // Bearer sessiya ham reset'da o'chadi (MF-3)
  })

  it('localStorage yo\'q muhitda (node) xatosiz ishlaydi', () => {
    seedUserA()
    expect(() => resetAccountState()).not.toThrow()
    expect(useAppStore.getState().user).toBeNull()
  })

  it("user-scoped BO'LMAGAN izlar (duel-history, flash-known-*, milestones-*, ...) reset'da o'chadi (audit H-8)", () => {
    localStorage.clear()
    localStorage.setItem('yhq-duel-history', '[{"opponentName":"Sardor"}]')
    localStorage.setItem('yhq-level-seen', '5')
    localStorage.setItem('yhq-goal', '20')
    localStorage.setItem('yhq-formula-favs', '[1]')
    localStorage.setItem('yhq-flash-known-7', '[1,2,3]')
    localStorage.setItem('yhq-flash-known-12', '[9]')
    localStorage.setItem('yhq-milestones-yhq', '{"m1":true}')
    // Client-only o'yin rekordlari ham akkaunt-scoped (audit 2026-08-31 LOW:
    // shared qurilmada oldingi akkaunt rekordlari ko'rinmasligi kerak)
    localStorage.setItem('yhq-signs-best-speed', '11')
    localStorage.setItem('yhq-signs-best-match-ms', '45000')

    resetAccountState()

    expect(localStorage.getItem('yhq-duel-history')).toBeNull()
    expect(localStorage.getItem('yhq-level-seen')).toBeNull()
    expect(localStorage.getItem('yhq-goal')).toBeNull()
    expect(localStorage.getItem('yhq-formula-favs')).toBeNull()
    expect(localStorage.getItem('yhq-flash-known-7')).toBeNull()
    expect(localStorage.getItem('yhq-flash-known-12')).toBeNull()
    expect(localStorage.getItem('yhq-milestones-yhq')).toBeNull()
    expect(localStorage.getItem('yhq-signs-best-speed')).toBeNull()
    expect(localStorage.getItem('yhq-signs-best-match-ms')).toBeNull()
  })

  it("by-design SAQLANADIGAN kalitlar reset'dan o'tib qoladi (user-namespaced outbox, fan tanlovi)", () => {
    localStorage.clear()
    // Outbox user-id bilan namespaced — chalkashmaydi, o'chirilsa offline javoblar yo'qoladi
    localStorage.setItem('yhq-outbox:111', '[]')
    // Umumiy user-preference (fan tanlovi) — akkauntga bog'liq emas
    localStorage.setItem('yhq-subject', 'yhq')

    resetAccountState()

    expect(localStorage.getItem('yhq-outbox:111')).toBe('[]')
    expect(localStorage.getItem('yhq-subject')).toBe('yhq')
  })
})
