/**
 * Vercel Cron — kunlik eslatma (har kuni soat 19:00 Toshkent = 14:00 UTC).
 *
 * Kimlar yuboriladi:
 *  - so'nggi 14 kunda faol bo'lgan (daily_records'da yozuvi bor) VA
 *  - bugun hali faol bo'lmagan foydalanuvchilar.
 *
 * Himoya: `Authorization: Bearer $CRON_SECRET` (Vercel cron avtomatik yuboradi;
 * manual trigger ham shu secret bilan ishlaydi).
 *
 * Muhim: bu router `telegramAuth`dan OLDIN mount qilinadi (bot foydalanuvchilari
 * emas — Vercel cron chaqiruvi), lekin CRON_SECRET'siz har qanday so'rov 401.
 */

import { Router } from 'express'
import { Bot, InlineKeyboard } from 'grammy'
import { gte, eq, and, lt, sql, inArray } from 'drizzle-orm'
import { db } from '../../db/connection'
import { dailyRecords, progress, dailyStreaks, answerTokens, leagueRolloverLog, rateLimits } from '../../schema'
import { config } from '../../config'
import { requireCronSecret } from '../../middleware/cron-auth'
import { weekStartTashkent, LEAGUE_ORDER } from '../leaderboard/leaderboard.repository'
import { cronRepository } from './cron.repository'
import { distributeWeeklyPrizes } from '../leaderboard/tournament-prize.service'

const router = Router()

router.use('/cron', requireCronSecret)

const APP_URL = `${config.deploy.appUrl}?v=${config.deploy.buildId}`

/** 'YYYY-MM-DD' — Asia/Tashkent (foydalanuvchi vaqt zonasi) */
function tashkentDate(daysAgo = 0): string {
  const d = new Date(Date.now() - daysAgo * 86_400_000)
  return d.toLocaleDateString('sv-SE', { timeZone: 'Asia/Tashkent' })
}

// Vercel Cron scheduled requests use GET; secret middleware is the trust boundary.
router.get('/cron/daily-reminder', async (_req, res) => {
  const token = config.telegram.botToken
  if (!token) {
    res.status(500).json({ error: 'BOT_TOKEN not set' })
    return
  }

  const today  = tashkentDate()
  const acquired = await cronRepository.tryStart('daily-reminder', today)
  if (!acquired) {
    res.json({ ok: true, skipped: true, reason: 'already_started_or_completed', date: today })
    return
  }

  try {
    const cutoff = tashkentDate(14)

    // So'nggi 14 kunda faol foydalanuvchilar
    const recent = await db
      .selectDistinct({ userId: dailyRecords.userId })
      .from(dailyRecords)
      .where(gte(dailyRecords.date, cutoff))

    // Bugun allaqachon faol — ularga eslatma kerak emas
    const activeToday = await db
      .selectDistinct({ userId: dailyRecords.userId })
      .from(dailyRecords)
      .where(eq(dailyRecords.date, today))

    const done = new Set(activeToday.map((r) => r.userId))
    // FAQAT Telegram-linked userlar (raqam-string id) — telefon+parol akkauntlarida
    // ('p_<digits>') TG chat yo'q, ularga SMS yog'och emas: xabar yuborib bo'lmaydi.
    const targets = [...new Set(recent.map((r) => r.userId))]
      .filter((uid) => !done.has(uid) && /^\d+$/.test(uid))

    // Personalized: har userning eng uzun streak'i (xabarga kiritiladi)
    const streakRows = targets.length > 0
      ? await db.select({ userId: dailyStreaks.userId, streak: sql<number>`MAX(${dailyStreaks.streak})` })
          .from(dailyStreaks)
          .where(inArray(dailyStreaks.userId, targets))
          .groupBy(dailyStreaks.userId)
      : []
    const streakOf = new Map(streakRows.map((r) => [r.userId, Number(r.streak)]))

    const bot = new Bot(token)
    const keyboard = () => new InlineKeyboard().webApp('🔥 Mashqni boshlash', APP_URL)
    const textFor = (uid: string) => {
      const s = streakOf.get(uid) ?? 0
      if (s > 0) {
        return (
          `🔥 ${s} kunlik seriyangiz xavf ostida!\n\n` +
          `Bugun hali mashq qilmadingiz — 2 daqiqalik test seriyangizni saqlab qoladi. ` +
          `1 kun o'tkazilsa intizom 0 ga tushadi!`
        )
      }
      return (
        `🔥 Bugungi mashqni qolmang!\n\n` +
        `2 daqiqalik kichik test — katta natijaga birinchi qadam. ` +
        `Har kuni 1 savol = intizom seriyasi!`
      )
    }

    let sent = 0, blocked = 0, failed = 0
    // Telegram limiti (~30 msg/s) uchun 20 talik batch'lar (har userga personalized matn)
    for (let i = 0; i < targets.length; i += 20) {
      const batch = targets.slice(i, i + 20)
      const results = await Promise.allSettled(
        batch.map((uid) => bot.api.sendMessage(Number(uid), textFor(uid), { reply_markup: keyboard() })),
      )
      for (const r of results) {
        if (r.status === 'fulfilled') sent++
        else {
          const desc = String(r.reason?.description ?? r.reason)
          if (desc.includes('bot was blocked') || desc.includes('chat not found')) blocked++
          else failed++
        }
      }
    }

    const result = { date: today, targets: targets.length, sent, blocked, failed }
    await cronRepository.complete('daily-reminder', today, result)
    res.json({ ok: true, ...result })
  } catch (err) {
    await cronRepository.complete('daily-reminder', today, { error: String(err) }).catch(() => {})
    res.status(500).json({ ok: false, error: String(err) })
  }
})

