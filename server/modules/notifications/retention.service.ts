/**
 * Smart Retention Push Notifications Service
 * Sends personalized, high-conversion Telegram notifications for streaks,
 * inactive user reactivation, weekly tournament results, and premium status.
 */

import { Bot, InlineKeyboard } from 'grammy'
import { gte, lte, eq, and, sql, inArray } from 'drizzle-orm'
import { db } from '../../db/connection'
import {
  users,
  userSettings,
  dailyRecords,
  dailyStreaks,
} from '../../schema'
import { config } from '../../config'
import { LEAGUE_ORDER } from '../leaderboard/leaderboard.repository'

export interface RetentionSendResult {
  targets: number
  sent: number
  blocked: number
  failed: number
  durationMs: number
}

function tashkentDate(daysAgo = 0): string {
  const d = new Date(Date.now() - daysAgo * 86_400_000)
  return d.toLocaleDateString('sv-SE', { timeZone: 'Asia/Tashkent' })
}

function getAppUrl(path = ''): string {
  const base = `${config.deploy.appUrl}?v=${config.deploy.buildId}`
  if (!path) return base
  return `${config.deploy.appUrl}${path.startsWith('/') ? path : `/${path}`}?v=${config.deploy.buildId}`
}

function formatLeagueName(league: string, lang: 'uz' | 'ru' = 'uz'): string {
  const names: Record<string, { uz: string; ru: string }> = {
    bronze:   { uz: '🥉 Bronza',   ru: '🥉 Бронзовая' },
    silver:   { uz: '🥈 Kumush',   ru: '🥈 Серебряная' },
    gold:     { uz: '🥇 Oltin',    ru: '🥇 Золотая' },
    platinum: { uz: '💎 Platina',  ru: '💎 Платиновая' },
  }
  return names[league]?.[lang] ?? league
}

/**
 * 1. 🔥 Streak Reminder (Kunlik Mashq & Intizom Eslatmasi)
 */
export async function sendStreakReminder(): Promise<RetentionSendResult> {
  const start = Date.now()
  const token = config.telegram.botToken
  if (!token) throw new Error('BOT_TOKEN not configured')

  const today = tashkentDate()
  const cutoff = tashkentDate(14)

  // 1) Users active in the last 14 days
  const recent = await db
    .selectDistinct({ userId: dailyRecords.userId })
    .from(dailyRecords)
    .where(gte(dailyRecords.date, cutoff))

  // 2) Users already active today (do not notify)
  const activeToday = await db
    .selectDistinct({ userId: dailyRecords.userId })
    .from(dailyRecords)
    .where(eq(dailyRecords.date, today))

  const doneSet = new Set(activeToday.map((r) => r.userId))
  const candidateIds = [...new Set(recent.map((r) => r.userId))]
    .filter((uid) => !doneSet.has(uid) && /^\d+$/.test(uid))

  if (candidateIds.length === 0) {
    return { targets: 0, sent: 0, blocked: 0, failed: 0, durationMs: Date.now() - start }
  }

  // 3) Filter by userSettings.notificationsEnabled !== false & get user metadata
  const userRows = await db
    .select({
      id: users.id,
      firstName: users.firstName,
      language: userSettings.language,
      notificationsEnabled: userSettings.notificationsEnabled,
    })
    .from(users)
    .leftJoin(userSettings, eq(userSettings.userId, users.id))
    .where(inArray(users.id, candidateIds))

  const targetUsers = userRows.filter((u) => u.notificationsEnabled !== false)
  if (targetUsers.length === 0) {
    return { targets: 0, sent: 0, blocked: 0, failed: 0, durationMs: Date.now() - start }
  }

  const targetIds = targetUsers.map((u) => u.id)

  // 4) Get max streak for each target user
  const streakRows = await db
    .select({
      userId: dailyStreaks.userId,
      streak: sql<number>`MAX(${dailyStreaks.streak})`,
    })
    .from(dailyStreaks)
    .where(inArray(dailyStreaks.userId, targetIds))
    .groupBy(dailyStreaks.userId)

  const streakMap = new Map(streakRows.map((r) => [r.userId, Number(r.streak)]))

  const bot = new Bot(token)
  let sent = 0
  let blocked = 0
  let failed = 0

  for (let i = 0; i < targetUsers.length; i += 20) {
    const batch = targetUsers.slice(i, i + 20)
    const results = await Promise.allSettled(
      batch.map((user) => {
        const streak = streakMap.get(user.id) ?? 0
        const lang = (user.language ?? 'uz') as 'uz' | 'ru'
        const name = user.firstName || (lang === 'ru' ? 'Студент' : "O'quvchi")

        let messageText = ''
        if (streak >= 3) {
          messageText =
            lang === 'ru'
              ? `🔥 <b>${name}</b>, ваша серия в <b>${streak} дней</b> под угрозой!\n\nВы еще не тренировались сегодня — пройдите короткий 2-минутный тест и сохраните свой стрик!`
              : `🔥 <b>${name}</b>, sizning <b>${streak} kunlik</b> intizom seriyangiz xavf ostida!\n\nBugun hali mashq qilmadingiz — 2 daqiqalik test yechib seriyangizni saqlab qoling. Katta natija har kungi intizomdan boshlanadi!`
        } else {
          messageText =
            lang === 'ru'
              ? `⚡ <b>${name}</b>, не забудьте пройти сегодняшнюю практику!\n\nВсего 10 тестовых вопросов сегодня — и вы на шаг ближе к успешной сдаче экзамена!`
              : `⚡ <b>${name}</b>, bugungi 10 ta savolni yechishni unutmang!\n\nKunlik mashqlar bilimni mustahkamlaydi va imtihonga 100% tayyorlaydi.`
        }

        const keyboard = new InlineKeyboard().webApp(
          lang === 'ru' ? '▶️ Начать практику' : '▶️ Mashqni boshlash',
          getAppUrl()
        )

        return bot.api.sendMessage(Number(user.id), messageText, {
          parse_mode: 'HTML',
          reply_markup: keyboard,
        })
      })
    )

    for (const r of results) {
      if (r.status === 'fulfilled') {
        sent++
      } else {
        const desc = String(r.reason?.description ?? r.reason)
        if (desc.includes('bot was blocked') || desc.includes('chat not found')) {
          blocked++
        } else {
          failed++
        }
      }
    }

    if (i + 20 < targetUsers.length) {
      await new Promise((resolve) => setTimeout(resolve, 50))
    }
  }

  return {
    targets: targetUsers.length,
    sent,
    blocked,
    failed,
    durationMs: Date.now() - start,
  }
}

