import { describe, it, expect, vi, afterEach } from 'vitest'
import { createHmac, randomBytes } from 'crypto'
import { verifyInitData } from '../../../server/utils/telegram'

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
