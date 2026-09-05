/**
 * Cron endpoint'lari — `Authorization: Bearer $CRON_SECRET` himoyali.
 *
 * VERCEL HOBBY CHEKLOVI: free plan'da FAQAT 2 cron slot — shuning uchun 4 job
 * ikkita FANOUT endpoint'ga birlashtirilgan (vercel.json):
 *   /api/cron/daily-suite  (har kuni 14:00 UTC)  → cleanup-answer-tokens → daily-reminder
 *   /api/cron/weekly-suite (dushanba 00:15 UTC)  → league-rollover → boss-rollover
 * Har komponent o'z tryStart/complete guard'iga ega (alohida idempotency —
 * suite ichidagi bitta komponent xatosi boshqasini to'xtatmaydi va qayta
 * ishlatish xavfsiz). Alohida endpoint'lar saqlanadi: manual trigger,
 * admin/debug va kelajakda Pro plan'da alohida schedule'ga qaytarish uchun.
 *
 * Muhim: bu router `telegramAuth`dan OLDIN mount qilinadi (bot foydalanuvchilari
 * emas — Vercel cron chaqiruvi), lekin CRON_SECRET'siz har qanday so'rov 401.
 */

import { Router } from 'express'
import { Bot, InlineKeyboard } from 'grammy'
import { config } from '../../config'
import { Sentry } from '../../utils/sentry'
import { requireCronSecret } from '../../middleware/cron-auth'
import { weekStartTashkent, LEAGUE_ORDER } from '../leaderboard/leaderboard.repository'
import { cronRepository } from './cron.repository'
import { distributeWeeklyPrizes } from '../leaderboard/tournament-prize.service'
import { bossRepository } from '../boss/boss.repository'
import { bossPeriodKey } from '../../../shared/boss-battle'
import { decideStreakOutcome, STREAK_SAVE_COST } from '../../../shared/streak-save'

const router = Router()

router.use('/cron', requireCronSecret)

const APP_URL = `${config.deploy.appUrl}?v=${config.deploy.buildId}`

/** 'YYYY-MM-DD' — Asia/Tashkent (foydalanuvchi vaqt zonasi) */
function tashkentDate(daysAgo = 0): string {
  const d = new Date(Date.now() - daysAgo * 86_400_000)
  return d.toLocaleDateString('sv-SE', { timeZone: 'Asia/Tashkent' })
}

interface CronRunResult { status: number; body: Record<string, unknown> }

// ── Job implementatsiyalari (handler'lardan ajratilgan — suite fanout ham
//    shularni chaqiradi) ───────────────────────────────────────────────────

/** Kunlik eslatma (19:00 Toshkent = 14:00 UTC).
 *  Kimlarga: so'nggi 14 kunda faol VA bugun hali faol bo'lmagan TG-linkli userlar. */
