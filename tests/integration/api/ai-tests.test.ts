/**
 * AI KUNLIK TEST (rustili) — integration testlar (real test DB).
 *
 * Qamrov:
 *  - GET /ai-tests/today: auth guard + ro'yxat shakli + premiumRequired bayrog'i
 *  - GET /ai-tests/:id — javob kalitlarisiz payload (TRUST BOUNDARY),
 *    slot 2 premium gate (403), urinishdan keyin 409
 *  - POST /ai-tests/:id/submit — deterministik baholash + ATOMIK coin mint
 *    (ledger 'ai_test'), idempotency (clientToken retry = duplicate, coin×1),
 *    1-urinish cheklovi (boshqa token bilan ham duplicate), AI esse yo'li (mock Gemini)
 *  - GET /ai-tests/:id/result — post-submit reveal (grading + answers + public test)
 *
 * Izolyatsiya: submit-flow testlari subjectId='rustili_itest' + SOXTA sana
 * ('1999-01-01') — real scheduler ma'lumotiga tegmaydi; /today testi esa real
 * 'rustili'+bugun'ga FAQAT o'zi yozgan slot'larni kiritadi/o'chiradi.
 */

import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { eq, inArray, sql } from 'drizzle-orm'
import { randomBytes } from 'crypto'
import type { AiTestPayload } from '../../../shared/ai-daily-test'

const { createApp } = await import('../../../server/app')
const { db, executeRows } = await import('../../../server/db/connection')
const { users, aiDailyTests, aiDailyTestAttempts, tutorUsage } = await import('../../../server/schema')
const { usersRepository } = await import('../../../server/modules/users/users.repository')
const { authRepository } = await import('../../../server/modules/auth/auth.repository')
const { coinsRepository } = await import('../../../server/modules/coins/coins.repository')
const { config } = await import('../../../server/config')
const {
  AI_TEST_SUBJECT_ID, AI_TEST_GRADE_GLOBAL_USER_ID, AI_TEST_COIN_PER_CORRECT,
} = await import('../../../shared/ai-daily-test')
const { tashkentDate } = await import('../../../server/utils/date')
const request = (await import('supertest')).default

const app = createApp()

const FREE = '990000006001'
const PREM = '990000006002'
const IDS = [FREE, PREM]
const TOKENS: Record<string, string> = {}
const FAKE_DATE = '1999-01-01'
const FAKE_SUBJECT = 'rustili_itest'

/** Kichik (5 topshiriq) lekin to'liq formatdagi payload — grading 45 talab qilmaydi */
function miniPayload(slot: number): AiTestPayload {
  return {
    version: 1,
    title: `Вариант №${slot}`,
    contexts: [{ id: 'ctx-1', text: '(1) Литература бередит душу. (2) Книги живут веками. (3) Чтение — личное занятие.' }],
    tasks: [
      { kind: 'mcq', id: 'mcq-1', topic: 'Орфография', prompt: 'В каком слове пишется НН?',
        options: [{ id: 'A1', text: 'серебряный' }, { id: 'A2', text: 'серебреный' }, { id: 'A3', text: 'сирибряный' }, { id: 'A4', text: 'серебрянный' }],
        correctOptionId: 'A1' },
      { kind: 'mcq', id: 'mcq-2', topic: 'Пунктуация', prompt: 'Где запятые расставлены верно?',
        options: [{ id: 'A1', text: 'Первый' }, { id: 'A2', text: 'Второй' }, { id: 'A3', text: 'Третий' }, { id: 'A4', text: 'Четвёртый' }],
        correctOptionId: 'A3' },
      { kind: 'matching', id: 'match-1', topic: 'Тропы', prompt: 'Соотнесите строки и тропы',
        left: [{ id: 'L1', text: 'строка а' }, { id: 'L2', text: 'строка б' }, { id: 'L3', text: 'строка в' }],
        right: [{ id: 'R1', text: 'Метафора' }, { id: 'R2', text: 'Сравнение' }, { id: 'R3', text: 'Эпитет' }],
        correct: { L1: 'R1', L2: 'R2', L3: 'R3' } },
      { kind: 'short', id: 'short-1', topic: 'Лексика', contextId: 'ctx-1',
        prompt: 'Выпишите фразеологизм из предложения (1).', acceptedAnswers: ['бередит душу'] },
      { kind: 'essay', id: 'essay-1', topic: 'Чтение', prompt: 'Напишите эссе о чтении (150–200 слов).', minWords: 150, maxWords: 200 },
    ],
  }
}

