/**
 * Chempionlar tarixi (FIXPLAN #47) — GET /api/leaderboard/tournament-history
 *
 * Qamrov:
 *  - mavsumlar periodKey DESC guruhlangan (eng yangi birinchi)
 *  - har davr ichida g'oliblar rank ASC; podium ma'lumotlari to'liq
 *  - isYou FAQAT caller userId'ga teng qatorda true
 *  - limit DAVRGA qo'llanadi (qatorlarga emas — podium o'rtadan kesilmaydi)
 *
 * Requires real DATABASE_URL (tests/setup.ts .env yuklaydi).
 * Boshqa hech bir test tournament_prizes'ga yozmaydi (cron prod'da ishlaydi),
 * shu uchun global holat deterministik — faqat o'z userlarimiz qatorlari.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import { eq, inArray } from 'drizzle-orm'
import { createApp } from '../../../server/app'
import { db } from '../../../server/db/connection'
import { tournamentPrizes, users } from '../../../server/schema'
import { usersRepository } from '../../../server/modules/users/users.repository'

const app = createApp()

const U_A = '777000333001'   // P_NEW chempioni (rank 1) + P_OLD rank 2
const U_B = '777000333002'   // P_OLD chempioni (rank 1) + P_NEW rank 3
const U_C = '777000333003'   // faqat P_NEW rank 2
const IDS = [U_A, U_B, U_C]

const P_OLD = '2026-07-27'
const P_NEW = '2026-08-03'

async function cleanup() {
  await db.delete(tournamentPrizes).where(inArray(tournamentPrizes.userId, IDS))
  for (const id of IDS) {
    await db.delete(users).where(eq(users.id, id)) // FK cascade
  }
}

beforeAll(async () => {
  await cleanup()
  await usersRepository.initAtomic({ id: U_A, firstName: 'Alisher', lastName: 'Karim', username: '', photoUrl: '' })
  await usersRepository.initAtomic({ id: U_B, firstName: 'Bekzod', lastName: 'Rahim', username: '', photoUrl: '' })
  await usersRepository.initAtomic({ id: U_C, firstName: 'Charos', lastName: 'Nazar', username: '', photoUrl: '' })

  await db.insert(tournamentPrizes).values([
    { periodKey: P_OLD, userId: U_B, rank: 1, score: 120, league: 'silver', prizeDays: 30 },
    { periodKey: P_OLD, userId: U_A, rank: 2, score: 100, league: 'bronze', prizeDays: 14 },
    { periodKey: P_NEW, userId: U_A, rank: 1, score: 200, league: 'gold', prizeDays: 30 },
    { periodKey: P_NEW, userId: U_C, rank: 2, score: 150, league: 'silver', prizeDays: 14 },
    { periodKey: P_NEW, userId: U_B, rank: 3, score: 90, league: 'bronze', prizeDays: 7 },
  ])
})

afterAll(cleanup)

describe('GET /api/leaderboard/tournament-history (#47)', () => {
  it('mavsumlar yangi→eski tartibda, g\'oliblar rank ASC, podium to\'liq', async () => {
    const res = await request(app)
      .get(`/api/leaderboard/tournament-history?limit=6&userId=${U_A}`)
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)

    const seasons = res.body.seasons as Array<{
      periodKey: string
      winners: Array<{ rank: number; userId: string; isYou: boolean; score: number; prizeDays: number; name: string }>
    }>
    expect(seasons.length).toBe(2)
    expect(seasons.map((s) => s.periodKey)).toEqual([P_NEW, P_OLD])

    // Yangi davr: 3 g'olib, rank ASC
    expect(seasons[0].winners.length).toBe(3)
    expect(seasons[0].winners.map((w) => w.rank)).toEqual([1, 2, 3])
    expect(seasons[0].winners[0]).toMatchObject({
      rank: 1, userId: U_A, name: 'Alisher Karim', score: 200, prizeDays: 30, isYou: true,
    })
    // Podium o'rtadan kesilmagan: 2-g'olib ma'lumotlari ham to'liq
    expect(seasons[0].winners[1]).toMatchObject({ rank: 2, userId: U_C, score: 150, prizeDays: 14, isYou: false })

    // Eski davr: 2 g'olib
    expect(seasons[1].winners.length).toBe(2)
    expect(seasons[1].winners[0]).toMatchObject({ rank: 1, userId: U_B, score: 120, isYou: false })
  })

  it('limit=1 → FAQAT eng yangi davr (LIMIT davrga, qatorlarga emas)', async () => {
    const res = await request(app).get('/api/leaderboard/tournament-history?limit=1')
    expect(res.status).toBe(200)
    expect(res.body.seasons.length).toBe(1)
    expect(res.body.seasons[0].periodKey).toBe(P_NEW)
    expect(res.body.seasons[0].winners.length).toBe(3) // podium butun
  })

  it('userId\'siz → isYou hamma qatorda false', async () => {
    const res = await request(app).get('/api/leaderboard/tournament-history?limit=6')
    expect(res.status).toBe(200)
    const all = res.body.seasons.flatMap((s: { winners: Array<{ isYou: boolean }> }) => s.winners)
    expect(all.length).toBeGreaterThan(0)
    expect(all.every((w: { isYou: boolean }) => w.isYou === false)).toBe(true)
  })

  it('g\'oliblar avatar flaglari mavjud (leaderboard kontrakti bilan bir xil)', async () => {
    const res = await request(app).get(`/api/leaderboard/tournament-history?limit=1&userId=${U_B}`)
    const w = res.body.seasons[0].winners[0]
    expect(w).toHaveProperty('photoUrl')
    expect(w).toHaveProperty('hasCustomAvatar')
    expect(w).toHaveProperty('avatarFrame')
    expect(w.hasCustomAvatar).toBe(false)
    expect(w.avatarFrame).toBeNull()
  })
})
