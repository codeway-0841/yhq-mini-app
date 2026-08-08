/**
 * Users repository — all DB access for the `users` table.
 * No business logic here; only SQL/Drizzle calls.
 */

import { and, eq, isNull, sql } from 'drizzle-orm'
import { db, executeRows } from '../../db/connection'
import { users } from '../../schema'

export interface CreateOrUpdateUserInput {
  id:        bigint
  firstName: string
  lastName:  string | null
  username:  string | null
  photoUrl:  string | null
}

export const referralsRepository = {
  /**
   * Referal qaydi + referrer mukofoti (+N kun premium) BITTA SQL statement'da.
   * referee UNIQUE constraint ikkala rajotda ham bir marta hisoblanishini
   * kafolatlaydi; insert muvaffaqiyatli bo'lgan taqdirdagina UPDATE ishlaydi.
   */
  async tryCreateWithReward(referrerId: bigint, refereeId: bigint, days: number): Promise<boolean> {
    const rows = await executeRows<{ rewarded: number }>(sql`
      WITH inserted AS (
        INSERT INTO referrals (referrer_id, referee_id)
        VALUES (${referrerId}, ${refereeId})
        ON CONFLICT (referee_id) DO NOTHING
        RETURNING referrer_id
      ), rewarded AS (
        UPDATE users SET
          premium_until = GREATEST(COALESCE(premium_until, now()), now()) + make_interval(days => ${days}::int),
          updated_at = now()
        WHERE id = ${referrerId} AND EXISTS (SELECT 1 FROM inserted)
        RETURNING id
      )
      SELECT COUNT(*)::int AS rewarded FROM rewarded
    `)
    return Number(rows[0]?.rewarded) > 0
  },
}

export const usersRepository = {
  /**
   * Upsert user + progress + settings BITTA SQL statement'da (CTE).
   * Alohida INSERT'larda bitta qadam muvaffaqiyatsiz bo'lsa user yarim
   * holatda qolardi; endi butun init atomik (va idempotent) bajariladi.
   * Return qilmaydi — qator zarur bo'lsa keyin `findById` bilan o'qing.
   */
  async initAtomic(input: CreateOrUpdateUserInput): Promise<void> {
    await db.execute(sql`
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
    `)
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

  async findById(id: bigint): Promise<typeof users.$inferSelect | null> {
    const [user] = await db.select().from(users).where(eq(users.id, id))
    return user ?? null
  },

  /**
   * Update phone. Returns true when a row was actually updated.
   * Uses .returning() because neon-http driver does not populate rowCount.
   */
  async updatePhone(id: bigint, phone: string): Promise<boolean> {
    const rows = await db.update(users)
      .set({ phone, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning({ id: users.id })
    return rows.length > 0
  },

  /** Tarifni yangilash — Premium sotib olinganda (bot payment handler). */
  async setTariff(id: bigint, tariff: 'free' | 'premium'): Promise<void> {
    await db.update(users).set({ tariff, updatedAt: new Date() }).where(eq(users.id, id))
  },

  /** Trialni faqat bir marta va race-safe conditional update bilan beradi. */
  async tryGrantTrial(id: bigint, days: number): Promise<boolean> {
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
