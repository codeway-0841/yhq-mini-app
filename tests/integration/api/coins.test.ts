/**
 * COINS iqtisodiyoti (FIXPLAN #40) — integration testlar (real test DB).
 *
 * Qamrov:
 *  - MINT qoidalari: faqat gate'dan o'tgan TO'G'RI javob +1; xato/replay/gate → 0
 *  - Purchase ATOMIK: race double-debit yo'q, idempotency (purchaseId retry),
 *    already_owned guard, insufficient guard
 *  - premium-days consumable: premium_until uzaydi, user_items YO'Q, tariff 'free' (C-1)
 *  - Equip guard: egaliksiz ramka 403; egalikdan keyin users.avatar_frame yoziladi
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import request from 'supertest'
import postgres from 'postgres'
import { randomBytes } from 'crypto'
import { eq, sql } from 'drizzle-orm'
import { createApp } from '../../../server/app'
import { db, executeRows, getSqlTx } from '../../../server/db/connection'
import { questions, users } from '../../../server/schema'
import { usersRepository } from '../../../server/modules/users/users.repository'
import { authRepository } from '../../../server/modules/auth/auth.repository'
import { coinsRepository } from '../../../server/modules/coins/coins.repository'
import { progressRepository } from '../../../server/modules/progress/progress.repository'
import { config } from '../../../server/config'
import {
  getShopItem, isShopItemAvailable,
  COINS_PER_CORRECT_ANSWER, COINS_PER_MISTAKE_FIXED,
} from '../../../shared/shop-items'
import { SPIN_SEGMENTS, getSpinSegment } from '../../../shared/lucky-spin'
import { getMerchItem } from '../../../shared/merch-items'
import { getDailyTask } from '../../../shared/daily-tasks'
import { tashkentDate } from '../../../server/utils/date'

const app = createApp()

const USER_A = '990000004001'
const USER_B = '990000004002'
// USER_C: consumable-race testi uchun ALOHIDA — USER_B'ning 'coins:purchase'
// rate-limit bucket'i (10/min) allaqachon bir nechta subtestda ishlatiladi;
// yana 2 ta so'rov qo'shish CI'da (retry:2 + tarmoq kechikishi bilan) 429ga
// olib kelgan edi.
const USER_C = '990000004003'
const USER_D = '990000004004'
// USER_E: per-10-fixes testi uchun ALOHIDA — USER_D merch testlarida
// balansi qo'lda o'rnatiladi (setBalance), ya'ni javob mint'i bilan
// bir foydalanuvchini bo'lishish ikkala testni ham buzadi.
const USER_E = '990000004005'
const USER_F = '990000004006'
const USER_G = '990000004007'
const IDS = [USER_A, USER_B, USER_C, USER_D, USER_E, USER_F, USER_G]

/** Per-10-fixes testi uchun test O'ZI yaratadigan savollar (CI bazasida
 *  yetarli savol yo'q). 'a' — to'g'ri, 'b' — xato. */
const FIX_QUESTION_IDS = Array.from({ length: 10 }, (_, i) => 998001 + i)

async function cleanup() {
  for (const id of IDS) {
    await db.delete(users).where(eq(users.id, id))   // FK cascade: coins/items/sessions/tokens
  }
  for (const qid of FIX_QUESTION_IDS) {
    await db.delete(questions).where(eq(questions.id, qid))
  }
}

/** Per-10-fixes testi uchun savollarni yaratish — idempotent (onConflictDoNothing). */
async function seedFixQuestions() {
  for (const [i, id] of FIX_QUESTION_IDS.entries()) {
    await db.insert(questions).values({
      id,
      externalId: `coins_fix_${id}`,
      questionUz: `Coins fix savol ${i + 1}`,
      questionRu: `Coins fix вопрос ${i + 1}`,
      optionsUz: { a: '1', b: '2' },
      optionsRu: { a: '1', b: '2' },
      correctAnswer: 'a',
    }).onConflictDoNothing()
  }
}

async function createUserWithSession(id: string): Promise<string> {
  await usersRepository.initAtomic({ id, firstName: 'Coins', lastName: 'Test', username: '', photoUrl: '' })
  await authRepository.ensureIdentity('telegram', id, id)
  const token = randomBytes(32).toString('hex')
  await authRepository.createSession({
    token, userId: id, provider: 'telegram',
    expiresAt: new Date(Date.now() + 3_600_000),
  })
  return token
}

/** DB orqali balans berish (300 ta javob mock'lash o'rniga — deterministik) */
async function setBalance(userId: string, balance: number) {
  await executeRows(sql`
    INSERT INTO user_coins (user_id, balance) VALUES (${userId}, ${balance})
    ON CONFLICT (user_id) DO UPDATE SET balance = ${balance}
  `)
}

async function getBalance(userId: string): Promise<number> {
  return (await coinsRepository.getEconomyState(userId)).coins
}

/** daily_records seed (vazifa/merch testlari progress'ini deterministik sozlash) */
async function seedDaily(userId: string, answered: number, correct: number, fixed: number) {
  await executeRows(sql`
    INSERT INTO daily_records (user_id, date, subject_id, answered, correct, fixed)
    VALUES (${userId}, ${tashkentDate()}, 'yhq', ${answered}, ${correct}, ${fixed})
    ON CONFLICT (user_id, date, subject_id) DO UPDATE SET
      answered = EXCLUDED.answered, correct = EXCLUDED.correct, fixed = EXCLUDED.fixed
  `)
}

