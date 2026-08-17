/**
 * Haftalik turnir g'oliblariga avtomatik Premium sovg'alarini taqsimlash va
 * Telegram orqali maxsus bayramona tabriknoma jo'natish xizmati.
 */

import { and, desc, eq, gte, lt, sql } from 'drizzle-orm'
import { db } from '../../db/connection'
import { dailyRecords, progress, tournamentPrizes, users, userSettings } from '../../schema'
import { config } from '../../config'

export const TOURNAMENT_PRIZES: Record<number, number> = {
  1: 30, // 1-o'rin: 30 kunlik Premium
  2: 14, // 2-o'rin: 14 kunlik Premium
  3: 7,  // 3-o'rin: 7 kunlik Premium
}

export interface TournamentWinnerResult {
  userId: string
  name: string
  rank: number
  score: number
  league: string
  prizeDays: number
  newPremiumUntil: Date | null
  telegramNotified: boolean
}

/**
 * Berilgan sana dushanbasi uchun haftalik turnir g'oliblarini aniqlaydi va
 * avtomatik Premium obuna berib, Telegram bot orqali tabriknoma jo'natadi.
 *
 * @param periodKey O'tgan hafta dushanbasi (masalan '2026-08-10')
 */
export async function distributeWeeklyPrizes(periodKey: string): Promise<{
  periodKey: string
  awarded: boolean
  winners: TournamentWinnerResult[]
}> {
  // 1. Idempotency: Ushbu davr uchun mukofotlar allaqachon berilganmi?
  const existing = await db
    .select({
      id: tournamentPrizes.id,
      userId: tournamentPrizes.userId,
      rank: tournamentPrizes.rank,
      score: tournamentPrizes.score,
      league: tournamentPrizes.league,
      prizeDays: tournamentPrizes.prizeDays,
      firstName: users.firstName,
      lastName: users.lastName,
    })
    .from(tournamentPrizes)
    .innerJoin(users, eq(users.id, tournamentPrizes.userId))
    .where(eq(tournamentPrizes.periodKey, periodKey))
    .orderBy(tournamentPrizes.rank)

  if (existing.length > 0) {
    return {
      periodKey,
      awarded: false,
      winners: existing.map((w) => ({
        userId: w.userId,
        name: `${w.firstName} ${w.lastName ?? ''}`.trim(),
        rank: w.rank,
        score: w.score,
        league: w.league,
        prizeDays: w.prizeDays,
        newPremiumUntil: new Date(),
        telegramNotified: false,
      })),
    }
  }

  // 2. O'tgan haftadagi davr chegarasi (Dushanba 00:00 dan keyingi Dushanba 00:00 gacha)
  const dStart = new Date(periodKey)
  const dEnd = new Date(dStart.getTime() + 7 * 86_400_000)
  const endDateStr = dEnd.toISOString().slice(0, 10)

  // O'tgan haftada to'plangan ballar bo'yicha TOP-3 faol foydalanuvchini aniqlaymiz
  const weeklyScores = db
    .select({
      userId: dailyRecords.userId,
      score: sql<number>`SUM(${dailyRecords.correct})`.as('score'),
    })
    .from(dailyRecords)
    .where(
      and(
        gte(dailyRecords.date, periodKey),
        lt(dailyRecords.date, endDateStr)
      )
    )
    .groupBy(dailyRecords.userId)
    .as('weekly_scores')

  const topRows = await db
    .select({
      userId: users.id,
      firstName: users.firstName,
      lastName: users.lastName,
      tariff: users.tariff,
      premiumUntil: users.premiumUntil,
      notificationsEnabled: sql<boolean>`true`,
      league: sql<string>`COALESCE(${progress.league}, 'bronze')`,
      score: sql<number>`COALESCE(${weeklyScores.score}, 0)`,
    })
    .from(users)
    .innerJoin(weeklyScores, eq(weeklyScores.userId, users.id))
    .leftJoin(progress, eq(progress.userId, users.id))
    .leftJoin(userSettings, eq(userSettings.userId, users.id))
    .where(sql`${weeklyScores.score} > 0`)
    .orderBy(
      desc(sql`COALESCE(${weeklyScores.score}, 0)`),
      desc(sql`COALESCE(${progress.totalCorrect}, 0)`)
    )
    .limit(3)

  if (topRows.length === 0) {
    return { periodKey, awarded: false, winners: [] }
  }

  const results: TournamentWinnerResult[] = []

  for (let i = 0; i < topRows.length; i++) {
    const row = topRows[i]
    const rank = i + 1
    const prizeDays = TOURNAMENT_PRIZES[rank] || 7

    // Foydalanuvchiga Premium berish.
    // C-1: muddatli sovrin tariff'ga TEGMAYDI (premium_until yetarli).
    // H-1 (qisman): GREATEST SQLda — SELECT va UPDATE orasida boshqa
    // to'lov/promo muddatni uzatsa, eskisi ko'r-ko'rona o'chirilmaydi.
    const [granted] = await db
      .update(users)
      .set({
        premiumUntil: sql`GREATEST(COALESCE(premium_until, now()), now()) + make_interval(days => ${prizeDays}::int)`,
        updatedAt: new Date(),
      })
      .where(eq(users.id, row.userId))
      .returning({ premiumUntil: users.premiumUntil })

    // Mukofot yozuvini kiritish
    await db.insert(tournamentPrizes).values({
      periodKey,
      userId: row.userId,
      rank,
      score: Number(row.score),
      league: row.league,
      prizeDays,
    }).onConflictDoNothing()

    // Telegram Bot orqali maxsus bayramona tabriknoma jo'natish
    let notified = false
    const tgId = !row.userId.startsWith('p_') && !row.userId.startsWith('e_') ? row.userId : null
    const wantsNotification = row.notificationsEnabled ?? true

    if (tgId && wantsNotification && config.telegram.botToken) {
      notified = await sendPrizeNotificationToTelegram(tgId, {
        name: row.firstName,
        rank,
        score: Number(row.score),
        prizeDays,
      })
    }

    results.push({
      userId: row.userId,
      name: `${row.firstName} ${row.lastName ?? ''}`.trim(),
      rank,
      score: Number(row.score),
      league: row.league,
      prizeDays,
      newPremiumUntil: granted?.premiumUntil ?? null,
      telegramNotified: notified,
    })
  }

  return { periodKey, awarded: true, winners: results }
}

