/**
 * Streak va Streak Charge (Zaryad) SQL fragmentlari — `daily.repository.touchActivity` va
 * `progress.repository.recordAnswer` IKKALASI shu yerdan oladi.
 *
 * Qaror jadvali `shared/streak-save.ts` `decideStreakOutcome` bilan BIR XIL —
 * integration testlar (`tests/integration/api/streak-save.test.ts`) ikkalasini
 * bir xil holatlarda tekshiradi.
 *
 * DIQQAT — nega `EXCLUDED` ISHLATILMAYDI: `EXCLUDED` faqat `ON CONFLICT DO
 * UPDATE`ning `SET` bandida mavjud; `RETURNING`da unga murojaat qilish
 * `42P01 invalid reference to FROM-clause entry for table "excluded"` beradi.
 * Subquery'lar statement BOSHIDAGI snapshot'ni (upsert'gacha bo'lgan eski qatorni),
 * `RETURNING` dagi `daily_streaks.*` esa yangilangan qiymatni qaytaradi.
 */
import { sql, type SQL } from 'drizzle-orm'
import {
  STREAK_CHARGE_EARN_EVERY,
  STREAK_CHARGE_MAX,
  STREAK_SAVE_COST,
} from '../../../shared/streak-save'

interface Ctx {
  userId:    string
  subjectId: string
  /** Joriy faollik sanasi 'YYYY-MM-DD' */
  date:      string
}

/** Upsert'gacha bo'lgan oxirgi faollik sanasi (NULL — ilk qator) */
function prevDateSql({ userId, subjectId }: Ctx): SQL {
  return sql`(SELECT s.last_daily_date FROM daily_streaks s
              WHERE s.user_id = ${userId} AND s.subject_id = ${subjectId})`
}

/** Upsert'gacha bo'lgan seriya zaryadlari (0..2) */
export function prevChargesSql({ userId, subjectId }: Ctx): SQL {
  return sql`COALESCE((SELECT s.charges FROM daily_streaks s
                       WHERE s.user_id = ${userId} AND s.subject_id = ${subjectId}), 0)`
}

/** Ketma-ket TO'LIQ o'tkazib yuborilgan kunlar soni (0 = kecha faol bo'lgan) */
export function gapDaysSql(ctx: Ctx): SQL {
  return sql`((${ctx.date}::date - ${prevDateSql(ctx)}::date) - 1)`
}

/** Shu chaqiruvda 1 ta Streak Charge sarflanib seriya saqlanadimi? */
export function chargeSaveEligibleSql(ctx: Ctx): SQL {
  return sql`COALESCE((
    ${gapDaysSql(ctx)} = 1
    AND ${prevChargesSql(ctx)} > 0
  ), false)`
}

/**
 * Shu chaqiruvda zaryad yo'qligi sababli coin yechib streak saqlanadimi?
 * Har doim TRUE/FALSE (NULL emas).
 */
export function coinSaveEligibleSql(ctx: Ctx): SQL {
  const gap = gapDaysSql(ctx)
  return sql`COALESCE((
    ${gap} = 1
    AND ${prevChargesSql(ctx)} <= 0
    AND COALESCE((SELECT c.balance FROM user_coins c WHERE c.user_id = ${ctx.userId}), 0) >= ${STREAK_SAVE_COST}::int
  ), false)`
}

/**
 * `streak` ustunining yangi qiymati (`ON CONFLICT DO UPDATE SET streak = ...`).
 * Zaryad yoki coin bilan saqlanganda seriya SAQLANADI (o'smaydi!).
 */
export function streakValueSql(ctx: Ctx, chargeEligible: SQL, coinEligible: SQL): SQL {
  const gap = gapDaysSql(ctx)
  return sql`CASE
    WHEN daily_streaks.last_daily_date >= ${ctx.date}
      THEN daily_streaks.streak
    WHEN daily_streaks.last_daily_date IS NULL
      THEN 1
    WHEN ${gap} = 0
      THEN daily_streaks.streak + 1
    WHEN ${chargeEligible} OR ${coinEligible}
      THEN daily_streaks.streak
    ELSE 1
  END`
}

/**
 * `charges` ustunining yangi qiymati (`ON CONFLICT DO UPDATE SET charges = ...`).
 *  - Shu kunda qayta faollik -> o'zgarmaydi
 *  - gapDays = 1 + charge > 0 -> 1 ta zaryad sarflanadi
 *  - gapDays = 0 va yangi streak 7 ga karrali -> +1 zaryad (max STREAK_CHARGE_MAX)
 *  - Qolgan barcha holat -> saqlanadi (zaryad eskirmaydi)
 */
export function chargesValueSql(ctx: Ctx, chargeEligible: SQL): SQL {
  const gap = gapDaysSql(ctx)
  return sql`CASE
    WHEN daily_streaks.last_daily_date >= ${ctx.date}
      THEN daily_streaks.charges
    WHEN ${chargeEligible}
      THEN GREATEST(0, daily_streaks.charges - 1)
    WHEN ${gap} = 0
      AND ((daily_streaks.streak + 1) % ${STREAK_CHARGE_EARN_EVERY}::int = 0)
      THEN LEAST(${STREAK_CHARGE_MAX}::int, daily_streaks.charges + 1)
    ELSE daily_streaks.charges
  END`
}

/**
 * `RETURNING` ichida shu chaqiruvda yangi zaryad berildimi?
 * `daily_streaks.charges` = upsert'dan KEYINGI qiymat; `prevChargesSql` = OLDINGI.
 */
export function chargeEarnedReturningSql(ctx: Ctx, chargeEligible: SQL): SQL {
  return sql`COALESCE((
    NOT (${chargeEligible})
    AND ${gapDaysSql(ctx)} = 0
    AND (daily_streaks.streak % ${STREAK_CHARGE_EARN_EVERY}::int = 0)
    AND daily_streaks.charges > ${prevChargesSql(ctx)}
  ), false)`
}
