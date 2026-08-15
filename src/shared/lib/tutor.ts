import { config } from '../config'
import { getInitData } from '../../platform/telegram'
import { getSessionToken } from './session'

/**
 * AI Tutor — client. POST /api/tutor/explain (premium-only) — SSE streaming.
 *
 * Xato yechilgan savolni AI (Gemini flash) o'quvchiga tabiiy tilda tushuntiradi.
 * Matn qismlari REAL VAQTDA keladi — UI'da "yozib borayotgan" effekt.
 */

/**
 * FREE foydalanuvchilar uchun statik tushuntirish (AI Tutor premium-only o'rniga).
 * 404 → null (ushbu savolga izoh yozilmagan).
 */
export async function fetchStaticExplanation(
  questionId: number,
  lang: 'uz' | 'ru',
): Promise<string | null> {
  try {
    const res = await fetch(`${config.apiBaseUrl}/questions/${questionId}/explanation?lang=${lang}`)
    if (res.status === 404) return null
    if (!res.ok) throw new TutorError('network', `HTTP ${res.status}`)
    const data = (await res.json()) as { text?: string }
    return data.text ?? null
  } catch (err) {
    if (err instanceof TutorError) throw err
    throw new TutorError('network', 'Tarmoq xatosi')
  }
}

/** Xatolik turlari — UI'da holatga qarab xabar ko'rsatish uchun */
export type TutorErrorKind = 'premium_required' | 'unavailable' | 'quota' | 'daily_limit' | 'network'
export class TutorError extends Error {
  kind: TutorErrorKind
  constructor(kind: TutorErrorKind, message: string) {
    super(message)
    this.kind = kind
  }
}

/** SSE stream'dan matn qismlarini o'qiydigan generator */
export async function* explainQuestion(
  questionId: number,
  lang: 'uz' | 'ru',
  answeredCorrect = false,
): AsyncGenerator<string, void, void> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  const initData = getInitData()
  if (initData) {
    headers['x-telegram-init-data'] = initData
  } else {
    const token = getSessionToken()
    if (token) headers['Authorization'] = `Bearer ${token}`
  }

  const res = await fetch(`${config.apiBaseUrl}/tutor/explain`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ questionId, lang, answeredCorrect }),
  })

  if (!res.ok) {
    if (res.status === 403) throw new TutorError('premium_required', 'Premium kerak')
    if (res.status === 429) throw new TutorError('daily_limit', 'Kunlik limit tugadi')
    if (res.status === 503) throw new TutorError('quota', 'AI hozir band')
    if (res.status === 502) throw new TutorError('unavailable', 'AI vaqtincha ishlamayapti')
    throw new TutorError('network', `HTTP ${res.status}`)
  }
  if (!res.body) throw new TutorError('network', 'Stream yo\'q')

  const reader  = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  for (;;) {
    const { done, value } = await reader.read()
    if (done) return
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''
    for (const line of lines) {
      if (!line.startsWith('data:')) continue
      const json = line.slice(5).trim()
      if (json === '[DONE]') return
      try {
        yield (JSON.parse(json) as { text?: string }).text ?? ''
      } catch { /* chunk chegarasida — o'tkazib yuboramiz */ }
    }
  }
}
