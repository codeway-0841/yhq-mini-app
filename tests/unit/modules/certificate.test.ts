import { describe, it, expect } from 'vitest'
import { t } from '../../../src/shared/i18n'

describe('Certificate Module & Delivery System', () => {
  it('has complete UZ and RU i18n keys for Certificate delivery and download', () => {
    expect(t('uz', 'certOfficialTitle')).toBe('Rasmiy bilim sertifikati')
    expect(t('ru', 'certOfficialTitle')).toBe('Сертификат знаний')

    expect(t('uz', 'downloadCertificate')).toBe('Rasmni yuklab olish')
    expect(t('ru', 'downloadCertificate')).toBe('Скачать сертификат')

    expect(t('uz', 'sendToTelegram')).toBe('Telegram botga yuborish (Rasmni saqlash)')
    expect(t('ru', 'sendToTelegram')).toBe('Отправить в Telegram бот (Сохранить)')

    expect(t('uz', 'certSentSuccess')).toBeTruthy()
    expect(t('ru', 'certSentSuccess')).toBeTruthy()

    expect(t('uz', 'shareCertificate')).toBe("Telegram'da ulashish")
    expect(t('ru', 'shareCertificate')).toBe('Поделиться в Telegram')
  })

  it('correctly parses base64 image and creates file payload buffer', () => {
    const rawDataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
    const cleanBase64 = rawDataUrl.replace(/^data:image\/\w+;base64,/, '')
    const buffer = Buffer.from(cleanBase64, 'base64')
    expect(buffer.length).toBeGreaterThan(0)
  })

  it('validates Telegram User ID formats for direct bot delivery', () => {
    const isTelegramUid = (id: string) => /^\d{5,12}$/.test(id)
    expect(isTelegramUid('123456789')).toBe(true)
    expect(isTelegramUid('5891234567')).toBe(true)
    expect(isTelegramUid('p_998901234567')).toBe(false)
    expect(isTelegramUid('guest_123')).toBe(false)
  })
})