/**
 * 2. 👋 Inactivity Reactivation (2-3 kun kirmaganlarga qaytish eslatmasi)
 */
export async function sendInactivityReactivation(): Promise<RetentionSendResult> {
  const start = Date.now()
  const token = config.telegram.botToken
  if (!token) throw new Error('BOT_TOKEN not configured')

  const activeCutoff = tashkentDate(2) // active in last 2 days
  const maxCutoff = tashkentDate(7)    // but active within last 7 days

  // Users active between 3-7 days ago
  const candidateRows = await db
    .selectDistinct({ userId: dailyRecords.userId })
    .from(dailyRecords)
    .where(and(gte(dailyRecords.date, maxCutoff), lte(dailyRecords.date, activeCutoff)))

  const activeRecentlyRows = await db
    .selectDistinct({ userId: dailyRecords.userId })
    .from(dailyRecords)
    .where(gte(dailyRecords.date, tashkentDate(1)))

  const activeRecentlySet = new Set(activeRecentlyRows.map((r) => r.userId))
  const candidateIds = candidateRows
    .map((r) => r.userId)
    .filter((uid) => !activeRecentlySet.has(uid) && /^\d+$/.test(uid))

  if (candidateIds.length === 0) {
    return { targets: 0, sent: 0, blocked: 0, failed: 0, durationMs: Date.now() - start }
  }

  const userRows = await db
    .select({
      id: users.id,
      firstName: users.firstName,
      language: userSettings.language,
      notificationsEnabled: userSettings.notificationsEnabled,
    })
    .from(users)
    .leftJoin(userSettings, eq(userSettings.userId, users.id))
    .where(inArray(users.id, candidateIds))

  const targetUsers = userRows.filter((u) => u.notificationsEnabled !== false)
  if (targetUsers.length === 0) {
    return { targets: 0, sent: 0, blocked: 0, failed: 0, durationMs: Date.now() - start }
  }

  const bot = new Bot(token)
  let sent = 0
  let blocked = 0
  let failed = 0

  for (let i = 0; i < targetUsers.length; i += 20) {
    const batch = targetUsers.slice(i, i + 20)
    const results = await Promise.allSettled(
      batch.map((user) => {
        const lang = (user.language ?? 'uz') as 'uz' | 'ru'
        const name = user.firstName || (lang === 'ru' ? 'Студент' : "O'quvchi")

        const messageText =
          lang === 'ru'
            ? `👋 Привет, <b>${name}</b>!\n\nНовые тесты и билеты ждут вас. Повторите пройденные темы всего за несколько минут и будьте уверены в своих знаниях!`
            : `👋 Salom, <b>${name}</b>!\n\nYangi testlar va biletlar sizni kutmoqda. Bir necha daqiqada bilimingizni yangilab, imtihonga tayyorgarlikni davom ettiring!`

        const keyboard = new InlineKeyboard().webApp(
          lang === 'ru' ? '🚀 Открыть тесты' : '🚀 Testlarni ochish',
          getAppUrl()
        )

        return bot.api.sendMessage(Number(user.id), messageText, {
          parse_mode: 'HTML',
          reply_markup: keyboard,
        })
      })
    )

    for (const r of results) {
      if (r.status === 'fulfilled') {
        sent++
      } else {
        const desc = String(r.reason?.description ?? r.reason)
        if (desc.includes('bot was blocked') || desc.includes('chat not found')) {
          blocked++
        } else {
          failed++
        }
      }
    }

    if (i + 20 < targetUsers.length) {
      await new Promise((resolve) => setTimeout(resolve, 50))
    }
  }

  return {
    targets: targetUsers.length,
    sent,
    blocked,
    failed,
    durationMs: Date.now() - start,
  }
}

