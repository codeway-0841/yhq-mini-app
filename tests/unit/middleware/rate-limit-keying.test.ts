/**
 * Rate limit KALITI — CGNAT regressiyasi.
 *
 * Limitlar ilgari IP bo'yicha kalitlanardi. Mobil operatorlar CGNAT ishlatadi:
 * minglab abonent bitta public IPv4 ortida. Bitta faol foydalanuvchi ~10-20
 * req/min qiladi, ya'ni 120/min chegara bitta operator shlyuzidagi 6-12
 * foydalanuvchida tugardi va BUTUN API o'sha operator mijozlari uchun
 * o'chardi — hech kim qoidabuzarlik qilmasa ham.
 *
 * Yechim: chelakni SHAXSGA bog'lash (`userId`), IP'ga emas. IP faqat anonim
 * so'rov uchun zaxira kalit bo'lib qoladi.
 */
import { describe, it, expect } from 'vitest'
import express from 'express'
import request from 'supertest'
import { rateLimit, identityKey } from '../../../server/middleware/rate-limiter'

/** Ishlab chiqarishdagi kalit funksiyasining AYNAN o'zi ishlatiladi */
const userFirstKey = identityKey

/** Bitta CGNAT IP ortidagi bir nechta foydalanuvchini taqlid qiladi */
function buildApp(maxPerMinute: number) {
  const app = express()
  app.set('trust proxy', 1)
  // Auth'ni taqlid qilamiz: X-User sarlavhasi bo'lsa — tekshiruvdan o'tgan user
  app.use((req, _res, next) => {
    const u = req.header('x-user')
    if (u) (req as { userId?: string }).userId = u
    next()
  })
  app.use(rateLimit({ maxPerMinute, keyFn: userFirstKey }))
  app.get('/ping', (_req, res) => { res.json({ ok: true }) })
  return app
}

/** Bitta IP, lekin har xil foydalanuvchi — CGNAT stsenariysi */
async function hit(app: express.Express, user: string | null) {
  const r = request(app).get('/ping').set('X-Forwarded-For', '203.0.113.7')
  if (user) r.set('X-User', user)
  return r
}

describe('rate limit kaliti — CGNAT ortida', () => {
  it("bitta IP'dagi HAR XIL foydalanuvchilar bir-birini bloklamaydi", async () => {
    const app = buildApp(3)

    // A o'z chelagini tugatadi
    for (let i = 0; i < 3; i++) expect((await hit(app, 'user-a')).status).toBe(200)
    expect((await hit(app, 'user-a')).status).toBe(429)

    // B AYNI IP'da, lekin o'z chelagi bilan — ta'sirlanmasligi kerak
    expect((await hit(app, 'user-b')).status).toBe(200)
    expect((await hit(app, 'user-b')).status).toBe(200)
  })

  it('anonim so\'rovlar IP bo\'yicha cheklanadi (zaxira kalit)', async () => {
    const app = buildApp(2)
    expect((await hit(app, null)).status).toBe(200)
    expect((await hit(app, null)).status).toBe(200)
    expect((await hit(app, null)).status).toBe(429)
  })

  it("IP bo'yicha kalitlash AYNAN shu regressiyani qaytaradi", async () => {
    // Qarama-qarshi holat: eski xatti-harakat hujjatlashtiriladi —
    // IP kaliti bilan B foydalanuvchi A tugatgan chelakdan aziyat chekadi.
    const app = express()
    app.set('trust proxy', 1)
    app.use(rateLimit({ maxPerMinute: 3, keyFn: (req) => req.ip ?? 'unknown' }))
    app.get('/ping', (_req, res) => { res.json({ ok: true }) })

    for (let i = 0; i < 3; i++) {
      expect((await request(app).get('/ping').set('X-Forwarded-For', '203.0.113.7')).status).toBe(200)
    }
    const victim = await request(app).get('/ping').set('X-Forwarded-For', '203.0.113.7')
    expect(victim.status).toBe(429)
  })
})

describe('identityKey — platformadan mustaqil', () => {
  const asReq = (o: Partial<express.Request> & { userId?: string }) => o as express.Request

  it("userId bolsa transportdan qatiy nazar osha ishlatiladi", () => {
    // Telegram Mini App
    expect(identityKey(asReq({ userId: 'u-1', ip: '1.1.1.1' }))).toBe('u-1')
    // Telefon/email Bearer sessiyasi — ayni kanonik id shakli
    expect(identityKey(asReq({ userId: 'p_998900000', ip: '2.2.2.2' }))).toBe('p_998900000')
    // Kelajakdagi Android/iOS mijoz — o'z auth usuli `req.userId` ni to'ldirsa
    // rate limit qatlamiga umuman tegish shart emas.
    expect(identityKey(asReq({ userId: 'e_ab12cd', ip: '3.3.3.3' }))).toBe('e_ab12cd')
  })

  it("userId yoq bolsa IP zaxira kalit", () => {
    expect(identityKey(asReq({ ip: '9.9.9.9' }))).toBe('9.9.9.9')
  })

  it("ikkalasi ham yoq bolsa ham kalit qaytaradi (limiter ochib qolmaydi)", () => {
    expect(identityKey(asReq({}))).toBe('unknown')
  })

  it("BIR XIL userId turli transportlarda BIR XIL chelakka tushadi", () => {
    // Bitta akkaunt Telegram'dan ham, kelajakdagi ilovadan ham kirsa — bitta
    // limit. Kalit transportga qarab bo'linib ketmasligi kerak.
    const fromTelegram = identityKey(asReq({ userId: 'acct-7', ip: '5.5.5.5' }))
    const fromNativeApp = identityKey(asReq({ userId: 'acct-7', ip: '6.6.6.6' }))
    expect(fromTelegram).toBe(fromNativeApp)
  })
})