async function withLockedCoinRow<T>(userId: string, body: () => Promise<T>): Promise<T> {
  const client = postgres(config.db.url, { max: 1, connect_timeout: 10 })
  let pending: Promise<T> | null = null
  try {
    await client.begin(async (tx) => {
      await tx`SELECT user_id FROM user_coins WHERE user_id = ${userId} FOR UPDATE`
      pending = body()
      await new Promise((resolve) => setTimeout(resolve, 500))
    })
    return await pending!
  } finally {
    await client.end({ timeout: 5 })
  }
}

let tokenA: string
let tokenB: string
let tokenC: string
let tokenD: string
let tokenF: string

beforeAll(async () => {
  await cleanup()
  await seedFixQuestions()
  tokenA = await createUserWithSession(USER_A)
  tokenB = await createUserWithSession(USER_B)
  tokenC = await createUserWithSession(USER_C)
  tokenD = await createUserWithSession(USER_D)
  await createUserWithSession(USER_E)
  tokenF = await createUserWithSession(USER_F)
  await createUserWithSession(USER_G)
}, 90_000)

afterAll(cleanup, 90_000)

describe('coins mint — faqat gate + to\'g\'ri javob', () => {
  it('yangi to\'g\'ri javob +1 coin mint qiladi; xato javob 0; replay qayta bermaydi', async () => {
    // IKKI xil savol kerak: mint qoidasi ularni FARQLI baholaydi — qFix xato
    // qilinib keyin tuzatiladi (is_fix yo'li), qNew esa birinchi urinishda
    // to'g'ri yechiladi (oddiy +1 coin yo'li).
    const [qFix, qNew] = await db.select().from(questions).limit(2)
    expect(qFix).toBeDefined()
    expect(qNew).toBeDefined()
    const wrongOpt = Object.keys(qFix.optionsUz).find((k) => k !== qFix.correctAnswer) ?? '__x__'
    const t1 = randomBytes(16).toString('hex')

    // 1) XATO javob — mint yo'q
    const wrong = await request(app).post(`/api/progress/${USER_A}/result`)
      .send({ questionId: qFix.id, selectedAnswer: wrongOpt, subjectId: 'yhq', clientToken: t1 })
      .expect(200)
    expect(wrong.body.coinsEarned ?? 0).toBe(0)
    expect(await getBalance(USER_A)).toBe(0)

    // 2) YANGI savolga TO'G'RI javob — COINS_PER_CORRECT_ANSWER mint + balans javobda
    const t2 = randomBytes(16).toString('hex')
    const ok = await request(app).post(`/api/progress/${USER_A}/result`)
      .send({ questionId: qNew.id, selectedAnswer: qNew.correctAnswer, subjectId: 'yhq', clientToken: t2 })
      .expect(200)
    expect(ok.body.coinsEarned).toBe(COINS_PER_CORRECT_ANSWER)
    expect(ok.body.coinBalance).toBe(COINS_PER_CORRECT_ANSWER)
    expect(await getBalance(USER_A)).toBe(COINS_PER_CORRECT_ANSWER)

    // 3) XUDDI SHU token replay — qayta mint YO'Q
    const replay = await request(app).post(`/api/progress/${USER_A}/result`)
      .send({ questionId: qNew.id, selectedAnswer: qNew.correctAnswer, subjectId: 'yhq', clientToken: t2 })
      .expect(200)
    expect(replay.body.duplicate).toBe(true)
    expect(replay.body.coinsEarned ?? 0).toBe(0)
    expect(await getBalance(USER_A)).toBe(COINS_PER_CORRECT_ANSWER)

    // 4) YANGI token, lekin anti-farm gate (bu savol allaqachon to'g'ri yechilgan) — mint YO'Q
    const t3 = randomBytes(16).toString('hex')
    const gate = await request(app).post(`/api/progress/${USER_A}/result`)
      .send({ questionId: qNew.id, selectedAnswer: qNew.correctAnswer, subjectId: 'yhq', clientToken: t3 })
      .expect(200)
    expect(gate.body.duplicate).toBe(true)
    expect(await getBalance(USER_A)).toBe(COINS_PER_CORRECT_ANSWER)

    // Ledger: bitta 'answer' qatori
    const hist = await coinsRepository.getHistory(USER_A)
    expect(hist.filter((h) => h.reason === 'answer').length).toBe(1)
  })

  it('xato tuzatish HAR SAFAR coin beradi (to\'g\'ri javobning yarmi)', async () => {
    // Avval bu "har 10 ta tuzatishga 1 coin" edi, hisoblagich esa
    // daily_records.fixed — u har KUNI va har FAN bo'yicha nolga qaytardi.
    // Kunlik vazifaning o'zi 5 ta tuzatishni so'raydi (DAILY_TASKS fix-5),
    // ya'ni vazifani bajaradigan foydalanuvchi 10 ga hech qachon yetmay,
    // tuzatishdan abadiy 0 coin olardi. Endi har bir tuzatish darhol to'lanadi.
    //
    // Savollarni TESTNING O'ZI yaratadi (beforeAll): CI test bazasida atigi
    // bir nechta savol bor, ya'ni mavjud qatorlar soniga tayanib bo'lmaydi.
    // Retry'ga chidamli: vitest bu faylda retry:2 bilan ishlaydi, oldingi
    // urinishning javoblari qolsa anti-farm gate mint'ni to'sib qo'yardi.
    await db.delete(users).where(eq(users.id, USER_E))
    await createUserWithSession(USER_E)

    const rows = FIX_QUESTION_IDS.map((id) => ({ id, correctAnswer: 'a' }))

    // Avval XATO javob — tuzatiladigan xatolar tayyorlanadi (xato mint bermaydi)
    for (const q of rows) {
      await request(app).post(`/api/progress/${USER_E}/result`)
        .send({ questionId: q.id, selectedAnswer: 'b', subjectId: 'yhq', clientToken: randomBytes(16).toString('hex') })
        .expect(200)
    }
    expect(await getBalance(USER_E)).toBe(0)

    // Endi tuzatamiz: HAR BIRI COINS_PER_MISTAKE_FIXED beradi
    const earned: number[] = []
    for (const q of rows) {
      const res = await request(app).post(`/api/progress/${USER_E}/result`)
        .send({ questionId: q.id, selectedAnswer: q.correctAnswer, subjectId: 'yhq', clientToken: randomBytes(16).toString('hex') })
        .expect(200)
      earned.push(res.body.coinsEarned ?? 0)
    }

    expect(earned).toEqual(rows.map(() => COINS_PER_MISTAKE_FIXED))
    expect(await getBalance(USER_E)).toBe(rows.length * COINS_PER_MISTAKE_FIXED)

    // Tuzatish to'g'ri javobdan ARZONROQ bo'lishi shart — aks holda ataylab
    // xato qilib keyin tuzatish oddiy to'g'ri javobdan foydaliroq bo'lardi.
    expect(COINS_PER_MISTAKE_FIXED).toBeLessThan(COINS_PER_CORRECT_ANSWER)
    // 20 ta ketma-ket so'rov (10 xato + 10 tuzatish) uzoq test bazasiga —
    // standart 15s yetmaydi.
  }, 90_000)

  it('parallel yangi tokenlar bilan bitta savolga to\'g\'ri javob — faqat bitta mint/counter', async () => {
    const [question] = await db.select().from(questions).limit(1)
    const results = await Promise.all(Array.from({ length: 8 }, () =>
      progressRepository.recordAnswer({
        userId: USER_G,
        correct: true,
        questionId: question.id,
        date: tashkentDate(),
        subjectId: 'yhq',
        clientToken: randomBytes(16).toString('hex'),
      })))

    expect(results.filter((r) => r.updated && !r.duplicate)).toHaveLength(1)
    expect(results.filter((r) => r.duplicate && r.reason === 'gate')).toHaveLength(7)
    expect(results.reduce((sum, r) => sum + r.coinsMinted, 0)).toBe(COINS_PER_CORRECT_ANSWER)
    expect(await getBalance(USER_G)).toBe(COINS_PER_CORRECT_ANSWER)

    const [prog] = await executeRows<{ total_answered: number; total_correct: number }>(sql`
      SELECT total_answered::int, total_correct::int
      FROM progress
      WHERE user_id = ${USER_G}
    `)
    expect(prog.total_answered).toBe(1)
    expect(prog.total_correct).toBe(1)
  })
})

