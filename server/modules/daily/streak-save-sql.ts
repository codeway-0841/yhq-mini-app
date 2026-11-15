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
  STREAK_CHARGE_MAX,
  STREAK_CHARGE_UNITS_REQUIRED,
} from '../../../shared/streak-save'

interface Ctx {
  userId:    string
  subjectId: string
  /** Joriy faollik sanasi 'YYYY-MM-DD' */
  date:      string
}

/** Upsert'gacha bo'lgan global oxirgi faollik sanasi (NULL — ilk qator) */
function prevDateSql({ userId }: Ctx): SQL {
  return sql`(SELECT s.last_daily_date FROM daily_streaks s
              WHERE s.user_id = ${userId}
              ORDER BY s.last_daily_date DESC NULLS LAST, s.updated_at DESC, s.streak DESC
              LIMIT 1)`
}

/** Upsert'gacha bo'lgan global seriya qiymati (0 — ilk qator) */
export function prevStreakSql({ userId }: Ctx): SQL {
  return sql`COALESCE((SELECT s.streak FROM daily_streaks s
                       WHERE s.user_id = ${userId}
                       ORDER BY s.last_daily_date DESC NULLS LAST, s.updated_at DESC, s.streak DESC
                       LIMIT 1), 0)`
}

/** Upsert'gacha bo'lgan global seriya zaryadlari (0..2) */
export function prevChargesSql({ userId }: Ctx): SQL {
  return sql`COALESCE((SELECT s.charges FROM daily_streaks s
                       WHERE s.user_id = ${userId}
                       ORDER BY s.last_daily_date DESC NULLS LAST, s.updated_at DESC, s.streak DESC
                       LIMIT 1), 0)`
}

/** Upsert'gacha bo'lgan global zaryad yig'ish progressi (0..2) */
export function prevChargeProgressSql({ userId }: Ctx): SQL {
  return sql`COALESCE((SELECT s.charge_progress FROM daily_streaks s
                       WHERE s.user_id = ${userId}
                       ORDER BY s.last_daily_date DESC NULLS LAST, s.updated_at DESC, s.streak DESC
                       LIMIT 1), 0)`
}

/** Oxirgi marta zaryad olingan kalendar sana (NULL — hali olinmagan) */
export function prevLastChargeEarnedDateSql({ userId }: Ctx): SQL {
  return sql`(SELECT s.last_charge_earned_date FROM daily_streaks s
              WHERE s.user_id = ${userId}
              ORDER BY s.last_daily_date DESC NULLS LAST, s.updated_at DESC, s.streak DESC
              LIMIT 1)`
}

/** Ketma-ket TO'LIQ o'tkazib yuborilgan kunlar soni (0 = kecha faol bo'lgan) */
export function gapDaysSql(ctx: Ctx): SQL {
  return sql`((${ctx.date}::date - ${prevDateSql(ctx)}::date) - 1)`
}

/** Shu chaqiruvda `gapDays` ta Streak Charge sarflanib seriya saqlanadimi? */
export function chargeSaveEligibleSql(ctx: Ctx): SQL {
  const gap = gapDaysSql(ctx)
  return sql`COALESCE((
    ${gap} >= 1
    AND ${prevChargesSql(ctx)} >= ${gap}
  ), false)`
}

/** Shu chaqiruvda +`unitDelta` zaryad birligi qo'shilishi mumkinmi (kuniga max 1 batareya, limit 2)? */
export function canCreditChargeUnitSql(ctx: Ctx, unitDelta: SQL, chargeEligible: SQL): SQL {
  const prevDate = prevDateSql(ctx)
  const prevCharges = prevChargesSql(ctx)
  const prevEarned = prevLastChargeEarnedDateSql(ctx)
  return sql`COALESCE((
    (${unitDelta})::int > 0
    AND NOT (${chargeEligible})
    AND ((${prevDate}) IS NULL OR (${prevDate}) <= ${ctx.date})
    AND (${prevCharges}) < ${STREAK_CHARGE_MAX}::int
    AND ((${prevEarned}) IS NULL OR (${prevEarned}) < ${ctx.date})
  ), false)`
}

/** Yangi `last_daily_date` qiymati (INSERT ham, UPDATE ham global snapshot'ga tayanadi) */
export function lastDailyDateValueSql(ctx: Ctx): SQL {
  return sql`GREATEST(COALESCE((${prevDateSql(ctx)}), ${ctx.date}), ${ctx.date})`
}

/**
 * `streak` ustunining yangi qiymati (INSERT ham, ON CONFLICT UPDATE ham bir xil global formulani ishlatadi).
 * Zaryad bilan saqlanganda seriya SAQLANADI (o'smaydi!).
 */
