/**
 * AI Kunlik Test SCHEDULER (Render, 24/7 server — Vercel 60s limitiga sig'maydi).
 *
 * Har soatda "ensure": BUGUN va ERTANGA 2 variant mavjudmi — yo'q bo'lsa
 * generatsiya qilib yozadi. Idempotent: (subject_id, date, slot) UNIQUE +
 * ON CONFLICT DO NOTHING, shuning uchun restart/deploy/multi-tick xavfsiz.
 *
 * Nima uchun Vercel cron emas: 2×45 topshiriq generatsiyasi 5 parallel Gemini
 * chaqiriq × 2 variant — serverless 60s limitiga sig'maydi. Render'dagi
 * server/index.ts 24/7 ishlaydi va DB'ga ulangan — shu yerda yashaydi.
 *
 * GEMINI_API_KEY Render Environment'ga yozilgan bo'lishi SHART — bo'lmasa
 * scheduler o'zini o'chiradi (log'da ko'rinadi).
 */

import { config } from '../../config'
import { Sentry } from '../../utils/sentry'
import { tashkentDate } from '../../utils/date'
import { registerInterval } from '../../utils/shutdown'
import { AI_TEST_SUBJECT_ID, AI_TEST_SLOTS } from '../../../shared/ai-daily-test'
import { aiTestsRepository } from './ai-tests.repository'
import { generateAiDailyTest } from './generator'

const TICK_MS = 60 * 60_000        // soatlik ensure
const BOOT_DELAY_MS = 45_000       // boot'dan keyin (DB/pool isinishi)

let running = false               // tick overlap himoyasi (bitta instansda)

async function ensureFor(date: string): Promise<void> {
  const existing = await aiTestsRepository.getTestsForDate(AI_TEST_SUBJECT_ID, date)
  const have = new Set(existing.map((t) => t.slot))
  for (const slot of AI_TEST_SLOTS) {
    if (have.has(slot)) continue
    console.log(`[ai-tests] ${date} slot ${slot} generatsiya qilinmoqda...`)
    const payload = await generateAiDailyTest(slot)
    const status = await aiTestsRepository.insertGeneratedTest({
      subjectId: AI_TEST_SUBJECT_ID, date, slot, title: payload.title, payload,
    })
    console.log(`[ai-tests] ${date} slot ${slot}: ${status}`)
  }
}

async function tick(): Promise<void> {
  if (running) return
  running = true
  try {
    const today = tashkentDate()
    const tomorrow = tashkentDate(new Date(Date.now() + 24 * 3600_000))
    await ensureFor(today)
    if (tomorrow !== today) await ensureFor(tomorrow)
  } catch (err) {
    console.error('[ai-tests] scheduler tick xatosi:', (err as Error)?.message ?? err)
    Sentry.captureException(err instanceof Error ? err : new Error(String(err)))
  } finally {
    running = false
  }
}

/** server/index.ts'dan bir marta chaqiriladi. */
export function startAiTestScheduler(): void {
  if (!config.ai.geminiApiKey) {
    console.warn('[ai-tests] GEMINI_API_KEY yo‘q — kunlik test scheduler o‘chiq')
    return
  }
  const boot = setTimeout(() => { void tick() }, BOOT_DELAY_MS)
  boot.unref?.()
  registerInterval(setInterval(() => { void tick() }, TICK_MS))
  console.log('[ai-tests] scheduler yoqildi (soatlik ensure: bugun + ertaga)')
}
