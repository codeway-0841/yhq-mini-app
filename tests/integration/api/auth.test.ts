/**
 * Integration tests — multi-provider auth (Telefon+parol, TG Login Widget,
 * session lifecycle, account linking + adopt-merge).
 *
 * REQUIREMENTS: TEST_DATABASE_URL (.env orqali) va BOT_TOKEN (widget testlari).
 * neon-http per-request — o'chirish afterAll'da (users cascade tozalaydi).
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import { createHash, createHmac, randomBytes } from 'crypto'
import { createApp } from '../../../server/app'
import { db } from '../../../server/db/connection'
import { users, progress, linkCodes } from '../../../server/schema'
import { eq, inArray } from 'drizzle-orm'
import { config } from '../../../server/config'
import { authService } from '../../../server/modules/auth/auth.service'
import { authRepository } from '../../../server/modules/auth/auth.repository'
import { usersRepository } from '../../../server/modules/users/users.repository'

const app = createApp()
const BOT_TOKEN = config.telegram.botToken

// ── Test entity'lari (boshqa testlar bilan to'qnashmasligi uchun unikal) ────
const TG_A   = '999444555666'   // widget login user (bo'sh shell)
const TG_C   = '999444555667'   // datali TG user (conflict case)
const TG_BOT = '999444555669'   // Mini App ochmagan TG (bot-link rename)
const PHONE_B = '+998900000010'
const PHONE_D = '+998900000011'
const PHONE_E = '+998900000012'
const PASS    = 'testparol8'

const CLEAN_IDS = [TG_A, TG_C, TG_BOT, 'p_998900000010', 'p_998900000011', 'p_998900000012']

async function cleanup() {
  await db.delete(users).where(inArray(users.id, CLEAN_IDS))
}

/** Widget spec: secret = SHA256(bot_token) (initData sxemasidan FARQLI) */
function widgetFields(tgId: string) {
  const fields: Record<string, string> = {
    id: tgId, first_name: 'Link', auth_date: String(Math.floor(Date.now() / 1000)),
  }
  const dcs = Object.entries(fields).sort(([a], [b]) => (a < b ? -1 : 1)).map(([k, v]) => `${k}=${v}`).join('\n')
  const secret = createHash('sha256').update(BOT_TOKEN!).digest()
  return { ...fields, hash: createHmac('sha256', secret).update(dcs).digest('hex') }
}

/**
 * TG user + sessiyani WIDGET'SIZ yaratadi — linking testlari BOT_TOKEN'dan
 * MUSTAQIL (CI env'da token yo'q). Invariant saqlanadi: ('telegram', T).user_id = T.
 * Qaytaradi: yaroqli Bearer sessionToken.
 */
async function createTgUserWithSession(tgId: string): Promise<string> {
  await usersRepository.initAtomic({ id: tgId, firstName: 'Link', lastName: '', username: '', photoUrl: '' })
  await authRepository.ensureIdentity('telegram', tgId, tgId)
  const token = randomBytes(32).toString('hex')
  await authRepository.createSession({
    token, userId: tgId, provider: 'telegram',
    expiresAt: new Date(Date.now() + 3_600_000),
  })
  return token
}

/** user'ga progress data yozish (adopt-merge "bo'sh emas" holati uchun) */
async function giveProgress(userId: string, answered: number) {
  await db.update(progress).set({ totalCorrect: answered, totalWrong: 0, totalAnswered: answered })
    .where(eq(progress.userId, userId))
}

const itIfBot = BOT_TOKEN ? it : it.skip

beforeAll(cleanup)
afterAll(cleanup)

