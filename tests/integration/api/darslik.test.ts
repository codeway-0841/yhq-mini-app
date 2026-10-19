/**
 * Darslik mastery + XP — haqiqiy test DB dalili.
 *
 * Qamrov (handoff P0 #2):
 *  - birinchi pass: mastery v2, XP 32, daily_limits;
 *  - takroriy submit: XP qayta berilmaydi, mastery bitta qator;
 *  - parallel submit: ikki so'rovdan faqat bittasi XP oladi (atomik CTE);
 *  - v1 mastery: eski qator keyingi mavzuni ochadi, v2 qatori qo'shiladi;
 *  - XP shifti 500: to'liq va qisman cap;
 *  - curated kesh invalidation + admin regeneratsiya.
 *
 * Talab: NODE_ENV=test, TEST_DATABASE_URL (prod'dan farqli) va 0075 migratsiya.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import request from 'supertest'
import { and, eq } from 'drizzle-orm'
import { createApp } from '../../../server/app'
import { db } from '../../../server/db/connection'
import {
  dailyLimits,
  dailyRecords,
  dailyStreaks,
  darslikChecks,
  darslikMastery,
  progress,
  userCoins,
  users,
} from '../../../server/schema'
import { tashkentDate } from '../../../server/utils/date'
import { block01Checks } from '../../../server/modules/darslik/curated/block-01'
import { darslikCheckHash } from '../../../server/modules/darslik/check-cache'
import {
  DARSLIK_CHECK_VERSION,
  DARSLIK_LEGACY_CHECK_VERSION,
  type DarslikAnswers,
  type DarslikCheck,
} from '../../../shared/darslik-mastery'

const app = createApp()

const IDS = {
  first: '998877682001',
  duplicate: '998877682002',
  parallel: '998877682003',
  cap: '998877682004',
  partialCap: '998877682005',
  v1: '998877682006',
  cache: '998877682007',
  admin: '998877682008',
} as const
const ALL_IDS = Object.values(IDS)

function initData(userId: string): string {
  return `query_id=TEST&user=${encodeURIComponent(JSON.stringify({ id: Number(userId), first_name: 'Darslik' }))}&auth_date=1723000000&hash=dev`
}

function auth(userId: string) {
  return { 'x-telegram-init-data': initData(userId) }
}

const post = (userId: string, path: string, body?: object) =>
  request(app).post(path).set(auth(userId)).send(body)

const getProgress = (userId: string) =>
  request(app).get('/api/darslik/progress').set(auth(userId))

function answersFor(check: DarslikCheck): DarslikAnswers {
  return Object.fromEntries(check.questions.map(question => {
    switch (question.kind) {
      case 'mcq':
      case 'listening':
        return [question.id, String(question.correctIndex)]
      case 'input':
        return [question.id, question.answers[0]]
      case 'word_bank':
        return [question.id, question.answer]
      case 'match':
        return [question.id, question.pairs.map(pair => pair.right)]
    }
  }))
}

async function cleanup() {
  await db.delete(users).where(eq(users.id, IDS.admin))
  for (const userId of ALL_IDS) {
    await db.delete(users).where(eq(users.id, userId))
  }
}

async function resetUser(userId: string) {
  await db.delete(darslikMastery).where(eq(darslikMastery.userId, userId))
  await db.delete(dailyLimits).where(eq(dailyLimits.userId, userId))
  await db.delete(dailyRecords).where(eq(dailyRecords.userId, userId))
  await db.delete(dailyStreaks).where(eq(dailyStreaks.userId, userId))
  await db.delete(userCoins).where(eq(userCoins.userId, userId))
  await db.update(progress).set({ xp: 0 }).where(eq(progress.userId, userId))
}

async function xpOf(userId: string): Promise<number> {
  const [row] = await db.select({ xp: progress.xp }).from(progress).where(eq(progress.userId, userId))
  return row?.xp ?? 0
}

async function todaysLimit(userId: string) {
  const [row] = await db.select().from(dailyLimits)
    .where(and(eq(dailyLimits.userId, userId), eq(dailyLimits.date, tashkentDate())))
  return row
}

async function masteryRows(userId: string) {
  return db.select().from(darslikMastery).where(eq(darslikMastery.userId, userId))
}

const submitCorrect = async (userId: string, topicId: string) => {
  const check = block01Checks[topicId]
  expect(check, topicId).toBeTruthy()
  return post(userId, `/api/darslik/${encodeURIComponent(topicId)}/submit`, {
    answers: answersFor(check),
  })
}

beforeAll(async () => {
  await cleanup()
  for (const userId of ALL_IDS) {
    const res = await request(app)
      .post('/api/init')
      .set(auth(userId))
      .send({ id: userId, first_name: 'Darslik', last_name: 'Integration' })
    expect(res.status, userId).toBe(200)
  }
  await db.update(users).set({ isAdmin: true }).where(eq(users.id, IDS.admin))
})

afterAll(cleanup)

describe('darslik mastery — birinchi pass va idempotentlik', () => {
  it('birinchi pass mastery v2, 32 XP va daily_limits yozadi', async () => {
    await resetUser(IDS.first)
    expect((await getProgress(IDS.first)).body.passed).toEqual([])

    const checkRes = await post(IDS.first, '/api/darslik/1%3A0/check')
    expect(checkRes.status).toBe(200)
    expect(checkRes.body.format).toBe('lesson')

    const res = await submitCorrect(IDS.first, '1:0')
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({
      passed: true,
      correct: 6,
      total: 6,
      xpEarned: 32,
      xp: 32,
      alreadyPassed: false,
    })

    expect(await xpOf(IDS.first)).toBe(32)
    expect((await todaysLimit(IDS.first))?.xpEarned).toBe(32)

    const rows = await masteryRows(IDS.first)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ topicId: '1:0', version: DARSLIK_CHECK_VERSION })

    const progressRes = await getProgress(IDS.first)
    expect(progressRes.body.passed).toEqual(['1:0'])
    expect(progressRes.headers['cache-control']).toContain('no-store')

    // Qaror: dars mashqlari umumiy savol statistikasiga (totalCorrect/liga)
    // yozilmaydi — ular o'rganish faolligi, imtihon savoli emas.
    const [prog] = await db.select({ totalCorrect: progress.totalCorrect })
      .from(progress).where(eq(progress.userId, IDS.first))
    expect(prog?.totalCorrect).toBe(0)
  })

  it('takroriy submit XPni ikki marta bermaydi', async () => {
    await resetUser(IDS.duplicate)
    expect((await post(IDS.duplicate, '/api/darslik/1%3A0/check')).status).toBe(200)

    const first = await submitCorrect(IDS.duplicate, '1:0')
    const second = await submitCorrect(IDS.duplicate, '1:0')

    expect(first.body).toMatchObject({ passed: true, xpEarned: 32, alreadyPassed: false })
    expect(second.body).toMatchObject({ passed: true, xpEarned: 0, xp: 32, alreadyPassed: true })
    expect(await xpOf(IDS.duplicate)).toBe(32)
    expect((await todaysLimit(IDS.duplicate))?.xpEarned).toBe(32)
    expect(await masteryRows(IDS.duplicate)).toHaveLength(1)

    // Takroriy submit kunlik hisoblagichni ikki marta oshirmaydi.
    const [record] = await db.select().from(dailyRecords).where(and(
      eq(dailyRecords.userId, IDS.duplicate),
      eq(dailyRecords.date, tashkentDate()),
      eq(dailyRecords.subjectId, 'rustili'),
    ))
    expect(record?.answered).toBe(6)
    expect(record?.correct).toBe(6)
  })

  it('parallel submitda XP faqat bir marta yoziladi', async () => {
    await resetUser(IDS.parallel)
    expect((await post(IDS.parallel, '/api/darslik/1%3A0/check')).status).toBe(200)

    const [left, right] = await Promise.all([
      submitCorrect(IDS.parallel, '1:0'),
      submitCorrect(IDS.parallel, '1:0'),
    ])

    expect([left.status, right.status]).toEqual([200, 200])
    const earned = [left.body.xpEarned, right.body.xpEarned].sort((a, b) => a - b)
    expect(earned).toEqual([0, 32])
    expect(await xpOf(IDS.parallel)).toBe(32)
    expect((await todaysLimit(IDS.parallel))?.xpEarned).toBe(32)
    expect(await masteryRows(IDS.parallel)).toHaveLength(1)
  })
})

describe('darslik mastery — XP shifti va v1 moslik', () => {
  it('kunlik XP shifti to‘lgan bo‘lsa XP bermaydi, lekin mastery yoziladi', async () => {
    await resetUser(IDS.cap)
    await db.insert(dailyLimits).values({
      userId: IDS.cap,
      date: tashkentDate(),
      xpEarned: 500,
      coinsEarned: 0,
    })

    const res = await submitCorrect(IDS.cap, '1:0')
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ passed: true, xpEarned: 0 })
    expect(await xpOf(IDS.cap)).toBe(0)
    expect((await todaysLimit(IDS.cap))?.xpEarned).toBe(500)
    expect(await masteryRows(IDS.cap)).toHaveLength(1)
  })

  it('shiftga qisman joy qolsa faqat qolgan qism beriladi', async () => {
    await resetUser(IDS.partialCap)
    await db.insert(dailyLimits).values({
      userId: IDS.partialCap,
      date: tashkentDate(),
      xpEarned: 490,
      coinsEarned: 0,
    })

    const res = await submitCorrect(IDS.partialCap, '1:0')
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ passed: true, xpEarned: 10, xp: 10 })
    expect(await xpOf(IDS.partialCap)).toBe(10)
    expect((await todaysLimit(IDS.partialCap))?.xpEarned).toBe(500)
  })

  it('v1 mastery keyingi mavzuni ochadi va v2 qatori qo‘shiladi', async () => {
    await resetUser(IDS.v1)
    await db.insert(darslikMastery).values({
      userId: IDS.v1,
      topicId: '1:0',
      version: DARSLIK_LEGACY_CHECK_VERSION,
    })

    expect((await getProgress(IDS.v1)).body.passed).toEqual(['1:0'])
    const nextCheck = await post(IDS.v1, '/api/darslik/1%3A1/check')
    expect(nextCheck.status).toBe(200)
    expect(nextCheck.body.format).toBe('lesson')

    const res = await submitCorrect(IDS.v1, '1:1')
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ passed: true, xpEarned: 32 })

    const rows = await masteryRows(IDS.v1)
    expect(rows).toHaveLength(2)
    expect(rows).toContainEqual(expect.objectContaining({
      topicId: '1:0', version: DARSLIK_LEGACY_CHECK_VERSION,
    }))
    expect(rows).toContainEqual(expect.objectContaining({
      topicId: '1:1', version: DARSLIK_CHECK_VERSION,
    }))
    expect((await getProgress(IDS.v1)).body.passed.sort()).toEqual(['1:0', '1:1'])
  })
})

describe('darslik kesh invalidation — curated va admin', () => {
  it('eski AI kesh qatori curated bilan almashtiriladi (hash bo‘yicha)', async () => {
    await resetUser(IDS.cache)
    const curated = block01Checks['1:0']
    const stale = block01Checks['1:1']
    await db.insert(darslikChecks).values({
      topicId: '1:0',
      version: DARSLIK_CHECK_VERSION,
      payload: stale,
      contentHash: 'stale-ai-hash',
      source: 'ai',
    }).onConflictDoUpdate({
      target: [darslikChecks.topicId, darslikChecks.version],
      set: { payload: stale, contentHash: 'stale-ai-hash', source: 'ai' },
    })

    const res = await post(IDS.cache, '/api/darslik/1%3A0/check')
    expect(res.status).toBe(200)
    expect(res.body.questions).toHaveLength(curated.questions.length)

    const [row] = await db.select().from(darslikChecks)
      .where(and(eq(darslikChecks.topicId, '1:0'), eq(darslikChecks.version, DARSLIK_CHECK_VERSION)))
    expect(row?.source).toBe('curated')
    expect(row?.contentHash).toBe(darslikCheckHash(curated))
    expect(row?.payload).toEqual(curated)
  })

  it('admin 1-blok keshini regeneratsiya qiladi, oddiy user 403 oladi', async () => {
    const forbidden = await post(IDS.cache, '/api/admin/darslik/regenerate', { blockId: 1 })
    expect(forbidden.status).toBe(403)

    const res = await post(IDS.admin, '/api/admin/darslik/regenerate', { blockId: 1 })
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ topics: 12, invalidated: expect.any(Number), curatedReseeded: 12 })

    const [row] = await db.select().from(darslikChecks)
      .where(and(eq(darslikChecks.topicId, '1:0'), eq(darslikChecks.version, DARSLIK_CHECK_VERSION)))
    expect(row?.source).toBe('curated')
    expect(row?.contentHash).toBe(darslikCheckHash(block01Checks['1:0']))
  })
})
