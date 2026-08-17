/**
 * TG broadcast kampaniyalari (M-5) — integration testlar.
 * Telegram yuborish `server/utils/tg-send` orqali MOCK (real Telegram API'ga CHIQILMAYDI).
 * Tekshiradi: snapshot freeze, chunk claim (race), blocked/failed tasnif, stale-reclaim (M-4).
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import request from 'supertest'
import { createApp } from '../../../server/app'
import { db } from '../../../server/db/connection'
import { users, authIdentities, tgBroadcasts, tgBroadcastRecipients } from '../../../server/schema'
import { eq, inArray } from 'drizzle-orm'
import { authRepository } from '../../../server/modules/auth/auth.repository'
import { sendTelegramMessage } from '../../../server/utils/tg-send'
import { tgBroadcastService } from '../../../server/modules/admin/tg-broadcast.service'

vi.mock('../../../server/utils/tg-send', async () => {
  const actual = await vi.importActual<typeof import('../../../server/utils/tg-send')>('../../../server/utils/tg-send')
  return { ...actual, sendTelegramMessage: vi.fn(async () => ({})) }
})

const app = createApp()

const ADMIN_ID = '977100000000'
const TG1 = '977100000001'
const TG2 = '977100000002'
const TG3 = '977100000003'   // premium
const P_ONLY = 'p_9771000004'  // telefon-only user — TG audience'ga KIRMASLIGI kerak
const BASE = [TG1, TG2, TG3]
const ADMIN_TOKEN = 'itest_tgb_admin_token'

async function seedUsers(ids: string[]) {
  await db.insert(users).values(
    ids.map((id) => ({ id, firstName: 'TG', lastName: id.slice(-2), username: `tg_${id}`, photoUrl: '' })),
  ).onConflictDoNothing()
  await db.insert(authIdentities).values(
    ids.map((id) => ({ provider: 'telegram' as const, providerUid: id, userId: id })),
  ).onConflictDoNothing()
}

async function cleanup() {
  await db.delete(tgBroadcastRecipients)
  await db.delete(tgBroadcasts)
  await db.delete(authIdentities).where(inArray(authIdentities.userId, [ADMIN_ID, ...BASE, P_ONLY]))
  await db.delete(users).where(inArray(users.id, [ADMIN_ID, ...BASE, P_ONLY]))
}

beforeAll(async () => {
  await cleanup()
  await db.insert(users).values([
    { id: ADMIN_ID, firstName: 'B', lastName: 'Admin', username: 'tgb_admin', photoUrl: '', isAdmin: true },
  ])
  await authRepository.createSession({
    token: ADMIN_TOKEN, userId: ADMIN_ID, provider: 'phone', expiresAt: new Date(Date.now() + 3600_000),
  })
  await seedUsers(BASE)
  await db.update(users).set({ tariff: 'premium' }).where(eq(users.id, TG3))
  // Telefon-only user (identity phone, id p_) — broadcast audience'siz
  await db.insert(users).values({ id: P_ONLY, firstName: 'P', lastName: '', username: 'tgb_p', photoUrl: '' })
    .onConflictDoNothing()
  await db.insert(authIdentities).values({ provider: 'phone', providerUid: '+998977100004', userId: P_ONLY })
    .onConflictDoNothing()
})

afterAll(cleanup)

const asAdmin = (r: request.Test) => r.set('Authorization', `Bearer ${ADMIN_TOKEN}`)

describe('TG broadcast kampaniya (M-5)', () => {
  it("create → draft kampaniya", async () => {
    const res = await asAdmin(request(app).post('/api/admin/tg-broadcasts'))
      .send({ segment: 'all', message: 'Salom hammaga — chunked test!' })
      .expect(200)
    expect(res.body.broadcast.status).toBe('draft')
    expect(res.body.broadcast.segment).toBe('all')
  })

  it('dispatch: snapshot freeze + barcha recipientga yuboriladi + "sent" statusi', async () => {
    vi.mocked(sendTelegramMessage).mockClear()
    const broadcast = await tgBroadcastService.create({ segment: 'all', message: 'Snapshot freeze tekshiruvi xabari' })
    let out = await tgBroadcastService.dispatchChunk(broadcast.id)
    let guard = 0
    while (out.status !== 'sent' && guard++ < 50) {
      out = await tgBroadcastService.dispatchChunk(broadcast.id)
    }
    expect(out.status).toBe('sent')

    // BIZNING 3 user recipientlar orasida; p_ user EMAS (boshqa test userlari ham
    // umumiy test DB'da yashaydi — ularni hisobga olmaganda tekshiramiz)
    const recps = await db.select().from(tgBroadcastRecipients).where(eq(tgBroadcastRecipients.broadcastId, broadcast.id))
    const ids = recps.map((r) => r.tgId)
    for (const id of BASE) expect(ids).toContain(id)
    expect(ids).not.toContain(P_ONLY)
    const mine = recps.filter((r) => BASE.includes(r.tgId))
    expect(mine.every((r) => r.status === 'sent')).toBe(true)
    const calledIds = vi.mocked(sendTelegramMessage).mock.calls.map((c) => String(c[0]))
    for (const id of BASE) expect(calledIds).toContain(id)

    // SNAPSHOT FREEZE: yangi user qo'shilganda eski kampaniyaga tushmaydi
    const LATE = '977100000099'
    await seedUsers([LATE])
    const recpsAfter = await db.select().from(tgBroadcastRecipients).where(eq(tgBroadcastRecipients.broadcastId, broadcast.id))
    expect(recpsAfter.map((r) => r.tgId)).not.toContain(LATE)
    await db.delete(authIdentities).where(eq(authIdentities.userId, LATE))
    await db.delete(users).where(eq(users.id, LATE))
  })

  it('segment=premium FAQAT premium userga (yoki premium_until faolga)', async () => {
    vi.mocked(sendTelegramMessage).mockClear()
    const broadcast = await tgBroadcastService.create({ segment: 'premium', message: 'Premium exclusive tekshiruvi' })
    let out = await tgBroadcastService.dispatchChunk(broadcast.id)
    let guard = 0
    while (out.status !== 'sent' && guard++ < 50) {
      out = await tgBroadcastService.dispatchChunk(broadcast.id)
    }
    const recps = await db.select().from(tgBroadcastRecipients).where(eq(tgBroadcastRecipients.broadcastId, broadcast.id))
    const ids = recps.map((r) => r.tgId)
    expect(ids).toContain(TG3)
    expect(ids).not.toContain(TG1)
    expect(ids).not.toContain(TG2)
  })

  it('blocked tasnifi: "bot was blocked" → status=blocked (failed emas)', async () => {
    vi.mocked(sendTelegramMessage).mockClear()
    vi.mocked(sendTelegramMessage).mockImplementation(async (chatId) => {
      if (String(chatId) === TG1) {
        const err = new Error('GrammyError') as Error & { description: string }
        err.description = 'Forbidden: bot was blocked by the user'
        throw err
      }
      if (String(chatId) === TG2) throw new Error('network timeout')
      return {}
    })
    const broadcast = await tgBroadcastService.create({ segment: 'all', message: 'Blocked/failed tasnif tekshiruvi' })
    let out = await tgBroadcastService.dispatchChunk(broadcast.id)
    let guard = 0
    while (out.status !== 'sent' && guard++ < 50) {
      out = await tgBroadcastService.dispatchChunk(broadcast.id)
    }
    const recps = await db.select().from(tgBroadcastRecipients).where(eq(tgBroadcastRecipients.broadcastId, broadcast.id))
    const byId = new Map(recps.map((r) => [r.tgId, r.status]))
    expect(byId.get(TG1)).toBe('blocked')
    expect(byId.get(TG2)).toBe('failed')
    expect(byId.get(TG3)).toBe('sent')
    expect(out.broadcast.blockedCount).toBeGreaterThanOrEqual(1)
    expect(out.broadcast.failedCount).toBeGreaterThanOrEqual(1)
  })

  it('M-4 stale-reclaim: "sending"da 10+ daqiqa qotgan qator QAYTA claim qilinadi', async () => {
    vi.mocked(sendTelegramMessage).mockClear()
    vi.mocked(sendTelegramMessage).mockImplementation(async () => ({}))
    const b2 = await tgBroadcastService.create({ segment: 'all', message: 'Qotish simulyatsiyasi' })
    await tgBroadcastService.dispatchChunk(b2.id)   // snapshot + yuborish (mock)
    // Crash simulyatsiyasi: recipientlar "sending"da qotdi, kampaniya ham
    await db.update(tgBroadcastRecipients)
      .set({ status: 'sending', claimedAt: new Date(Date.now() - 11 * 60_000), sentAt: null })
      .where(eq(tgBroadcastRecipients.broadcastId, b2.id))
    await db.update(tgBroadcasts)
      .set({ status: 'sending', sentCount: 0, finishedAt: null })
      .where(eq(tgBroadcasts.id, b2.id))
    vi.mocked(sendTelegramMessage).mockClear()
    let out = await tgBroadcastService.dispatchChunk(b2.id)
    let guard = 0
    while (out.status !== 'sent' && guard++ < 50) {
      out = await tgBroadcastService.dispatchChunk(b2.id)
    }
    const recps = await db.select().from(tgBroadcastRecipients).where(eq(tgBroadcastRecipients.broadcastId, b2.id))
    const mine = recps.filter((r) => BASE.includes(r.tgId))
    expect(mine.every((r) => r.status === 'sent')).toBe(true)   // stale qatorlar qayta yuborildi
  })

  it('race: 2 parallel dispatchChunk — recipientlar IKKI marta yuborilmaydi (SKIP LOCKED)', async () => {
    // 30 ta user — batch (25) dan katta, 2 chunk kerak
    const raceIds = Array.from({ length: 30 }, (_, i) => `9771000001${String(i).padStart(2, '0')}`)
    await seedUsers(raceIds)
    vi.mocked(sendTelegramMessage).mockClear()
    vi.mocked(sendTelegramMessage).mockImplementation(async () => ({}))

    const broadcast = await tgBroadcastService.create({ segment: 'all', message: 'Race tekshiruvi' })
    await Promise.all([
      tgBroadcastService.dispatchChunk(broadcast.id),
      tgBroadcastService.dispatchChunk(broadcast.id),
    ])
    // Qolgan chunk'lar (parallel dispatch 'sent' bo'lgach already_sent tashlashi mumkin)
    let guard = 0
    for (;;) {
      const out = await tgBroadcastService.dispatchChunk(broadcast.id).catch(() => ({ status: 'sent' as const }))
      if (out.status === 'sent' || guard++ > 50) break
    }
    const finalBroadcast = (await tgBroadcastService.list(50)).find((b) => b.id === broadcast.id)
    expect(finalBroadcast?.status).toBe('sent')

    const calls = vi.mocked(sendTelegramMessage).mock.calls.map((c) => String(c[0]))
    const scoped = calls.filter((c) => BASE.includes(c) || raceIds.includes(c))
    const unique = new Set(scoped)
    // 33 ta bizning user (30 race + 3 base) — HECH QAYSI ikki marta yuborilmadi
    expect(unique.size).toBe(scoped.length)
    expect(scoped.length).toBe(BASE.length + raceIds.length)

    await db.delete(authIdentities).where(inArray(authIdentities.userId, raceIds))
    await db.delete(users).where(inArray(users.id, raceIds))
  })
})
