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
import { gte, eq, and, lt, sql } from 'drizzle-orm'
import { db } from '../../db/connection'
import { dailyRecords, progress } from '../../schema'
import { config } from '../../config'
import { weekStartTashkent, LEAGUE_ORDER } from '../leaderboard/leaderboard.repository'

const router = Router()

const BASE_URL = process.env['APP_URL'] ?? 'https://yhq-mini-app.vercel.app'
const BUILD_ID = (process.env['VERCEL_GIT_COMMIT_SHA'] ?? 'v1').slice(0, 8)
const APP_URL  = `${BASE_URL}?v=${BUILD_ID}`

/** 'YYYY-MM-DD' — Asia/Tashkent (foydalanuvchi vaqt zonasi) */
function tashkentDate(daysAgo = 0): string {
  const d = new Date(Date.now() - daysAgo * 86_400_000)
  return d.toLocaleDateString('sv-SE', { timeZone: 'Asia/Tashkent' })
}

router.all('/cron/daily-reminder', async (req, res) => {
  const secret = process.env['CRON_SECRET']
  if (secret && req.headers.authorization !== `Bearer ${secret}`) {
    res.status(401).json({ error: 'unauthorized' })
    return
  }
  const token = config.telegram.botToken
  if (!token) {
    res.status(500).json({ error: 'BOT_TOKEN not set' })
    return
  }

  const today  = tashkentDate()
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
  const targets = [...new Set(recent.map((r) => r.userId))].filter((uid) => !done.has(uid))

  const bot = new Bot(token)
  const keyboard = () => new InlineKeyboard().webApp('🔥 Mashqni boshlash', APP_URL)
  const text =
    `🔥 Kunlik seriyangizni yo'qotmang!\n\n` +
    `Bugun hali mashq qilmadingiz — 2 daqiqalik test seriyangizni davom ettiradi. ` +
    `1 kun o'tkazilsa intizom 0 ga tushadi!`

  let sent = 0, blocked = 0, failed = 0
  // Telegram limiti (~30 msg/s) uchun 20 talik batch'lar
  for (let i = 0; i < targets.length; i += 20) {
    const batch = targets.slice(i, i + 20)
    const results = await Promise.allSettled(
      batch.map((uid) => bot.api.sendMessage(Number(uid), text, { reply_markup: keyboard() })),
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

  res.json({ ok: true, date: today, targets: targets.length, sent, blocked, failed })
})

/**
 * Vercel Cron — haftalik LIGA rollover (har dushanba 00:15 UTC).
 * O'tgan hafta ball asosida: har ligada TOP 30% → bir daraja YUQORIga,
 * PASTKI 30% va umuman nofaollar → bir daraja PASTGA.
 * Duolingo uslubi: bronze → silver → gold → platinum.
 */
router.all('/cron/league-rollover', async (req, res) => {
  const secret = process.env['CRON_SECRET']
  if (secret && req.headers.authorization !== `Bearer ${secret}`) {
    res.status(401).json({ error: 'unauthorized' })
    return
  }

  const wThis = weekStartTashkent()    // joriy hafta boshi (yangi liga davri)
  const wPrev = weekStartTashkent(1)   // natija olingan hafta boshi

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

  const lvl = (l: string) => Math.max(0, LEAGUE_ORDER.indexOf(l as typeof LEAGUE_ORDER[number]))
  const up   = (l: string) => LEAGUE_ORDER[Math.min(LEAGUE_ORDER.length - 1, lvl(l) + 1)]
  const down = (l: string) => LEAGUE_ORDER[Math.max(0, lvl(l) - 1)]

  let promoted = 0, demoted = 0
  const updates: Promise<unknown>[] = []

  for (const league of LEAGUE_ORDER) {
    const inLeague = rows.filter((r) => (r.league || 'bronze') === league)
    const active   = inLeague.filter((r) => Number(r.score) > 0)
      .sort((a, b) => Number(b.score) - Number(a.score))

    const n        = active.length
    const promoteN = n >= 2 ? Math.max(1, Math.round(n * 0.3)) : 0
    const demoteN  = n >= 3 ? Math.max(1, Math.round(n * 0.3)) : 0

    active.forEach((r, i) => {
      if (i < promoteN && lvl(r.league) < LEAGUE_ORDER.length - 1) {
        promoted++
        updates.push(db.update(progress).set({ league: up(r.league), updatedAt: new Date() })
          .where(eq(progress.userId, r.userId)))
      } else if (i >= n - demoteN && lvl(r.league) > 0) {
        demoted++
        updates.push(db.update(progress).set({ league: down(r.league), updatedAt: new Date() })
          .where(eq(progress.userId, r.userId)))
      }
    })

    // Umuman nofaol (0 ball) — bilanliga Bronze'dan yuqori bo'lsa tushadi
    for (const r of inLeague.filter((x) => Number(x.score) === 0)) {
      if (lvl(r.league) > 0) {
        demoted++
        updates.push(db.update(progress).set({ league: down(r.league), updatedAt: new Date() })
          .where(eq(progress.userId, r.userId)))
      }
    }
  }

  await Promise.all(updates)
  res.json({ ok: true, prevWeekStart: wPrev, users: rows.length, promoted, demoted })
})

export default router