/**
 * Vercel Cron — haftalik LIGA rollover (har dushanba 00:15 UTC).
 * O'tgan hafta ball asosida: har ligada TOP 30% → bir daraja YUQORIga,
 * PASTKI 30% va umuman nofaollar → bir daraja PASTGA.
 * Duolingo uslubi: bronze → silver → gold → platinum.
 */
router.get('/cron/league-rollover', async (_req, res) => {
  const wThis = weekStartTashkent()    // joriy hafta boshi (yangi liga davri)
  const wPrev = weekStartTashkent(1)   // natija olingan hafta boshi
  const acquired = await cronRepository.tryStart('league-rollover', wPrev)
  if (!acquired) {
    res.json({ ok: true, skipped: true, reason: 'already_started_or_completed', prevWeekStart: wPrev })
    return
  }

  const lvl = (l: string) => {
    const idx = LEAGUE_ORDER.indexOf(l as typeof LEAGUE_ORDER[number])
    return Math.max(0, idx)  // Safety: invalid leagues default to 0 (bronze)
  }
  const up   = (l: string) => LEAGUE_ORDER[Math.min(LEAGUE_ORDER.length - 1, lvl(l) + 1)]
  const down = (l: string) => LEAGUE_ORDER[Math.max(0, lvl(l) - 1)]

  try {
    // 1) REJA — bu davr uchun allaqachon jurnalga yozilganmi? Crash'dan keyingi
    // davom REJALASHTIRISHNI SKIP qiladi (aolda jarayon qayta-promote/demote
    // kaskadiga olib kelardi: qayta ishga tushish JORIY liga'dan qayta hisoblardi).
    let plan = await db.select({
      userId:     leagueRolloverLog.userId,
      fromLeague: leagueRolloverLog.fromLeague,
      toLeague:   leagueRolloverLog.toLeague,
    }).from(leagueRolloverLog).where(eq(leagueRolloverLog.periodKey, wPrev))

    let evaluated = 0
    if (plan.length === 0) {
      const rows = await db.select({
        userId: progress.userId,
        league: progress.league,
        score:  sql<number>`COALESCE(SUM(${dailyRecords.correct}), 0)`,
      }).from(progress)
        .leftJoin(dailyRecords, and(
          eq(dailyRecords.userId, progress.userId),
          gte(dailyRecords.date, wPrev),
          lt(dailyRecords.date, wThis),
        ))
        .groupBy(progress.userId, progress.league)

      // Normalize invalid leagues to bronze and log data quality issues
      const validLeagues = new Set(LEAGUE_ORDER)
      const normalized = rows.map(r => {
        const league = r.league || 'bronze'
        if (!validLeagues.has(league as typeof LEAGUE_ORDER[number])) {
          console.warn(`[league-rollover] Invalid league "${league}" for user ${r.userId}, normalizing to bronze`)
          return { ...r, league: 'bronze' as const }
        }
        return { ...r, league: league as typeof LEAGUE_ORDER[number] }
      })
      evaluated = normalized.length

      const computed: Array<{ userId: string; fromLeague: string; toLeague: string }> = []
      for (const league of LEAGUE_ORDER) {
        const inLeague = normalized.filter((r) => r.league === league)
        const active   = inLeague.filter((r) => Number(r.score) > 0)
          .sort((a, b) => Number(b.score) - Number(a.score))

        const n        = active.length
        const promoteN = n >= 2 ? Math.max(1, Math.round(n * 0.3)) : 0
        const demoteN  = n >= 3 ? Math.max(1, Math.round(n * 0.3)) : 0

        active.forEach((r, i) => {
          const currentLevel = lvl(r.league)
          // Check promotion boundary first
          if (i < promoteN && currentLevel < LEAGUE_ORDER.length - 1) {
            const targetLeague = up(r.league)
            if (targetLeague !== r.league) computed.push({ userId: r.userId, fromLeague: r.league, toLeague: targetLeague })
          }
          // Check demotion boundary
          else if (i >= n - demoteN && currentLevel > 0) {
            const targetLeague = down(r.league)
            if (targetLeague !== r.league) computed.push({ userId: r.userId, fromLeague: r.league, toLeague: targetLeague })
          }
        })

        // Umuman nofaol (0 ball) — liga Bronze'dan yuqori bo'lsa tushadi
        for (const r of inLeague.filter((x) => Number(x.score) === 0)) {
          const currentLevel = lvl(r.league)
          if (currentLevel > 0) {
            const targetLeague = down(r.league)
            if (targetLeague !== r.league) computed.push({ userId: r.userId, fromLeague: r.league, toLeague: targetLeague })
          }
        }
      }

      // Rejani BITTA atomik statement'da saqlaymiz — keyingi APPLY bosqichi
      // crash'ga tushsa, qayta ishga tushirish SHU rejadan davom etadi.
      if (computed.length > 0) {
        await db.insert(leagueRolloverLog)
          .values(computed.map((c) => ({ userId: c.userId, periodKey: wPrev, fromLeague: c.fromLeague, toLeague: c.toLeague })))
          .onConflictDoNothing()
        plan = computed
      }
    }

    // 2) APPLY — har UPDATE JORIY liga plan'dagi `from`ga teng bo'lgandagina yuradi
    // (guard): bajarilganlari idempotent skip; parallel CRON/apply ikki marta yozmaydi.
    const applied = await Promise.all(plan.map((p) =>
      db.update(progress)
        .set({ league: p.toLeague, updatedAt: new Date() })
        .where(and(eq(progress.userId, p.userId), eq(progress.league, p.fromLeague)))
        .returning({ id: progress.userId })
    ))
    const appliedCount = applied.reduce((sum, rows) => sum + rows.length, 0)

    const promoted = plan.filter((p) => lvl(p.toLeague) > lvl(p.fromLeague)).length
    const demoted  = plan.filter((p) => lvl(p.toLeague) < lvl(p.fromLeague)).length
    const result = { prevWeekStart: wPrev, users: evaluated, planned: plan.length, applied: appliedCount, promoted, demoted }
    await cronRepository.complete('league-rollover', wPrev, result)
    // Haftalik turnir g'oliblariga avtomatik Premium sovg'alarini berish va tabriknoma jo'natish
    distributeWeeklyPrizes(wPrev)
      .then((res) => console.log(`[league-rollover] Tournament prizes distributed for ${wPrev}: ${res.winners.length} winners`))
      .catch((e) => console.error('[league-rollover] tournament prizes error:', e))
    res.json({ ok: true, ...result })
  } catch (err) {
    // RETRY-SAFE: davr 'completed'ga BELGILANMAYDI — jobRuns 'running' qoladi,
    // stale-lease (1 soat) o'tgach keyingi trigger reja jurnalidan davom etadi.
    // (Eski xatti-harakat: catch'da complete → qisman liga holati bir haftaga qotardi.)
    console.error('[league-rollover] failed — stale-lease (1 soat) keyingi urinishga ruxsat beradi:', err)
    res.status(500).json({ ok: false, error: String(err) })
  }
})