describe('POST /api/auth/phone/register + login', () => {
  it('register → 201 + sessionToken + profile (p_ id)', async () => {
    const res = await request(app).post('/api/auth/phone/register')
      .send({ phone: PHONE_B, password: PASS, firstName: 'Botir' })
    expect(res.status).toBe(201)
    expect(res.body.sessionToken).toMatch(/^[0-9a-f]{64}$/)
    expect(res.body.user.id).toBe('p_998900000010')
    expect(res.body.providers).toEqual(['phone'])
    expect(res.body.progress.totalAnswered).toBe(0)
  })

  it('register takroran → 409 phone_taken', async () => {
    const res = await request(app).post('/api/auth/phone/register')
      .send({ phone: PHONE_B, password: PASS, firstName: 'Dublikat' })
    expect(res.status).toBe(409)
  })

  it("noto'g'ri telefon → 400", async () => {
    const res = await request(app).post('/api/auth/phone/register')
      .send({ phone: '+999000000', password: PASS, firstName: 'X' })
    expect(res.status).toBe(400)
  })

  it("noto'g'ri parol → 401 invalid_credentials", async () => {
    const res = await request(app).post('/api/auth/phone/login')
      .send({ phone: PHONE_B, password: 'xato_parol_999' })
    expect(res.status).toBe(401)
  })

  it('login → session → /auth/me (Bearer) → /auth/logout → 401', async () => {
    const login = await request(app).post('/api/auth/phone/login').send({ phone: PHONE_B, password: PASS })
    expect(login.status).toBe(200)
    const token = login.body.sessionToken

    const me = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`)
    expect(me.status).toBe(200)
    expect(me.body.user.id).toBe('p_998900000010')

    const out = await request(app).post('/api/auth/logout').set('Authorization', `Bearer ${token}`)
    expect(out.status).toBe(200)

    const meAfter = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`)
    expect(meAfter.status).toBe(401)
  })

  it('auth header\'siz /auth/me → 401', async () => {
    const res = await request(app).get('/api/auth/me')
    expect(res.status).toBe(401)
  })
})

describe('POST /api/auth/telegram (Login Widget)', () => {
  itIfBot('valid widget signature → session + telegram provider', async () => {
    const res = await request(app).post('/api/auth/telegram').send(widgetFields(TG_A))
    expect(res.status).toBe(200)
    expect(res.body.user.id).toBe(TG_A)
    expect(res.body.providers).toContain('telegram')
  })

  itIfBot('buzilgan hash → 401', async () => {
    const res = await request(app).post('/api/auth/telegram')
      .send({ ...widgetFields(TG_A), hash: '0'.repeat(64) })
    expect(res.status).toBe(401)
  })
})

describe('Account linking — /api/auth/phone/link (adopt-merge)', () => {
  it('TG shell (bo\'sh) + telefon akkaunt (data bor) → RENAME: data ko\'chadi, TG id saqlanadi', async () => {
    // TG shell (bo'sh) — widget'siz (BOT_TOKEN CI'da yo'q)
    const tgToken = await createTgUserWithSession(TG_A)

    // Telefon akkauntiga data beramiz
    await giveProgress('p_998900000010', 5)
    // va unga refresh session (eski token logout bo'lgan)
    const phoneLogin = await request(app).post('/api/auth/phone/login').send({ phone: PHONE_B, password: PASS })

    // TG sessiyadan telefonni ulash — parol proof bilan
    const link = await request(app).post('/api/auth/phone/link')
      .set('Authorization', `Bearer ${tgToken}`)
      .send({ phone: PHONE_B, password: PASS })
    expect(link.status).toBe(200)
    expect(link.body.status).toBe('adopted')
    expect(link.body.user.id).toBe(TG_A)                  // TG id SAQLANADI
    expect(link.body.progress.totalAnswered).toBe(5)      // data KÖCHDI
    expect(link.body.providers.sort()).toEqual(['phone', 'telegram'])

    // ESKI telefon sessiyasi ON UPDATE CASCADE orqali ko'chgan — hali ham yaroqli
    const meViaOld = await request(app).get('/api/auth/me')
      .set('Authorization', `Bearer ${phoneLogin.body.sessionToken}`)
    expect(meViaOld.status).toBe(200)
    expect(meViaOld.body.user.id).toBe(TG_A)

    // Telefon login endi TG akkauntiga olib kiradi
    const relogin = await request(app).post('/api/auth/phone/login').send({ phone: PHONE_B, password: PASS })
    expect(relogin.body.user.id).toBe(TG_A)
  })

  it('noto\'g\'ri parol bilan link → 401 (account takeover himoyasi)', async () => {
    const tgToken = await createTgUserWithSession(TG_C)
    const res = await request(app).post('/api/auth/phone/link')
      .set('Authorization', `Bearer ${tgToken}`)
      .send({ phone: PHONE_B, password: 'boshqa_parol_1' })
    expect(res.status).toBe(401)
  })

  it('IKKALA akkauntda ham data → 409 accounts_merge_required', async () => {
    const tgToken = await createTgUserWithSession(TG_C)
    await giveProgress(TG_C, 3)
    // TG_A endi datali (oldingi adopt'da 5 javob ko'chgan)
    const res = await request(app).post('/api/auth/phone/link')
      .set('Authorization', `Bearer ${tgToken}`)
      .send({ phone: PHONE_B, password: PASS })
    expect(res.status).toBe(409)
  })
})

