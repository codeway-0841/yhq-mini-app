/**
 * Integration tests — Vercel Cron endpoint'lari (MB-4: league-rollover retry-safe).
 *
 *  1) cron-auth fail-closed: noto'g'ri secret → 401
 *  2) rollover happy path: promote/demote jarayoni + qayta chaqiruv skipped
 *  3) CRASH-RESUME regression: reja jurnali bor holatda qayta ishga tushirish
 *     REJALASHTIRISHNI SKIP qiladi — apply `league = fromLeague` guard bilan
 *     (eski bug: qayta ishga tushish JORIY ligadan hisoblar, promote kaskadiga
 *     olib kelardi: silver→gold→platinum bir kechada).
 *
 * REQUIREMENTS: TEST_DATABASE_URL (.env). CRON_SECRET test boshida o'rnatiladi
 * (config uni startup snapshot'ida o'qiydi — modul importi dynamic shu sababli).
 */

process.env.CRON_SECRET ||= 'integration-test-cron-secret'

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { eq, and, inArray, sql } from 'drizzle-orm'

const { createApp } = await import('../../../server/app')
const { db } = await import('../../../server/db/connection')
const { users, progress, dailyRecords, jobRuns, leagueRolloverLog } = await import('../../../server/schema')
const { usersRepository } = await import('../../../server/modules/users/users.repository')
const { weekStartTashkent } = await import('../../../server/modules/leaderboard/leaderboard.repository')
const request = (await import('supertest')).default

const app = createApp()
const SECRET = process.env.CRON_SECRET

// ── Test user'lari (boshqa testlar bilan to'qnashmaydigan id'lar) ──────────
// DIQQAT: test DB umumiy — rollover BUTUN bazadagi userlarni ko'radi; shuning
// uchun ballar BOSQICHMA (900/800/700) — har qanday qoldiq pool'da ham U1 TOP.
// U2/U3 promote/demote natijasi pool hajmiga bog'liq → ularga assert YO'Q.
const U1 = 'crontest_roll_1'   // bronze, TOP score  → promote bronze→silver (kafolatli)
const U2 = 'crontest_roll_2'   // bronze, mid score  → pool hajmiga bog'liq
const U3 = 'crontest_roll_3'   // bronze, low score  → pool hajmiga bog'liq
const U4 = 'crontest_roll_4'   // gold + nofaol (0 ball) → demote gold→silver (pool'dan MUSTAQIL)
const CLEAN = [U1, U2, U3, U4]

const wPrev = weekStartTashkent(1)
// O'tgan haftada bir kun — rollover hisobi [wPrev, wThis) oralig'iga tushishi shart
const dayInPrevWeek = new Date(Date.parse(wPrev + 'T00:00:00Z') + 2 * 86_400_000).toISOString().slice(0, 10)

async function daily(userId: string, correct: number) {
  // vitest retry-safe: flayk retry'da uq_daily_record dublikat bo'lmasin
  await db.insert(dailyRecords).values({ userId, date: dayInPrevWeek, subjectId: 'yhq', answered: correct, correct })
    .onConflictDoUpdate({
      target: [dailyRecords.userId, dailyRecords.date, dailyRecords.subjectId],
      set: { answered: correct, correct },
    })
}

async function leagueOf(userId: string): Promise<string> {
  const [row] = await db.select({ league: progress.league }).from(progress).where(eq(progress.userId, userId))
  return row?.league ?? 'none'
}

async function cleanup() {
  await db.delete(users).where(inArray(users.id, CLEAN))  // cascade: progress/daily/rollover_log
  await db.delete(jobRuns).where(and(eq(jobRuns.jobName, 'league-rollover'), eq(jobRuns.periodKey, wPrev)))
  await db.delete(leagueRolloverLog).where(eq(leagueRolloverLog.periodKey, wPrev))
}

beforeAll(async () => {
  await cleanup()
  for (const u of CLEAN) {
    await usersRepository.initAtomic({ id: u, firstName: 'Cron', lastName: 'T', username: u, photoUrl: '' })
  }
  await db.update(progress).set({ league: 'gold' }).where(eq(progress.userId, U4))
  await daily(U1, 900)
  await daily(U2, 800)
  await daily(U3, 700)
  // U4: nofaol — daily_records qatori yo'q
})
afterAll(cleanup)

describe('GET /api/cron/league-rollover', () => {
  it('noto\'g\'ri secret bilan → 401 (fail-closed)', async () => {
    const res = await request(app).get('/api/cron/league-rollover')
      .set('Authorization', 'Bearer xato-secret')
    expect(res.status).toBe(401)
  })

  it('rollover: promote/demote to\'g\'ri, qayta chaqiruv skipped', async () => {
    const res = await request(app).get('/api/cron/league-rollover')
      .set('Authorization', `Bearer ${SECRET}`)
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
    expect(res.body.promoted).toBeGreaterThanOrEqual(1)   // U1 kesin orasida
    expect(res.body.demoted).toBeGreaterThanOrEqual(1)    // U4 kesin orasida

    // Pool-dominant U1 → birinchi promote (bronze pool'da eng katta ball)
    expect(await leagueOf(U1)).toBe('silver')
    // Nofaol gold → mustaqil demote (boshqa userlar ballidan ta'sirlanmaydi)
    expect(await leagueOf(U4)).toBe('silver')

    // Period completed — qayta chaqiruv SKIP (guard)
    const again = await request(app).get('/api/cron/league-rollover')
      .set('Authorization', `Bearer ${SECRET}`)
    expect(again.status).toBe(200)
    expect(again.body.skipped).toBe(true)
  })

  it('CRASH-RESUME: reja jurnalidan davom — kaskad YO\'Q (MB-4 regression)', async () => {
    // Crash holatini simulyatsiya qilamiz: jobRuns qatorini o'chirib
    // 'running' lease qayta olinsin; reja jurnali (oldingi testdan) SAQLANADI,
    // liga holati esa qisman o'zgargan (U1 silver — allaqachon bajarilgan).
    // QAYTA REJALASHTIRISH bo'lsa — U1 yana promote bo'lib GOLD bo'lardi.
    // Guard'li APPLY esa U1'ni skip qiladi (joriy liga silver ≠ from bronze).
    const U5 = 'crontest_roll_5'
    await usersRepository.initAtomic({ id: U5, firstName: 'Cron', lastName: 'T', username: U5, photoUrl: '' })
    await daily(U5, 8)
    CLEAN.push(U5)
    // U5 uchun "crash'da yozilgan" sun'iy reja qatori
    await db.insert(leagueRolloverLog).values({ userId: U5, periodKey: wPrev, fromLeague: 'bronze', toLeague: 'silver' }).onConflictDoNothing()
    await db.delete(jobRuns).where(and(eq(jobRuns.jobName, 'league-rollover'), eq(jobRuns.periodKey, wPrev)))

    const res = await request(app).get('/api/cron/league-rollover')
      .set('Authorization', `Bearer ${SECRET}`)
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)

    // U1: allaqachon silver — guard uni skip qiladi (kaskad bo'lsa GOLD bo'lardi!)
    expect(await leagueOf(U1)).toBe('silver')
    // U5: reja jurnalidagi bronza→silver transition endi bajarildi
    expect(await leagueOf(U5)).toBe('silver')
    // Reja qayta yozilmagan (SKIP planning) — promoted faqat reja elementlaridan
    expect(res.body.planned).toBeGreaterThan(0)
  })
})
