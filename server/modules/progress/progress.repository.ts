/**
 * Progress repository — DB access for the `progress` table.
 */

import { eq, sql } from 'drizzle-orm'
import { db, executeRows }     from '../../db/connection'
import { progress, duelResults } from '../../schema'
import { COINS_PER_CORRECT_ANSWER } from '../../../shared/shop-items'
import {
  XP_FIRST_CORRECT, XP_MISTAKE_FIXED, XP_DAILY_CAP, COINS_DAILY_ANSWER_CAP,
} from '../../../shared/xp'
import { STREAK_SAVE_COST } from '../../../shared/streak-save'
import { coinSaveEligibleSql, streakValueSql } from '../daily/streak-save-sql'

/**
 * H-3 (audit, TODO H4 variant 1 — kunlik kredit): bitta user kuniga shu
 * miqdordan ortiq javob BALL-counterlariga YOZILMAYDI (answered/correct/
 * streak/daily_records — League score manbai). Farming qiymati kuniga cheklangan
 * (haftada ×7), legit o'quvchi (marathon ham) 1000/javob'ga kamdan-kam yetadi.
 * Jimgina cap: javob "duplicate" no-op sifatida qaytariladi (xato YO'Q).
 */
export const DAILY_ANSWER_CREDIT = 1000

/** Bitta duel ishtirokchisining natijasi (`duel_results` qatori) */
export interface DuelResultRow {
  matchId:    string
  userId:     string
  opponentId: string | null
  result:     'win' | 'lose' | 'draw'
  selfScore:  number
  oppScore:   number
  forfeit:    boolean
}