async function runDailyReminder(): Promise<CronRunResult> {
  const token = config.telegram.botToken
  if (!token) {
    return { status: 500, body: { ok: false, error: 'BOT_TOKEN not set' } }
  }

  const today  = tashkentDate()
  const acquired = await cronRepository.tryStart('daily-reminder', today)
  if (!acquired) {
    return { status: 200, body: { ok: true, skipped: true, reason: 'already_started_or_completed', date: today } }
  }

  try {
    const cutoff = tashkentDate(14)

    // So'nggi 14 kunda faol foydalanuvchilar
    const recent = await cronRepository.listRecentActiveUserIds(cutoff)

    // Bugun allaqachon faol — ularga eslatma kerak emas
    const done = await cronRepository.listActiveOnDate(today)

    // FAQAT Telegram-linked userlar (raqam-string id) — telefon+parol akkauntlarida
    // ('p_<digits>') TG chat yo'q, ularga SMS yog'och emas: xabar yuborib bo'lmaydi.
    const targets = [...new Set(recent)]
      .filter((uid) => !done.has(uid) && /^\d+$/.test(uid))

    // Personalized: har userning eng uzun streak'i (xabarga kiritiladi)
    const streakOf = await cronRepository.topStreaksForUsers(targets)
    // Streak coin-save: bugun ham o'tkazib yuborilsa nima bo'lishini oldindan
    // ogohlantirish (foydalanuvchi coin avtomatik yechilishini bilishi shart).
    const riskOf = await cronRepository.streakSaveRiskForUsers(targets, today)

    const bot = new Bot(token)
    const keyboard = () => new InlineKeyboard().webApp('🔥 Mashqni boshlash', APP_URL)
    const coinSaveWarning = (uid: string): string => {
      const risk = riskOf.get(uid)
      if (!risk) return ''
      const outcome = decideStreakOutcome({
        gapDays: risk.gapDaysTomorrow, premium: risk.premium, balance: risk.balance,
      })
      if (outcome === 'coin_save') {
        return `\n\n🧊 Bugun ham mashq qilmasangiz, ${STREAK_SAVE_COST} coin evaziga seriyangiz saqlanadi.`
      }
      if (outcome === 'reset' && risk.gapDaysTomorrow <= 1) {
        // Faqat hali "saqlab qolish mumkin edi" bosqichida foydali — coin
        // yetishmasa aynan shu ogohlantirish sabab bo'lib qolishi mumkin.
        // gapDaysTomorrow > 1 bo'lsa allaqachon kech — foydasiz xabar.
        return `\n\n⚠️ Balansingizda ${STREAK_SAVE_COST} coin yo'q — seriyangiz saqlanmaydi, 0 ga tushadi.`
      }
      return ''
    }
    const textFor = (uid: string) => {
      const s = streakOf.get(uid) ?? 0
      if (s > 0) {
        return (
          `🔥 ${s} kunlik seriyangiz xavf ostida!\n\n` +
          `Bugun hali mashq qilmadingiz — 2 daqiqalik test seriyangizni saqlab qoladi. ` +
          `1 kun o'tkazilsa intizom 0 ga tushadi!` +
          coinSaveWarning(uid)
        )
      }
      return (
        `🔥 Bugungi mashqni qolmang!\n\n` +
        `2 daqiqalik kichik test — katta natijaga birinchi qadam. ` +
        `Har kuni 1 savol = intizom seriyasi!`
      )
    }

    // Checkpoint-resume (audit H-6): 30s maxDuration'dan oshib function o'ldirilsa,
    // stale-lease retry BARCHA target'larga QAYTA yuborardi (dublikat spam).
    // Oldingi run'ning {offset, sent...} checkpoint'idan davom etamiz — har batch
    // DB'ga yoziladi, retry faqat qolganidan boshlaydi.
    const prevRun = await cronRepository.getRunDetails('daily-reminder', today)
    let sent    = Number(prevRun['sent']    ?? 0)
    let blocked = Number(prevRun['blocked'] ?? 0)
    let failed  = Number(prevRun['failed']  ?? 0)
    const startOffset = Math.min(Number(prevRun['offset'] ?? 0), targets.length)

    // Telegram limiti (~30 msg/s) uchun 20 talik batch'lar (har userga personalized matn)
    for (let i = startOffset; i < targets.length; i += 20) {
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
      await cronRepository.saveCheckpoint('daily-reminder', today, {
        offset: i + batch.length, sent, blocked, failed,
      })
    }

    const result = { date: today, targets: targets.length, sent, blocked, failed }
    await cronRepository.complete('daily-reminder', today, result)
    return { status: 200, body: { ok: true, ...result } }
  } catch (err) {
    console.error('[daily-reminder] failed — stale-lease (1 soat) keyingi urinishga ruxsat beradi:', err)
    Sentry.captureException(err, { tags: { cron: 'daily-reminder', period: today } })
    return { status: 500, body: { ok: false, error: String(err) } }
  }
}

/** Haftalik LIGA rollover: TOP 30% yuqoriga, PASTKI 30%/nofaollar pastga
 *  (bronze → silver → gold → platinum) + turnir mukofotlari. */