/** Barcha deterministik topshiriqlar to'g'ri (4 coin); esse bo'sh */
function allCorrect() {
  return {
    mcq: { 'mcq-1': 'A1', 'mcq-2': 'A3' },
    matching: { 'match-1': { L1: 'R1', L2: 'R2', L3: 'R3' } },
    short: { 'short-1': 'Бередит душу!' },   // normalize test ham shu yerda
    essay: '',
  }
}

let slot1Id: number
let slot2Id: number
const createdTestIds: number[] = []
const realFetch = globalThis.fetch
const ORIGINAL_KEY = config.ai.geminiApiKey

async function insertTest(subjectId: string, date: string, slot: number): Promise<number> {
  const rows = await executeRows<{ id: number }>(sql`
    INSERT INTO ai_daily_tests (subject_id, date, slot, title, payload)
    VALUES (${subjectId}, ${date}, ${slot}, ${`Вариант №${slot}`}, ${JSON.stringify(miniPayload(slot))}::jsonb)
    ON CONFLICT (subject_id, date, slot) DO NOTHING
    RETURNING id
  `)
  if (rows.length > 0) {
    createdTestIds.push(Number(rows[0].id))
    return Number(rows[0].id)
  }
  const existing = await executeRows<{ id: number }>(sql`
    SELECT id FROM ai_daily_tests WHERE subject_id = ${subjectId} AND date = ${date} AND slot = ${slot}
  `)
  return Number(existing[0]!.id)
}

async function cleanup() {
  await db.delete(aiDailyTestAttempts).where(inArray(aiDailyTestAttempts.userId, IDS))
  await db.delete(tutorUsage).where(eq(tutorUsage.userId, AI_TEST_GRADE_GLOBAL_USER_ID))
  for (const id of IDS) await db.delete(users).where(eq(users.id, id))  // FK cascade: sessions, coins
  if (createdTestIds.length > 0) {
    await db.delete(aiDailyTests).where(inArray(aiDailyTests.id, createdTestIds))
  }
}

beforeAll(async () => {
  await cleanup()
  for (const id of IDS) {
    await usersRepository.initAtomic({ id, firstName: 'AiTest', lastName: id.slice(-2), username: '', photoUrl: '' })
    await authRepository.ensureIdentity('telegram', id, id)
    const token = randomBytes(32).toString('hex')
    await authRepository.createSession({ token, userId: id, provider: 'telegram', expiresAt: new Date(Date.now() + 3_600_000) })
    TOKENS[id] = token
  }
  await db.update(users).set({ tariff: 'premium' }).where(eq(users.id, PREM))

  slot1Id = await insertTest(FAKE_SUBJECT, FAKE_DATE, 1)
  slot2Id = await insertTest(FAKE_SUBJECT, FAKE_DATE, 2)
})

afterEach(() => {
  globalThis.fetch = realFetch
})

afterAll(async () => {
  config.ai.geminiApiKey = ORIGINAL_KEY
  globalThis.fetch = realFetch
  await cleanup()
})

describe('ai-tests — GET /today', () => {
  it('auth\'siz 401; ro\'yxat shakli + premiumRequired (slot 2)', async () => {
    await request(app).get(`/api/ai-tests/today?subject=${AI_TEST_SUBJECT_ID}`).expect(401)

    // /today uchun REAL sana+subject'ga slot yozamiz (faqat o'zimiznikini o'chiramiz)
    const today = tashkentDate()
    const mySlot = await insertTest(AI_TEST_SUBJECT_ID, today, 1)

    const res = await request(app).get(`/api/ai-tests/today?subject=${AI_TEST_SUBJECT_ID}`)
      .set('Authorization', `Bearer ${TOKENS[FREE]}`).expect(200)
    expect(res.body.ok).toBe(true)
    expect(res.body.date).toBe(today)
    expect(Array.isArray(res.body.tests)).toBe(true)
    const mine = (res.body.tests as { id: number; premiumRequired: boolean; attempted: boolean; taskCount: number }[])
      .find((t) => t.id === mySlot)
    expect(mine).toBeDefined()
    expect(mine!.taskCount).toBe(5)
    expect(mine!.premiumRequired).toBe(false)
    expect(mine!.attempted).toBe(false)

    // Noma'lum fan → 404
    await request(app).get('/api/ai-tests/today?subject=bunday_fan_yoq')
      .set('Authorization', `Bearer ${TOKENS[FREE]}`).expect(404)
  })
})

