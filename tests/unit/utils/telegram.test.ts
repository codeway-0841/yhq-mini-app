import { describe, it, expect, vi, afterEach } from 'vitest'
import { createHmac, createHash, randomBytes } from 'crypto'
import { verifyInitData, verifyLoginWidget } from '../../../server/utils/telegram'

const TOKEN = 'TEST_BOT_TOKEN'

/** Telegram spec bo'yicha imzolangan initData yasash */
function makeInitData(fields: Record<string, string>, token = TOKEN): string {
  const pairs = Object.entries(fields).filter(([k]) => k !== 'hash')
  pairs.sort(([a], [b]) => (a < b ? -1 : 1))
  const dcs = pairs.map(([k, v]) => `${k}=${v}`).join('\n')
  const secret = createHmac('sha256', 'WebAppData').update(token).digest()
  const hash = createHmac('sha256', secret).update(dcs).digest('hex')
  return new URLSearchParams({ ...fields, hash }).toString()
}

const USER = JSON.stringify({ id: 123456789, first_name: 'Test' })
const freshDate = () => String(Math.floor(Date.now() / 1000))

afterEach(() => vi.useRealTimers())

describe('verifyInitData', () => {
  it('to\'g\'ri imzolangan initData → user qaytaradi', () => {
    const initData = makeInitData({ auth_date: freshDate(), user: USER })
    expect(verifyInitData(initData, TOKEN)?.id).toBe(123456789)
  })

  it('buzilgan imzo (boshqa token) → null', () => {
    const initData = makeInitData({ auth_date: freshDate(), user: USER }, 'BOSHQA_TOKEN')
    expect(verifyInitData(initData, TOKEN)).toBeNull()
  })

  it('buzilgan hash matni → null', () => {
    const initData = makeInitData({ auth_date: freshDate(), user: USER })
    const tampered = initData.replace(/hash=[a-f0-9]+/, `hash=${'0'.repeat(64)}`)
    expect(verifyInitData(tampered, TOKEN)).toBeNull()
  })

  it('auth_date bilan o\'ynangan so\'rov → null (qayta imzolash imkoni yo\'q)', () => {
    const initData = makeInitData({ auth_date: freshDate(), user: USER })
    // auth_date'ni imzosiz o'zgartirib yuborish imzoni buzadi
    const tampered = initData.replace(/auth_date=\d+/, 'auth_date=1')
    expect(verifyInitData(tampered, TOKEN)).toBeNull()
  })

  it('24 soatdan ESKI auth_date → null (replay)', () => {
    const old = String(Math.floor(Date.now() / 1000) - 24 * 3600 - 60)
    const initData = makeInitData({ auth_date: old, user: USER })
    expect(verifyInitData(initData, TOKEN)).toBeNull()
  })

  it('auth_date YO\'Q → null (imzo umrbod yashamasligi kerak)', () => {
    const initData = makeInitData({ user: USER })   // auth_date'siz!
    expect(verifyInitData(initData, TOKEN)).toBeNull()
  })

  it('kelajakdagi auth_date (>60s skew) → null', () => {
    const future = String(Math.floor(Date.now() / 1000) + 3600)
    const initData = makeInitData({ auth_date: future, user: USER })
    expect(verifyInitData(initData, TOKEN)).toBeNull()
  })

  it('user field yo\'q → null', () => {
    const initData = makeInitData({ auth_date: freshDate() })
    expect(verifyInitData(initData, TOKEN)).toBeNull()
  })

  it('buzilgan JSON user → null', () => {
    const initData = makeInitData({ auth_date: freshDate(), user: 'not-json' })
    expect(verifyInitData(initData, TOKEN)).toBeNull()
  })

  it('toksik random payload → null, crash yo\'q', () => {
    expect(verifyInitData(randomBytes(64).toString('hex'), TOKEN)).toBeNull()
    expect(verifyInitData('', TOKEN)).toBeNull()
  })
})

// ── Telegram Login Widget — BOSHQA sxema (secret = SHA256(token), WebAppData EMAS) ──

/** Widget spec bo'yicha imzolangan maydonlar: secret = SHA256(bot_token) raw digest */
function makeWidgetFields(fields: Record<string, string>, token = TOKEN): Record<string, string> {
  const pairs = Object.entries(fields).filter(([k, v]) => k !== 'hash' && v !== '')
  pairs.sort(([a], [b]) => (a < b ? -1 : 1))
  const dcs = pairs.map(([k, v]) => `${k}=${v}`).join('\n')
  const secret = createHash('sha256').update(token).digest()
  const hash = createHmac('sha256', secret).update(dcs).digest('hex')
  return { ...fields, hash }
}

const WIDGET_USER = { id: '123456789', first_name: 'Test', username: 'test_user' }

describe('verifyLoginWidget', () => {
  it("to'g'ri imzolangan widget → user qaytaradi", () => {
    const fields = makeWidgetFields({ ...WIDGET_USER, auth_date: freshDate() })
    expect(verifyLoginWidget(fields, TOKEN)?.id).toBe(123456789)
  })

  it('Mini App (WebAppData) sxemasi bilan imzolangan → null (sxemalar ARALASHMAYDI)', () => {
    // initData sxemasi bilan imzolasak — widget verify qabul qilmasligi shart
    const pairs = [`auth_date=${freshDate()}`, `id=${WIDGET_USER.id}`, `first_name=Test`].sort()
    const initDataSecret = createHmac('sha256', 'WebAppData').update(TOKEN).digest()
    const wrongHash = createHmac('sha256', initDataSecret).update(pairs.join('\n')).digest('hex')
    expect(verifyLoginWidget({ ...WIDGET_USER, auth_date: freshDate(), hash: wrongHash }, TOKEN)).toBeNull()
  })

  it('buzilgan imzo (boshqa token) → null', () => {
    const fields = makeWidgetFields({ ...WIDGET_USER, auth_date: freshDate() }, 'BOSHQA_TOKEN')
    expect(verifyLoginWidget(fields, TOKEN)).toBeNull()
  })

  it("maydon o'zgartirilgan (id) → imzo buziladi → null", () => {
    const fields = makeWidgetFields({ ...WIDGET_USER, auth_date: freshDate() })
    expect(verifyLoginWidget({ ...fields, id: '999999999' }, TOKEN)).toBeNull()
  })

  it('24 soatdan ESKI auth_date → null (replay)', () => {
    const old = String(Math.floor(Date.now() / 1000) - 24 * 3600 - 60)
    const fields = makeWidgetFields({ ...WIDGET_USER, auth_date: old })
    expect(verifyLoginWidget(fields, TOKEN)).toBeNull()
  })

  it('hash yo\'q → null', () => {
    expect(verifyLoginWidget({ ...WIDGET_USER, auth_date: freshDate() }, TOKEN)).toBeNull()
  })
})
