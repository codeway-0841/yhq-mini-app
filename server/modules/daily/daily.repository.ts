/**
 * Daily Challenge repository — `daily_records` + `daily_streaks` (fan bo'yicha).
 *
 * Streak semantikasi (har fan uchun MUSTAQIL):
 *  - lastDailyDate == bugun    → o'zgarishsiz (bir kunda qayta faollik)
 *  - lastDailyDate == kecha    → streak + 1 (seriya davom etdi)
 *  - aks holda (uzilish/ilk)   → streak = 1
 *  - O'qishda: oxirgi sana kechadan ham eski bo'lsa → 0 (kun o'tkazilgan)
 *
 * Bir fandan boshqasiga o'tilsa, streak o'sha fanga tegishli qoladi:
 * (user_id, subject_id) juftligi bo'yicha alohida saqlanadi.
 */

import { and, asc, desc, eq, sql } from 'drizzle-orm'
import { db, executeRows, type DB } from '../../db/connection'
import { dailyRecords, dailyStreaks } from '../../schema'
import {
  chargeEarnedReturningSql,
  chargeSaveEligibleSql,
  chargesValueSql,
  coinSaveEligibleSql,
  lastDailyDateValueSql,
  streakValueSql,
} from './streak-save-sql'
import { STREAK_SAVE_COST } from '../../../shared/streak-save'

/** 'YYYY-MM-DD' dan oldingi kun (UTC parse — vaqt zonasi tushunchasiz) */
export function prevDate(date: string): string {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() - 1)
  return d.toISOString().slice(0, 10)
}

/** 1 kunlik tanaffus sanasi (zaryad bilan kechirilishi mumkin) */
export function isFrozenDay(lastDailyDate: string, today: string): boolean {
  return lastDailyDate === prevDate(prevDate(today))
}

/** Yangi dailyStreak qiymati (sof funksiya — unit test uchun) */
export function calcNextStreak(lastDailyDate: string | null, date: string, current: number, hasCharge = false): number {
  if (lastDailyDate === date)             return current
  if (lastDailyDate === prevDate(date))   return current + 1
  // Zaryad bilan saqlanganda seriya saqlanadi (o'smaydi!)
  if (hasCharge && lastDailyDate && isFrozenDay(lastDailyDate, date)) return current
  return 1
}

/**
 * O'qishdagi streak: kecha yoki bugun faol bo'lsa joriy seriya;
 * 1 kun o'tkazilgan va `charges > 0` bo'lsa himoyalangan joriy seriya; aks holda 0.
 */
export function effectiveStreak(lastDailyDate: string | null, today: string, current: number, charges = 0): number {
  if (!lastDailyDate) return 0
  if (lastDailyDate < prevDate(today)) {
    if (charges > 0 && lastDailyDate === prevDate(prevDate(today))) return current
    return 0
  }
  return current
}

/** Sanalar ro'yxatidagi eng uzun ketma-ket kunlar seriyasi (saralangan, unikal) */
export function calcBestStreak(dates: string[]): number {
  let best = 0, run = 0, prev = ''
  for (const d of dates) {
    run = (prev && prevDate(d) === prev) ? run + 1 : 1
    if (run > best) best = run
    prev = d
  }
  return best
}

export interface DailyRecordRow {
  date: string
  subjectId: string
  answered: number
  correct: number
}

export interface DailyHistoryRow extends DailyRecordRow {
  fixed: number
}

/** Foydalanuvchi uchun barcha fanlar kesimidagi global streak va zaryad qatorini o'qiydi */
async function readStreak(userId: string) {
  const [row] = await db.select({
    streak:        dailyStreaks.streak,
    charges:       dailyStreaks.charges,
    lastDailyDate: dailyStreaks.lastDailyDate,
  }).from(dailyStreaks).where(eq(dailyStreaks.userId, userId))
    .orderBy(
      sql`${dailyStreaks.lastDailyDate} DESC NULLS LAST`,
      desc(dailyStreaks.updatedAt),
      desc(dailyStreaks.streak),
    )
    .limit(1)
  return row ?? null
}