async function runLeagueRollover(): Promise<CronRunResult> {
  const wThis = weekStartTashkent()    // joriy hafta boshi (yangi liga davri)
  const wPrev = weekStartTashkent(1)   // natija olingan hafta boshi
  const acquired = await cronRepository.tryStart('league-rollover', wPrev)
  if (!acquired) {
    return { status: 200, body: { ok: true, skipped: true, reason: 'already_started_or_completed', prevWeekStart: wPrev } }
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
    let plan = await cronRepository.loadRolloverPlan(wPrev)

    let evaluated = 0
    if (plan.length === 0) {
      const rows = await cronRepository.leagueWeekScores(wPrev, wThis)

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
          .sort((a, b) => (Number(b.score) - Number(a.score)) || a.userId.localeCompare(b.userId))

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
        await cronRepository.persistRolloverPlan(computed, wPrev)
        plan = computed
      }
    }

    // 2) APPLY — har UPDATE JORIY liga plan'dagi `from`ga teng bo'lgandagina yuradi
    // (guard): bajarilganlari idempotent skip; chunked (50/batch) fan-out bo'ronini oldini oladi (M-7)
    let appliedCount = 0
    const CHUNK_SIZE = 50
    for (let i = 0; i < plan.length; i += CHUNK_SIZE) {
      const chunk = plan.slice(i, i + CHUNK_SIZE)
      const applied = await Promise.all(chunk.map((p) =>
        cronRepository.applyLeagueChange(p.userId, p.fromLeague, p.toLeague)
      ))
      appliedCount += applied.reduce((sum, n) => sum + n, 0)
    }

    const promoted = plan.filter((p) => lvl(p.toLeague) > lvl(p.fromLeague)).length
    const demoted  = plan.filter((p) => lvl(p.toLeague) < lvl(p.fromLeague)).length
    // Haftalik turnir g'oliblariga avtomatik Premium sovg'alarini berish va tabriknoma jo'natish (H-1: await before complete)
    let prizeResult: any = { winners: [] }
    try {
      prizeResult = await distributeWeeklyPrizes(wPrev)
      console.log(`[league-rollover] Tournament prizes distributed for ${wPrev}: ${prizeResult.winners.length} winners`)
    } catch (e) {
      console.error('[league-rollover] tournament prizes error:', e)
      Sentry.captureException(e, { tags: { cron: 'league-rollover', stage: 'tournament-prizes', period: wPrev } })
    }

    const result = { prevWeekStart: wPrev, users: evaluated, planned: plan.length, applied: appliedCount, promoted, demoted, prizesAwarded: prizeResult.winners?.length ?? 0 }
    await cronRepository.complete('league-rollover', wPrev, result)
    return { status: 200, body: { ok: true, ...result } }
  } catch (err) {
    // RETRY-SAFE: davr 'completed'ga BELGILANMAYDI — jobRuns 'running' qoladi,
    // stale-lease (1 soat) o'tgach keyingi trigger reja jurnalidan davom etadi.
    // (Eski xatti-harakat: catch'da complete → qisman liga holati bir haftaga qotardi.)
    console.error('[league-rollover] failed — stale-lease (1 soat) keyingi urinishga ruxsat beradi:', err)
    Sentry.captureException(err, { tags: { cron: 'league-rollover', period: wPrev } })
    return { status: 500, body: { ok: false, error: String(err) } }
  }
}

/** BOSS BATTLE haftalik rollover: o'tgan hafta bossi active→escaped yoki
 *  defeated→mukofotlar (atomik CTE, ledger UNIQUE) + yangi hafta bossi. */
async function runBossRollover(): Promise<CronRunResult> {
  const curPeriod  = bossPeriodKey()
  // O'tgan hafta: periodKey'ni 7 kun qaytarib
  const prevDate = new Date(`${curPeriod}T00:00:00Z`)
  prevDate.setUTCDate(prevDate.getUTCDate() - 7)
  const prevPeriod = prevDate.toISOString().slice(0, 10)

  const acquired = await cronRepository.tryStart('boss-rollover', prevPeriod)
  if (!acquired) {
    return { status: 200, body: { ok: true, skipped: true, reason: 'already_started_or_completed', prevPeriod } }
  }

  try {
    const roll = await bossRepository.weeklyRollover(prevPeriod)
    // Yangi hafta bossi (getState/applyDamage lazy ham yaratadi — bu yerda proaktiv)
    await bossRepository.ensureActiveBoss(curPeriod)
    const result = { prevPeriod, curPeriod, ...roll }
    await cronRepository.complete('boss-rollover', prevPeriod, result)
    return { status: 200, body: { ok: true, ...result } }
  } catch (err) {
    // RETRY-SAFE: complete BELGILANMAYDI (league-rollover pattern'i) — stale-lease
    // (1 soat) o'tgach re-run; mukofot CTE ledger-UNIQUE bilan qayta xavfsiz.
    console.error('[boss-rollover] failed — stale-lease retry:', err)
    Sentry.captureException(err, { tags: { cron: 'boss-rollover', period: prevPeriod } })
    return { status: 500, body: { ok: false, error: String(err) } }
  }
}

