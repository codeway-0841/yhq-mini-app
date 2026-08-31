/**
 * Telegram xabar yuborish UMUMIY utili (M-5): lazy Bot singleton + photo
 * file_id keshi. tg-broadcast.service shu orqali yuboradi — integration
 * testlar shu modulni vi.mock qiladi (real Telegram API'ga CHIQILMAYDI).
 *
 * M-5 (audit 2026-08-31): 429 FLOOD-WAIT handling. Eski holatda Telegram
 * `retry_after` qaytarsa xabar 'failed' bo'lib TERMINAL holatga o'tardi —
 * katta kampaniyada yuzlab xabar butunlay yo'qolardi. Endi:
 *  - 429 bo'lsa `retry_after` (≤30s) kutilib BIR MARTA qayta uriniladi;
 *  - retry_after juda uzun yoki ikkinchi urinish ham 429 bo'lsa —
 *    TelegramThrottleError tashlanadi (caller qatorni 'pending'ga qaytaradi,
 *    keyingi chunk'da davom etadi — xabar YO'QOLMAYDI).
 */
import { Bot, GrammyError, InlineKeyboard, type InputFile } from 'grammy'
import { config } from '../config'

let bot: Bot | null = null
function getBot(): Bot {
  if (!config.telegram.botToken) throw new Error('Telegram BOT_TOKEN serverda sozlanmagan')
  bot ??= new Bot(config.telegram.botToken)
  return bot
}

export interface TgSendOptions {
  text: string
  /** Rasm: telegram file_id (eng tez) YOKI tashqi URL YOKI lokal fayl (InputFile) */
  photo?: string | InputFile | null
  keyboard?: InlineKeyboard
}

export interface TgSendResult {
  /** sendPhoto muvaffaqiyatli bo'lsa — keyingi yuborishlar uchun tez file_id */
  fileId?: string
}

/** Flood-wait juda uzun — caller qatorni 'pending'ga qaytarib keyin davom etadi
 *  (xabar yo'qolmaydi; Vercel maxDuration ichida qolish uchun kutish cheklangan). */
export class TelegramThrottleError extends Error {
  constructor(public readonly retryAfterSeconds: number) {
    super(`Telegram flood-wait: retry_after=${retryAfterSeconds}s`)
    this.name = 'TelegramThrottleError'
  }
}

/** 429 xatosidan retry_after sekundlarini o'qiydi (429 bo'lmasa null). Export — unit test. */
export function getRetryAfterSeconds(err: unknown): number | null {
  const e = err as GrammyError | undefined
  if (e?.error_code !== 429) return null
  const ra = Number((e.parameters as { retry_after?: unknown } | undefined)?.retry_after)
  return Number.isFinite(ra) && ra > 0 ? ra : 1
}

/** Qayta urinish uchun maksimal kutish — Vercel funksiya maxDuration (60s) ichida
 *  xavfsiz chegara; bundan uzun kutish o'rniga qator 'pending'ga qaytadi. */
const MAX_RETRY_WAIT_SECONDS = 30

/** Blok/dead-chat xatolarimi? (recipient 'blocked' — qayta urinilmaydi) */
export function isBlockedTelegramError(err: unknown): boolean {
  const desc = String((err as GrammyError)?.description ?? (err as Error)?.message ?? '')
  return desc.includes('bot was blocked')
    || desc.includes('chat not found')
    || desc.includes('user is deactivated')
    || desc.includes('bots can\'t send messages to bots')
    // M-5 (audit): bot guruhdan chiqarilgan yoki yozish huquqi yo'q — bu ham
    // TERMINAL holat (qayta urinish foydasiz, 'failed' emas 'blocked' hisoblanadi)
    || desc.includes('bot was kicked')
    || desc.includes('have no rights to send a message')
    || desc.includes('chat_id is empty')
    || desc.includes('message thread not found')
}

async function sendOnce(chatId: number | string, opts: TgSendOptions): Promise<TgSendResult> {
  const b = getBot()
  if (opts.photo) {
    const res = await b.api.sendPhoto(Number(chatId), opts.photo, {
      caption: opts.text,
      reply_markup: opts.keyboard,
    })
    const fileId = res?.photo?.[res.photo.length - 1]?.file_id
    return { fileId }
  }
  await b.api.sendMessage(Number(chatId), opts.text, { reply_markup: opts.keyboard })
  return {}
}

export async function sendTelegramMessage(chatId: number | string, opts: TgSendOptions): Promise<TgSendResult> {
  try {
    return await sendOnce(chatId, opts)
  } catch (err) {
    const retryAfter = getRetryAfterSeconds(err)
    if (retryAfter == null) throw err   // 429 emas — oddiy xato (blocked/failed tasnifiga)
    if (retryAfter > MAX_RETRY_WAIT_SECONDS) throw new TelegramThrottleError(retryAfter)
    await new Promise((r) => setTimeout(r, retryAfter * 1000))
    try {
      return await sendOnce(chatId, opts)
    } catch (err2) {
      const retryAfter2 = getRetryAfterSeconds(err2)
      if (retryAfter2 != null) throw new TelegramThrottleError(retryAfter2)
      throw err2
    }
  }
}