/**
 * 3. 🏆 Weekly League Rollover Notifications
 */
export async function sendLeagueResultsNotification(
  plan: Array<{ userId: string; fromLeague: string; toLeague: string }>
): Promise<RetentionSendResult> {
  const start = Date.now()
  const token = config.telegram.botToken
  if (!token || plan.length === 0) {
    return { targets: 0, sent: 0, blocked: 0, failed: 0, durationMs: Date.now() - start }
  }

  const tgTargetIds = plan.map((p) => p.userId).filter((uid) => /^\d+$/.test(uid))
  if (tgTargetIds.length === 0) {
    return { targets: 0, sent: 0, blocked: 0, failed: 0, durationMs: Date.now() - start }
  }

  const userRows = await db
    .select({
      id: users.id,
      firstName: users.firstName,
      language: userSettings.language,
      notificationsEnabled: userSettings.notificationsEnabled,
    })
    .from(users)
    .leftJoin(userSettings, eq(userSettings.userId, users.id))
    .where(inArray(users.id, tgTargetIds))

  const userMap = new Map(userRows.map((u) => [u.id, u]))
  const planMap = new Map(plan.map((p) => [p.userId, p]))

  const bot = new Bot(token)
  let sent = 0
  let blocked = 0
  let failed = 0

  const lvl = (l: string) => Math.max(0, LEAGUE_ORDER.indexOf(l as any))

  for (let i = 0; i < tgTargetIds.length; i += 20) {
    const batch = tgTargetIds.slice(i, i + 20)
    const results = await Promise.allSettled(
      batch.map((uid) => {
        const user = userMap.get(uid)
        const p = planMap.get(uid)
        if (!user || !p || user.notificationsEnabled === false) return Promise.resolve()

        const lang = (user.language ?? 'uz') as 'uz' | 'ru'
        const name = user.firstName || (lang === 'ru' ? 'Студент' : "O'quvchi")
        const isPromoted = lvl(p.toLeague) > lvl(p.fromLeague)

        let messageText = ''
        if (isPromoted) {
          const leagueTitle = formatLeagueName(p.toLeague, lang)
          messageText =
            lang === 'ru'
              ? `🎉 Поздравляем, <b>${name}</b>!\n\nБлагодаря отличным результатам на прошлой неделе вы перешли в <b>${leagueTitle}</b> лигу! 🏆\n\nНовый недельный турнир уже стартовал!`
              : `🎉 Tabriklaymiz, <b>${name}</b>!\n\nO'tgan haftadagi ajoyib natijangiz tufayli <b>${leagueTitle}</b> ligasiga ko'tarildingiz! 🏆\n\nYangi haftalik turnirga start berildi, peshqadamlikni qo'ldan bermang!`
        } else {
          const leagueTitle = formatLeagueName(p.toLeague, lang)
          messageText =
            lang === 'ru'
              ? `⚔️ <b>${name}</b>, стартовал новый недельный турнир в <b>${leagueTitle}</b> лиге!\n\nНабирайте очки с первых дней недели, чтобы занять призовые места!`
              : `⚔️ <b>${name}</b>, <b>${leagueTitle}</b> ligasida yangi haftalik turnir boshlandi!\n\nPeshqadam bo'lish uchun haftaning ilk kunlaridanoq ball to'plashni boshlang!`
        }

        const keyboard = new InlineKeyboard().webApp(
          lang === 'ru' ? '🏆 Таблица лидеров' : '🏆 Turnir jadvali',
          getAppUrl('/leaderboard')
        )

        return bot.api.sendMessage(Number(uid), messageText, {
          parse_mode: 'HTML',
          reply_markup: keyboard,
        })
      })
    )

    for (const r of results) {
      if (r.status === 'fulfilled') {
        sent++
      } else {
        const desc = String(r.reason?.description ?? r.reason)
        if (desc.includes('bot was blocked') || desc.includes('chat not found')) {
          blocked++
        } else {
          failed++
        }
      }
    }

    if (i + 20 < tgTargetIds.length) {
      await new Promise((resolve) => setTimeout(resolve, 50))
    }
  }

  return {
    targets: tgTargetIds.length,
    sent,
    blocked,
    failed,
    durationMs: Date.now() - start,
  }
}

