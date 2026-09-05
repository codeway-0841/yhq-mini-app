import { describe, it, expect, vi, beforeEach } from 'vitest'
import { authService, phoneUserId } from '../../../server/modules/auth/auth.service'
import { authRepository } from '../../../server/modules/auth/auth.repository'
import { usersRepository } from '../../../server/modules/users/users.repository'
import { progressRepository } from '../../../server/modules/progress/progress.repository'
import { settingsRepository } from '../../../server/modules/settings/settings.repository'
import { savedRepository } from '../../../server/modules/saved/saved.repository'
import { coinsRepository } from '../../../server/modules/coins/coins.repository'
import { hashPassword } from '../../../server/utils/password'
import { AppError } from '../../../server/middleware/error-handler'
import { config } from '../../../server/config'

describe('server/modules/auth/auth.service.ts - Real Service Layer Tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    // #40: buildAuthSession endi getEconomyState ham chaqiradi — mock'siz real
    // DB'ga urinadi (CI'da DATABASE_URL=db.invalid → test yiqilardi)
    vi.spyOn(coinsRepository, 'getEconomyState').mockResolvedValue({ coins: 0, ownedItems: [] })
  })

  describe('phoneUserId helper', () => {
    it('normalizes +998 phone number to canonical p_<digits> user ID', () => {
      expect(phoneUserId('+998901234567')).toBe('p_998901234567')
      expect(phoneUserId('998901234567')).toBe('p_998901234567')
      expect(phoneUserId('+998 90 123 45 67')).toBe('p_998901234567')
    })
  })

  describe('registerWithPhone', () => {
    it('successfully registers new user with phone + password (OTP tasdiqlangach)', async () => {
      vi.spyOn(authRepository, 'findIdentity').mockResolvedValue(null as any)
      vi.spyOn(authRepository, 'consumeOTP').mockResolvedValue(true)
      vi.spyOn(usersRepository, 'initAtomic').mockResolvedValue(undefined as any)
      vi.spyOn(authRepository, 'createIdentity').mockResolvedValue(true)
      vi.spyOn(authRepository, 'createSession').mockResolvedValue(undefined as any)
      vi.spyOn(usersRepository, 'findById').mockResolvedValue({
        id: 'p_998901234567',
        firstName: 'Test',
        lastName: '',
        username: '',
        photoUrl: '',
        phone: '+998901234567',
        tariff: 'free',
        isAdmin: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any)
      vi.spyOn(progressRepository, 'findByUserId').mockResolvedValue({
        userId: 'p_998901234567',
        totalCorrect: 0,
        totalWrong: 0,
        totalAnswered: 0,
        streak: 0,
        wrongByTicket: {},
        solvedQuestions: [],
      } as any)
      // P2: buildAuthSession endi listSolvedKeys ham chaqiradi — mock'siz real DB'ga
      // urinadi (CI'da DATABASE_URL=db.invalid → test yiqilardi)
      vi.spyOn(progressRepository, 'listSolvedKeys').mockResolvedValue([])
      vi.spyOn(settingsRepository, 'findByUserId').mockResolvedValue({
        userId: 'p_998901234567',
        autoNextCorrect: true,
        autoNextWrong: false,
        noAnimation: false,
        shuffleOptions: false,
        fontSize: 'medium',
        fontStyle: 'default',
        language: 'uz',
        theme: 'dark',
        offlineMode: false,
      } as any)
      vi.spyOn(savedRepository, 'findByUserId').mockResolvedValue([])
      vi.spyOn(authRepository, 'listUserProviders').mockResolvedValue(['phone'])

      const result = await authService.registerWithPhone({
        phone: '+998901234567',
        password: 'Password123!',
        firstName: 'Test User',
        otp: '123456',
      })

      expect(result.sessionToken).toHaveLength(64)
      expect(result.user.id).toBe('p_998901234567')
      expect(result.providers).toEqual(['phone'])
    })

    it('throws 409 phone_taken if phone identity already exists', async () => {
      vi.spyOn(authRepository, 'findIdentity').mockResolvedValue({
        provider: 'phone',
        providerUid: '+998901234567',
        userId: 'p_998901234567',
        passwordHash: 'hash',
        createdAt: new Date(),
      })

      await expect(
        authService.registerWithPhone({
          phone: '+998901234567',
          password: 'Password123!',
          firstName: 'Duplicate User',
          otp: '123456',
        }),
      ).rejects.toThrowError(new AppError(409, 'phone_taken'))
    })

    it('throws 409 phone_taken if createIdentity returns false', async () => {
      vi.spyOn(authRepository, 'findIdentity').mockResolvedValue(null as any)
      vi.spyOn(authRepository, 'consumeOTP').mockResolvedValue(true)
      vi.spyOn(usersRepository, 'initAtomic').mockResolvedValue(undefined as any)
      vi.spyOn(authRepository, 'createIdentity').mockResolvedValue(false)

      await expect(
        authService.registerWithPhone({
          phone: '+998901234567',
          password: 'Password123!',
          firstName: 'Test User',
          otp: '123456',
        }),
      ).rejects.toThrowError(new AppError(409, 'phone_taken'))
    })
  })

  describe('loginWithPhone', () => {
    it('successfully logs in with valid phone and password', async () => {
      const password = 'SecretPassword123!'
      const hash = hashPassword(password)

      vi.spyOn(authRepository, 'findIdentity').mockResolvedValue({
        provider: 'phone',
        providerUid: '+998901234567',
        userId: 'p_998901234567',
        passwordHash: hash,
        createdAt: new Date(),
      })
      vi.spyOn(authRepository, 'isAccountLocked').mockResolvedValue(false)
      vi.spyOn(authRepository, 'resetFailedLoginAttempts').mockResolvedValue(undefined as any)
      vi.spyOn(authRepository, 'createSession').mockResolvedValue(undefined as any)
      vi.spyOn(usersRepository, 'findById').mockResolvedValue({
        id: 'p_998901234567',
        firstName: 'Test',
        lastName: '',
        username: '',
        photoUrl: '',
        tariff: 'free',
      } as any)
      vi.spyOn(progressRepository, 'findByUserId').mockResolvedValue({
        userId: 'p_998901234567',
        totalCorrect: 10,
        totalWrong: 1,
        totalAnswered: 11,
        streak: 2,
        wrongByTicket: {},
      } as any)
      vi.spyOn(progressRepository, 'listSolvedKeys').mockResolvedValue(['yhq:1', 'yhq:5'])
      vi.spyOn(settingsRepository, 'findByUserId').mockResolvedValue({
        userId: 'p_998901234567',
        autoNextCorrect: true,
        autoNextWrong: false,
        noAnimation: false,
        shuffleOptions: false,
        fontSize: 'medium',
        fontStyle: 'default',
        language: 'uz',
        theme: 'dark',
        offlineMode: false,
      } as any)
      vi.spyOn(savedRepository, 'findByUserId').mockResolvedValue([])
      vi.spyOn(authRepository, 'listUserProviders').mockResolvedValue(['phone'])

      const result = await authService.loginWithPhone({
        phone: '+998901234567',
        password,
      })

      expect(result.sessionToken).toHaveLength(64)
      expect(result.user.id).toBe('p_998901234567')
    })

    it('throws 401 invalid_credentials if user not found', async () => {
      vi.spyOn(authRepository, 'findIdentity').mockResolvedValue(null as any)

      await expect(
        authService.loginWithPhone({
          phone: '+998901234567',
          password: 'anyPassword',
        }),
      ).rejects.toThrowError(new AppError(401, 'invalid_credentials'))
    })

    it('throws 403 account_locked if account is currently locked', async () => {
      vi.spyOn(authRepository, 'findIdentity').mockResolvedValue({
        provider: 'phone',
        providerUid: '+998901234567',
        userId: 'p_998901234567',
        passwordHash: hashPassword('pass'),
        createdAt: new Date(),
      })
      vi.spyOn(authRepository, 'isAccountLocked').mockResolvedValue(true)

      await expect(
        authService.loginWithPhone({
          phone: '+998901234567',
          password: 'pass',
        }),
      ).rejects.toThrowError(new AppError(403, 'account_locked'))
    })

    it('increments failed attempts and locks account on 5th failed password', async () => {
      vi.spyOn(authRepository, 'findIdentity').mockResolvedValue({
        provider: 'phone',
        providerUid: '+998901234567',
        userId: 'p_998901234567',
        passwordHash: hashPassword('realPassword'),
        createdAt: new Date(),
      })
      vi.spyOn(authRepository, 'isAccountLocked').mockResolvedValue(false)
      vi.spyOn(authRepository, 'incrementFailedLoginAttempts').mockResolvedValue(5)
      const lockSpy = vi.spyOn(authRepository, 'lockAccount').mockResolvedValue(undefined as any)

      await expect(
        authService.loginWithPhone({
          phone: '+998901234567',
          password: 'wrongPassword',
        }),
      ).rejects.toThrowError(new AppError(403, 'account_locked'))

      expect(lockSpy).toHaveBeenCalledWith('p_998901234567', expect.any(Date))
    })
  })

  describe('Telegram Login Widget', () => {
    it('throws 401 invalid_widget_signature for corrupted HMAC signature', async () => {
      const origToken = config.telegram.botToken
      ;(config.telegram as any).botToken = 'mock-bot-token:12345'
      try {
        await expect(
          authService.loginWithTelegramWidget({
            id: 123456789,
            first_name: 'Test',
            last_name: '',
            username: 'test',
            photo_url: '',
            auth_date: Math.floor(Date.now() / 1000),
            hash: '0'.repeat(64),
          }),
        ).rejects.toThrowError(new AppError(401, 'invalid_widget_signature'))
      } finally {
        ;(config.telegram as any).botToken = origToken
      }
    })
  })

  describe('linkPhone lockout enforcement (ID 02)', () => {
    it('throws 403 account_locked if target phone account is locked', async () => {
      vi.spyOn(authRepository, 'findIdentity').mockResolvedValue({
        provider: 'phone',
        providerUid: '+998901234567',
        userId: 'p_998901234567',
        passwordHash: hashPassword('targetPass'),
        createdAt: new Date(),
      })
      vi.spyOn(authRepository, 'isAccountLocked').mockResolvedValue(true)

      await expect(
        authService.linkPhone('123456789', {
          phone: '+998901234567',
          password: 'targetPass',
        }),
      ).rejects.toThrowError(new AppError(403, 'account_locked'))
    })

    it('increments failed attempts on victim account and locks upon 5th failure during link', async () => {
      vi.spyOn(authRepository, 'findIdentity').mockResolvedValue({
        provider: 'phone',
        providerUid: '+998901234567',
        userId: 'p_998901234567',
        passwordHash: hashPassword('realPass'),
        createdAt: new Date(),
      })
      vi.spyOn(authRepository, 'isAccountLocked').mockResolvedValue(false)
      vi.spyOn(authRepository, 'incrementFailedLoginAttempts').mockResolvedValue(5)
      const lockSpy = vi.spyOn(authRepository, 'lockAccount').mockResolvedValue(undefined as any)

      await expect(
        authService.linkPhone('123456789', {
          phone: '+998901234567',
          password: 'wrongPass',
        }),
      ).rejects.toThrowError(new AppError(403, 'account_locked'))

      expect(lockSpy).toHaveBeenCalledWith('p_998901234567', expect.any(Date))
    })
  })
})