/**
 * G'olibga Telegram orqali bayramona tabrik yuborish
 */
async function sendPrizeNotificationToTelegram(
  telegramId: string | number,
  data: { name: string; rank: number; score: number; prizeDays: number }
): Promise<boolean> {
  const medals: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' }
  const titles: Record<number, string> = {
    1: '1-O\'RIN CHEMPIONI',
    2: '2-O\'RIN SOVRINDORI',
    3: '3-O\'RIN SOVRINDORI',
  }

  const medal = medals[data.rank] || '🏆'
  const title = titles[data.rank] || 'G\'OLIB'

  const message = `${medal} <b>TABRIKLAYMIZ, ${data.name}!</b>\n\n` +
    `Siz o'tgan haftalik bilimlar turnirida <b>${data.score} ball</b> bilan <b>${medal} ${title}</b> bo'ldingiz! 🎉\n\n` +
    `🎁 <b>Sovriningiz:</b> ${data.prizeDays} kunlik Bepul <b>Premium</b> obuna hisobingizga faollashtirildi!\n\n` +
    `Endi siz barcha fanlar, AI Tutor va imtihon simulyatorlaridan cheksiz foydalanishingiz mumkin. Bilim olishda davom eting! 🚀`

  try {
    const res = await fetch(`https://api.telegram.org/bot${config.telegram.botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: telegramId,
        text: message,
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: '🏆 Reyting & Sovrinlarni Ko\'rish',
                web_app: { url: config.deploy.appUrl },
              },
            ],
          ],
        },
      }),
    })

    const body: any = await res.json()
    return Boolean(body?.ok)
  } catch (err) {
    console.error(`[tournament-prize] Failed to send Telegram notification to ${telegramId}:`, err)
    return false
  }
}

/**
 * Oxirgi haftalik turnir g'oliblarini olish (Leaderboard / UI uchun)
 */
export async function getLatestTournamentWinners(): Promise<Array<{
  periodKey: string
  rank: number
  userId: string
  name: string
  score: number
  league: string
  prizeDays: number
}>> {
  const latestPeriod = await db
    .select({ periodKey: tournamentPrizes.periodKey })
    .from(tournamentPrizes)
    .orderBy(desc(tournamentPrizes.createdAt))
    .limit(1)

  if (latestPeriod.length === 0) return []

  const periodKey = latestPeriod[0].periodKey

  const rows = await db
    .select({
      periodKey: tournamentPrizes.periodKey,
      rank: tournamentPrizes.rank,
      userId: tournamentPrizes.userId,
      firstName: users.firstName,
      lastName: users.lastName,
      score: tournamentPrizes.score,
      league: tournamentPrizes.league,
      prizeDays: tournamentPrizes.prizeDays,
    })
    .from(tournamentPrizes)
    .innerJoin(users, eq(users.id, tournamentPrizes.userId))
    .where(eq(tournamentPrizes.periodKey, periodKey))
    .orderBy(tournamentPrizes.rank)

  return rows.map((r) => ({
    periodKey: r.periodKey,
    rank: r.rank,
    userId: r.userId,
    name: `${r.firstName} ${r.lastName ?? ''}`.trim(),
    score: r.score,
    league: r.league,
    prizeDays: r.prizeDays,
  }))
}
