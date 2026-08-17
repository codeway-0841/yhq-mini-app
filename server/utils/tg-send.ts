/**
 * Telegram xabar yuborish UMUMIY utili (M-5): lazy Bot singleton + photo
 * file_id keshi. tg-broadcast.service shu orqali yuboradi — integration
 * testlar shu modulni vi.mock qiladi (real Telegram API'ga CHIQILMAYDI).
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

/** Blok/dead-chat xatolarimi? (recipient 'blocked' — qayta urinilmaydi) */
export function isBlockedTelegramError(err: unknown): boolean {
  const desc = String((err as GrammyError)?.description ?? (err as Error)?.message ?? '')
  return desc.includes('bot was blocked')
    || desc.includes('chat not found')
    || desc.includes('user is deactivated')
    || desc.includes('bots can\'t send messages to bots')
}

export async function sendTelegramMessage(chatId: number | string, opts: TgSendOptions): Promise<TgSendResult> {
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