describe('coins purchase — atomiklik', () => {
  const THEME = 'crimson'          // 500c, accent-theme (durable)
  const price = getShopItem(THEME)!.price

  it('parallel xarid — FAQAT bitta debit (claim-first race guard, CI kafili)', async () => {
    await setBalance(USER_B, 2000)
    const p1 = request(app).post('/api/coins/purchase')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ itemId: THEME, purchaseId: randomBytes(16).toString('hex') })
    const p2 = request(app).post('/api/coins/purchase')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ itemId: THEME, purchaseId: randomBytes(16).toString('hex') })
    const [r1, r2] = await Promise.all([p1, p2])
    const statuses = [r1.status, r2.status].sort()
    // Terms: biri 200 (ok), ikkinchisi 409 ITEM_ALREADY_OWNED — double-debit YO'Q
    expect(statuses).toEqual([200, 409])
    expect(await getBalance(USER_B)).toBe(2000 - price)

    const state = await coinsRepository.getEconomyState(USER_B)
    expect(state.ownedItems.filter((i) => i === THEME).length).toBe(1)
    const debits = (await coinsRepository.getHistory(USER_B)).filter((h) => h.reason === 'purchase')
    expect(debits.length).toBe(1)
  })

  it('parallel CONSUMABLE (premium-days) xuddi shu purchaseId — FAQAT bitta debit', async () => {
    // Durable'dan farqli: consumable claim-first user_items lock'iga ega emas —
    // shu race'ni aynan shu test ushlashi kerak (audit #4).
    // USER_C ishlatiladi (USER_B EMAS) — USER_B'ning 'coins:purchase' rate-limit
    // bucket'i (10/min) shu describe blokidagi boshqa subtestlarda allaqachon
    // deyarli to'lgan; bu yerga qo'shsa CI'da 429 chiqarardi.
    await setBalance(USER_C, 2000)
    const purchaseId = randomBytes(16).toString('hex')
    const before = await getBalance(USER_C)
    const p1 = request(app).post('/api/coins/purchase')
      .set('Authorization', `Bearer ${tokenC}`)
      .send({ itemId: 'premium-days-1', purchaseId })
    const p2 = request(app).post('/api/coins/purchase')
      .set('Authorization', `Bearer ${tokenC}`)
      .send({ itemId: 'premium-days-1', purchaseId })
    const [r1, r2] = await Promise.all([p1, p2])
    const price = getShopItem('premium-days-1')!.price
    expect(r1.status).toBe(200)
    expect(r2.status).toBe(200)
    // Biri 'ok', ikkinchisi 'duplicate' bo'lishi kerak — IKKALASI HAM 'ok' bo'lsa double-debit
    const oks = [r1.body, r2.body].filter((b) => b.duplicate === false).length
    expect(oks).toBe(1)
    expect(before - (await getBalance(USER_C))).toBe(price)
    const debits = (await coinsRepository.getHistory(USER_C)).filter((h) => h.reason === 'purchase' && h.refId === purchaseId)
    expect(debits.length).toBe(1)
  })

  it('parallel CONSUMABLE turli purchaseId — balans yetganicha bitta premium grant va bitta ledger', async () => {
    const item = getShopItem('premium-days-1')!
    await setBalance(USER_C, item.price)
    await db.update(users).set({ premiumUntil: null }).where(eq(users.id, USER_C))
    const beforeLedger = await executeRows<{ n: number; total: number }>(sql`
      SELECT COUNT(*)::int AS n, COALESCE(SUM(delta), 0)::int AS total
      FROM coin_transactions
      WHERE user_id = ${USER_C} AND reason = 'purchase'
    `)

    const results = await withLockedCoinRow(USER_C, () => Promise.all(
      Array.from({ length: 8 }, () =>
        coinsRepository.purchase(USER_C, 'premium-days-1', randomBytes(16).toString('hex'))),
    ))

    expect(results.filter((r) => r.status === 'ok')).toHaveLength(1)
    expect(results.filter((r) => r.status === 'insufficient')).toHaveLength(7)
    expect(await getBalance(USER_C)).toBe(0)

    const rows = await executeRows<{ n: number; total: number }>(sql`
      SELECT COUNT(*)::int AS n, COALESCE(SUM(delta), 0)::int AS total
      FROM coin_transactions
      WHERE user_id = ${USER_C} AND reason = 'purchase'
    `)
    expect(rows[0].n - beforeLedger[0].n).toBe(1)
    expect(rows[0].total - beforeLedger[0].total).toBe(-item.price)

    const [u] = await db.select({ premiumUntil: users.premiumUntil }).from(users).where(eq(users.id, USER_C))
    expect(u.premiumUntil?.getTime()).toBeGreaterThan(Date.now() + 18 * 3600_000)
    expect(u.premiumUntil?.getTime()).toBeLessThan(Date.now() + 36 * 3600_000)
  }, 30_000)

  it('xuddi shu purchaseId retry — idempotent duplicate (qayta debit yo\'q)', async () => {
    const before = await getBalance(USER_B)
    const purchaseId = randomBytes(16).toString('hex')
    await request(app).post('/api/coins/purchase')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ itemId: 'frame-neon', purchaseId })
      .expect(200)
    const mid = await getBalance(USER_B)
    const retry = await request(app).post('/api/coins/purchase')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ itemId: 'frame-neon', purchaseId })
      .expect(200)
    expect(retry.body.duplicate).toBe(true)
    expect(await getBalance(USER_B)).toBe(mid)
    expect(before - mid).toBe(getShopItem('frame-neon')!.price)
  })

  it('balans yetarli bo\'lmasa — 409 COINS_INSUFFICIENT, balans o\'zgarmaydi', async () => {
    // USER_B 'crimson'ni allaqachon olgan (race testi) — boshqa tema bilan tekshiramiz
    await setBalance(USER_B, 20)
    const res = await request(app).post('/api/coins/purchase')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ itemId: 'royal', purchaseId: randomBytes(16).toString('hex') })
      .expect(409)
    expect(res.body.error).toBe('COINS_INSUFFICIENT')
    expect(await getBalance(USER_B)).toBe(20)
  })

  it('noma\'lum item — 404; auth\'siz — 401', async () => {
    await request(app).post('/api/coins/purchase')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ itemId: 'nonexistent', purchaseId: randomBytes(16).toString('hex') })
      .expect(404)
    await request(app).post('/api/coins/purchase')
      .send({ itemId: THEME, purchaseId: randomBytes(16).toString('hex') })
      .expect(401)
  })

  it('insufficient -> topup -> same purchaseId muvaffaqiyatli bo\'ladi (failed attempt does not burn key)', async () => {
    const item = getShopItem('premium-days-1')!
    await setBalance(USER_D, 0)
    const purchaseId = randomBytes(16).toString('hex')

    // 1. Balans 0: insufficient
    const res1 = await coinsRepository.purchase(USER_D, 'premium-days-1', purchaseId)
    expect(res1.status).toBe('insufficient')

    // 2. Balans to'ldiriladi
    await setBalance(USER_D, item.price)

    // 3. Xuddi shu purchaseId bilan retry qilinadi: muvaffaqiyatli bo'lishi shart!
    const res2 = await coinsRepository.purchase(USER_D, 'premium-days-1', purchaseId)
    expect(res2.status).toBe('ok')
    expect(res2.balance).toBe(0)

    // 4. Xuddi shu purchaseId bilan 3-marta yuborilsa: duplicate
    const res3 = await coinsRepository.purchase(USER_D, 'premium-days-1', purchaseId)
    expect(res3.status).toBe('duplicate')
    expect(res3.balance).toBe(0)
  })

  it('entitlement/DB failure holatida tranzaksiya rollback — balans o\'zgarmaydi, ledger yozilmaydi', async () => {
    const purchaseId = randomBytes(16).toString('hex')
    await setBalance(USER_D, 500)
    const beforeBal = await getBalance(USER_D)

    // Simulating transaction failure: sqlTx.begin ichida exception bo'lsa
    const sqlTx = getSqlTx()
    await expect(
      sqlTx.begin(async (tx) => {
        // 1. Ledger claim
        await tx`
          INSERT INTO coin_transactions (user_id, delta, reason, ref_id)
          VALUES (${USER_D}, -100, 'purchase', ${purchaseId})
        `
        // 2. Debit
        await tx`
          UPDATE user_coins SET balance = balance - 100 WHERE user_id = ${USER_D}
        `
        // 3. Force failure (masalan entitlement xatosi)
        throw new Error('SIMULATED_ENTITLEMENT_CRASH')
      })
    ).rejects.toThrow('SIMULATED_ENTITLEMENT_CRASH')

    // Tekshiramiz: tranzaksiya to'liq rollback bo'lgan
    // 1) Balans o'zgarmagan:
    expect(await getBalance(USER_D)).toBe(beforeBal)

    // 2) Ledger'da hech qanday yozuv qolmagan:
    const txRows = await executeRows<{ id: number }>(sql`
      SELECT id FROM coin_transactions WHERE user_id = ${USER_D} AND reason = 'purchase' AND ref_id = ${purchaseId}
    `)
    expect(txRows).toHaveLength(0)
  })
})