/**
 * 4. 👑 Premium Expiring Reminder (Obuna ertaga tugashi haqida ogohlantirish)
 */
export async function sendPremiumExpiringReminder(): Promise<RetentionSendResult> {
  const start = Date.now()
  const token = config.telegram.botToken
  if (!token) throw new Error('BOT_TOKEN not configured')

  const now = new Date()
  const in24h = new Date(now.getTime() + 24 * 3600_000)
  const in48h = new Date(now.getTime() + 48 * 3600_000)

  // Find users whose premium expires between 24h and 48h from now
  const expiringUsers = await db
    .select({
      id: users.id,
      firstName: users.firstName,
      language: userSettings.language,
      notificationsEnabled: userSettings.notificationsEnabled,
      premiumUntil: users.premiumUntil,
    })
    .from(users)
    .leftJoin(userSettings, eq(userSettings.userId, users.id))
    .where(and(gte(users.premiumUntil, in24h), lte(users.premiumUntil, in48h)))

  const targetUsers = expiringUsers.filter(
    (u) => /^\d+$/.test(u.id) && u.notificationsEnabled !== false
  )

  if (targetUsers.length === 0) {
    return { targets: 0, sent: 0, blocked: 0, failed: 0, durationMs: Date.now() - start }
  }

  const bot = new Bot(token)
  let sent = 0
  let blocked = 0
  let failed = 0

  for (let i = 0; i < targetUsers.length; i += 20) {
    const batch = targetUsers.slice(i, i + 20)
    const results = await Promise.allSettled(
      batch.map((user) => {
        const lang = (user.language ?? 'uz') as 'uz' | 'ru'
        const name = user.firstName || (lang === 'ru' ? 'Студент' : "O'quvchi")

        const messageText =
          lang === 'ru'
            ? `👑 <b>${name}</b>, ваша Premium подписка истекает <b>завтра</b>.\n\nПродлите подписку, чтобы сохранить доступ к AI Tutor, всем эксклюзивным темам и неограниченным режимам тренировки!`
            : `👑 <b>${name}</b>, sizning Premium obunangiz <b>ertaga</b> o'z nihoyasiga yetadi.\n\nAI Tutor, barcha eksklyuziv temalar va cheksiz mashq rejimlari uzluksiz ishlashi uchun obunangizni yangilang!`

        const keyboard = new InlineKeyboard().webApp(
          lang === 'ru' ? '👑 Продлить Premium' : '👑 Obunani yangilash',
          getAppUrl('/premium')
        )

        return bot.api.sendMessage(Number(user.id), messageText, {
          parse_mode: 'HTML',
          reply_markup: keyboard,
        })
      })
    )

    for (const r of results) {
      if (r.status === 'fulfilled') {
        sent++
      } else {
        const desc = String(r.reason?.description ?? r.reason)
        if (desc.includes('bot was blocked') || desc.includes('chat not found')) {
          blocked++
        } else {
          failed++
        }
      }
    }

    if (i + 20 < targetUsers.length) {
      await new Promise((resolve) => setTimeout(resolve, 50))
    }
  }

  return {
    targets: targetUsers.length,
    sent,
    blocked,
    failed,
    durationMs: Date.now() - start,
  }
}

