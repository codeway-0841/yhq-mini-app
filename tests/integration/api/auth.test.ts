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
import { users, progress, linkCodes, otpCodes, sessions } from '../../../server/schema'
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
const PHONE_G = '+998900000013'   // session-revoke testi
const PHONE_H = '+998900000014'   // login lockout testi
const PHONE_OTP = '+998900000015' // OTP cooldown/lockout testi (user yaratilmaydi)
const PASS    = 'testparol8'

const CLEAN_IDS = [TG_A, TG_C, TG_BOT, 'p_998900000010', 'p_998900000011', 'p_998900000012', 'p_998900000013', 'p_998900000014']

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

/** OTP seed (SMS yuborishsiz) — register/link raqam tasdiqlashini talab qiladi */
async function seedOtp(phone: string, code = '123456') {
  const { hashOTP } = await import('../../../server/utils/sms')
  await db.delete(otpCodes).where(eq(otpCodes.phone, phone))
  await authRepository.createOTP(phone, hashOTP(code), new Date(Date.now() + 5 * 60_000))
}

const itIfBot = BOT_TOKEN ? it : it.skip

beforeAll(cleanup)
afterAll(cleanup)

describe('POST /api/auth/phone/register + login', () => {
  it('register (OTP bilan) → 201 + sessionToken + profile (p_ id)', async () => {
    await seedOtp(PHONE_B)
    const res = await request(app).post('/api/auth/phone/register')
      .send({ phone: PHONE_B, password: PASS, firstName: 'Botir', otp: '123456' })
    expect(res.status).toBe(201)
    expect(res.body.sessionToken).toMatch(/^[0-9a-f]{64}$/)
    expect(res.body.user.id).toBe('p_998900000010')
    expect(res.body.providers).toEqual(['phone'])
    expect(res.body.progress.totalAnswered).toBe(0)
  })

  it('register takroran → 409 phone_taken', async () => {
    await seedOtp(PHONE_B)
    const res = await request(app).post('/api/auth/phone/register')
      .send({ phone: PHONE_B, password: PASS, firstName: 'Dublikat', otp: '123456' })
    expect(res.status).toBe(409)
  })

  it("noto'g'ri telefon → 400", async () => {
    const res = await request(app).post('/api/auth/phone/register')
      .send({ phone: '+999000000', password: PASS, firstName: 'X', otp: '123456' })
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

  it("M10: sessions jadvalida XOM token emas, sha256 hash saqlanadi", async () => {
    const login = await request(app).post('/api/auth/phone/login').send({ phone: PHONE_B, password: PASS })
    expect(login.status).toBe(200)
    const raw = login.body.sessionToken as string

    const rows = await db.select({ token: sessions.token }).from(sessions)
      .where(eq(sessions.userId, 'p_998900000010'))
    const stored = rows.map((r) => r.token)
    expect(stored).toContain(createHash('sha256').update(raw).digest('hex'))
    expect(stored).not.toContain(raw)
    // Bearer resolve hash'langan satr orqali hamon ishlaydi (regression himoyasi)
    const me = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${raw}`)
    expect(me.status).toBe(200)
    await authRepository.deleteSession(raw)
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
    await seedOtp(PHONE_E)
    const reg = await request(app).post('/api/auth/phone/register')
      .send({ phone: PHONE_E, password: PASS, firstName: 'Elyor', otp: '123456' })
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
    await seedOtp(PHONE_D)
    const reg = await request(app).post('/api/auth/phone/register')
      .send({ phone: PHONE_D, password: PASS, firstName: 'Dilbar', otp: '123456' })
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

describe('Abuse himoyalari — session revoke, lockout, OTP cooldown', () => {
  it('change-password: boshqa sessiyalar revoke, joriy sessiya saqlanadi', async () => {
    await db.delete(users).where(eq(users.id, 'p_998900000013'))  // retry-safe pre-clean
    await seedOtp(PHONE_G)
    const reg = await request(app).post('/api/auth/phone/register')
      .send({ phone: PHONE_G, password: PASS, firstName: 'Gulnoza', otp: '123456' })
    expect(reg.status).toBe(201)
    const token1 = reg.body.sessionToken

    const login2 = await request(app).post('/api/auth/phone/login')
      .send({ phone: PHONE_G, password: PASS })
    expect(login2.status).toBe(200)
    const token2 = login2.body.sessionToken

    // change-password kuch-siyosati talab qiladi (default policy: special belgi shart)
    const changed = await request(app).post('/api/auth/change-password')
      .set('Authorization', `Bearer ${token1}`)
      .send({ currentPassword: PASS, newPassword: 'Yangi!Parol86' })
    expect(changed.status).toBe(200)

    // Joriy sessiya saqlanadi
    const me1 = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token1}`)
    expect(me1.status).toBe(200)
    // Ikkinchi (ehtimol o'g'irlangan) sessiya yopilgan
    const me2 = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token2}`)
    expect(me2.status).toBe(401)
    // Yangi parol bilan kirish ishlaydi
    const relogin = await request(app).post('/api/auth/phone/login')
      .send({ phone: PHONE_G, password: 'Yangi!Parol86' })
    expect(relogin.status).toBe(200)
  })

  it('telefon login lockout: 5 noto\'g\'ri parol → account_locked (403)', async () => {
    await db.delete(users).where(eq(users.id, 'p_998900000014'))  // retry-safe pre-clean
    await seedOtp(PHONE_H)
    const reg = await request(app).post('/api/auth/phone/register')
      .set('X-Forwarded-For', '192.168.100.99')
      .send({ phone: PHONE_H, password: PASS, firstName: 'Husnora', otp: '123456' })
    expect(reg.status).toBe(201)

    // 1-4 urinish: 401
    for (let i = 0; i < 4; i++) {
      const res = await request(app).post('/api/auth/phone/login')
        .set('X-Forwarded-For', `192.168.100.${10 + i}`)
        .send({ phone: PHONE_H, password: 'xato_parol_999' })
      expect(res.status).toBe(401)
    }
    // 5-urinish: bloklanadi
    const fifth = await request(app).post('/api/auth/phone/login')
      .set('X-Forwarded-For', '192.168.100.20')
      .send({ phone: PHONE_H, password: 'xato_parol_999' })
    expect(fifth.status).toBe(403)
    expect(fifth.body.error).toContain('account_locked')

    // TO'G'RI parol ham bloklangan (lockout davomida)
    const blocked = await request(app).post('/api/auth/phone/login')
      .set('X-Forwarded-For', '192.168.100.21')
      .send({ phone: PHONE_H, password: PASS })
    expect(blocked.status).toBe(403)
    await authRepository.resetFailedLoginAttempts('p_998900000014')
  })

  it('OTP resend cooldown: 60s ichida qayta so\'rov → 429', async () => {
    await db.delete(otpCodes).where(eq(otpCodes.phone, PHONE_OTP))  // retry-safe pre-clean
    // OTP qatorini to'g'ridan-to'g'ri yaratamiz (SMS yuborishsiz)
    await authRepository.createOTP(PHONE_OTP, 'test-hash', new Date(Date.now() + 5 * 60_000))
    await expect(authService.requestOTP({ phone: PHONE_OTP }))
      .rejects.toThrow(/otp_cooldown/)
  })

  it('OTP brute-force lockout: 5 noto\'g\'ri kod → otp_locked + kod o\'chadi', async () => {
    await db.delete(otpCodes).where(eq(otpCodes.phone, PHONE_OTP))  // retry-safe pre-clean
    const { hashOTP } = await import('../../../server/utils/sms')
    await authRepository.createOTP(PHONE_OTP, hashOTP('123456'), new Date(Date.now() + 5 * 60_000))

    // 1-4 urinish: invalid_otp
    for (let i = 0; i < 4; i++) {
      await expect(authService.verifyOTPLogin({ phone: PHONE_OTP, code: '999999' }))
        .rejects.toThrow(/invalid_otp/)
    }
    // 5-urinish: kod butunlay o'chadi
    await expect(authService.verifyOTPLogin({ phone: PHONE_OTP, code: '999999' }))
      .rejects.toThrow(/otp_locked/)
    expect(await authRepository.getOTPState(PHONE_OTP)).toBeNull()

    // To'g'ri kod ham endi ishlamaydi (kod o'chirilgan)
    await expect(authService.verifyOTPLogin({ phone: PHONE_OTP, code: '123456' }))
      .rejects.toThrow(/invalid_otp/)
  })
})

// ── OTP tasdiqlash: register/link (raqam egasi isboti — squatting himoyasi) ──
describe('Telefon OTP tasdiqlash (register + link)', () => {
  const PHONE_REG = '+998900000015'   // register testi (yangi raqam)
  const PHONE_LNK = '+998900000016'   // link (yangi raqam) testi
  const TG_LINK   = '999444555680'    // link qiluvchi TG user
  const REG_ID    = 'p_998900000015'
  const LNK_ID    = 'p_998900000016'
  const ALL2      = [TG_LINK, REG_ID, LNK_ID]

  beforeAll(async () => {
    await db.delete(users).where(inArray(users.id, ALL2))
  })
  afterAll(async () => {
    await db.delete(users).where(inArray(users.id, ALL2))
  })

  it("register OTP'siz → 400 (validatsiya: otp majburiy)", async () => {
    const res = await request(app).post('/api/auth/phone/register')
      .send({ phone: PHONE_REG, password: 'parol12345', firstName: 'Test' })
    expect(res.status).toBe(400)
  })

  it("register noto'g'ri kod bilan → 401 invalid_otp", async () => {
    await seedOtp(PHONE_REG)
    const res = await request(app).post('/api/auth/phone/register')
      .send({ phone: PHONE_REG, password: 'parol12345', firstName: 'Test', otp: '999999' })
    expect(res.status).toBe(401)
    expect(res.body.error).toContain('invalid_otp')
  })

  it("register to'g'ri kod bilan → sessiya + parol identity yaratiladi", async () => {
    await seedOtp(PHONE_REG, '123456')
    const res = await request(app).post('/api/auth/phone/register')
      .send({ phone: PHONE_REG, password: 'parol12345', firstName: 'Test', otp: '123456' })
      .expect(201)
    expect(res.body.sessionToken).toBeTruthy()
    expect(res.body.user.id).toBe(REG_ID)

    // OTP bir martalik — qayta ishlatib bo'lmaydi
    const replay = await request(app).post('/api/auth/phone/register')
      .send({ phone: '+998900000017', password: 'parol12345', firstName: 'X', otp: '123456' })
    expect(replay.status).toBeLessThan(500)
    expect(replay.status).toBe(401)

    // Parol bilan endi kirsa bo'ladi (SMS'siz login)
    const login = await request(app).post('/api/auth/phone/login')
      .send({ phone: PHONE_REG, password: 'parol12345' })
      .expect(200)
    expect(login.body.sessionToken).toBeTruthy()
  })

  it("link YANGI raqamga OTP'siz → 400 otp_required", async () => {
    const token = await createTgUserWithSession(TG_LINK)
    const res = await request(app).post('/api/auth/phone/link')
      .set('Authorization', `Bearer ${token}`)
      .send({ phone: PHONE_LNK, password: 'parol12345' })
    expect(res.status).toBe(400)
    expect(res.body.error).toContain('otp_required')
  })

  it("link YANGI raqamga to'g'ri OTP bilan → attached (raqam egasi isbotlandi)", async () => {
    await seedOtp(PHONE_LNK, '654321')
    const token = await createTgUserWithSession(TG_LINK)
    const res = await request(app).post('/api/auth/phone/link')
      .set('Authorization', `Bearer ${token}`)
      .send({ phone: PHONE_LNK, password: 'parol12345', otp: '654321' })
      .expect(200)
    expect(res.body.status).toBe('attached')
    expect(res.body.providers).toContain('phone')
  })

  it("link BAND raqamga parol proof bilan OTP'siz → ishlaydi (semantika saqlanadi)", async () => {
    // TG_LINK endi PHONE_LNK identity'ga ega — branch 2 (o'z raqami): parol yetarli
    const token = await createTgUserWithSession(TG_LINK)
    const res = await request(app).post('/api/auth/phone/link')
      .set('Authorization', `Bearer ${token}`)
      .send({ phone: PHONE_LNK, password: 'parol12345' })
      .expect(200)
    expect(res.body.status).toBe('attached')
  })
})
