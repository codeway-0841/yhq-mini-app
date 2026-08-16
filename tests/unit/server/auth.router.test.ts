import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import { createApp } from '../../../server/app'
import { authService } from '../../../server/modules/auth/auth.service'
import { authRepository } from '../../../server/modules/auth/auth.repository'

const app = createApp()

describe('server/modules/auth/auth.router.ts - Router Layer Tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  describe('OTP Endpoints', () => {
    it('POST /api/auth/otp/request succeeds with valid phone', async () => {
      vi.spyOn(authService, 'requestOTP').mockResolvedValue({
        sent: true,
        expiresInSeconds: 120,
        resendInSeconds: 60,
      } as any)

      const res = await request(app)
        .post('/api/auth/otp/request')
        .send({ phone: '+998901234567' })
        .expect(200)

      expect(res.body.sent).toBe(true)
    })

    it('POST /api/auth/otp/request returns 400 for invalid phone format', async () => {
      const res = await request(app)
        .post('/api/auth/otp/request')
        .send({ phone: '12345' })
        .expect(400)

      expect(res.body.error).toBeDefined()
    })

    it('POST /api/auth/otp/verify/login succeeds with valid phone + 6-digit code', async () => {
      vi.spyOn(authService, 'verifyOTPLogin').mockResolvedValue({
        sessionToken: 'token123',
        user: { id: 'p_998901234567' },
      } as any)

      const res = await request(app)
        .post('/api/auth/otp/verify/login')
        .send({ phone: '+998901234567', code: '123456' })
        .expect(200)

      expect(res.body.sessionToken).toBe('token123')
    })

    it('POST /api/auth/otp/verify/register succeeds with valid payload', async () => {
      vi.spyOn(authService, 'verifyOTPRegister').mockResolvedValue({
        sessionToken: 'token456',
        user: { id: 'p_998901234567' },
      } as any)

      const res = await request(app)
        .post('/api/auth/otp/verify/register')
        .send({
          phone: '+998901234567',
          code: '123456',
          password: 'Password123!',
          firstName: 'Ali',
        })
        .expect(201)

      expect(res.body.sessionToken).toBe('token456')
    })
  })

  describe('Phone Register & Login Endpoints', () => {
    it('POST /api/auth/phone/register returns 201 on success', async () => {
      vi.spyOn(authService, 'registerWithPhone').mockResolvedValue({
        sessionToken: 'reg_token',
        user: { id: 'p_998901234567' },
      } as any)

      const res = await request(app)
        .post('/api/auth/phone/register')
        .send({
          phone: '+998901234567',
          password: 'Password123!',
          firstName: 'Vali',
          otp: '123456',
        })
        .expect(201)

      expect(res.body.sessionToken).toBe('reg_token')
    })

    it('POST /api/auth/phone/login returns 200 on success', async () => {
      vi.spyOn(authService, 'loginWithPhone').mockResolvedValue({
        sessionToken: 'login_token',
        user: { id: 'p_998901234567' },
      } as any)

      const res = await request(app)
        .post('/api/auth/phone/login')
        .send({
          phone: '+998901234567',
          password: 'Password123!',
        })
        .expect(200)

      expect(res.body.sessionToken).toBe('login_token')
    })
  })

  describe('Telegram Flow Endpoints', () => {
    it('POST /api/auth/telegram-login creates a login code', async () => {
      vi.spyOn(authService, 'createTelegramLoginCode').mockResolvedValue({
        code: 'tg_code_123',
        url: 'https://t.me/bot?start=login_tg_code_123',
        expiresInSeconds: 300,
      } as any)

      const res = await request(app)
        .post('/api/auth/telegram-login')
        .send({})
        .expect(200)

      expect(res.body.code).toBe('tg_code_123')
    })

    it('GET /api/auth/telegram-login/:code polls code status', async () => {
      vi.spyOn(authService, 'checkTelegramLoginCode').mockResolvedValue({
        status: 'pending',
      } as any)

      const res = await request(app)
        .get('/api/auth/telegram-login/tg_code_123')
        .expect(200)

      expect(res.body.status).toBe('pending')
    })
  })

  describe('Protected Session Endpoints', () => {
    it('GET /api/auth/me returns 401 when no auth header provided', async () => {
      await request(app)
        .get('/api/auth/me')
        .expect(401)
    })

    it('GET /api/auth/me returns profile when valid session provided', async () => {
      vi.spyOn(authRepository, 'resolveSession').mockResolvedValue({
        userId: 'p_998901234567',
        provider: 'phone',
        expiresAt: new Date(Date.now() + 1000000),
      } as any)
      vi.spyOn(authService, 'getSessionProfile').mockResolvedValue({
        user: { id: 'p_998901234567', firstName: 'Ali' },
        providers: ['phone'],
      } as any)

      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer valid_session_token_123')
        .expect(200)

      expect(res.body.user.id).toBe('p_998901234567')
    })

    it('POST /api/auth/logout revokes session', async () => {
      vi.spyOn(authRepository, 'resolveSession').mockResolvedValue({
        userId: 'p_998901234567',
        provider: 'phone',
        expiresAt: new Date(Date.now() + 1000000),
      } as any)
      const logoutSpy = vi.spyOn(authService, 'logout').mockResolvedValue(undefined as any)

      const res = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', 'Bearer valid_session_token_123')
        .expect(200)

      expect(res.body.ok).toBe(true)
      expect(logoutSpy).toHaveBeenCalledWith('valid_session_token_123')
    })
  })
})
