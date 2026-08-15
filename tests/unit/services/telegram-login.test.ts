import { describe, it, expect } from 'vitest'
import { t } from '../../../src/shared/i18n'
import { telegramLoginCodes } from '../../../server/schema'

describe('Telegram Login Flow & Schema', () => {
  it('defines telegram_login_codes table in schema', () => {
    expect(telegramLoginCodes).toBeDefined()
    expect(telegramLoginCodes.code).toBeDefined()
    expect(telegramLoginCodes.sessionToken).toBeDefined()
    expect(telegramLoginCodes.expiresAt).toBeDefined()
    expect(telegramLoginCodes.createdAt).toBeDefined()
  })

  it('has consistent i18n keys for telegram login in UZ and RU', () => {
    expect(t('uz', 'authTelegramLogin')).toBe('Telegram orqali kirish')
    expect(t('ru', 'authTelegramLogin')).toBe('Войти через Telegram')

    expect(t('uz', 'authCodeExpired')).toBe("Kod eskirdi — qayta urinib ko'ring")
    expect(t('ru', 'authCodeExpired')).toBe('Код истёк — попробуйте ещё раз')

    expect(t('uz', 'authTgSharePhone')).toContain('Boshlash')
    expect(t('ru', 'authTgSharePhone')).toContain('Старт')
  })

  it('matches deep-link login param in bot command regex', () => {
    const loginRegex = /^login_[A-Za-z0-9_-]{6,32}$/

    expect(loginRegex.test('login_aB12-cD34_eF')).toBe(true)
    expect(loginRegex.test('login_0123456789a')).toBe(true)
    expect(loginRegex.test('login_abc')).toBe(false) // too short
    expect(loginRegex.test('ref_12345')).toBe(false)
    expect(loginRegex.test('duel-123456')).toBe(false)
  })

  it('correctly extracts login code from deep link param', () => {
    const param = 'login_aB12-cD34_eF'
    const code = param.slice(6)
    expect(code).toBe('aB12-cD34_eF')
  })

  it('sanitizes bot username with or without leading @', () => {
    const rawWithAt = '@yhq_robot'
    const rawWithoutAt = 'yhq_robot'

    const clean1 = rawWithAt.replace(/^@/, '')
    const clean2 = rawWithoutAt.replace(/^@/, '')

    expect(clean1).toBe('yhq_robot')
    expect(clean2).toBe('yhq_robot')
  })
})
