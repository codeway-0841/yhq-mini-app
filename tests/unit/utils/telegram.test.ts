/**
 * initData / Login Widget verifikatsiyasi — replay oynasi chegaralari (P1-4).
 *
 * Oldin MAX_AGE 24 soat edi; endi config orqali (INITDATA_MAX_AGE_SECONDS,
 * default 1 soat). Bu testlar chegara holatlarini qat'iylashtiradi:
 *  - yangi auth_date o'tadi;
 *  - oynadan eski (2 soat) — DEFAULT bo'yicha rad (eski 24h xatti-harakati EMAS);
 *  - kengaytirilgan oyna (env bilan) eskiroq qiymatni o'tkazadi;
 *  - kelajakdagi vaqt > 60s — rad (skew himoyasi);
 *  - buzilgan imzo — rad (timing-safe compare yo'li).
 */

import { createHmac, createHash } from 'crypto'
import { describe, it, expect, afterEach } from 'vitest'
import { verifyInitData, verifyLoginWidget } from '../../../server/utils/telegram'
import { config } from '../../../server/config'

const BOT_TOKEN = '7000000001:TEST_TOKEN_AUDIT_P14'

/** Mini App initData imzosi: secret = HMAC('WebAppData', token) */
function signDataCheckString(dataCheckString: string): string {
  const secretKey = createHmac('sha256', 'WebAppData').update(BOT_TOKEN).digest()
  return createHmac('sha256', secretKey).update(dataCheckString).digest('hex')
}

/** Login Widget imzosi: secret = SHA-256(token) — boshqa sxema! */
function signWidgetString(dataCheckString: string): string {
  const secret = createHash('sha256').update(BOT_TOKEN).digest()
  return createHmac('sha256', secret).update(dataCheckString).digest('hex')
}

function buildInitData(fields: Record<string, string>): string {
  const entries = Object.entries(fields).filter(([k]) => k !== 'hash')
  entries.sort()
  const hash = signDataCheckString(entries.map(([k, v]) => `${k}=${v}`).join('\n'))
  return new URLSearchParams({ ...fields, hash }).toString()
}

const USER_JSON = JSON.stringify({ id: 424242, first_name: 'Test' })

function authDate(offsetSeconds: number): string {
  return String(Math.floor(Date.now() / 1000) - offsetSeconds)
}

// config startup snapshot'i — mutatsiyalarni har test'dan keyin qaytaramiz
const originalMaxAge = config.auth.initDataMaxAgeSeconds
afterEach(() => {
  ;(config.auth as { initDataMaxAgeSeconds: number }).initDataMaxAgeSeconds = originalMaxAge
  process.env.NODE_ENV = 'test'
})

describe('verifyInitData — replay oynasi (P1-4)', () => {
  it('yangi auth_date (1 daqiqa oldin) o\'tadi', () => {
    const initData = buildInitData({ auth_date: authDate(60), user: USER_JSON })
    const user = verifyInitData(initData, BOT_TOKEN)
    expect(user?.id).toBe(424242)
  })

  it("2 soat eskirgan initData DEFAULT oyna bilan RAD (24 soat emas — P1-4)", () => {
    const initData = buildInitData({ auth_date: authDate(2 * 3600), user: USER_JSON })
    expect(verifyInitData(initData, BOT_TOKEN)).toBeNull()
  })

  it('oyna kengaytirilsa (masalan 24h) eski qiymat o\'tadi — env konfiguratsiyasi ishlaydi', () => {
    ;(config.auth as { initDataMaxAgeSeconds: number }).initDataMaxAgeSeconds = 86_400
    const initData = buildInitData({ auth_date: authDate(2 * 3600), user: USER_JSON })
    expect(verifyInitData(initData, BOT_TOKEN)?.id).toBe(424242)
  })

  it('kelajakdagi auth_date (> 60s skew) — rad', () => {
    const initData = buildInitData({ auth_date: authDate(-300), user: USER_JSON })
    expect(verifyInitData(initData, BOT_TOKEN)).toBeNull()
  })

  it('buzilgan imzo — rad (imzo tekshiruvi freshnesdan OLDIN)', () => {
    const initData = buildInitData({ auth_date: authDate(60), user: USER_JSON })
      .replace(/hash=[0-9a-f]+/, 'hash=' + '0'.repeat(64))
    expect(verifyInitData(initData, BOT_TOKEN)).toBeNull()
  })

  it('auth_date yo\'q — rad (imzo umrbod yashamasligi kerak)', () => {
    const initData = buildInitData({ user: USER_JSON })
    expect(verifyInitData(initData, BOT_TOKEN)).toBeNull()
  })
})

describe('verifyLoginWidget — bir xil oyna siyosati', () => {
  function widgetFields(offsetSeconds: number): Record<string, string> {
    const fields: Record<string, string> = {
      id: '424242',
      first_name: 'Test',
      auth_date: authDate(offsetSeconds),
    }
    const entries = Object.entries(fields).sort()
    fields['hash'] = signWidgetString(entries.map(([k, v]) => `${k}=${v}`).join('\n'))
    return fields
  }

  it('yangi widget ma\'lumoti o\'tadi', () => {
    expect(verifyLoginWidget(widgetFields(30), BOT_TOKEN)?.id).toBe(424242)
  })

  it('2 soat eskirgan widget — default oyna bilan rad', () => {
    expect(verifyLoginWidget(widgetFields(2 * 3600), BOT_TOKEN)).toBeNull()
  })
})
