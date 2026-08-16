/**
 * SMS marketing kampaniyalari — integration testlar.
 *
 * Opt-in consent + campaign create/dispatch chunk oqimi.
 * Eskiz yuborish MOCK qilinadi (config.sms.enabled=false → dev console path,
 * sendSmsMessage no-op) — real SMS ketmaydi.
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import request from 'supertest'
import { createApp } from '../../../server/app'
import { db } from '../../../server/db/connection'
import { users, smsCampaigns, smsCampaignRecipients } from '../../../server/schema'
import { eq, inArray } from 'drizzle-orm'
import { authRepository } from '../../../server/modules/auth/auth.repository'
import { sendSmsMessage } from '../../../server/utils/sms'

vi.mock('../../../server/utils/sms', async () => {
  const actual = await vi.importActual<typeof import('../../../server/utils/sms')>('../../../server/utils/sms')
  return { ...actual, sendSmsMessage: vi.fn(async () => {}) }
})

const app = createApp()

const ADMIN_ID = '977000111300'
const U1 = '977000111301'   // opt-in + phone
const U2 = '977000111302'   // phone bor, opt-in YO'Q
const U3 = '977000111303'   // opt-in, phone YO'Q → audience'ga kirmaydi
const ALL = [ADMIN_ID, U1, U2, U3]

const ADMIN_TOKEN = 'itest_sms_admin_token'
const USER_TOKEN = 'itest_sms_user_token'

async function cleanup() {
  await db.delete(smsCampaignRecipients)
  await db.delete(smsCampaigns)
  await db.delete(users).where(inArray(users.id, ALL))
}

beforeAll(async () => {
  await cleanup()
  await db.insert(users).values([
    { id: ADMIN_ID, firstName: 'Sms', lastName: 'Admin', username: 'sms_admin', photoUrl: '', isAdmin: true },
    { id: U1, firstName: 'O1', lastName: '', username: 'sms_u1', photoUrl: '', phone: '+998901111111' },
    { id: U2, firstName: 'O2', lastName: '', username: 'sms_u2', photoUrl: '', phone: '+998902222222' },
    { id: U3, firstName: 'O3', lastName: '', username: 'sms_u3', photoUrl: '' },
  ])
  const expiresAt = new Date(Date.now() + 3600_000)
  await authRepository.createSession({ token: ADMIN_TOKEN, userId: ADMIN_ID, provider: 'phone', expiresAt })
  await authRepository.createSession({ token: USER_TOKEN, userId: U1, provider: 'phone', expiresAt })
})

afterAll(cleanup)

const asAdmin = (r: request.Test) => r.set('Authorization', `Bearer ${ADMIN_TOKEN}`)
const asUser = (r: request.Test) => r.set('Authorization', `Bearer ${USER_TOKEN}`)

describe('SMS consent (opt-in)', () => {
  it("PATCH /users/:id/sms-consent — user o'zi opt-in beradi, profile'da ko'rinadi", async () => {
    const res = await asUser(request(app).patch(`/api/users/${U1}/sms-consent`)).send({ optIn: true }).expect(200)
    expect(res.body.ok).toBe(true)

    const [row] = await db.select({ optIn: users.smsOptIn, at: users.smsOptedInAt }).from(users).where(eq(users.id, U1))
    expect(row.optIn).toBe(true)
    expect(row.at).not.toBeNull()
  })

  it('opt-out timestampni tozalaydi', async () => {
    await asUser(request(app).patch(`/api/users/${U1}/sms-consent`)).send({ optIn: false }).expect(200)
    const [row] = await db.select().from(users).where(eq(users.id, U1))
    expect(row.smsOptIn).toBe(false)
    expect(row.smsOptedInAt).toBeNull()
    // qayta yoqamiz — keyingi testlar uchun
    await asUser(request(app).patch(`/api/users/${U1}/sms-consent`)).send({ optIn: true }).expect(200)
  })

  it('U3 (opt-in, phonesiz) — audience soniga kirmaydi', async () => {
    await db.update(users).set({ smsOptIn: true }).where(eq(users.id, U3))
    const res = await asAdmin(request(app).get('/api/admin/sms/audience')).expect(200)
    expect(res.body.optedIn).toBe(1)   // faqat U1
  })

  it('non-admin audience endpoint\'ga kirolmaydi (403)', async () => {
    await asUser(request(app).get('/api/admin/sms/audience')).expect(403)
  })
})

describe('SMS campaign — create + chunk dispatch', () => {
  it("kampaniya validatsiyasi: qisqa matn 400, non-admin 403", async () => {
    await asUser(request(app).post('/api/admin/sms/campaigns')).send({ title: 'Test', message: 'qisqa' }).expect(403)
    await asAdmin(request(app).post('/api/admin/sms/campaigns')).send({ title: 'Test', message: 'qisqa' }).expect(400)
  })

  it('create → draft; dispatch → FAQAT opt-in+phone userlar oladi; sent bo\'lgach davom etmaydi', async () => {
    const created = await asAdmin(request(app).post('/api/admin/sms/campaigns'))
      .send({ title: 'Sinov kampaniyasi', message: 'KIWI test xabari — bu faqat integration sinov.' })
      .expect(201)
    const id: number = created.body.campaign.id
    expect(created.body.campaign.status).toBe('draft')

    // Birinchi dispatch: audience snapshot (U1 faqat) + yuborish + sent
    const first = await asAdmin(request(app).post(`/api/admin/sms/campaigns/${id}/send`)).expect(200)
    expect(first.body.campaign.targetCount).toBe(1)
    expect(first.body.campaign.sentCount).toBe(1)
    expect(first.body.campaign.status).toBe('sent')
    expect(first.body.remaining).toBe(0)
    expect(sendSmsMessage).toHaveBeenCalledWith('+998901111111', expect.stringContaining('KIWI'))

    // Recipient qatori + status
    const recs = await db.select().from(smsCampaignRecipients).where(eq(smsCampaignRecipients.campaignId, id))
    expect(recs).toHaveLength(1)
    expect(recs[0].userId).toBe(U1)
    expect(recs[0].status).toBe('sent')

    // U2 (opt-in yo'q) recipient bo'lmagan
    expect(recs.find((r) => r.userId === U2)).toBeUndefined()

    // To\'liq yuborilgandan keyin qayta dispatch → 409
    await asAdmin(request(app).post(`/api/admin/sms/campaigns/${id}/send`)).expect(409)
  })

  it("Eskiz xatosi recipientni 'failed' qiladi, chunk davom etadi", async () => {
    vi.mocked(sendSmsMessage).mockImplementationOnce(async () => { throw new Error('eskiz down') })
    const created = await asAdmin(request(app).post('/api/admin/sms/campaigns'))
      .send({ title: 'Fail sinovi', message: 'Bu xabar eskiz xatosini sinash uchun yozildi.' })
      .expect(201)
    const id = created.body.campaign.id as number

    const res = await asAdmin(request(app).post(`/api/admin/sms/campaigns/${id}/send`)).expect(200)
    expect(res.body.campaign.failedCount).toBe(1)
    expect(res.body.campaign.sentCount).toBe(0)
    expect(res.body.campaign.status).toBe('sent')   // pending=0 → yakunlandi

    const recs = await db.select().from(smsCampaignRecipients).where(eq(smsCampaignRecipients.campaignId, id))
    expect(recs[0].status).toBe('failed')
    expect(recs[0].error).toContain('eskiz')
  })

  it('ro\'yxat endpoint statistika bilan qaytaradi', async () => {
    const res = await asAdmin(request(app).get('/api/admin/sms/campaigns')).expect(200)
    expect(res.body.campaigns.length).toBeGreaterThanOrEqual(2)
    const sent = res.body.campaigns.find((c: { status: string }) => c.status === 'sent')
    expect(sent).toBeTruthy()
  })
})
