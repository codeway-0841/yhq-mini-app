/**
 * tg-send (M-5, audit 2026-08-31) — flood-wait va blocked tasnifi unit testlari.
 *
 * Qamrov:
 *  - getRetryAfterSeconds: 429 → retry_after (yo'q bo'lsa 1s default), 429 emas → null
 *  - isBlockedTelegramError: terminal holatlar (blocked/dead-chat/rights) — qayta
 *    yuborish foydasiz; oddiy xatolar blocked EMAS
 *  - sendTelegramMessage: 429'da retry_after kutib BIR MARTA qayta urinadi;
 *    ikkinchi 429 yoki >30s kutish → TelegramThrottleError (xabar yo'qolmaydi —
 *    caller 'pending'ga qaytaradi)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GrammyError } from 'grammy'

// Bot'ning API chaqiruvlari mock'lanadi — real Telegram'ga CHIQILMAYDI
const h = vi.hoisted(() => ({
  sendMessage: vi.fn(),
  sendPhoto: vi.fn(),
}))
vi.mock('grammy', async (importOriginal) => {
  const actual = await importOriginal<typeof import('grammy')>()
  // `new Bot()` bilan mos class (arrow-fn constructor bo'la olmaydi)
  class MockBot {
    api = { sendMessage: h.sendMessage, sendPhoto: h.sendPhoto }
  }
  return { ...actual, Bot: MockBot as unknown as typeof actual.Bot }
})

import {
  sendTelegramMessage,
  isBlockedTelegramError,
  getRetryAfterSeconds,
  TelegramThrottleError,
} from '../../../server/utils/tg-send'
import { config } from '../../../server/config'

/** GrammyError 429 imitatsiyasi (real xato shape'i) */
function floodWait(retryAfter: number): GrammyError {
  return new GrammyError(
    'Call to \'sendMessage\' failed! (429: Too Many Requests: retry after 5)',
    { ok: false, error_code: 429, description: 'Too Many Requests: retry after 5', parameters: { retry_after: retryAfter } },
    'sendMessage',
    { chat_id: 1, text: 'x' },
  )
}

beforeEach(() => {
  h.sendMessage.mockReset().mockResolvedValue({ message_id: 1 })
  h.sendPhoto.mockReset().mockResolvedValue({ photo: [{ file_id: 'fid_1' }] })
  // BOT_TOKEN kerak (getBot) — config import-paytida parse qiladi; CI'da env
  // BO'LMAYDI, shuning uchun runtime mutate (call-time o'qiladi). Mahalliy
  // .env'ga bog'liq bo'lmaslik uchun HAR DOIM yozamiz (??= EMAS).
  ;(config.telegram as { botToken?: string }).botToken = '123:test-token'
})

describe('getRetryAfterSeconds', () => {
  it('429 xatosidan retry_after ni o\'qiydi', () => {
    expect(getRetryAfterSeconds(floodWait(7))).toBe(7)
  })
  it('retry_after yo\'q 429 → 1s default', () => {
    const err = new GrammyError('x', { ok: false, error_code: 429, description: 'Too Many Requests' }, 'sendMessage', {})
    expect(getRetryAfterSeconds(err)).toBe(1)
  })
  it('429 bo\'lmagan xato → null', () => {
    expect(getRetryAfterSeconds(new Error('Forbidden: bot was blocked by the user'))).toBeNull()
  })
})

describe('isBlockedTelegramError (terminal holatlar)', () => {
  it.each([
    'Forbidden: bot was blocked by the user',
    'Bad Request: chat not found',
    'Forbidden: user is deactivated',
    "Forbidden: bots can't send messages to bots",
    // M-5 yangi pattern'lar:
    'Forbidden: bot was kicked from the supergroup chat',
    'Bad Request: have no rights to send a message',
    'Bad Request: chat_id is empty',
    'Bad Request: message thread not found',
  ])('terminal: %s', (desc) => {
    expect(isBlockedTelegramError(new Error(desc))).toBe(true)
  })

  it.each([
    'Too Many Requests: retry after 5',   // 429 — blocked EMAS (retry qilinadi)
    'Bad Gateway',                         // vaqtinchalik server xatosi
    'ETIMEDOUT',                           // tarmoq
  ])('terminal EMAS: %s', (desc) => {
    expect(isBlockedTelegramError(new Error(desc))).toBe(false)
  })
})

describe('sendTelegramMessage — 429 retry_after handling', () => {
  it('429 → retry_after kutib BIR MARTA qayta urinadi va muvaffaqiyat bo\'ladi', async () => {
    h.sendMessage
      .mockRejectedValueOnce(floodWait(0.01))   // 10ms — test tez
      .mockResolvedValueOnce({ message_id: 2 })
    const res = await sendTelegramMessage(123, { text: 'salom' })
    expect(res).toEqual({})
    expect(h.sendMessage).toHaveBeenCalledTimes(2)
  })

  it('ikkinchi urinish ham 429 → TelegramThrottleError (caller pending\'ga qaytaradi)', async () => {
    h.sendMessage.mockRejectedValue(floodWait(0.01))
    await expect(sendTelegramMessage(123, { text: 'salom' }))
      .rejects.toBeInstanceOf(TelegramThrottleError)
    expect(h.sendMessage).toHaveBeenCalledTimes(2)   // faqat 1 retry
  })

  it('retry_after > 30s → DARHOL TelegramThrottleError (funksiya maxDuration himoyasi)', async () => {
    h.sendMessage.mockRejectedValue(floodWait(120))
    await expect(sendTelegramMessage(123, { text: 'salom' }))
      .rejects.toBeInstanceOf(TelegramThrottleError)
    expect(h.sendMessage).toHaveBeenCalledTimes(1)   // kutishsiz — retry ham qilinmaydi
  })

  it('429 bo\'lmagan xato → asl xato qayta tashlanadi (retry YO\'Q)', async () => {
    const blocked = new Error('Forbidden: bot was blocked by the user')
    h.sendMessage.mockRejectedValue(blocked)
    await expect(sendTelegramMessage(123, { text: 'salom' })).rejects.toBe(blocked)
    expect(h.sendMessage).toHaveBeenCalledTimes(1)
  })
})