/** answer_tokens cleanup: 7 kundan eski idempotency token'lari + retention
 *  (rate_limits, analytics, sessions, otp, email/pwd tokenlar, history, audit). */
async function runCleanup(): Promise<CronRunResult> {
  const today = tashkentDate()
  const acquired = await cronRepository.tryStart('cleanup-answer-tokens', today)
  if (!acquired) {
    return { status: 200, body: { ok: true, skipped: true, reason: 'already_started_or_completed', date: today } }
  }

  try {
    const result = await cronRepository.cleanupExpired()

    await cronRepository.complete('cleanup-answer-tokens', today, {
      deleted: result.deleted,
      rateLimitsDeleted: result.rateLimitsDeleted,
      analyticsDeleted: result.analyticsDeleted,
      tgCodesDeleted: result.tgCodesDeleted,
      linkCodesDeleted: result.linkCodesDeleted,
      sessionsDeleted: result.sessionsDeleted,
      otpDeleted: result.otpDeleted,
      emailTokensDeleted: result.emailTokensDeleted,
      pwdTokensDeleted: result.pwdTokensDeleted,
      loginHistoryDeleted: result.loginHistoryDeleted,
      auditLogsDeleted: result.auditLogsDeleted,
    })
    return { status: 200, body: { ok: true, ...result } }
  } catch (err) {
    await cronRepository.complete('cleanup-answer-tokens', today, { error: String(err) }).catch(() => {})
    Sentry.captureException(err, { tags: { cron: 'cleanup-answer-tokens', period: today } })
    return { status: 500, body: { ok: false, error: String(err) } }
  }
}

/**
 * Yopiq VIP guruhlardan obunasi tugagan foydalanuvchilarni chiqarish.
 * Har kuni daily-suite tarkibida bajariladi.
 * Obunasi tugaganlarni ban qilib darhol unban qiladi (kicked, lekin blacklist'siz — qayta obunada kira oladi).
 */
async function runVipExpiredCleanup(): Promise<CronRunResult> {
  const token = config.telegram.botToken
  if (!token) {
    return { status: 500, body: { ok: false, error: 'BOT_TOKEN is unset' } }
  }

  const today = tashkentDate()
  const started = await cronRepository.tryStart('vip-expired-cleanup', today)
  if (!started) {
    return { status: 200, body: { ok: true, skipped: 'already_running_or_done' } }
  }

  const bot = new Bot(token)
  let kickedCount = 0

  try {
    const { SUBJECT_BASES, getSubjectTelegramChatId } = await import('../../../shared/subjects')
    const { db } = await import('../../db/connection')
    const { users } = await import('../../schema')
    const { and, or, isNull, lt, ne } = await import('drizzle-orm')

    // Barcha sozlangan yopiq guruhlar
    const groupChatIds: string[] = []
    for (const s of SUBJECT_BASES) {
      const chatId = (config.groups as Record<string, string | undefined>)?.[s.id] || getSubjectTelegramChatId(s.id)
      if (chatId && !groupChatIds.includes(chatId)) {
        groupChatIds.push(chatId)
      }
    }

    if (groupChatIds.length === 0) {
      await cronRepository.complete('vip-expired-cleanup', today, { kicked: 0, reason: 'no_groups' })
      return { status: 200, body: { ok: true, kicked: 0, reason: 'no_groups' } }
    }

    // Obunasi yo'q yoki tugagan foydalanuvchilar
    const now = new Date()
    const expiredUsers = await db
      .select({ id: users.id })
      .from(users)
      .where(
        and(
          ne(users.tariff, 'premium'),
          or(isNull(users.premiumUntil), lt(users.premiumUntil, now)),
        )
      )

    for (const u of expiredUsers) {
      const uidNum = Number(u.id)
      if (isNaN(uidNum) || uidNum <= 0) continue

      for (const chatId of groupChatIds) {
        const chatIdNum = Number(chatId) || chatId
        try {
          const member = await bot.api.getChatMember(chatIdNum, uidNum)
          if (member && member.status === 'member') {
            // Guruhdan chiqarish: ban + darhol unban (blacklist qolmaydi)
            await bot.api.banChatMember(chatIdNum, uidNum)
            await bot.api.unbanChatMember(chatIdNum, uidNum)
            kickedCount++
          }
        } catch {
          // User bu guruhda yo'q yoki bot ruxsati cheklangan
        }
      }
    }

    await cronRepository.complete('vip-expired-cleanup', today, { kicked: kickedCount })
    return { status: 200, body: { ok: true, kicked: kickedCount } }
  } catch (err) {
    await cronRepository.complete('vip-expired-cleanup', today, { error: String(err) }).catch(() => {})
    Sentry.captureException(err, { tags: { cron: 'vip-expired-cleanup', period: today } })
    return { status: 500, body: { ok: false, error: String(err) } }
  }
}

