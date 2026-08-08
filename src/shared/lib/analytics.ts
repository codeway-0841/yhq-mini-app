import { config } from '../config'
import { getInitData } from '../../platform/telegram'
import { getSessionToken } from './session'

/**
 * KPI tracking (1 haftalik sinov) — fire-and-forget, HECH QACHON block/throw qilmaydi.
 * Auth credential: initData (Mini App) YOKI Bearer session (telefon/widget login) —
 * ikkalovidan biri bo'lmasa event yuborilmaydi (mehmon rejim yo'q).
 */
export function track(event: string, props: Record<string, unknown> = {}): void {
  try {
    if (!/^[a-z_]+$/.test(event)) return
    const initData = getInitData()
    const sessionToken = getSessionToken()
    // Ikkala credential ham yo'q (aniqlanmagan brauzer preview) — KPI skip
    if (!initData && !sessionToken) return
    void fetch(`${config.apiBaseUrl}/analytics`, {
      method: 'POST',
      headers: initData
        ? { 'Content-Type': 'application/json', 'x-telegram-init-data': initData }
        : { 'Content-Type': 'application/json', Authorization: `Bearer ${sessionToken!}` },
      body: JSON.stringify({ event, props }),
      keepalive: true, // sahifa yopilganda ham yetib boradigan kichik payload
    }).catch(() => { /* KPI xatosi ilova oqimiga ta'sir qilmasligi kerak */ })
  } catch { /* noop */ }
}
