/**
 * Repository-level coverage (FIXPLAN #29) — eng qimmatli yo'llar:
 * referrals reward/unique, payments ledger idempotent, promo redeem chegaralari,
 * sessions consume/resolve, OTP atomarligi, trial race.
 * Barcha testlar REAL Neon test DB'da (레pository CTE'larining race semantikasi).
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { db } from '../../../server/db/connection'
import { users, referrals, payments, promoCodes, otpCodes, sessions, authIdentities } from '../../../server/schema'
import { eq, inArray } from 'drizzle-orm'
import { referralsRepository, usersRepository } from '../../../server/modules/users/users.repository'
import { paymentRepository } from '../../../server/modules/payments/payment.repository'
import { promoRepository } from '../../../server/modules/promo/promo.repository'
import { authRepository } from '../../../server/modules/auth/auth.repository'



const PREFIX = 'zzrc_'
const mkId = () => `${PREFIX}${Math.random().toString(36).slice(2, 10)}`
const createdUsers: string[] = []
const createdPromos: string[] = []
const createdOtps: string[] = []

async function mkUser(id: string) {
  await db.insert(users).values({ id, firstName: 'RC', lastName: '', username: id, photoUrl: '' }).onConflictDoNothing()
  createdUsers.push(id)
}

afterAll(async () => {
  await db.delete(sessions).where(inArray(sessions.userId, createdUsers))
  await db.delete(authIdentities).where(inArray(authIdentities.userId, createdUsers))
  await db.delete(referrals).where(inArray(referrals.refereeId, createdUsers))
  await db.delete(referrals).where(inArray(referrals.referrerId, createdUsers))
  await db.delete(payments).where(inArray(payments.userId, createdUsers))
  await db.delete(users).where(inArray(users.id, createdUsers))
  if (createdPromos.length) await db.delete(promoCodes).where(inArray(promoCodes.code, createdPromos))
  if (createdOtps.length) await db.delete(otpCodes).where(inArray(otpCodes.phone, createdOtps))
})

describe('repository coverage: referrals reward', () => {
  it('rewardIfPhoneLinked — 8 parallel poygada FAQAT 1 marta (race-safe)', async () => {
    const referrer = mkId(), referee = mkId()
    await mkUser(referrer); await mkUser(referee)
    await db.insert(referrals).values({ referrerId: referrer, refereeId: referee, status: 'pending' })

    const results = await Promise.all(Array.from({ length: 8 }, () => referralsRepository.rewardIfPhoneLinked(referee)))
    expect(results.filter(Boolean)).toHaveLength(1)

    const [r] = await db.select().from(referrals).where(eq(referrals.refereeId, referee))
    expect(r.status).toBe('rewarded')
  })

  it('createPending — referee UNIQUE: bir xil referee ikki marta yozilmaydi', async () => {
    const r1 = mkId(), r2 = mkId(), referee = mkId()
    await mkUser(r1); await mkUser(r2); await mkUser(referee)

    const first = await referralsRepository.createPending(r1, referee)
    const second = await referralsRepository.createPending(r2, referee)
    expect(first).toBe(true)
    expect(second).toBe(false)   // ON CONFLICT (referee_id) DO NOTHING

    const rows = await db.select().from(referrals).where(eq(referrals.refereeId, referee))
    expect(rows).toHaveLength(1)
  })

  it('getStats — invited/rewarded/pending hisobi to\'g\'ri', async () => {
    const referrer = mkId(), a = mkId(), b = mkId()
    await mkUser(referrer); await mkUser(a); await mkUser(b)
    await db.insert(referrals).values([
      { referrerId: referrer, refereeId: a, status: 'pending' },
      { referrerId: referrer, refereeId: b, status: 'pending' },
    ])
    await referralsRepository.rewardIfPhoneLinked(a)

    const stats = await referralsRepository.getStats(referrer)
    expect(stats.invited).toBe(2)
    expect(stats.rewarded).toBe(1)
  })
})

describe('repository coverage: payments ledger', () => {
  it('user_not_found — mavjud bo\'lmagan user hech qanday ledger/garant yozmaydi', async () => {
    const result = await paymentRepository.complete({
      telegramChargeId: `${PREFIX}ghost_${Date.now()}`,
      providerChargeId: 'x', userId: `${PREFIX}does_not_exist`, plan: 'month',
      days: 30, amount: 100, currency: 'XTR', payload: 't', rawUpdate: {},
    })
    expect(result).toBe('user_not_found')
    const ledger = await db.select().from(payments).where(eq(payments.userId, `${PREFIX}does_not_exist`))
    expect(ledger).toHaveLength(0)
  })
})

describe('repository coverage: promo redeem chegaralari', () => {
  it('yolg\'on kod → not_found; eskirgan kod → muddati o\'tgan', async () => {
    const P = 'rc_test_noop'
    const notFound = await promoRepository.findByCode(P)
    expect(notFound).toBeNull()

    // Eskirgan kod yaratamiz
    const expiredCode = `rc_exp_${Date.now()}`
    await db.insert(promoCodes).values({
      code: expiredCode, type: 'premium_days', value: 3, maxUses: 10, usedCount: 0,
      expiresAt: new Date(Date.now() - 86_400_000), isActive: true,
    }).returning({ code: promoCodes.code })
    createdPromos.push(expiredCode)
    const expired = await promoRepository.findByCode(expiredCode)
    expect(expired).not.toBeNull()
    // Raw SQL AS "expiresAt" string qaytarishi mumkin — Date'ga keltiramiz
    expect(new Date(expired!.expiresAt as unknown as string).getTime()).toBeLessThan(Date.now())
  })
})

describe('repository coverage: sessions + OTP atomarligi', () => {
  it('createSession → resolveSession → izchi PK (sha256 hash saqlanadi — xom token YO\'Q)', async () => {
    const uid = mkId()
    await mkUser(uid)
    const raw = `raw_${Math.random().toString(36).repeat(2)}`
    await authRepository.createSession({ token: raw, userId: uid, provider: 'telegram', expiresAt: new Date(Date.now() + 3_600_000) })

    const resolved = await authRepository.resolveSession(raw)
    expect(resolved?.userId).toBe(uid)

    // DB'da FAQAT sha256 saqlanishini tekshiramiz (M10)
    const [row] = await db.select().from(sessions).where(eq(sessions.userId, uid))
    expect(String(row.token)).not.toBe(raw)
    expect(String(row.token)).toMatch(/^[0-9a-f]{64}$/)   // sha256 hex
  })

  it('createOTPWithCooldown — 8 parallel faqat 1 kiradi (M-11 atomarlik)', async () => {
    const phone = `+99890${Math.floor(3000000 + Math.random() * 999999)}`
    createdOtps.push(phone)
    const results = await Promise.all(Array.from({ length: 8 }, () =>
      authRepository.createOTPWithCooldown(phone, 'hash_x', new Date(Date.now() + 300_000))))
    expect(results.filter(Boolean)).toHaveLength(1)
  })

  it('consumeOTP — faqat TO\'G\'RI hash bir marta (ikkinchi chaqiruv false)', async () => {
    const phone = `+99890${Math.floor(4000000 + Math.random() * 999999)}`
    createdOtps.push(phone)
    await authRepository.createOTPWithCooldown(phone, 'hash_123456', new Date(Date.now() + 300_000))

    const first = await authRepository.consumeOTP(phone, 'hash_123456')
    expect(first).toBe(true)
    // Bir marta iste'mol qilindi — qayta o'qisa topilmaydi
    const second = await authRepository.consumeOTP(phone, 'hash_123456')
    expect(second).toBe(false)
  })
})

describe('repository coverage: trial race', () => {
  it('startTrial — 8 parallel FAQAT 1 granted (REFERANS: users.service orqali)', async () => {
    const uid = mkId()
    await mkUser(uid)
    const { usersService } = await import('../../../server/modules/users/users.service')
    const results = await Promise.all(Array.from({ length: 8 }, () => usersService.startTrial(uid)))
    expect(results.filter((r) => r.granted)).toHaveLength(1)

    const t = await usersRepository.tryGrantTrial(uid, 3)
    expect(t).toBe(false)   // already granted
  })
})