describe('coins — mavsumiy drop guard', () => {
  // Oynalar kesishmaydi (03-01..03-27 va 08-15..09-03) → har qanday kunda
  // KAMIDA bittasi yopiq bo'ladi (expired branch har doim deterministik).
  const NAVRUZ = 'frame-navruz'
  const MUSTAQILLIK = 'frame-mustaqillik'

  it('oyna tashqarisidagi mavsumiy buyum — 409 ITEM_SEASON_EXPIRED, balans o\'zgarmaydi', async () => {
    const expiredItem = [NAVRUZ, MUSTAQILLIK]
      .map((id) => getShopItem(id)!)
      .find((i) => !isShopItemAvailable(i))
    expect(expiredItem).toBeDefined()
    await setBalance(USER_A, 10000)
    const res = await request(app).post('/api/coins/purchase')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ itemId: expiredItem.id, purchaseId: randomBytes(16).toString('hex') })
      .expect(409)
    expect(res.body.error).toBe('ITEM_SEASON_EXPIRED')
    expect(await getBalance(USER_A)).toBe(10000)
  })

  it('aktiv oynadagi mavsumiy buyum — oddiy durable xarid kabi ishlaydi', async () => {
    const activeItem = [NAVRUZ, MUSTAQILLIK]
      .map((id) => getShopItem(id)!)
      .find((i) => isShopItemAvailable(i))
    if (!activeItem) return   // iyun kabi oynalar "orasidagi" sana — faqat yopiq branch tekshiriladi
    // USER_D ishlatiladi (USER_B'ning 10/min bucket'i to'lmasligi uchun)
    await setBalance(USER_D, 10000)
    const res = await request(app).post('/api/coins/purchase')
      .set('Authorization', `Bearer ${tokenD}`)
      .send({ itemId: activeItem.id, purchaseId: randomBytes(16).toString('hex') })
      .expect(200)
    expect(res.body.ok).toBe(true)
    expect(res.body.durable).toBe(true)
    expect(await getBalance(USER_D)).toBe(10000 - activeItem.price)
    const state = await coinsRepository.getEconomyState(USER_D)
    expect(state.ownedItems).toContain(activeItem.id)
  })
})