export function streakValueSql(ctx: Ctx, chargeEligible: SQL): SQL {
  const gap = gapDaysSql(ctx)
  const prevDate = prevDateSql(ctx)
  const prevStreak = prevStreakSql(ctx)
  return sql`CASE
    WHEN (${prevDate}) >= ${ctx.date}
      THEN (${prevStreak})
    WHEN (${prevDate}) IS NULL
      THEN 1
    WHEN ${gap} = 0
      THEN (${prevStreak}) + 1
    WHEN ${chargeEligible}
      THEN (${prevStreak})
    ELSE 1
  END`
}

/**
 * `charges` ustunining yangi qiymati:
 *  - gapDays >= 1 va charges >= gapDays -> gapDays ta zaryad sarflanadi
 *  - Birlik sharti + kuniga max 1 ta batareya + progress == 3 -> +1 zaryad (max 2)
 *  - Qolgan barcha holat -> saqlanadi (zaryad eskirmaydi)
 */
export function chargesValueSql(
  ctx: Ctx,
  chargeEligible: SQL,
  unitDelta: SQL,
): SQL {
  const gap = gapDaysSql(ctx)
  const prevDate = prevDateSql(ctx)
  const prevCharges = prevChargesSql(ctx)
  const prevProgress = prevChargeProgressSql(ctx)
  const creditUnit = canCreditChargeUnitSql(ctx, unitDelta, chargeEligible)
  return sql`CASE
    WHEN (${prevDate}) > ${ctx.date}
      THEN (${prevCharges})
    WHEN ${chargeEligible}
      THEN GREATEST(0, (${prevCharges}) - GREATEST(1, (${gap})::int))
    WHEN ${creditUnit}
      AND ((${prevProgress}) + (${unitDelta})::int) >= ${STREAK_CHARGE_UNITS_REQUIRED}::int
      THEN LEAST(${STREAK_CHARGE_MAX}::int, (${prevCharges}) + 1)
    ELSE (${prevCharges})
  END`
}

/** `charge_progress` ustunining yangi qiymati (0..2) */
export function chargeProgressValueSql(
  ctx: Ctx,
  chargeEligible: SQL,
  unitDelta: SQL,
): SQL {
  const prevDate = prevDateSql(ctx)
  const prevCharges = prevChargesSql(ctx)
  const prevProgress = prevChargeProgressSql(ctx)
  const prevEarned = prevLastChargeEarnedDateSql(ctx)
  const creditUnit = canCreditChargeUnitSql(ctx, unitDelta, chargeEligible)
  return sql`CASE
    WHEN (${prevDate}) > ${ctx.date}
      THEN (${prevProgress})
    WHEN ${chargeEligible}
      THEN (${prevProgress})
    WHEN (${prevCharges}) >= ${STREAK_CHARGE_MAX}::int
      OR ((${prevEarned}) IS NOT NULL AND (${prevEarned}) >= ${ctx.date})
      THEN 0
    WHEN ${creditUnit}
      AND ((${prevProgress}) + (${unitDelta})::int) >= ${STREAK_CHARGE_UNITS_REQUIRED}::int
      THEN 0
    WHEN ${creditUnit}
      THEN (${prevProgress}) + (${unitDelta})::int
    ELSE (${prevProgress})
  END`
}

/** `last_charge_earned_date` ustunining yangi qiymati */
export function lastChargeEarnedDateValueSql(
  ctx: Ctx,
  chargeEligible: SQL,
  unitDelta: SQL,
): SQL {
  const prevDate = prevDateSql(ctx)
  const prevProgress = prevChargeProgressSql(ctx)
  const prevEarned = prevLastChargeEarnedDateSql(ctx)
  const creditUnit = canCreditChargeUnitSql(ctx, unitDelta, chargeEligible)
  return sql`CASE
    WHEN (${prevDate}) > ${ctx.date}
      THEN (${prevEarned})
    WHEN ${creditUnit}
      AND ((${prevProgress}) + (${unitDelta})::int) >= ${STREAK_CHARGE_UNITS_REQUIRED}::int
      THEN ${ctx.date}
    ELSE (${prevEarned})
  END`
}

/**
 * `RETURNING` ichida shu chaqiruvda yangi zaryad berildimi?
 * `daily_streaks.charges` = upsert'dan KEYINGI qiymat; `prevChargesSql` = OLDINGI.
 */
export function chargeEarnedReturningSql(ctx: Ctx): SQL {
  return sql`COALESCE((
    daily_streaks.charges > ${prevChargesSql(ctx)}
    AND daily_streaks.last_charge_earned_date = ${ctx.date}
  ), false)`
}
