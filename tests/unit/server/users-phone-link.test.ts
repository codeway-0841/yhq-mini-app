/**
 * Telefon ulash — Mini App requestContact fast-path (SMS'siz, 2026-08-28).
 *
 * Telegram-imzolangan contact xabari (bot message:contact handler) raqamni
 * usersService.applyVerifiedPhone orqali yozadi; client GET /users/:id/phone
 * endpoint'ini poll qilib shuni ko'radi, yetib kelmasa SMS OTP fallback.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import express from 'express'
import request from 'supertest'

vi.mock('../../../server/middleware/auth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../server/middleware/auth')>()),
  // Unit app'da global telegramAuth yo'q — requireSelf'ni userId injector bilan almashtiramiz
  requireSelf: (req: express.Request, _res: express.Response, next: express.NextFunction) => {
    (req as { userId?: string }).userId = '123'
    next()
  },
}))

import usersRouter from '../../../server/modules/users/users.router'
import { usersService } from '../../../server/modules/users/users.service'
import { usersRepository, referralsRepository } from '../../../server/modules/users/users.repository'
import { errorHandler } from '../../../server/middleware/error-handler'

function makeApp() {
  const app = express()
  app.use(express.json())
  app.use('/api', usersRouter)
  app.use(errorHandler)
  return app
}

describe('usersService.applyVerifiedPhone — verified raqam yozish nuqtasi', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("raqam yoziladi + referal reward trigger bo'ladi (repository CTE idempotent)", async () => {
    const upd = vi.spyOn(usersRepository, 'updatePhone').mockResolvedValue(true)
    const rew = vi.spyOn(referralsRepository, 'rewardIfPhoneLinked').mockResolvedValue(true)

    await usersService.applyVerifiedPhone('123', '+998901234567')

    expect(upd).toHaveBeenCalledWith('123', '+998901234567')
    expect(rew).toHaveBeenCalledWith('123')
  })

  it("user qatori yo'q → 404 AppError, reward chaqirilmaydi", async () => {
    vi.spyOn(usersRepository, 'updatePhone').mockResolvedValue(false)
    const rew = vi.spyOn(referralsRepository, 'rewardIfPhoneLinked').mockResolvedValue(false)

    await expect(usersService.applyVerifiedPhone('x', '+998901234567'))
      .rejects.toMatchObject({ statusCode: 404 })
    expect(rew).not.toHaveBeenCalled()
  })

  it('reward xatosi asosiy yozuvni sindirmaydi (best-effort)', async () => {
    vi.spyOn(usersRepository, 'updatePhone').mockResolvedValue(true)
    vi.spyOn(referralsRepository, 'rewardIfPhoneLinked').mockRejectedValue(new Error('db down'))

    await expect(usersService.applyVerifiedPhone('123', '+998901234567')).resolves.toBeUndefined()
  })
})

describe('GET /api/users/:userId/phone — fast-path polling endpoint', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('ulangan raqamni qaytaradi + Cache-Control: private, no-store (PII)', async () => {
    vi.spyOn(usersRepository, 'findById').mockResolvedValue({ id: '123', phone: '+998901234567' } as never)

    const res = await request(makeApp()).get('/api/users/123/phone').expect(200)

    expect(res.body).toEqual({ phone: '+998901234567' })
    expect(res.headers['cache-control']).toContain('no-store')
  })

  it('raqam hali yozilmagan (bot webhook yetib kelmagan) → { phone: null }', async () => {
    vi.spyOn(usersRepository, 'findById').mockResolvedValue({ id: '123', phone: null } as never)

    const res = await request(makeApp()).get('/api/users/123/phone').expect(200)

    expect(res.body).toEqual({ phone: null })
  })

  it("user yo'q → 404", async () => {
    vi.spyOn(usersRepository, 'findById').mockResolvedValue(null as never)

    await request(makeApp()).get('/api/users/123/phone').expect(404)
  })
})
