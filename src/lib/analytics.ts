import { config } from '../config'

/**
 * KPI tracking (1 haftalik sinov) — fire-and-forget, HECH QACHON block/throw qilmaydi.
 * Faqat prod (+ haqiqiy Telegram user) uchun meaningful; dev'da no-op bo'lishi mumkin.
 */
export function track(event: string, props: Record<string, unknown> = {}): void {
  try {
    if (!/^[a-z_]+$/.test(event)) return
    const tg = (window as { Telegram?: { WebApp?: { initData?: string } } }).Telegram?.WebApp
    const initData = tg?.initData
    // Telegram'siz (brauzer) — KPI uchun keraksiz o'lchov; saqaramizmi? hozircha skip
    if (!initData) return
    void fetch(`${config.apiBaseUrl}/analytics`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-telegram-init-data': initData,
      },
      body: JSON.stringify({ event, props }),
      keepalive: true, // sahifa yopilganda ham yetib boradigan kichik payload
    }).catch(() => { /* KPI xatosi ilova oqimiga ta'sir qilmasligi kerak */ })
  } catch { /* noop */ }
}