/**
 * 5. 🛠️ Send Test Notification to Admin
 */
export async function sendTestNotificationToAdmin(
  adminUserId: string,
  type: 'streak' | 'inactivity' | 'league' | 'premium_expiring'
): Promise<{ ok: boolean; message: string }> {
  const token = config.telegram.botToken
  if (!token) throw new Error('BOT_TOKEN not configured')
  if (!/^\d+$/.test(adminUserId)) {
    throw new Error('Test xabarnoma yuborish uchun faqat Telegram orqali ulangan admin akkaunti kerak')
  }

  const [user] = await db
    .select({
      id: users.id,
      firstName: users.firstName,
      language: userSettings.language,
    })
    .from(users)
    .leftJoin(userSettings, eq(userSettings.userId, users.id))
    .where(eq(users.id, adminUserId))

  const lang = (user?.language ?? 'uz') as 'uz' | 'ru'
  const name = user?.firstName || (lang === 'ru' ? 'Админ' : 'Admin')

  let text = ''
  let appPath = ''
  let btnLabel = ''

  if (type === 'streak') {
    text =
      lang === 'ru'
        ? `[ТЕСТ] 🔥 <b>${name}</b>, ваша серия в <b>5 дней</b> под угрозой!\n\nВы еще не тренировались сегодня — пройдите короткий 2-минутный тест и сохраните стрик!`
        : `[TEST] 🔥 <b>${name}</b>, sizning <b>5 kunlik</b> intizom seriyangiz xavf ostida!\n\nBugun hali mashq qilmadingiz — 2 daqiqalik test yechib seriyangizni saqlab qoling!`
    btnLabel = lang === 'ru' ? '▶️ Начать практику' : '▶️ Mashqni boshlash'
    appPath = ''
  } else if (type === 'inactivity') {
    text =
      lang === 'ru'
        ? `[ТЕСТ] 👋 Привет, <b>${name}</b>!\n\nНовые тесты и билеты ждут вас. Готовы проверить свои знания?`
        : `[TEST] 👋 Salom, <b>${name}</b>!\n\nYangi testlar va biletlar sizni kutmoqda. Bilimingizni sinashga tayyormisiz?`
    btnLabel = lang === 'ru' ? '🚀 Открыть тесты' : '🚀 Testlarni ochish'
    appPath = ''
  } else if (type === 'league') {
    text =
      lang === 'ru'
        ? `[ТЕСТ] 🎉 Поздравляем, <b>${name}</b>!\n\nПо результатам прошлой недели вы перешли в <b>🥇 Золотую</b> лигу! 🏆`
        : `[TEST] 🎉 Tabriklaymiz, <b>${name}</b>!\n\nO'tgan haftadagi natijangiz bilan <b>🥇 Oltin</b> ligasiga ko'tarildingiz! 🏆`
    btnLabel = lang === 'ru' ? '🏆 Таблица лидеров' : '🏆 Turnir jadvali'
    appPath = '/leaderboard'
  } else if (type === 'premium_expiring') {
    text =
      lang === 'ru'
        ? `[ТЕСТ] 👑 <b>${name}</b>, ваша Premium подписка истекает <b>завтра</b>. Продлите подписку, чтобы сохранить все возможности!`
        : `[TEST] 👑 <b>${name}</b>, sizning Premium obunangiz <b>ertaga</b> tugaydi. Imkoniyatlarni saqlab qolish uchun obunani yangilang!`
    btnLabel = lang === 'ru' ? '👑 Продлить Premium' : '👑 Obunani yangilash'
    appPath = '/premium'
  }

  const bot = new Bot(token)
  const keyboard = new InlineKeyboard().webApp(btnLabel, getAppUrl(appPath))

  await bot.api.sendMessage(Number(adminUserId), text, {
    parse_mode: 'HTML',
    reply_markup: keyboard,
  })

  return { ok: true, message: 'Test xabarnoma muvaffaqiyatli yuborildi' }
}