describe('ai-tests — GET /:id (trust boundary + premium gate)', () => {
  it('payload\'da javob kalitlari YO\'Q; slot 2 free userga 403, premium\'ga 200', async () => {
    const res = await request(app).get(`/api/ai-tests/${slot1Id}`)
      .set('Authorization', `Bearer ${TOKENS[FREE]}`).expect(200)
    expect(res.body.test.tasks.length).toBe(5)
    for (const t of res.body.test.tasks) {
      expect(t).not.toHaveProperty('correctOptionId')
      expect(t).not.toHaveProperty('correct')
      expect(t).not.toHaveProperty('acceptedAnswers')
    }

    await request(app).get(`/api/ai-tests/${slot2Id}`)
      .set('Authorization', `Bearer ${TOKENS[FREE]}`).expect(403)
    await request(app).get(`/api/ai-tests/${slot2Id}`)
      .set('Authorization', `Bearer ${TOKENS[PREM]}`).expect(200)

    await request(app).get('/api/ai-tests/abc')
      .set('Authorization', `Bearer ${TOKENS[FREE]}`).expect(400)
  })

  it('ertangi test ID orqali erta ochilmaydi va submit qilinmaydi', async () => {
    const tomorrow = tashkentDate(new Date(Date.now() + 24 * 3600_000))
    const futureId = await insertTest(FAKE_SUBJECT, tomorrow, 1)

    await request(app).get(`/api/ai-tests/${futureId}`)
      .set('Authorization', `Bearer ${TOKENS[FREE]}`).expect(404)

    await request(app).post(`/api/ai-tests/${futureId}/submit`)
      .set('Authorization', `Bearer ${TOKENS[FREE]}`)
      .send({ answers: allCorrect(), clientToken: randomBytes(16).toString('hex') })
      .expect(404)
  })
})

