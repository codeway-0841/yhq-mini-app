/**
 * Users repository — all DB access for the `users` table.
 * No business logic here; only SQL/Drizzle calls.
 */

import { and, eq, isNull, sql } from 'drizzle-orm'
import { db, executeRows, type DB } from '../../db/connection'
import { users } from '../../schema'
import { REFERRAL_REWARD_DAYS, REFERRAL_MAX_REWARDED } from './referral.constants'

export interface CreateOrUpdateUserInput {
  id:        string
  firstName: string
  lastName:  string | null
  username:  string | null
  photoUrl:  string | null
}

export const referralsRepository = {
  /**
   * Yangi referal QAYDI + Referrer mukofoti (+1 kun premium).
   * Do'st Telegram orqali kirishi bilanoq ulashgan odamga (referrer) 1 kun Premium beriladi.
   * Ulangan odam (referee) esa mukofot olmaydi.
   * referee UNIQUE — bir user faqat bir marta referal bo'la oladi.
   * @returns qayd yaratildimi (false = bu referee allaqachon bor)
   */
  async createPending(referrerId: string, refereeId: string): Promise<boolean> {
    const rows = await executeRows<{ created: boolean }>(sql`
      WITH inserted AS (
        INSERT INTO referrals (referrer_id, referee_id, status, rewarded_at)
        VALUES (${referrerId}, ${refereeId}, 'rewarded', now())
        ON CONFLICT (referee_id) DO NOTHING
        RETURNING id, referrer_id
      ), rew AS (
        UPDATE users SET
          premium_until = GREATEST(COALESCE(premium_until, now()), now()) + make_interval(days => ${REFERRAL_REWARD_DAYS}::int),
          updated_at = now()
        WHERE id IN (
          SELECT i.referrer_id FROM inserted i
          WHERE (SELECT COUNT(*) FROM referrals x
                 WHERE x.referrer_id = i.referrer_id AND x.status = 'rewarded') <= ${REFERRAL_MAX_REWARDED}::int
        )
        RETURNING id
      )
      SELECT EXISTS (SELECT 1 FROM inserted) AS created
    `)
    return rows[0]?.created === true
  },

  /** Referal statistikasi (Profil kartasi uchun). */
  async getStats(userId: string): Promise<{
    invited: number
    rewarded: number
    pending: number
  }> {
    const rows = await executeRows<{ invited: number; rewarded: number }>(sql`
      SELECT
        COUNT(*)::int                                                   AS invited,
        COUNT(*) FILTER (WHERE status = 'rewarded')::int                AS rewarded
      FROM referrals
      WHERE referrer_id = ${userId}
    `)
    const invited  = Number(rows[0]?.invited ?? 0)
    const rewarded = Number(rows[0]?.rewarded ?? 0)
    return { invited, rewarded, pending: invited - rewarded }
  },

  /**
   * Referee TELEFONINI ULADI — referrer mukofoti (+N kun) BITTA atomik
   * statement'da: pending → rewarded + referrer premium (CAP ichida).
   *
   * Telefon ulash = marketing kanali (verified raqam) VA oqimning yagona
   * users.phone yozish nuqtasi shu (auth linkPhone alohida — identity'lar
   * jadvaliga yozadi, users.phone'ga emas).
   * Cap count snapshot'da (joriy grant hisobga kirmaydi) — ±1 xato qabul
   * qilinadi, farming himoyasi buzilmaydi (haqiqiy gate — har referee
   * yangi TG akkaunt talab qiladi).
   * @returns mukofot berildimi (false = pending referal yo'q / cap to'lgan)
   */
  async rewardIfPhoneLinked(refereeId: string): Promise<boolean> {
    const rows = await executeRows<{ rewarded: number }>(sql`
      WITH pend AS (
        SELECT id, referrer_id FROM referrals
        WHERE referee_id = ${refereeId} AND status = 'pending'
        LIMIT 1
      ), upd AS (
        UPDATE referrals r SET status = 'rewarded', rewarded_at = now()
        FROM pend WHERE r.id = pend.id AND r.status = 'pending'
        RETURNING r.referrer_id
      ), rew AS (
        UPDATE users SET
          premium_until = GREATEST(COALESCE(premium_until, now()), now()) + make_interval(days => ${REFERRAL_REWARD_DAYS}::int),
          updated_at = now()
        WHERE id IN (
          SELECT u.referrer_id FROM upd u
          WHERE (SELECT COUNT(*) FROM referrals x
                 WHERE x.referrer_id = u.referrer_id AND x.status = 'rewarded') < ${REFERRAL_MAX_REWARDED}::int
        )
        RETURNING id
      )
      SELECT COUNT(*)::int AS rewarded FROM rew
    `)
    return Number(rows[0]?.rewarded) > 0
  },
}