describe('coins — Lucky Spin (omad g\'ildiragi)', () => {
  it('GET holat → POST spin (1/kun) → qayta POST 409; yutuq atomik yoziladi', async () => {
    const date = tashkentDate()

    // 1) Boshlang'ich holat — aylantirilmagan
    const s0 = await request(app).get('/api/coins/spin')
      .set('Authorization', `Bearer ${tokenA}`).expect(200)
    expect(s0.body.spun).toBe(false)

    // 2) Spin — segment config'dan, grant atomik
    const before = await getBalance(USER_A)
    const res = await request(app).post('/api/coins/spin')
      .set('Authorization', `Bearer ${tokenA}`).expect(200)
    const seg = getSpinSegment(res.body.segment.id)
    expect(seg).not.toBeNull()
    expect(res.body.segment).toEqual({ id: seg!.id, kind: seg!.kind, amount: seg!.amount })

    if (seg!.kind === 'coins') {
      expect(res.body.balance).toBe(before + seg!.amount)
      expect(await getBalance(USER_A)).toBe(before + seg!.amount)
      const spinTx = (await coinsRepository.getHistory(USER_A)).filter((h) => h.reason === 'spin')
      expect(spinTx.length).toBe(1)
      expect(spinTx[0].refId).toBe(`spin:${date}`)
    } else {
      expect(new Date(res.body.premiumUntil).getTime()).toBeGreaterThan(Date.now() + 18 * 3600_000)
    }

    // 3) Qayta spin — 409 SPIN_ALREADY_USED_TODAY, balans o'zgarmaydi
    const res2 = await request(app).post('/api/coins/spin')
      .set('Authorization', `Bearer ${tokenA}`).expect(409)
    expect(res2.body.error).toBe('SPIN_ALREADY_USED_TODAY')

    // 4) GET holat — spun + rewardId
    const s1 = await request(app).get('/api/coins/spin')
      .set('Authorization', `Bearer ${tokenA}`).expect(200)
    expect(s1.body).toMatchObject({ spun: true, rewardId: seg!.id, date })
  })

  it('repository: yangi kun yangi claim; ESKI sana qabul qilinmaydi; premium grant C-1', async () => {
    const coinsSeg = SPIN_SEGMENTS.find((s) => s.kind === 'coins')!
    const premiumSeg = SPIN_SEGMENTS.find((s) => s.kind === 'premium-days')!

    // Kun ketma-ketligi: 2026-06-01 → ok; shu kun qayta → already; eski kun → already; keyingi kun → ok
    const r1 = await coinsRepository.spin(USER_B, '2026-06-01', coinsSeg)
    expect(r1.status).toBe('ok')
    expect(await coinsRepository.spin(USER_B, '2026-06-01', coinsSeg)).toMatchObject({ status: 'already_spun' })
    expect(await coinsRepository.spin(USER_B, '2026-05-31', coinsSeg)).toMatchObject({ status: 'already_spun' })

    // Premium segment: premium_until uzaydi, tariff free (C-1), user_items yozilmaydi
    const r2 = await coinsRepository.spin(USER_B, '2026-06-02', premiumSeg)
    expect(r2.status).toBe('ok')
    expect(r2.status === 'ok' && r2.premiumUntil !== null
      && new Date(r2.premiumUntil).getTime() > Date.now()).toBe(true)
    const [u] = await db.select().from(users).where(eq(users.id, USER_B))
    expect(u.tariff).toBe('free')                      // C-1
    const spinTx = (await coinsRepository.getHistory(USER_B)).filter((h) => h.reason === 'spin')
    expect(spinTx.length).toBe(1)                      // FAQAT coin yutuq ledger'da (premium audit daily_spins'da)

    // noma'lum user
    expect(await coinsRepository.spin('no_such_user', '2026-06-03', coinsSeg)).toMatchObject({ status: 'user_not_found' })
  })
})