describe('Account linking — tg-link-code (bot oqimi)', () => {
  it('telefon user kod yaratadi → bot ulaydi (TG hech Mini App ochmagan) → sinxron', async () => {
    // yangi telefon user
    const reg = await request(app).post('/api/auth/phone/register')
      .send({ phone: PHONE_E, password: PASS, firstName: 'Elyor' })
    const token = reg.body.sessionToken
    await giveProgress('p_998900000012', 7)

    const linkCode = await request(app).post('/api/auth/tg-link-code')
      .set('Authorization', `Bearer ${token}`)
    expect(linkCode.status).toBe(200)
    expect(linkCode.body.code).toBeTruthy()

    // Bot oqimini simulyatsiya qilamiz (handler shu servisni chaqiradi)
    const result = await authService.linkTelegramByCode(linkCode.body.code, { id: Number(TG_BOT) })
    expect(result.status).toBe('linked')

    // Kod BIR MARTALIK — qayta ishlatib bo'lmaydi
    const replay = await authService.linkTelegramByCode(linkCode.body.code, { id: Number(TG_BOT) })
    expect(replay.status).toBe('invalid')

    // Eski session RENAME orqali amal qiladi va providers ikkalasi
    const me = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`)
    expect(me.status).toBe(200)
    expect(me.body.user.id).toBe(TG_BOT)
    expect(me.body.progress.totalAnswered).toBe(7)
    expect(me.body.providers.sort()).toEqual(['phone', 'telegram'])
  })

  it('eskirgan kod → invalid', async () => {
    const reg = await request(app).post('/api/auth/phone/register')
      .send({ phone: PHONE_D, password: PASS, firstName: 'Dilbar' })
    const code = await authService.createTelegramLinkCode(reg.body.user.id)
    // kodni o'tmishga o'tkazamiz (expired)
    await db.update(linkCodes).set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(linkCodes.code, code.code))
    const result = await authService.linkTelegramByCode(code.code, { id: Number(TG_C) })
    expect(result.status).toBe('invalid')
  })

  it('conflict: datali telefon + datali TG → conflict javobi', async () => {
    await giveProgress(TG_C, 3)   // TG_C allaqachon datali bo'lishi mumkin (yana bir marta)
    const login = await request(app).post('/api/auth/phone/login').send({ phone: PHONE_D, password: PASS })
    await giveProgress('p_998900000011', 2)
    const code = await authService.createTelegramLinkCode(login.body.user.id)
    const result = await authService.linkTelegramByCode(code.code, { id: Number(TG_C) })
    expect(result.status).toBe('conflict')
  })
})