describe('ai-tests — submit (baholash + coin + idempotency)', () => {
  it('to\'g\'ri javoblar → grading + ATOMIK coin mint + ledger; retry = duplicate (coin×1)', async () => {
    const bal0 = (await coinsRepository.getEconomyState(FREE)).coins
    const clientToken = randomBytes(16).toString('hex')

    const res = await request(app).post(`/api/ai-tests/${slot1Id}/submit`)
      .set('Authorization', `Bearer ${TOKENS[FREE]}`)
      .send({ answers: allCorrect(), clientToken })
      .expect(200)

    expect(res.body.duplicate).toBe(false)
    expect(res.body.grading.correctCount).toBe(4)      // 2 mcq + 1 matching + 1 short
    expect(res.body.grading.short['short-1'].correct).toBe(true)   // normalize ishladi
    expect(res.body.coinsAwarded).toBe(4 * AI_TEST_COIN_PER_CORRECT)

    const bal1 = (await coinsRepository.getEconomyState(FREE)).coins
    expect(bal1).toBe(bal0 + 4)
    const ledger = (await coinsRepository.getHistory(FREE, 20)).filter((h) => h.reason === 'ai_test')
    expect(ledger.length).toBe(1)
    expect(ledger[0].refId).toBe(`ai_test:${slot1Id}:${FREE}`)

    // RETRY (xuddi shu clientToken) — duplicate, coin QAYTA yozilmaydi
    const res2 = await request(app).post(`/api/ai-tests/${slot1Id}/submit`)
      .set('Authorization', `Bearer ${TOKENS[FREE]}`)
      .send({ answers: allCorrect(), clientToken })
      .expect(200)
    expect(res2.body.duplicate).toBe(true)
    expect(res2.body.grading.correctCount).toBe(4)
    expect((await coinsRepository.getEconomyState(FREE)).coins).toBe(bal0 + 4)

    // BOSHQA token — 1-urinish cheklovi (baribir duplicate)
    const res3 = await request(app).post(`/api/ai-tests/${slot1Id}/submit`)
      .set('Authorization', `Bearer ${TOKENS[FREE]}`)
      .send({ answers: allCorrect(), clientToken: randomBytes(16).toString('hex') })
      .expect(200)
    expect(res3.body.duplicate).toBe(true)
    expect((await coinsRepository.getEconomyState(FREE)).coins).toBe(bal0 + 4)

    // Urinishdan keyin GET /:id → 409 already_attempted
    await request(app).get(`/api/ai-tests/${slot1Id}`)
      .set('Authorization', `Bearer ${TOKENS[FREE]}`).expect(409)

    // /result — reveal (grading + answers + public test)
    const rr = await request(app).get(`/api/ai-tests/${slot1Id}/result`)
      .set('Authorization', `Bearer ${TOKENS[FREE]}`).expect(200)
    expect(rr.body.attempt.grading.mcq['mcq-1'].correctOptionId).toBe('A1')
    expect(rr.body.attempt.answers.mcq['mcq-1']).toBe('A1')
    expect(rr.body.test.tasks.length).toBe(5)
    // Begona user result'ni ololmaydi
    await request(app).get(`/api/ai-tests/${slot1Id}/result`)
      .set('Authorization', `Bearer ${TOKENS[PREM]}`).expect(404)
  })

  it('slot 2 (premium): free user submit → 403; premium → 200', async () => {
    await request(app).post(`/api/ai-tests/${slot2Id}/submit`)
      .set('Authorization', `Bearer ${TOKENS[FREE]}`)
      .send({ answers: allCorrect(), clientToken: randomBytes(16).toString('hex') })
      .expect(403)

    const res = await request(app).post(`/api/ai-tests/${slot2Id}/submit`)
      .set('Authorization', `Bearer ${TOKENS[PREM]}`)
      .send({ answers: allCorrect(), clientToken: randomBytes(16).toString('hex') })
      .expect(200)
    expect(res.body.grading.correctCount).toBe(4)
  })

  it('ESSE yo\'li: mock Gemini baholaydi → essay score + qo\'shimcha coin', async () => {
    // Yangi slot (toza user+test juftligi kerak — PREM slot2'ni allaqachon yechdi)
    const slotAiId = await insertTest(FAKE_SUBJECT, FAKE_DATE, 1) // mavjud — qayta ishlatamiz, user PREM uchun yangi emas
    void slotAiId
    // PREM uchun alohida test (slot 1, boshqa sana) — toza holat
    const aiTestId = await insertTest(FAKE_SUBJECT, '1999-01-02', 1)

    config.ai.geminiApiKey = 'test-gemini-key'
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).includes('generativelanguage.googleapis.com')) {
        return {
          ok: true, status: 200,
          json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify({ essay: { score: 8, feedback: 'Хороший тезис и аргументы.' }, shortReview: [] }) }] } }] }),
          text: async () => '',
        } as unknown as Response
      }
      return realFetch(input as RequestInfo, init)
    }) as unknown as typeof fetch

    const bal0 = (await coinsRepository.getEconomyState(PREM)).coins
    const res = await request(app).post(`/api/ai-tests/${aiTestId}/submit`)
      .set('Authorization', `Bearer ${TOKENS[PREM]}`)
      .send({
        answers: { ...allCorrect(), essay: 'Чтение развивает личность. '.repeat(30) },
        clientToken: randomBytes(16).toString('hex'),
      })
      .expect(200)

    expect(res.body.grading.essay.score).toBe(8)
    expect(res.body.grading.essayScore).toBe(8)
    // 4 deterministik + round(8/10*6)=5 esse coin
    expect(res.body.coinsAwarded).toBe(4 + 5)
    expect((await coinsRepository.getEconomyState(PREM)).coins).toBe(bal0 + 9)
  })
})