describe('coins — premium-days consumable + equip guard', () => {
  it('premium-days: premium_until uzaydi, user_items yozilmaydi, tariff free qoladi (C-1), qayta olish mumkin', async () => {
    await setBalance(USER_A, 2000)
    const res = await request(app).post('/api/coins/purchase')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ itemId: 'premium-days-1', purchaseId: randomBytes(16).toString('hex') })
      .expect(200)
    expect(res.body.ok).toBe(true)
    // timestamp-without-tz serializatsiyasi server TZ'ga bog'liq — aniq +23h emas,
    // keng xavfsiz pastki chegara (+1 kunlik grant isboti uchun 18h yetarli):
    expect(new Date(res.body.premiumUntil).getTime()).toBeGreaterThan(Date.now() + 18 * 3600_000)

    const state = await coinsRepository.getEconomyState(USER_A)
    expect(state.ownedItems).toHaveLength(0)          // consumable — egalik yozuvi YO'Q
    const [u] = await db.select().from(users).where(eq(users.id, USER_A))
    expect(u.tariff).toBe('free')                      // C-1: muddatli grant tariff'ga TEGMADI
    expect(u.premiumUntil!.getTime()).toBeGreaterThan(Date.now())

    // Consumable'ni QAYTA sotib olish mumkin (yangi purchaseId)
    await request(app).post('/api/coins/purchase')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ itemId: 'premium-days-1', purchaseId: randomBytes(16).toString('hex') })
      .expect(200)
    expect(await getBalance(USER_A)).toBe(2000 - 2 * getShopItem('premium-days-1')!.price)
  })

  it('equip: egaliksiz ramka 403; olingandan keyin ok; null — olib tashlash', async () => {
    // Test mustaqilligi: oldingi xarajatlardan qat'iy nazar balansni tiklaymiz
    await setBalance(USER_A, 2000)
    // USER_A'da hali hech qanday ramka yo'q (faqat premium-days olgan)
    const denied = await request(app).post('/api/coins/equip')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ itemId: 'frame-gold' })
    expect(denied.status).toBe(403)
    expect(denied.body.error).toBe('ITEM_NOT_OWNED')

    // Sotib olamiz va equip qilamiz
    await request(app).post('/api/coins/purchase')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ itemId: 'frame-gold', purchaseId: randomBytes(16).toString('hex') })
      .expect(200)
    const equipped = await request(app).post('/api/coins/equip')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ itemId: 'frame-gold' })
      .expect(200)
    expect(equipped.body.avatarFrame).toBe('frame-gold')
    let [u] = await db.select().from(users).where(eq(users.id, USER_A))
    expect(u.avatarFrame).toBe('frame-gold')

    // Profil contract'da ham ko'rinadi (toApiUser enrichment)
    const prof = await request(app).get(`/api/profile/${USER_A}`).expect(200)
    expect(prof.body.user.avatarFrame).toBe('frame-gold')
    expect(prof.body.user.ownedItems).toContain('frame-gold')
    expect(typeof prof.body.user.coins).toBe('number')

    // Olib tashlash
    await request(app).post('/api/coins/equip')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ itemId: null })
      .expect(200)
    ;[u] = await db.select().from(users).where(eq(users.id, USER_A))
    expect(u.avatarFrame).toBeNull()

    // tema sotib olinganda ham equip shart emas — lekin avatar-frame bo'lmagan
    // item'ni equip qilish rad etiladi (kind guard)
    await request(app).post('/api/coins/equip')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ itemId: 'premium-days-1' })
      .expect(404)
  })

  it('history endpoint — tangalar harakati tartibda qaytadi', async () => {
    const res = await request(app).get('/api/coins/history')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200)
    expect(Array.isArray(res.body.rows)).toBe(true)
    expect(res.body.rows.length).toBeGreaterThan(0)
    const reasons = new Set(res.body.rows.map((r: { reason: string }) => r.reason))
    expect([...reasons].every((r) => typeof r === 'string')).toBe(true)
    // debits manfiy, mint musbat
    for (const row of res.body.rows) {
      expect(typeof row.delta).toBe('number')
      expect(row.delta).not.toBe(0)
    }
  })
})

