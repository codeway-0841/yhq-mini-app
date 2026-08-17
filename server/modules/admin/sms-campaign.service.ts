/**
 * SMS marketing kampaniyalari — FAQAT sms_opt_in=TRUE userlarga.
 *
 * Chunk'li dispatch (Vercel serverless 30s limit): har `dispatchChunk`
 * chaqiruvi BATCH_SIZE ta recipient yuboradi va qolanganini qaytaradi —
 * admin UI remaining=0 bo'lguncha "Davom ettiradi". Audience snapshot'i
 * birinchi dispatch'da freeze qilinadi (keyingi opt-outlar ta'sir qilmaydi).
 */

import { sql } from 'drizzle-orm'
import { executeRows } from '../../db/connection'
import { sendSmsMessage } from '../../utils/sms'

/** Bir dispatch chaqiruvida yuboriladigan SMS soni (Eskiz rate + Vercel timeout muvozanati) */
export const SMS_BATCH_SIZE = 30

/** Matn cheklovlari: 1 SMS = 160 ASCII (yoki 70 kirill) — 2 segmentgacha ruxsat */
const MAX_MESSAGE_LENGTH = 300

export interface SmsCampaignRow {
  id: number
  title: string
  message: string
  status: 'draft' | 'sending' | 'sent'
  targetCount: number
  sentCount: number
  failedCount: number
  createdAt: Date
  finishedAt: Date | null
}

type DbRow = Record<string, unknown>

/** executeRows (raw sql `RETURNING *`) snake_case qaytaradi — API camelCase */
function mapCampaign(r: DbRow): SmsCampaignRow {
  return {
    id: Number(r['id']),
    title: String(r['title']),
    message: String(r['message']),
    status: r['status'] as SmsCampaignRow['status'],
    targetCount: Number(r['target_count']),
    sentCount: Number(r['sent_count']),
    failedCount: Number(r['failed_count']),
    createdAt: new Date(r['created_at'] as string),
    finishedAt: r['finished_at'] ? new Date(r['finished_at'] as string) : null,
  }
}

