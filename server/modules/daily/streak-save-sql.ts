/**
 * Streak coin-save SQL fragmentlari — `daily.repository.touchActivity` va
 * `progress.repository.recordAnswer` IKKALASI shu yerdan oladi (avval streak
 * CASE qo'lda ikki joyda dublikat edi; coin-save mantig'i murakkabroq bo'lgani
 * uchun bitta manbaga chiqarildi).
 *
 * Qaror jadvali `shared/streak-save.ts` `decideStreakOutcome` bilan BIR XIL —
 * integration testlar (`tests/integration/api/streak-save.test.ts`) ikkalasini
 * bir xil holatlarda tekshiradi.
 *
 * DIQQAT — nega `EXCLUDED` ISHLATILMAYDI: `EXCLUDED` faqat `ON CONFLICT DO
 * UPDATE`ning `SET` bandida mavjud; `RETURNING`da unga murojaat qilish
 * `42P01 invalid reference to FROM-clause entry for table "excluded"` beradi.
 * Bizga esa BIR XIL `eligible` ifodasi ham `SET`da (streak CASE), ham
 * `RETURNING`da (ledger gate) kerak. Shuning uchun fragmentlar `EXCLUDED`
 * o'rniga `daily_streaks` jadvaliga mustaqil subquery qiladi — bitta statement
 * ichida u statement BOSHIDAGI snapshot'ni ko'radi (ya'ni upsert'gacha bo'lgan
 * ESKI qatorni), aynan bizga kerak bo'lgan qiymat.
 */
import { sql, type SQL } from 'drizzle-orm'
import { STREAK_SAVE_COST } from '../../../shared/streak-save'

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

/** Ketma-ket TO'LIQ o'tkazib yuborilgan kunlar soni (0 = kecha faol bo'lgan) */
function gapDaysSql(ctx: Ctx): SQL {
  return sql`((${ctx.date}::date - ${prevDateSql(ctx)}::date) - 1)`
}

function isPremiumSql({ userId }: Ctx): SQL {
  return sql`COALESCE((SELECT (u.tariff = 'premium'
                               OR (u.premium_until IS NOT NULL AND u.premium_until > now()))
                       FROM users u WHERE u.id = ${userId}), false)`
}

/**
 * Shu chaqiruvda coin yechib streak saqlanadimi — `decideStreakOutcome`ning
 * `'coin_save'` sharti (bosqich + balans). Har doim TRUE/FALSE (NULL emas).
 */
export function coinSaveEligibleSql(ctx: Ctx): SQL {
  const gap = gapDaysSql(ctx)
  const premium = isPremiumSql(ctx)
  return sql`COALESCE((
    (
      (${gap} = 1 AND NOT ${premium})
      OR (${gap} = 2 AND ${premium})
    )
    AND COALESCE((SELECT c.balance FROM user_coins c WHERE c.user_id = ${ctx.userId}), 0) >= ${STREAK_SAVE_COST}::int
  ), false)`
}

/**
 * `streak` ustunining yangi qiymati (`ON CONFLICT DO UPDATE SET streak = ...`).
 * `eligible` — `coinSaveEligibleSql(ctx)` natijasi; chaqiruvchi bir marta
 * yaratib ham shu yerda, ham ledger shartida ishlatadi (bir xil qaror).
 */
export function streakValueSql(ctx: Ctx, eligible: SQL): SQL {
  const gap = gapDaysSql(ctx)
  return sql`CASE
    WHEN daily_streaks.last_daily_date >= ${ctx.date}
      THEN daily_streaks.streak
    WHEN daily_streaks.last_daily_date IS NULL
      THEN 1
    WHEN ${gap} = 0
      THEN daily_streaks.streak + 1
    WHEN ${gap} = 1 AND ${isPremiumSql(ctx)}
      THEN daily_streaks.streak + 1
    WHEN ${eligible}
      THEN daily_streaks.streak + 1
    ELSE 1
  END`
}