describe('coins — kunlik vazifalar (#40 Faza 2)', () => {
  const date = tashkentDate()

  it('GET /coins/tasks — progress server aggregate\'dan; claim atomik (1/kun)', async () => {
    // 25 javob / 16 to'g'ri / 3 tuzatish: answers-20 ✓, correct-15 ✓, fix-5 ✗
    await seedDaily(USER_A, 25, 16, 3)

    const res = await request(app).get('/api/coins/tasks')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200)
    const byId = new Map(res.body.tasks.map((t: { id: string } & Record<string, unknown>) => [t.id, t]))
    expect(byId.get('answers-20')).toMatchObject({ progress: 20, completed: true, claimed: false })
    expect(byId.get('correct-15')).toMatchObject({ progress: 15, completed: true, claimed: false })
    expect(byId.get('fix-5')).toMatchObject({ progress: 3, completed: false, claimed: false })

    const before = await getBalance(USER_A)

    // 1) Bajarilmaganini claim — 409
    const notDone = await request(app).post('/api/coins/claim-task')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ taskId: 'fix-5' })
    expect(notDone.status).toBe(409)
    expect(notDone.body.error).toBe('TASK_NOT_COMPLETED')

    // 2) Bajarilganini claim — +reward, balans yangilanadi
    const claimed1 = await request(app).post('/api/coins/claim-task')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ taskId: 'answers-20' })
      .expect(200)
    const answersTask = getDailyTask('answers-20')!
    expect(claimed1.body.reward).toBe(answersTask.reward)
    expect(claimed1.body.balance).toBe(before + answersTask.reward)

    // 3) XUDDI SHU vazifani qayta claim — 409 (race/refresh'dan himoyalangan)
    const again = await request(app).post('/api/coins/claim-task')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ taskId: 'answers-20' })
    expect(again.status).toBe(409)
    expect(again.body.error).toBe('TASK_ALREADY_CLAIMED')
    expect(await getBalance(USER_A)).toBe(before + answersTask.reward)   // double-credit YO'Q

    // 4) Holat yangilanganda claimed:true
    const after = await request(app).get('/api/coins/tasks')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200)
    const afterById = new Map(after.body.tasks.map((t: { id: string } & Record<string, unknown>) => [t.id, t]))
    expect(afterById.get('answers-20')).toMatchObject({ claimed: true })

    // Ledger'da 'task_claim' ref kuni bilan
    const hist = await coinsRepository.getHistory(USER_A)
    expect(hist.some((h) => h.reason === 'task_claim' && h.refId === `answers-20:${date}`)).toBe(true)
  })

  it('parallel task claim — reward faqat bitta yoziladi', async () => {
    await seedDaily(USER_F, 25, 16, 0)
    await setBalance(USER_F, 0)
    const task = getDailyTask('answers-20')!

    const results = await withLockedCoinRow(USER_F, () => Promise.all(
      Array.from({ length: 8 }, () => coinsRepository.claimTask(USER_F, task.id, date)),
    ))

    expect(results.filter((r) => r.status === 'ok')).toHaveLength(1)
    expect(results.filter((r) => r.status === 'already_claimed')).toHaveLength(7)
    expect(await getBalance(USER_F)).toBe(task.reward)

    const hist = await coinsRepository.getHistory(USER_F)
    expect(hist.filter((h) => h.reason === 'task_claim' && h.refId === `${task.id}:${date}`)).toHaveLength(1)
  })

  it('legacy /daily/fix progress bermaydi — fix-5 mukofotini soxta ochib bo\'lmaydi', async () => {
    await seedDaily(USER_F, 0, 0, 0)
    await setBalance(USER_F, 0)

    for (let i = 0; i < 5; i++) {
      await request(app).post(`/api/daily/${USER_F}/fix`)
        .set('Authorization', `Bearer ${tokenF}`)
        .send({ subjectId: 'yhq' })
        .expect(200)
    }

    const claim = await request(app).post('/api/coins/claim-task')
      .set('Authorization', `Bearer ${tokenF}`)
      .send({ taskId: 'fix-5' })
    expect(claim.status).toBe(409)
    expect(claim.body.error).toBe('TASK_NOT_COMPLETED')
    expect(await getBalance(USER_F)).toBe(0)
  })

  it('noma\'lum taskId — 404; auth\'siz — 401', async () => {
    await request(app).post('/api/coins/claim-task')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ taskId: 'nonexistent' })
      .expect(404)
    await request(app).post('/api/coins/claim-task')
      .send({ taskId: 'answers-20' })
      .expect(401)
    await request(app).get('/api/coins/tasks').expect(401)
  })
})