/**
 * Vercel Cron — answer_tokens cleanup (har kecha 02:00 UTC).
 * Idempotency token'lari cheksiz o'sib ketmasligi uchun 7 kundan eski
 * qatorlarni o'chiradi. Har replay o'sha paytda yaratilgan token bilan
 * keladi — 7 kun ichida kelmaydigan replay unlikely (client davra yozib beradi).
 */
router.get('/cron/cleanup-answer-tokens', async (_req, res) => {
  const today = tashkentDate()
  const acquired = await cronRepository.tryStart('cleanup-answer-tokens', today)
  if (!acquired) {
    res.json({ ok: true, skipped: true, reason: 'already_started_or_completed', date: today })
    return
  }

  try {
    const cutoff = new Date(Date.now() - 7 * 86_400_000)
    const result = await db.delete(answerTokens).where(lt(answerTokens.createdAt, cutoff))
    const deleted = result.rowCount ?? 0

    // rate_limits counter'lari: oynasi 1 soat+ eskirganlar (multi-instance limiter)
    const rlCutoff = new Date(Date.now() - 3_600_000)
    const rlResult = await db.delete(rateLimits).where(lt(rateLimits.windowStart, rlCutoff))
    const rateLimitsDeleted = rlResult.rowCount ?? 0

    await cronRepository.complete('cleanup-answer-tokens', today, { deleted, rateLimitsDeleted })
    res.json({ ok: true, deleted, rateLimitsDeleted, cutoff: cutoff.toISOString() })
  } catch (err) {
    await cronRepository.complete('cleanup-answer-tokens', today, { error: String(err) }).catch(() => {})
    res.status(500).json({ ok: false, error: String(err) })
  }
})

export default router
