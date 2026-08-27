/**
 * Broadcast service — send announcements and notifications via Telegram bot.
 */

import { Bot, InlineKeyboard, InputFile } from 'grammy'
import { eq, gte } from 'drizzle-orm'
import { db } from '../../db/connection'
import { users, authIdentities, dailyRecords } from '../../schema'
import { config } from '../../config'

export type BroadcastTarget = 'all' | 'free' | 'premium' | 'inactive_7d' | 'active_today'

export interface BroadcastPayload {
  target: BroadcastTarget
  text: string
  imageUrl?: string | null
  imageData?: string | null
  buttonText?: string | null
  buttonUrl?: string | null
  testTelegramId?: string | number | null
}

export interface BroadcastResult {
  total: number
  sent: number
  blocked: number
  failed: number
  durationMs: number
}

const APP_URL = `${config.deploy.appUrl}?v=${config.deploy.buildId}`

function tashkentDate(daysAgo = 0): string {
  const d = new Date(Date.now() - daysAgo * 86_400_000)
  return d.toLocaleDateString('sv-SE', { timeZone: 'Asia/Tashkent' })
}

/**
 * Fetch eligible numeric Telegram user IDs for the given audience target.
 */
export async function getTargetTelegramIds(target: BroadcastTarget): Promise<number[]> {
  const now = new Date()

  // 1. Get all telegram identity mappings
  // Users either have authIdentities (provider='telegram', providerUid) OR users.id is numeric
  const tgIdentities = await db
    .select({
      userId: authIdentities.userId,
      tgId: authIdentities.providerUid,
    })
    .from(authIdentities)
    .where(eq(authIdentities.provider, 'telegram'))

  const idMap = new Map<string, string>() // userId -> tgId
  tgIdentities.forEach((row) => {
    if (/^\d+$/.test(row.tgId)) {
      idMap.set(row.userId, row.tgId)
    }
  })

  // Also users whose id itself is numeric
  const allUsers = await db
    .select({
      id: users.id,
      tariff: users.tariff,
      premiumUntil: users.premiumUntil,
    })
    .from(users)

  allUsers.forEach((u) => {
    if (/^\d+$/.test(u.id) && !idMap.has(u.id)) {
      idMap.set(u.id, u.id)
    }
  })

  let filteredUserIds = allUsers

  if (target === 'premium') {
    filteredUserIds = allUsers.filter(
      (u) => u.tariff === 'premium' || (u.premiumUntil && new Date(u.premiumUntil) > now)
    )
  } else if (target === 'free') {
    filteredUserIds = allUsers.filter(
      (u) => u.tariff === 'free' && (!u.premiumUntil || new Date(u.premiumUntil) <= now)
    )
  } else if (target === 'active_today') {
    const today = tashkentDate(0)
    const activeRows = await db
      .selectDistinct({ userId: dailyRecords.userId })
      .from(dailyRecords)
      .where(eq(dailyRecords.date, today))
    const activeSet = new Set(activeRows.map((r) => r.userId))
    filteredUserIds = allUsers.filter((u) => activeSet.has(u.id))
  } else if (target === 'inactive_7d') {
    const cutoff = tashkentDate(7)
    const activeRows = await db
      .selectDistinct({ userId: dailyRecords.userId })
      .from(dailyRecords)
      .where(gte(dailyRecords.date, cutoff))
    const activeRecentSet = new Set(activeRows.map((r) => r.userId))
    filteredUserIds = allUsers.filter((u) => !activeRecentSet.has(u.id))
  }

  const resultTgIds = new Set<number>()
  filteredUserIds.forEach((u) => {
    const tgIdStr = idMap.get(u.id)
    if (tgIdStr) {
      const num = Number(tgIdStr)
      if (num > 0) resultTgIds.add(num)
    }
  })

  return Array.from(resultTgIds)
}

/**
 * Execute broadcast sending via Grammy with rate limiting (25 msg/sec)
 */
export async function executeBroadcast(payload: BroadcastPayload): Promise<BroadcastResult> {
  const token = config.telegram.botToken
  if (!token) {
    throw new Error('Telegram BOT_TOKEN serverda sozlanmagan')
  }

  const bot = new Bot(token)
  const startTime = Date.now()

  let targetIds: number[]
  if (payload.testTelegramId) {
    targetIds = [Number(payload.testTelegramId)]
  } else {
    targetIds = await getTargetTelegramIds(payload.target)
  }

  if (targetIds.length === 0) {
    return { total: 0, sent: 0, blocked: 0, failed: 0, durationMs: 0 }
  }

  // Build inline keyboard if button is requested
  const buildKeyboard = () => {
    if (!payload.buttonText) return undefined
    const kb = new InlineKeyboard()
    const text = payload.buttonText.trim()
    const url = payload.buttonUrl?.trim()

    if (url && (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('tg://'))) {
      if (url.includes('t.me/') || !url.startsWith('http')) {
        kb.url(text, url)
      } else {
        kb.webApp(text, url)
      }
    } else {
      kb.webApp(text, APP_URL)
    }
    return kb
  }

  const keyboard = buildKeyboard()

  // Prepare photo: support base64 data url or external URL
  let photoSource: string | InputFile | null = null
  if (payload.imageData && payload.imageData.startsWith('data:')) {
    const match = payload.imageData.match(/^data:([A-Za-z-+/]+);base64,(.+)$/)
    if (match && match[2]) {
      const buffer = Buffer.from(match[2], 'base64')
      photoSource = new InputFile(buffer, 'broadcast.jpg')
    }
  } else if (payload.imageUrl && payload.imageUrl.startsWith('http')) {
    photoSource = payload.imageUrl
  }

  let sent = 0
  let blocked = 0
  let failed = 0

  // Send in chunks of 25 to respect Telegram's 30 msg/sec limit
  const chunkSize = 25
  for (let i = 0; i < targetIds.length; i += chunkSize) {
    const chunk = targetIds.slice(i, i + chunkSize)
    const promises = chunk.map(async (chatId) => {
      try {
        if (photoSource) {
          const res = await bot.api.sendPhoto(chatId, photoSource, {
            caption: payload.text,
            reply_markup: keyboard,
          })
          // Telegram file_id optimization: cache file_id for subsequent sends!
          if (res?.photo && res.photo.length > 0) {
            photoSource = res.photo[res.photo.length - 1].file_id
          }
        } else {
          await bot.api.sendMessage(chatId, payload.text, {
            reply_markup: keyboard,
          })
        }
        return 'sent'
      } catch (err: any) {
        const desc = String(err?.description || err?.message || '')
        if (
          desc.includes('bot was blocked') ||
          desc.includes('chat not found') ||
          desc.includes('user is deactivated')
        ) {
          return 'blocked'
        }
        return 'failed'
      }
    })

    const results = await Promise.all(promises)
    results.forEach((res) => {
      if (res === 'sent') sent++
      else if (res === 'blocked') blocked++
      else failed++
    })

    // Delay 1s between chunks if there are more chunks
    if (i + chunkSize < targetIds.length) {
      await new Promise((resolve) => setTimeout(resolve, 1000))
    }
  }

  return {
    total: targetIds.length,
    sent,
    blocked,
    failed,
    durationMs: Date.now() - startTime,
  }
}
