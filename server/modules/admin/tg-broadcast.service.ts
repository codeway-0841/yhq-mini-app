/**
 * Telegram broadcast Kampaniyalari (M-5 audit fix): ESKI executeBroadcast
 * BUTUN users jadvalini RAM'ga yuklab, 25/s tempda UI'SIZ yuborardi — Vercel
 * 30s limitida ~500-700 kishida JIM uzilib qolar, qayta davom ETTIRILMASDI.
 *
 * Yangi oqim (sms-campaign pattern'i):
 *  1) createBroadcast → draft (matn/segment/tugma/rasm-URL).
 *  2) Birinchi dispatchChunk: audience SOF SQL'da (INSERT…SELECT — JS'ga
 *     yuklanmaydi!) snapshot freeze + status='sending' (atomik lock).
 *  3) Har chunk: 25 qator FOR UPDATE SKIP LOCKED bilan claim → yuborish →
 *     sent/blocked/failed. Stale-'sending' (crash) 10 daqiqadan keyin qayta claim.
 *  UI remaining=0 bo'lguncha chunk chaqiradi — Vercel timeout'da kampaniya
 *  "sending" qoladi va KEYINGI chaqiruv shu yeridan DAVOM ETADI (resume).
 *
 * photo: FAQAT tashqi URL (yoki avvalgi chunk'dan olingan file_id) — base64
 * upload DB'ga sig'maydi; kichik test yuborish uchun eski endpoint qolgan.
 */

import { sql } from 'drizzle-orm'
import { executeRows } from '../../db/connection'
import { InlineKeyboard } from 'grammy'
import { sendTelegramMessage, isBlockedTelegramError } from '../../utils/tg-send'
import { config } from '../../config'

/** Bir dispatch chaqiruvida yuboriladigan xabarlar (Telegram ~30 msg/s limiti) */
export const TG_BROADCAST_BATCH_SIZE = 25

export type BroadcastSegment = 'all' | 'free' | 'premium' | 'inactive_7d' | 'active_today'

export interface TgBroadcastRow {
  id: number
  segment: BroadcastSegment
  message: string
  imageUrl: string | null
  buttonText: string | null
  buttonUrl: string | null
  status: 'draft' | 'sending' | 'sent'
  targetCount: number
  sentCount: number
  blockedCount: number
  failedCount: number
  createdAt: Date
  finishedAt: Date | null
}

type DbRow = Record<string, unknown>

function mapRow(r: DbRow): TgBroadcastRow {
  return {
    id: Number(r['id']),
    segment: r['segment'] as BroadcastSegment,
    message: String(r['message']),
    imageUrl: (r['image_url'] as string) ?? null,
    buttonText: (r['button_text'] as string) ?? null,
    buttonUrl: (r['button_url'] as string) ?? null,
    status: r['status'] as TgBroadcastRow['status'],
    targetCount: Number(r['target_count']),
    sentCount: Number(r['sent_count']),
    blockedCount: Number(r['blocked_count']),
    failedCount: Number(r['failed_count']),
    createdAt: new Date(r['created_at'] as string),
    finishedAt: r['finished_at'] ? new Date(r['finished_at'] as string) : null,
  }
}

/** Segment uchun TG chat id'larini chiqaruvchi SOF SQL (JS'ga birorta qator yuklanmaydi — M-5 root fix) */
function audienceSql(segment: BroadcastSegment) {
  // TG user: (auth_identities.provider='telegram') YOKI (users.id raqamli)
  const base = sql`
    SELECT DISTINCT x.tg AS tg FROM (
      SELECT provider_uid AS tg FROM auth_identities WHERE provider = 'telegram'
      UNION
      SELECT id AS tg FROM users WHERE id ~ '^\\d+$'
    ) x
    WHERE x.tg ~ '^\\d+$'
  `
  const userCond = (cond: string) => sql`
    AND EXISTS (
      SELECT 1 FROM users u
      LEFT JOIN auth_identities ai ON ai.user_id = u.id AND ai.provider = 'telegram'
      WHERE COALESCE(ai.provider_uid, u.id) = x.tg AND (${sql.raw(cond)})
    )
  `
  switch (segment) {
    case 'all':
      return base
    case 'premium':
      return sql`${base} ${userCond("u.tariff = 'premium' OR (u.premium_until IS NOT NULL AND u.premium_until > now())")}`
    case 'free':
      return sql`${base} ${userCond("u.tariff = 'free' AND (u.premium_until IS NULL OR u.premium_until <= now())")}`
    case 'active_today':
      return sql`${base} ${userCond("EXISTS (SELECT 1 FROM daily_records dr WHERE dr.user_id = u.id AND dr.date = to_char(now() AT TIME ZONE 'Asia/Tashkent', 'YYYY-MM-DD'))")}`
    case 'inactive_7d':
      return sql`${base} ${userCond("NOT EXISTS (SELECT 1 FROM daily_records dr WHERE dr.user_id = u.id AND dr.date >= to_char((now() AT TIME ZONE 'Asia/Tashkent') - interval '7 days', 'YYYY-MM-DD'))")}`
  }
}

