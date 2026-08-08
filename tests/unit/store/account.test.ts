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
  tariff:    'premium',
  isAdmin:   false,
}

/** Har test oldidan barcha store'lar toza holatda */
beforeEach(() => {
  resetAccountState()
  useAppStore.setState({ initialized: false })
})

function seedUserA(): void {
  useAppStore.setState({ user: userA, tariff: 'premium', streak: 7, totalCorrect: 42, displayName: 'Anvar_aka' })
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
  })

  it('localStorage yo\'q muhitda (node) xatosiz ishlaydi', () => {
    seedUserA()
    expect(() => resetAccountState()).not.toThrow()
    expect(useAppStore.getState().user).toBeNull()
  })
})
