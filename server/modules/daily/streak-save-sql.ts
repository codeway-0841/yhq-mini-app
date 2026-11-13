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

/** Yangi `last_daily_date` qiymati (INSERT ham, UPDATE ham global snapshot'ga tayanadi) */
export function lastDailyDateValueSql(ctx: Ctx): SQL {
  return sql`GREATEST(COALESCE((${prevDateSql(ctx)}), ${ctx.date}), ${ctx.date})`
}

/**
 * `streak` ustunining yangi qiymati (INSERT ham, ON CONFLICT UPDATE ham bir xil global formulani ishlatadi).
 * Zaryad yoki coin bilan saqlanganda seriya SAQLANADI (o'smaydi!).
 */
export function streakValueSql(ctx: Ctx, chargeEligible: SQL, coinEligible: SQL): SQL {
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
    WHEN ${chargeEligible} OR ${coinEligible}
      THEN (${prevStreak})
    ELSE 1
  END`
}

/**
 * `charges` ustunining yangi qiymati (INSERT ham, ON CONFLICT UPDATE ham global snapshot'ga tayanadi).
 *  - Shu kunda qayta faollik (boshqa fanda bo'lsa ham) -> o'zgarmaydi
 *  - gapDays = 1 + charge > 0 -> 1 ta zaryad sarflanadi
 *  - gapDays = 0 va yangi streak 7 ga karrali -> +1 zaryad (max STREAK_CHARGE_MAX)
 *  - Qolgan barcha holat -> saqlanadi (zaryad eskirmaydi)
 */
export function chargesValueSql(ctx: Ctx, chargeEligible: SQL): SQL {
  const gap = gapDaysSql(ctx)
  const prevDate = prevDateSql(ctx)
  const prevStreak = prevStreakSql(ctx)
  const prevCharges = prevChargesSql(ctx)
  return sql`CASE
    WHEN (${prevDate}) >= ${ctx.date}
      THEN (${prevCharges})
    WHEN ${chargeEligible}
      THEN GREATEST(0, (${prevCharges}) - 1)
    WHEN ${gap} = 0
      AND (((${prevStreak}) + 1) % ${STREAK_CHARGE_EARN_EVERY}::int = 0)
      THEN LEAST(${STREAK_CHARGE_MAX}::int, (${prevCharges}) + 1)
    ELSE (${prevCharges})
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