describe('coins — MERCH buyurtmalari (#40 Faza 3)', () => {
  const MERCH = 'nakleyka'            // 2500c, stock 20
  const ORDER_INFO = { fullName: 'Test User', phone: '+998901112233', note: 'L o\'lcham' }

  // Admin session: USER_B'ni admin qilamiz (faqat shu testda)
  beforeAll(async () => {
    await db.update(users).set({ isAdmin: true }).where(eq(users.id, USER_B))
  })

  it('buyMerch: debit + order + stock/1-per-user guard + idempotency + refund', async () => {
    await seedDaily(USER_A, 0, 0, 0)   // task interference bo'lmasin
    await setBalance(USER_A, 6000)

    // 1) Muvaffaqiyatli buyurtma
    const p1 = randomBytes(16).toString('hex')
    const res = await request(app).post('/api/coins/buy-merch')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ itemId: MERCH, purchaseId: p1, ...ORDER_INFO })
      .expect(200)
    expect(res.body.ok).toBe(true)
    expect(res.body.orderId).toBeGreaterThan(0)
    expect(await getBalance(USER_A)).toBe(6000 - getMerchItem('nakleyka')!.price)

    // 2) XUDDI SHU purchaseId — idempotent duplicate (qayta debit yo'q)
    const dup = await request(app).post('/api/coins/buy-merch')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ itemId: MERCH, purchaseId: p1, ...ORDER_INFO })
      .expect(200)
    expect(dup.body.duplicate).toBe(true)
    expect(await getBalance(USER_A)).toBe(6000 - getMerchItem('nakleyka')!.price)

    // 3) 1-PER-USER: o'sha itemdan yana — 409 MERCH_ALREADY_OWNED
    const again = await request(app).post('/api/coins/buy-merch')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ itemId: MERCH, purchaseId: randomBytes(16).toString('hex'), ...ORDER_INFO })
    expect(again.status).toBe(409)
    expect(again.body.error).toBe('MERCH_ALREADY_OWNED')

    // 4) Tomon tomon: balans yetarli bo'lmasa — 409 COINS_INSUFFICIENT
    await setBalance(USER_A, 200)
    const insuf = await request(app).post('/api/coins/buy-merch')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ itemId: 'kiyim', purchaseId: randomBytes(16).toString('hex'), ...ORDER_INFO })
    expect(insuf.status).toBe(409)
    expect(insuf.body.error).toBe('COINS_INSUFFICIENT')

    // 5) Admin: buyurtma ro'yxatda ko'rinadi + status oqimi
    const list = await request(app).get('/api/admin/merch-orders')
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(200)
    const order = (list.body.rows as { id: number; status: string }[]).find((o) => o.id === res.body.orderId)
    expect(order?.status).toBe('new')

    await request(app).patch(`/api/admin/merch-orders/${res.body.orderId}/status`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ status: 'contacted' })
      .expect(200)

    // 6) Admin CANCEL → ATOMIK refund (nosilane balans + ledger)
    const preRefund = 200   // xariddan qolgan qoldiq (2× iqtisod bilan birga ko'chdi)
    const cancel = await request(app).post(`/api/admin/merch-orders/${res.body.orderId}/cancel`)
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(200)
    expect(cancel.body.status).toBe('cancelled')
    expect(await getBalance(USER_A)).toBe(preRefund + getMerchItem('nakleyka')!.price)   // qoldiq + refund
    const hist = await coinsRepository.getHistory(USER_A)
    expect(hist.some((h) => h.reason === 'merch_refund' && h.refId === `order:${res.body.orderId}`)).toBe(true)

    // 7) Qayta cancel — 409 (refund ikki marta ISHLAMAYDI)
    const recancel = await request(app).post(`/api/admin/merch-orders/${res.body.orderId}/cancel`)
      .set('Authorization', `Bearer ${tokenB}`)
    expect(recancel.status).toBe(409)
    expect(await getBalance(USER_A)).toBe(preRefund + getMerchItem('nakleyka')!.price)   // o'zgarmadi

    // 8) Bekor qilingandan keyin user item'dan YANA olishi mumkin (faol buyurtma yo'q)
    await setBalance(USER_A, 6000)
    const re = await request(app).post('/api/coins/buy-merch')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ itemId: MERCH, purchaseId: randomBytes(16).toString('hex'), ...ORDER_INFO })
      .expect(200)
    expect(re.body.ok).toBe(true)
  }, 90_000)

  it('merch RACE: parallel bir-odam-bir-item — FAQAT 1 buyurtma, 1 debit (claim-first)', async () => {
    await setBalance(USER_A, 20000)
    // Boshqa item (nakleyka allaqachon olgan — 8-qadamda)
    const p1 = request(app).post('/api/coins/buy-merch')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ itemId: 'sumka', purchaseId: randomBytes(16).toString('hex'), ...ORDER_INFO })
    const p2 = request(app).post('/api/coins/buy-merch')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ itemId: 'sumka', purchaseId: randomBytes(16).toString('hex'), ...ORDER_INFO })
    const [r1, r2] = await Promise.all([p1, p2])
    const statuses = [r1.status, r2.status].sort()
    expect(statuses).toEqual([200, 409])
    // ⚖️ ENG MUHIM INVARIANT: double-debit YO'Q
    expect(await getBalance(USER_A)).toBe(20000 - getMerchItem('sumka')!.price)
    // Buyurtma faqat 1 ta
    const myOrders = await request(app).get('/api/coins/merch-orders')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200)
    const sumkaOrders = (myOrders.body.rows as { itemId: string; status: string }[])
      .filter((o) => o.itemId === 'sumka' && o.status !== 'cancelled')
    expect(sumkaOrders).toHaveLength(1)
  })

  it('admin-only: oddiy user admin endpointga kira olmaydi; authsiz — 401', async () => {
    // USER_A admin emas
    await request(app).get('/api/admin/merch-orders')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(403)
    await request(app).post('/api/coins/buy-merch')
      .send({ itemId: MERCH, purchaseId: randomBytes(16).toString('hex'), ...ORDER_INFO })
      .expect(401)
  })

  it('GET /coins/merch — katalog + zaxira + alreadyOwned holati', async () => {
    const res = await request(app).get('/api/coins/merch')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200)
    const byId = new Map(res.body.items.map((i: { id: string } & Record<string, unknown>) => [i.id, i]))
    // Test davomida 1 ta FAOL nakleyka bor (8-qadam) → remaining = stock-1
    expect(byId.get('nakleyka')).toMatchObject({ alreadyOwned: true })
    // kiyim'ni hech qaysi test sotib olmaydi — doimo false (tartibga bog'liq emas)
    expect(byId.get('kiyim')).toMatchObject({ alreadyOwned: false })
    const nakleykaRemaining = byId.get('nakleyka')?.remaining as number
    expect(nakleykaRemaining).toBeGreaterThanOrEqual(0)
  })
})