export const usersRepository = {
  /** SMS marketing consent (opt-in/out) — audit timestamp bilan. */
  async setSmsOptIn(userId: string, optIn: boolean): Promise<boolean> {
    const rows = await executeRows<{ id: string }>(sql`
      UPDATE users SET
        sms_opt_in = ${optIn},
        sms_opted_in_at = CASE WHEN ${optIn} THEN now() ELSE NULL END,
        updated_at = now()
      WHERE id = ${userId}
      RETURNING id
    `)
    return rows.length > 0
  },

  /** SMS marketing uchun opt-in auditoriya soni (admin preview) */
  async countSmsOptIn(): Promise<number> {
    const rows = await executeRows<{ n: number }>(sql`
      SELECT COUNT(*)::int AS n FROM users WHERE sms_opt_in AND phone IS NOT NULL
    `)
    return Number(rows[0]?.n ?? 0)
  },

  /**
   * Upsert user + progress + settings BITTA SQL statement'da (CTE).
   * Alohida INSERT'larda bitta qadam muvaffaqiyatsiz bo'lsa user yarim
   * holatda qolardi; endi butun init atomik (va idempotent) bajariladi.
   * Return qilmaydi — qator zarur bo'lsa keyin `findById` bilan o'qing.
   * (Telegram identity saqlash users.service.init'da — shu jadval provider'dan
   * xabardor bo'lmasligi uchun: telefon userlar TG identity OLMAYDI.)
   * @param txOrDb — tashqi transaction ichida chaqirilganda (register flow)
   */
  async initAtomic(input: CreateOrUpdateUserInput, txOrDb: DB = db): Promise<void> {
    await executeRows(sql`
      WITH upserted AS (
        INSERT INTO users (id, first_name, last_name, username, photo_url)
        VALUES (
          ${input.id},
          ${input.firstName},
          ${input.lastName  ?? ''},
          ${input.username  ?? ''},
          ${input.photoUrl  ?? ''}
        )
        ON CONFLICT (id) DO UPDATE SET
          first_name = EXCLUDED.first_name,
          last_name  = EXCLUDED.last_name,
          username   = EXCLUDED.username,
          photo_url  = EXCLUDED.photo_url,
          updated_at = now()
        RETURNING id
      ), prog AS (
        INSERT INTO progress (user_id)
        SELECT id FROM upserted
        ON CONFLICT DO NOTHING
      ), sett AS (
        INSERT INTO settings (user_id)
        SELECT id FROM upserted
        ON CONFLICT DO NOTHING
      )
      SELECT (SELECT COUNT(*) FROM upserted) AS upserted_count
    `, txOrDb)
  },

  /** Upsert user and return the persisted row. */
  async upsert(input: CreateOrUpdateUserInput) {
    const [row] = await db.insert(users).values({
      id:        input.id,
      firstName: input.firstName,
      lastName:  input.lastName  ?? '',
      username:  input.username  ?? '',
      photoUrl:  input.photoUrl  ?? '',
    }).onConflictDoUpdate({
      target: users.id,
      set: {
        firstName: input.firstName,
        lastName:  input.lastName  ?? '',
        username:  input.username  ?? '',
        photoUrl:  input.photoUrl  ?? '',
        updatedAt: new Date(),
      },
    }).returning()
    return row!
  },

  async findById(id: string, txOrDb: DB = db): Promise<typeof users.$inferSelect | null> {
    const [user] = await txOrDb.select().from(users).where(eq(users.id, id))
    return user ?? null
  },

  /**
   * Update phone. Returns true when a row was actually updated.
   * Uses .returning() because neon-http driver does not populate rowCount.
   */
  async updatePhone(id: string, phone: string): Promise<boolean> {
    const rows = await db.update(users)
      .set({ phone, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning({ id: users.id })
    return rows.length > 0
  },

  /** Qo'lda yuklangan avatar (WebP data URL) — blok yozish; null → o'chirish. */
  async setAvatarWebp(userId: string, dataUrl: string | null): Promise<boolean> {
    const rows = await db.update(users)
      .set({ avatarWebp: dataUrl, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning({ id: users.id })
    return rows.length > 0
  },

  /** Global avatar (GET /api/avatar/:userId) — data URL yoki null. */
  async getAvatarWebp(userId: string): Promise<string | null> {
    const [row] = await db
      .select({ avatarWebp: users.avatarWebp })
      .from(users)
      .where(eq(users.id, userId))
    return row?.avatarWebp ?? null
  },

  /** Tarifni yangilash — Premium sotib olinganda (bot payment handler). */
  async setTariff(id: string, tariff: 'free' | 'premium'): Promise<void> {
    await db.update(users).set({ tariff, updatedAt: new Date() }).where(eq(users.id, id))
  },

  /** Trialni faqat bir marta va race-safe conditional update bilan beradi. */
  async tryGrantTrial(id: string, days: number): Promise<boolean> {
    const rows = await db.update(users).set({
      trialGrantedAt: new Date(),
      premiumUntil: sql`GREATEST(COALESCE(premium_until, now()), now()) + make_interval(days => ${days})`,
      updatedAt: new Date(),
    }).where(and(
      eq(users.id, id),
      eq(users.tariff, 'free'),
      isNull(users.trialGrantedAt),
    )).returning({ id: users.id })
    return rows.length > 0
  },
}