export const tgBroadcastService = {
  async list(limit = 20): Promise<TgBroadcastRow[]> {
    const rows = await executeRows<DbRow>(sql`
      SELECT * FROM tg_broadcasts ORDER BY id DESC LIMIT ${limit}
    `)
    return rows.map(mapRow)
  },

  async create(input: {
    segment: BroadcastSegment
    message: string
    imageUrl?: string | null
    buttonText?: string | null
    buttonUrl?: string | null
  }): Promise<TgBroadcastRow> {
    const message = input.message.trim()
    if (message.length < 3) throw new Error('message_too_short')
    if (message.length > 4096) throw new Error('message_too_long')
    const rows = await executeRows<DbRow>(sql`
      INSERT INTO tg_broadcasts (segment, message, image_url, button_text, button_url)
      VALUES (${input.segment}, ${message},
        ${input.imageUrl?.trim() || null}, ${input.buttonText?.trim() || null}, ${input.buttonUrl?.trim() || null})
      RETURNING *
    `)
    if (!rows[0]) throw new Error('insert_failed')
    return mapRow(rows[0])
  },

  /** Segment bo'yicha chat id'lar soni (UI preview) */
  async audienceCount(segment: BroadcastSegment): Promise<number> {
    const rows = await executeRows<{ n: number }>(sql`
      SELECT COUNT(*)::int AS n FROM (${audienceSql(segment)}) aud
    `)
    return Number(rows[0]?.n ?? 0)
  },

  /**
   * Bitta chunk yuborish. Birinchi chaqiruvda (draft) audience snapshot
   * yaratiladi (SOF SQL INSERT…SELECT). Keyingi chaqiruvlar pending +
   * stale-'sending' qatorlarni claim qilib davom etadi.
   */
  async dispatchChunk(broadcastId: number): Promise<{
    status: TgBroadcastRow['status']
    batchSent: number
    batchBlocked: number
    batchFailed: number
    remaining: number
    broadcast: TgBroadcastRow
  }> {
    const [broadcast] = await executeRows<DbRow>(sql`
      SELECT * FROM tg_broadcasts WHERE id = ${broadcastId}
    `)
    if (!broadcast) throw new Error('not_found')
    if (broadcast.status === 'sent') throw new Error('already_sent')

    // Draft → audience snapshot freeze + status=sending (atomik; parallel dispatch'da faqat 1 tasi)
    if (broadcast.status === 'draft') {
      const seg = broadcast.segment as BroadcastSegment
      const rows = await executeRows<{ locked: boolean }>(sql`
        WITH lock AS (
          UPDATE tg_broadcasts SET status = 'sending'
          WHERE id = ${broadcastId} AND status = 'draft'
          RETURNING id
        ), inserted AS (
          INSERT INTO tg_broadcast_recipients (broadcast_id, tg_id)
          SELECT ${broadcastId}, tg FROM (${audienceSql(seg)}) aud
          WHERE EXISTS (SELECT 1 FROM lock)
          ON CONFLICT DO NOTHING
          RETURNING id
        )
        SELECT EXISTS (SELECT 1 FROM lock) AS locked
      `)
      if (rows[0]?.locked !== true) {
        return this.dispatchChunk(broadcastId)
      }
    }

    // Chunk: 25 qator atomik claim (SKIP LOCKED) + stale-'sending' (>10 min) reclaim
    const batch = await executeRows<{ id: number; tg_id: string }>(sql`
      WITH claimed AS (
        SELECT id FROM tg_broadcast_recipients
        WHERE broadcast_id = ${broadcastId} AND (
          status = 'pending'
          OR (status = 'sending' AND (claimed_at IS NULL OR claimed_at < now() - interval '10 minutes'))
        )
        ORDER BY id
        LIMIT ${TG_BROADCAST_BATCH_SIZE}
        FOR UPDATE SKIP LOCKED
      )
      UPDATE tg_broadcast_recipients r
      SET status = 'sending', claimed_at = now()
      FROM claimed
      WHERE r.id = claimed.id
      RETURNING r.id, r.tg_id
    `)

    // Xabar tayyorlash (rasm: file_id keshi → URL; tugma inline keyboard)
    const message = String(broadcast.message)
    let keyboard: InlineKeyboard | undefined
    if (broadcast.button_text) {
      const kb = new InlineKeyboard()
      const bText = String(broadcast.button_text)
      const bUrl = broadcast.button_url ? String(broadcast.button_url) : null
      if (bUrl && (bUrl.startsWith('http://') || bUrl.startsWith('https://') || bUrl.startsWith('tg://'))) {
        if (bUrl.includes('t.me/') || !bUrl.startsWith('http')) kb.url(bText, bUrl)
        else kb.webApp(bText, bUrl)
      } else {
        kb.webApp(bText, `${config.deploy.appUrl}?v=${config.deploy.buildId}`)
      }
      keyboard = kb
    }
    let photo: string | null = (broadcast.photo_file_id as string) || (broadcast.image_url as string) || null

    let batchSent = 0
    let batchBlocked = 0
    let batchFailed = 0
    await Promise.all(batch.map(async (r) => {
      try {
        const res = await sendTelegramMessage(r.tg_id, { text: message, photo, keyboard })
        // file_id keshi: birinchi muvaffaqiyatli photo yuborishdan keyin RAM o'rniga ishlatamiz
        if (res.fileId && photo && !broadcast.photo_file_id) {
          await executeRows(sql`UPDATE tg_broadcasts SET photo_file_id = ${res.fileId} WHERE id = ${broadcastId} AND photo_file_id IS NULL`)
          broadcast.photo_file_id = res.fileId
          photo = res.fileId
        }
        await executeRows(sql`
          UPDATE tg_broadcast_recipients SET status = 'sent', sent_at = now() WHERE id = ${r.id}
        `)
        batchSent++
      } catch (err) {
        const blocked = isBlockedTelegramError(err)
        await executeRows(sql`
          UPDATE tg_broadcast_recipients SET status = ${blocked ? 'blocked' : 'failed'},
            error = ${String((err as Error)?.message ?? err).slice(0, 200)}
          WHERE id = ${r.id}
        `)
        if (blocked) batchBlocked++
        else batchFailed++
      }
    }))

    // Counterlar + yakunlash (pending+sending = 0 → sent)
    const [updated] = await executeRows<DbRow>(sql`
      WITH counts AS (
        SELECT
          COUNT(*) FILTER (WHERE status = 'sent')::int    AS sent,
          COUNT(*) FILTER (WHERE status = 'blocked')::int AS blocked,
          COUNT(*) FILTER (WHERE status = 'failed')::int  AS failed,
          COUNT(*) FILTER (WHERE status IN ('pending', 'sending'))::int AS pending
        FROM tg_broadcast_recipients
        WHERE broadcast_id = ${broadcastId}
      )
      UPDATE tg_broadcasts c SET
        sent_count    = (SELECT sent FROM counts),
        blocked_count = (SELECT blocked FROM counts),
        failed_count  = (SELECT failed FROM counts),
        target_count  = GREATEST(target_count, (SELECT sent + blocked + failed + pending FROM counts)),
        status        = CASE WHEN (SELECT pending FROM counts) = 0 THEN 'sent' ELSE 'sending' END,
        finished_at   = CASE WHEN (SELECT pending FROM counts) = 0 THEN now() ELSE finished_at END
      WHERE c.id = ${broadcastId}
      RETURNING *
    `)

    const mapped = mapRow(updated!)
    return {
      status: mapped.status,
      batchSent,
      batchBlocked,
      batchFailed,
      remaining: mapped.targetCount - mapped.sentCount - mapped.blockedCount - mapped.failedCount,
      broadcast: mapped,
    }
  },
}