export const dailyRepository = {
  /** Bugungi yozuv (barcha fanlar bo'yicha faollik jamlanmasi) + global dailyStreak + charges */
  async getToday(userId: string, date: string, subjectId: string): Promise<{
    record: DailyRecordRow | null
    dailyStreak: number
    streakCharges: number
  }> {
    const [agg] = await db.select({
      answered: sql<number>`COALESCE(SUM(${dailyRecords.answered}), 0)::int`,
      correct:  sql<number>`COALESCE(SUM(${dailyRecords.correct}), 0)::int`,
    }).from(dailyRecords).where(
      and(
        eq(dailyRecords.userId, userId),
        eq(dailyRecords.date, date),
      ),
    )
    const answered = Number(agg?.answered ?? 0)
    const record: DailyRecordRow | null = answered > 0
      ? { date, subjectId, answered, correct: Number(agg?.correct ?? 0) }
      : null

    const row = await readStreak(userId)
    const streakCharges = row?.charges ?? 0

    return {
      record,
      dailyStreak: effectiveStreak(row?.lastDailyDate ?? null, date, row?.streak ?? 0, streakCharges),
      streakCharges,
    }
  },

  /**
   * Kunlik FAOLLIK belgisi — tasdiqlangan faollik (to'liq test sessiyasi, >= 15 savol
   * yoki interaktiv dars yakuni) orqali chaqiriladi.
   *
   * Streak idempotent: bir xil kun qayta kelsa o'zgarmaydi (kun ko'chsa +1).
   * Uzilish (gap=1) -> avval `charges`, zaryad 0 bo'lsa 100 coin (`coin_save`).
   */
  async touchActivity(
    userId:    string,
    date:      string,
    subjectId: string,
    answeredDelta = 0,
    correctDelta  = 0,
    txOrDb:    DB = db,
  ): Promise<{
    dailyStreak: number
    coinSaved: boolean
    chargeSaved: boolean
    chargeEarned: boolean
    streakCharges: number
  }> {
    const ctx = { userId, subjectId, date }
    const chargeEligible = chargeSaveEligibleSql(ctx)
    const coinEligible = coinSaveEligibleSql(ctx)
    const rows = await executeRows<{
      daily_streak: number
      coin_saved: boolean
      charge_saved: boolean
      charge_earned: boolean
      streak_charges: number
    }>(sql`
      WITH record_upsert AS (
        INSERT INTO daily_records (user_id, date, subject_id, answered, correct, fixed)
        VALUES (${userId}, ${date}, ${subjectId}, ${answeredDelta}, ${correctDelta}, 0)
        ON CONFLICT (user_id, date, subject_id) DO UPDATE SET
          answered = daily_records.answered + EXCLUDED.answered,
          correct = daily_records.correct + EXCLUDED.correct
        RETURNING id
      ), streak_upsert AS (
        INSERT INTO daily_streaks (user_id, subject_id, streak, charges, last_daily_date, updated_at)
        VALUES (
          ${userId},
          ${subjectId},
          ${streakValueSql(ctx, chargeEligible, coinEligible)},
          ${chargesValueSql(ctx, chargeEligible)},
          ${lastDailyDateValueSql(ctx)},
          now()
        )
        ON CONFLICT (user_id, subject_id) DO UPDATE SET
          streak = ${streakValueSql(ctx, chargeEligible, coinEligible)},
          charges = ${chargesValueSql(ctx, chargeEligible)},
          last_daily_date = ${lastDailyDateValueSql(ctx)},
          updated_at = now()
        RETURNING streak, charges,
          (${chargeEligible}) AS charge_saved,
          ${chargeEarnedReturningSql(ctx, chargeEligible)} AS charge_earned,
          (${coinEligible}) AS coin_saved
      ), save_ledger AS (
        INSERT INTO coin_transactions (user_id, delta, reason, ref_id)
        SELECT ${userId}, ${-STREAK_SAVE_COST}, 'streak_save', ${`${subjectId}:${date}`}
        WHERE (SELECT coin_saved FROM streak_upsert)
        ON CONFLICT (user_id, reason, ref_id) DO NOTHING
        RETURNING id
      ), coin_debit AS (
        UPDATE user_coins SET
          balance = balance - ${STREAK_SAVE_COST}::int,
          updated_at = now()
        WHERE user_id = ${userId} AND EXISTS (SELECT 1 FROM save_ledger)
        RETURNING balance
      )
      SELECT
        (SELECT streak FROM streak_upsert)::int AS daily_streak,
        EXISTS (SELECT 1 FROM save_ledger) AS coin_saved,
        COALESCE((SELECT charge_saved FROM streak_upsert), false) AS charge_saved,
        COALESCE((SELECT charge_earned FROM streak_upsert), false) AS charge_earned,
        COALESCE((SELECT charges FROM streak_upsert), 0)::int AS streak_charges
    `, txOrDb)

    const value = Number(rows[0]?.daily_streak)
    if (!Number.isFinite(value)) throw new Error('Daily streak upsert returned no value')
    return {
      dailyStreak:   value,
      coinSaved:     rows[0]?.coin_saved === true,
      chargeSaved:   rows[0]?.charge_saved === true,
      chargeEarned:  rows[0]?.charge_earned === true,
      streakCharges: Number(rows[0]?.streak_charges ?? 0),
    }
  },

  /**
   * Kunlik faollik tarixi (`scope = 'global'` barcha fanlar bo'yicha jamlangan kalendar,
   * `'subject'` esa shu fanga xos grafik uchun). Streak va zaryadlar doimo global.
   */
  async getHistory(
    userId: string,
    date: string,
    subjectId: string,
    scope: 'subject' | 'global' = 'subject',
  ): Promise<{
    rows: DailyHistoryRow[]
    dailyStreak: number
    bestStreak: number
    streakCharges: number
  }> {
    const rows = scope === 'global'
      ? await db.select({
          date:      dailyRecords.date,
          subjectId: sql<string>`'global'`,
          answered:  sql<number>`COALESCE(SUM(${dailyRecords.answered}), 0)::int`,
          correct:   sql<number>`COALESCE(SUM(${dailyRecords.correct}), 0)::int`,
          fixed:     sql<number>`COALESCE(SUM(${dailyRecords.fixed}), 0)::int`,
        }).from(dailyRecords)
          .where(eq(dailyRecords.userId, userId))
          .groupBy(dailyRecords.date)
          .orderBy(asc(dailyRecords.date))
      : await db.select({
          date:      dailyRecords.date,
          subjectId: dailyRecords.subjectId,
          answered:  dailyRecords.answered,
          correct:   dailyRecords.correct,
          fixed:     dailyRecords.fixed,
        }).from(dailyRecords)
          .where(and(eq(dailyRecords.userId, userId), eq(dailyRecords.subjectId, subjectId)))
          .orderBy(asc(dailyRecords.date))

    const row = await readStreak(userId)
    // Yozuvda answered > 0 bo'lsa o'sha kun faol hisoblanadi (addFixed answered=0 yozadi)
    const activeDates = rows.filter((r) => r.answered > 0).map((r) => r.date)
    const streakCharges = row?.charges ?? 0
    const dailyStreak = effectiveStreak(row?.lastDailyDate ?? null, date, row?.streak ?? 0, streakCharges)

    return {
      rows,
      dailyStreak,
      bestStreak:  Math.max(calcBestStreak(activeDates), dailyStreak),
      streakCharges,
    }
  },

  /**
   * Xato savol tuzatildi deb belgilash — shu kunning yozuviga fixed+1.
   * Kunlik test bajarilmagan kun ham yozuv yaratiladi (answered=0 bo'ladi,
   * kalendar faolligi va streak'ga ta'sir qilmaydi).
   */
  async addFixed(userId: string, date: string, subjectId: string): Promise<void> {
    await db.insert(dailyRecords)
      .values({ userId, date, subjectId, answered: 0, correct: 0, fixed: 1 })
      .onConflictDoUpdate({
        target: [dailyRecords.userId, dailyRecords.date, dailyRecords.subjectId],
        set:    { fixed: sql`${dailyRecords.fixed} + 1` },
      })
  },
}