// ── FANOUT SUITE'lar (Vercel Hobby: 2 cron slot) ────────────────────────────

/**
 * /api/cron/daily-suite — har kuni 14:00 UTC (19:00 Toshkent).
 * cleanup → vip-cleanup → daily-reminder. Komponent xatosi keyingisini to'xtatmaydi,
 * lekin biron komponent yiqilsa suite 500 va ok: false qaytaradi (ID 14).
 */
router.get('/cron/daily-suite', async (_req, res) => {
  const results: Record<string, unknown> = {}
  let hasFailure = false
  for (const [name, run] of [
    ['cleanup-answer-tokens', runCleanup],
    ['vip-expired-cleanup', runVipExpiredCleanup],
    ['daily-reminder', runDailyReminder],
  ] as const) {
    try {
      const resRun = await run()
      results[name] = resRun.body
      if (resRun.status >= 400 || (resRun.body as { ok?: boolean })?.ok === false) {
        hasFailure = true
      }
    } catch (err) {
      hasFailure = true
      Sentry.captureException(err, { tags: { cron: 'daily-suite', stage: name } })
      results[name] = { ok: false, error: String(err) }
    }
  }
  const statusCode = hasFailure ? 500 : 200
  res.status(statusCode).json({ ok: !hasFailure, suite: 'daily', ...results })
})

/**
 * /api/cron/weekly-suite — dushanba 00:15 UTC.
 * league-rollover → boss-rollover. Biron komponent yiqilsa suite 500 va ok: false qaytaradi (ID 14).
 */
router.get('/cron/weekly-suite', async (_req, res) => {
  const results: Record<string, unknown> = {}
  let hasFailure = false
  for (const [name, run] of [['league-rollover', runLeagueRollover], ['boss-rollover', runBossRollover]] as const) {
    try {
      const resRun = await run()
      results[name] = resRun.body
      if (resRun.status >= 400 || (resRun.body as { ok?: boolean })?.ok === false) {
        hasFailure = true
      }
    } catch (err) {
      hasFailure = true
      Sentry.captureException(err, { tags: { cron: 'weekly-suite', stage: name } })
      results[name] = { ok: false, error: String(err) }
    }
  }
  const statusCode = hasFailure ? 500 : 200
  res.status(statusCode).json({ ok: !hasFailure, suite: 'weekly', ...results })
})

// ── Alohida endpoint'lar — manual trigger / admin / debug.
//    (Vercel PRO'ga ko'chilsa, vercel.json'da alohida schedule'ga qaytariladi.)
// Vercel Cron scheduled requests use GET; secret middleware is the trust boundary.

router.get('/cron/daily-reminder', async (_req, res) => {
  const r = await runDailyReminder()
  res.status(r.status).json(r.body)
})

router.get('/cron/league-rollover', async (_req, res) => {
  const r = await runLeagueRollover()
  res.status(r.status).json(r.body)
})

router.get('/cron/boss-rollover', async (_req, res) => {
  const r = await runBossRollover()
  res.status(r.status).json(r.body)
})

router.get('/cron/cleanup-answer-tokens', async (_req, res) => {
  const r = await runCleanup()
  res.status(r.status).json(r.body)
})

router.get('/cron/vip-expired-cleanup', async (_req, res) => {
  const r = await runVipExpiredCleanup()
  res.status(r.status).json(r.body)
})

export default router