export const progressRepository = {
  async ensureExists(userId: string): Promise<void> {
    await db.insert(progress).values({ userId }).onConflictDoNothing()
  },

  async findByUserId(userId: string) {
    const [row] = await db.select().from(progress).where(eq(progress.userId, userId))
    return row ?? null
  },

  /**
   * Test javobini yozish — BITTA atomik SQL statement'da (CTE):
   *  1) idempotency token (clientToken) — replay counterlarni qayta yozmaydi;
   *  2) progress counterlari (total/streak/wrongByTicket) — race-safe inkrement;
   *  3) shu kuning daily_records qatori (+1 javob);
   *  4) daily_streaks seriyasi (premium "freeze" logikasi bilan).
   * Streka/streak SQL semantikasi daily.repository.touchActivity bilan bir xil —
   * o'zgarish kiritilsa ikkalasini ham yangilash shart.
   *
   * Semantika: wrong_by_ticket — "hozirgi yechilmagan xatolar".
   *  - xato javob  → hisoblagich +1
   *  - to'g'ri javob → xato tuzatilgan, kalit jsonb'dan o'chiriladi (`-` operatori)
   *
   * `updated=false` bo'lsa progress qatori (va user) yo'q — daily yozuvlar
   * ham yozilmaydi va router 404 qaytaradi (eski behavior bilan bir xil).
   * `duplicate=true` — hech narsa yozilmadi, lekin bu IDEMPOTENT muvaffaqiyat.
   *   `reason`:
   *    - 'replay' — XUDDI SHU clientToken qayta kelgan (outbox flush/dublikat
   *      request): reveal QAYTA OCHILMAYDI (farming himoyasi, security tests).
   *    - 'gate'   — YANGI token, lekin anti-farm gate (avval to'g'ri yechilgan
   *      savolga yana to'g'ri javob) yoki kunlik kredit: counterlar yozilmaydi,
   *      LECIN user FRESH javob bergan — feedback (correct/correctAnswer) beriladi.
   */
  async recordAnswer(input: {
    userId:       string
    correct:      boolean
    questionId:   number | null
    date:         string
    subjectId:    string
    clientToken?: string
    /** Savol ko'rsatilgandan javob berilgunga qadar ketgan vaqt (ms).
     *  Client yuboradi; qiyinlikni keyinchalik MA'LUMOTDAN chiqarish uchun
     *  yig'iladi (hech qanday ball/XP'ga hozir ta'sir qilmaydi). */
    elapsedMs?:   number | null
  }): Promise<{ updated: boolean; dailyStreak: number | null; duplicate: boolean; reason?: 'replay' | 'gate'; coinBalance: number | null; coinSaved: boolean; xp: number | null; xpEarned: number; coinsMinted: number }> {
    const { userId, correct, questionId, date, subjectId, clientToken } = input
    // Ishonchsiz client qiymati: 0..10 daqiqa oralig'idan tashqarisi tashlanadi
    // (fon rejimida qolgan tab soatlab "javob berdi" bo'lib ko'rinmasin).
    const rawMs = input.elapsedMs
    const elapsedMs = typeof rawMs === 'number' && Number.isFinite(rawMs)
      ? Math.min(600_000, Math.max(0, Math.round(rawMs)))
      : null
    const token = clientToken ?? null
    // Multi-fan identity: kalit `${subjectId}:${questionId}` formatida —
    // fanlar orasida xato qaydlari chalkashmaydi.
    const qKey = questionId !== null ? `${subjectId}:${questionId}` : null
    const qPath = questionId !== null ? `{${subjectId}:${questionId}}` : null
    const correctDelta = correct ? 1 : 0
    const wrongDelta   = correct ? 0 : 1

    const ctx = { userId, subjectId, date }
    const eligible = coinSaveEligibleSql(ctx)

    const rows = await executeRows<{ proceed: boolean; prog_updated: number; daily_streak: number; token_inserted: boolean; coin_balance: number | null; coin_saved: boolean; xp: number | null; xp_earned: number; coins_minted: number }>(sql`
      WITH tok AS (
        -- Token user mavjud bo'lgandagina yaratiladi (FK himoyasi):
        -- ghost user'ning birinchi so'rovi ham "duplicate" emas, "not found".
        INSERT INTO answer_tokens (token, user_id)
        SELECT ${token}::text, ${userId}
        WHERE ${token}::text IS NOT NULL
          AND EXISTS (SELECT 1 FROM users WHERE id = ${userId})
        ON CONFLICT (token) DO NOTHING
        RETURNING token
      ), credit AS (
        -- H-3: kunlik javob krediti tugaganda keyingi yozuvlar jimgina no-op
        -- (bola ball farming'ni kunlik qiymatga qattiqlaydi; daily_records
        -- shu statement'dan OLDINGI holatda o'qiladi — snapshot izolyatsiyasi).
        SELECT (
          COALESCE(SUM(answered), 0) < ${DAILY_ANSWER_CREDIT}::int
        ) AS ok
        FROM daily_records
        WHERE user_id = ${userId} AND date = ${date}
      ), gate AS (
        SELECT (
          -- 1) clientToken replay YOKI token yo'q — o'tadi;
          (${token}::text IS NULL OR EXISTS (SELECT 1 FROM tok))
          -- 2) ANTI-FARM: ilgari TO'G'RI javob berilgan savolga takroriy
          --    to'g'ri javob counterlarga YOZILMAYDI. P2 (audit): gate endi
          --    progress_questions jadvaliga tayanadi (jsonb correct_questions
          --    o'rniga O(1) index EXISTS — quadratic rewrite yo'q).
          AND NOT (
            ${correct}
            AND ${questionId}::int IS NOT NULL
            AND EXISTS (
              SELECT 1 FROM progress_questions pq
              WHERE pq.user_id = ${userId}
                AND pq.subject_id = ${subjectId}
                AND pq.question_id = ${questionId}::int
                AND pq.correct
            )
          )
          -- 3) H-3: kunlik kredit (DAILY_ANSWER_CREDIT) — farming kunlik chegarasi
          AND (SELECT ok FROM credit)
        ) AS proceed
      ), limits AS (
        -- Kunlik shift hisobi statement'dan OLDINGI holatda o'qiladi
        -- (snapshot izolyatsiyasi — credit CTE bilan bir xil yondashuv).
        SELECT xp_earned, coins_earned FROM daily_limits
        WHERE user_id = ${userId} AND date = ${date}
      ), xp_calc AS (
        -- XP o'rganish HODISASIGA beriladi, javob soniga emas:
        --   yangi savol to'g'ri yechildi          → XP_FIRST_CORRECT
        --   avval XATO qilingan savol tuzatildi   → XP_MISTAKE_FIXED (qimmatroq)
        --   xato javob / takroriy to'g'ri javob   → 0
        SELECT CASE
          WHEN NOT ${correct}::boolean THEN 0
          WHEN ${questionId}::int IS NULL THEN 0
          WHEN NOT EXISTS (
            SELECT 1 FROM progress_questions pq
            WHERE pq.user_id = ${userId} AND pq.subject_id = ${subjectId}
              AND pq.question_id = ${questionId}::int
          ) THEN ${XP_FIRST_CORRECT}::int
          WHEN EXISTS (
            SELECT 1 FROM progress_questions pq
            WHERE pq.user_id = ${userId} AND pq.subject_id = ${subjectId}
              AND pq.question_id = ${questionId}::int AND NOT pq.correct
          ) THEN ${XP_MISTAKE_FIXED}::int
          ELSE 0
        END AS raw
      ), xp_award AS (
        -- Kunlik shift: shiftdan keyin mashq davom etadi, faqat XP to'xtaydi
        SELECT GREATEST(0, LEAST(
          (SELECT raw FROM xp_calc),
          ${XP_DAILY_CAP}::int - COALESCE((SELECT xp_earned FROM limits), 0)
        )) AS amount
      ), prog AS (
        UPDATE progress SET
          total_correct  = total_correct + ${correctDelta},
          total_wrong    = total_wrong + ${wrongDelta},
          total_answered = total_answered + 1,
          streak         = CASE WHEN ${correct} THEN streak + 1 ELSE 0 END,
          wrong_by_ticket = CASE
            WHEN ${qKey}::text IS NULL THEN COALESCE(wrong_by_ticket, '{}'::jsonb)
            WHEN ${correct} THEN COALESCE(wrong_by_ticket, '{}'::jsonb) - ${qKey}::text
            ELSE jsonb_set(
              COALESCE(wrong_by_ticket, '{}'::jsonb),
              ${qPath}::text[],
              (COALESCE((COALESCE(wrong_by_ticket, '{}'::jsonb)->>${qKey}::text)::int, 0) + 1)::text::jsonb
            )
          END,
          -- P2: solved/correct jsonb massivlar endi YOZILMAYDI — q_write CTE
          -- progress_questions jadvaliga O(1) upsert qiladi.
          xp             = xp + (SELECT amount FROM xp_award),
          updated_at = now()
        WHERE user_id = ${userId} AND (SELECT proceed FROM gate)
        RETURNING id, xp
      ), q_write AS (
        -- P2: yechilgan savol qaydini jadvalga O(1) upsert (jsonb massiv o'rniga).
        -- correct bir marta true bo'lsa orqaga qaytmaydi (anti-farm gate manbai).
        INSERT INTO progress_questions (user_id, subject_id, question_id, correct, answered_at, first_ms, last_ms)
        SELECT ${userId}, ${subjectId}, ${questionId}::int, ${correct}::boolean, now(),
               ${elapsedMs}::int, ${elapsedMs}::int
        WHERE ${questionId}::int IS NOT NULL
          AND EXISTS (SELECT 1 FROM prog)
        ON CONFLICT (user_id, subject_id, question_id) DO UPDATE
          SET correct = progress_questions.correct OR EXCLUDED.correct,
              answered_at = now(),
              -- first_ms FAQAT birinchi urinishda yoziladi (bo'sh bo'lsa to'ldiriladi)
              first_ms = COALESCE(progress_questions.first_ms, EXCLUDED.first_ms),
              last_ms = COALESCE(EXCLUDED.last_ms, progress_questions.last_ms)
        RETURNING user_id
      ), record_upsert AS (
        -- Progress qatori (=> user) mavjud bo'lgandagina kunlik yozuv yoziladi:
        -- ro'yxatdan o'tmagan usulda FK violation o'rniga toza "not found" qaytadi.
        INSERT INTO daily_records (user_id, date, subject_id, answered, correct, fixed)
        SELECT ${userId}, ${date}, ${subjectId}, 1, ${correctDelta}, 0
        WHERE EXISTS (SELECT 1 FROM prog)
        ON CONFLICT (user_id, date, subject_id) DO UPDATE SET
          answered = daily_records.answered + EXCLUDED.answered,
          correct = daily_records.correct + EXCLUDED.correct
        RETURNING id
      ), streak_upsert AS (
        -- Streak CASE va coin-save sharti streak-save-sql.ts dan —
        -- daily.repository.touchActivity bilan BITTA manba.
        INSERT INTO daily_streaks (user_id, subject_id, streak, last_daily_date, updated_at)
        SELECT ${userId}, ${subjectId}, 1, ${date}, now()
        WHERE EXISTS (SELECT 1 FROM prog)
        ON CONFLICT (user_id, subject_id) DO UPDATE SET
          streak = ${streakValueSql(ctx, eligible)},
          last_daily_date = GREATEST(COALESCE(daily_streaks.last_daily_date, EXCLUDED.last_daily_date), EXCLUDED.last_daily_date),
          updated_at = now()
        RETURNING streak, ${eligible} AS saved
      ), save_ledger AS (
        -- Idempotentlik gate'i: kuniga BITTA streak_save. Debit shu CTE
        -- natijasiga bog'langani uchun o'sha kundagi keyingi javoblar
        -- coin'ni qayta yechmaydi (ON CONFLICT DO NOTHING → qator yo'q).
        INSERT INTO coin_transactions (user_id, delta, reason, ref_id)
        SELECT ${userId}, ${-STREAK_SAVE_COST}, 'streak_save', ${`${subjectId}:${date}`}
        WHERE (SELECT saved FROM streak_upsert)
        ON CONFLICT (user_id, reason, ref_id) DO NOTHING
        RETURNING id
      ), coin_mint AS (
        -- Javoblardan kuniga olinadigan coin ham cheklangan (COINS_DAILY_ANSWER_CAP):
        -- balans yillar davomida shishib ketsa, keyin narxni ma'nosiz ko'tarish
        -- yoki balansni nolga tushirishdan boshqa chora qolmaydi.
        SELECT CASE
          WHEN ${correct}
           AND EXISTS (SELECT 1 FROM prog)
           AND COALESCE((SELECT coins_earned FROM limits), 0) < ${COINS_DAILY_ANSWER_CAP}::int
          THEN ${COINS_PER_CORRECT_ANSWER}::int
          ELSE 0
        END AS amount
      ), coin_award AS (
        -- FIXPLAN #40: coin MINT — FAQAT gate'dan o'tgan TO'G'RI javob uchun
        -- (EXISTS prog: anti-farm gate, kunlik kredit va token replay'ning
        -- BARCHASI coin'ni ham to'xtatadi — farming qiymati ball bilan birga
        -- cheklangan). Consumable idempotency: 'answer'+clientToken ref —
        -- replay'da prog yo'q → qayta mint yo'q (ledger ikki marta yozilmaydi).
        --
        -- MINT VA STREAK-SAVE DEBIT BITTA YOZUVDA (net delta) — SABAB:
        -- Postgres bitta statementda BIR QATORGA ikkita alohida upsert/UPDATE
        -- CTE qo'llasa FAQAT BITTASI saqlanadi, ikkinchisi JIMGINA yo'qoladi
        -- (real DB'da tekshirilgan). Alohida debit CTE mint'ni yo'q qilardi.
        INSERT INTO user_coins (user_id, balance, updated_at)
        SELECT ${userId},
          GREATEST(0,
            (SELECT amount FROM coin_mint)
            - (CASE WHEN EXISTS (SELECT 1 FROM save_ledger) THEN ${STREAK_SAVE_COST}::int ELSE 0 END)
          ),
          now()
        WHERE (SELECT amount FROM coin_mint) > 0
           OR EXISTS (SELECT 1 FROM save_ledger)
        ON CONFLICT (user_id) DO UPDATE SET
          balance = user_coins.balance
            + (SELECT amount FROM coin_mint)
            - (CASE WHEN EXISTS (SELECT 1 FROM save_ledger) THEN ${STREAK_SAVE_COST}::int ELSE 0 END),
          updated_at = now()
        RETURNING balance
      ), coin_ledger AS (
        -- ref_id: clientToken bo'lsa o'sha (global unique); bo'lmasa qKey
        -- ('subjectId:questionId') fallback — gate BIR marta shu savolga
        -- mint'ni o'tkazgani uchun (progress_questions.correct qaytmaydi)
        -- bu ref user boshiga takrorlanmaydi (audit: token yo'qligida ledger
        -- qatori butunlay tushib qolardi — balans/ledger divergensiyasi).
        -- Shart endi coin_award EMAS, prog — coin_award faqat streak-save
        -- sababli ham yaratilishi mumkin (mint bo'lmasa ham).
        INSERT INTO coin_transactions (user_id, delta, reason, ref_id)
        SELECT ${userId}, (SELECT amount FROM coin_mint), 'answer', COALESCE(${token}::text, ${qKey}::text)
        WHERE (SELECT amount FROM coin_mint) > 0
        ON CONFLICT (user_id, reason, ref_id) DO NOTHING
        RETURNING id
      ), limits_upsert AS (
        -- Kunlik shift hisobini yangilash (XP va coin bitta qatorda)
        INSERT INTO daily_limits (user_id, date, xp_earned, coins_earned, updated_at)
        SELECT ${userId}, ${date}, (SELECT amount FROM xp_award), (SELECT amount FROM coin_mint), now()
        WHERE EXISTS (SELECT 1 FROM prog)
          AND ((SELECT amount FROM xp_award) > 0 OR (SELECT amount FROM coin_mint) > 0)
        ON CONFLICT (user_id, date) DO UPDATE SET
          xp_earned    = daily_limits.xp_earned + EXCLUDED.xp_earned,
          coins_earned = daily_limits.coins_earned + EXCLUDED.coins_earned,
          updated_at   = now()
        RETURNING xp_earned
      )
      SELECT
        (SELECT proceed FROM gate) AS proceed,
        (SELECT COUNT(*)::int FROM prog) AS prog_updated,
        (SELECT streak::int FROM streak_upsert) AS daily_streak,
        EXISTS (SELECT 1 FROM tok) AS token_inserted,
        (SELECT balance::int FROM coin_award) AS coin_balance,
        EXISTS (SELECT 1 FROM save_ledger) AS coin_saved,
        (SELECT xp::int FROM prog) AS xp,
        (SELECT amount::int FROM xp_award) AS xp_earned,
        (SELECT amount::int FROM coin_mint) AS coins_minted
    `)

    const row = rows[0]
    const proceed = row?.proceed !== false
    if (!proceed) {
      // Token replay (duplicate) YOKI user/progress yo'q — farqlaymiz:
      const existing = await this.findByUserId(userId)
      if (!existing) return { updated: false, dailyStreak: null, duplicate: false, coinBalance: null, coinSaved: false, xp: null, xpEarned: 0, coinsMinted: 0 }
      // Sabab: token berilgan-u, lekin tok'da YO'Q → allaqachon mavjud (replay).
      // Yangi token + gate bosilgan bo'lsa tok INSERT bo'lgan → 'gate'.
      const reason = token !== null && row?.token_inserted === false ? 'replay' : 'gate'
      return { updated: true, dailyStreak: null, duplicate: true, reason, coinBalance: null, coinSaved: false, xp: existing.xp ?? null, xpEarned: 0, coinsMinted: 0 }
    }
    const updated = Number(row?.prog_updated) > 0
    const streakRaw = row?.daily_streak
    const dailyStreak = streakRaw != null && Number.isFinite(Number(streakRaw)) ? Number(streakRaw) : (updated ? 1 : null)
    const coinBalance = row?.coin_balance != null ? Number(row.coin_balance) : null
    return {
      updated, dailyStreak, duplicate: false, coinBalance, coinSaved: row?.coin_saved === true,
      xp: row?.xp != null ? Number(row.xp) : null,
      xpEarned: row?.xp_earned != null ? Number(row.xp_earned) : 0,
      coinsMinted: row?.coins_minted != null ? Number(row.coins_minted) : 0,
    }
  },

  /** Oktagon (PvP) g'alabasi — WS server match yakunida chaqiradi (Yutuqlar uchun) */
  async addOctagonWin(userId: string): Promise<void> {
    await db.insert(progress).values({
      userId,
      octagonWins: 1,
      updatedAt: new Date(),
    }).onConflictDoUpdate({
      target: progress.userId,
      set: {
        octagonWins: sql`COALESCE(${progress.octagonWins}, 0) + 1`,
        updatedAt:   sql`now()`,
      },
    })
  },

  /**
   * Duel natijalarini yozish — har ishtirokchiga bitta qator (mehmonlar
   * chaqiruvchi tomonda filtrlanadi). Leaderboard `duelTop` kunlik/haftalik/
   * oylik reytingni shu jadvaldan agregatlaydi.
   *
   * Idempotent: (match_id, user_id) unique — endMatch va forfeit ikkalasi ham
   * ishga tushib qolsa, ikkinchisi jimgina tashlab yuboriladi.
   */
  async recordDuelResults(rows: DuelResultRow[]): Promise<void> {
    if (rows.length === 0) return
    await db.insert(duelResults).values(rows).onConflictDoNothing({
      target: [duelResults.matchId, duelResults.userId],
    })
  },

  /** Profil API uchun yechilgan savollar ro'yxati (`${subjectId}:${questionId}` format — client kontrakti o'zgarmaydi) */
  async listSolvedKeys(userId: string): Promise<string[]> {
    const rows = await executeRows<{ k: string }>(sql`
      SELECT subject_id || ':' || question_id AS k
      FROM progress_questions
      WHERE user_id = ${userId}
    `)
    return rows.map((r) => r.k)
  },

  async reset(userId: string): Promise<void> {
    // P2: progress_questions jadvali ham tozalanadi (jsonb ustunlar bilan birga)
    await executeRows(sql`DELETE FROM progress_questions WHERE user_id = ${userId}`)
    await db.update(progress).set({
      totalCorrect:    0,
      totalWrong:      0,
      totalAnswered:   0,
      streak:          0,
      wrongByTicket:   {},
      solvedQuestions: [],
      correctQuestions: [],
      updatedAt:       new Date(),
    }).where(eq(progress.userId, userId))
  },

  /**
   * SR dashboard xulosasi (FIXPLAN #46) — "bugun tayyorlar" soni va prognoz.
   * Bitta GROUP BY'siz aggregate scan (idx_card_user_subject): karta soni
   * savollar sonidan oshmaydi — arzon.
   */
  async getCardsSummary(userId: string, subjectId: string): Promise<{
    total: number; dueNow: number; dueNext24h: number; dueNext7d: number; avgEf: number | null
  }> {
    const rows = await executeRows<{
      total: number; dueNow: number; dueNext24h: number; dueNext7d: number; avgEf: number | null
    }>(sql`
      SELECT
        COUNT(*)::int AS "total",
        -- EKSKLYUZIV oynalar: dueNow + dueNext24h + dueNext7d = 7 kunlik jami
        -- (kumulativ bo'lsa UI'dagi uchala son qo'shilganda adashtirardi)
        COUNT(*) FILTER (WHERE due_at <= now())::int AS "dueNow",
        COUNT(*) FILTER (WHERE due_at > now() AND due_at <= now() + interval '24 hours')::int AS "dueNext24h",
        COUNT(*) FILTER (WHERE due_at > now() + interval '24 hours' AND due_at <= now() + interval '7 days')::int AS "dueNext7d",
        ROUND(AVG(ef)::numeric, 2)::float AS "avgEf"
      FROM card_progress
      WHERE user_id = ${userId} AND subject_id = ${subjectId}
    `)
    return rows[0] ?? { total: 0, dueNow: 0, dueNext24h: 0, dueNext7d: 0, avgEf: null }
  },

  /** Moslashuvchan rejim (Spaced Repetition) kartalarini yuklash */
  async getCards(userId: string, subjectId: string) {
    const { cardProgress } = await import('../../schema')
    const { and } = await import('drizzle-orm')
    return db
      .select({
        questionId: cardProgress.questionId,
        ef:         cardProgress.ef,
        interval:   cardProgress.interval,
        reps:       cardProgress.reps,
        dueAt:      cardProgress.dueAt,
      })
      .from(cardProgress)
      .where(and(eq(cardProgress.userId, userId), eq(cardProgress.subjectId, subjectId)))
  },

  /** Moslashuvchan rejim kartasini yangilash (upsert) */
  async upsertCard(input: {
    userId:     string
    subjectId:  string
    questionId: number
    ef:         number
    interval:   number
    reps:       number
    dueAt:      Date
  }): Promise<void> {
    const { cardProgress } = await import('../../schema')
    await db
      .insert(cardProgress)
      .values({
        userId:     input.userId,
        subjectId:  input.subjectId,
        questionId: input.questionId,
        ef:         input.ef,
        interval:   input.interval,
        reps:       input.reps,
        dueAt:      input.dueAt,
      })
      .onConflictDoUpdate({
        target: [cardProgress.userId, cardProgress.subjectId, cardProgress.questionId],
        set: {
          ef:        input.ef,
          interval:  input.interval,
          reps:      input.reps,
          dueAt:     input.dueAt,
          updatedAt: new Date(),
        },
      })
  },
}