export const smsCampaignService = {
  /** Opt-in auditoriya soni (compose preview uchun) */
  async audienceCount(): Promise<number> {
    const rows = await executeRows<{ n: number }>(sql`
      SELECT COUNT(*)::int AS n FROM users WHERE sms_opt_in AND phone IS NOT NULL
    `)
    return Number(rows[0]?.n ?? 0)
  },

  /** Yangi draft kampaniya */
  async create(title: string, message: string): Promise<SmsCampaignRow> {
    const trimmed = message.trim()
    if (trimmed.length < 10) throw new Error('message_too_short')
    if (trimmed.length > MAX_MESSAGE_LENGTH) throw new Error('message_too_long')
    const rows = await executeRows<SmsCampaignRow>(sql`
      INSERT INTO sms_campaigns (title, message) VALUES (${title.trim()}, ${trimmed}) RETURNING *
    `)
    if (!rows[0]) throw new Error('insert_failed')
    return mapCampaign(rows[0] as unknown as DbRow)
  },

  async list(limit = 20): Promise<SmsCampaignRow[]> {
    const rows = await executeRows<SmsCampaignRow>(sql`
      SELECT * FROM sms_campaigns ORDER BY id DESC LIMIT ${limit}
    `)
    return rows.map((r) => mapCampaign(r as unknown as DbRow))
  },

  /**
   * Bitta chunk yuborish. Birinchi chaqiruvda (draft) audience snapshot
   * yaratiladi: sms_opt_in + phone bor userlar → recipients (pending).
   * Har recipient alohida yuboriladi: bitta xato butin chunk'ni to'xtatmaydi.
   */
  async dispatchChunk(campaignId: number): Promise<{
    status: SmsCampaignRow['status']
    batchSent: number
    batchFailed: number
    remaining: number
    campaign: SmsCampaignRow
  }> {
    const [campaign] = await executeRows<SmsCampaignRow>(sql`
      SELECT * FROM sms_campaigns WHERE id = ${campaignId}
    `)
    if (!campaign) throw new Error('not_found')
    if (campaign.status === 'sent') throw new Error('already_sent')
    // Draft → audience snapshot freeze + status=sending (bitta atomik UPDATE;
    // parallel "send" bosilganda faqat bittasi snapshot yaratadi)
    if (campaign.status === 'draft') {
      const rows = await executeRows<{ locked: boolean }>(sql`
        WITH lock AS (
          UPDATE sms_campaigns SET status = 'sending'
          WHERE id = ${campaignId} AND status = 'draft'
          RETURNING id
        ), audience AS (
          SELECT id, phone FROM users WHERE sms_opt_in AND phone IS NOT NULL
        ), inserted AS (
          INSERT INTO sms_campaign_recipients (campaign_id, user_id, phone)
          SELECT ${campaignId}, id, phone FROM audience
          WHERE EXISTS (SELECT 1 FROM lock)
          ON CONFLICT DO NOTHING
          RETURNING id
        )
        SELECT EXISTS (SELECT 1 FROM lock) AS locked
      `)
      if (rows[0]?.locked !== true) {
        // Parallel dispatch yutib yubordi — holatni qayta o'qiymiz
        return this.dispatchChunk(campaignId)
      }
    }

    // Chunk: pending recipientlarni atomik claim qilamiz (M-4: SKIP LOCKED poygaga qarshi).
    // Stale-reclaim: 'sending'da 10+ daqiqa QOTGAN qatorlar (crash'da qolgan)
    // qayta claim qilinadi — kampaniya "sending" holatida turib qolmaydi.
    const batch = await executeRows<{ id: number; phone: string }>(sql`
      WITH claimed AS (
        SELECT id FROM sms_campaign_recipients
        WHERE campaign_id = ${campaignId} AND (
          status = 'pending'
          OR (status = 'sending' AND (claimed_at IS NULL OR claimed_at < now() - interval '10 minutes'))
        )
        ORDER BY id
        LIMIT ${SMS_BATCH_SIZE}
        FOR UPDATE SKIP LOCKED
      )
      UPDATE sms_campaign_recipients r
      SET status = 'sending', claimed_at = now()
      FROM claimed
      WHERE r.id = claimed.id
      RETURNING r.id, r.phone
    `)

    let batchSent = 0
    let batchFailed = 0
    for (const r of batch) {
      try {
        await sendSmsMessage(r.phone, campaign.message)
        await executeRows(sql`
          UPDATE sms_campaign_recipients SET status = 'sent', sent_at = now() WHERE id = ${r.id}
        `)
        batchSent++
      } catch (err) {
        await executeRows(sql`
          UPDATE sms_campaign_recipients SET status = 'failed', error = ${String((err as Error)?.message ?? err).slice(0, 200)} WHERE id = ${r.id}
        `)
        batchFailed++
      }
    }

    // Counterlar + yakunlash (pending yoki sending = 0 bo'lsa status=sent)
    const [updated] = await executeRows<SmsCampaignRow>(sql`
      WITH counts AS (
        SELECT
          COUNT(*) FILTER (WHERE status = 'sent')::int   AS sent,
          COUNT(*) FILTER (WHERE status = 'failed')::int AS failed,
          COUNT(*) FILTER (WHERE status IN ('pending', 'sending'))::int AS pending
        FROM sms_campaign_recipients
        WHERE campaign_id = ${campaignId}
      )
      UPDATE sms_campaigns c SET
        sent_count   = (SELECT sent FROM counts),
        failed_count = (SELECT failed FROM counts),
        target_count = GREATEST(target_count, (SELECT sent + failed + pending FROM counts)),
        status       = CASE WHEN (SELECT pending FROM counts) = 0 THEN 'sent' ELSE 'sending' END,
        finished_at  = CASE WHEN (SELECT pending FROM counts) = 0 THEN now() ELSE finished_at END
      WHERE c.id = ${campaignId}
      RETURNING *
    `)

    const mapped = mapCampaign(updated as unknown as DbRow)
    return {
      status: mapped.status,
      batchSent,
      batchFailed,
      remaining: mapped.targetCount - mapped.sentCount - mapped.failedCount,
      campaign: mapped,
    }
  },
}
