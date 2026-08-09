/**
 * Readiness probe — `/api/ready` endpointi.
 *
 * `/api/health` (liveness: process tirikmi?) dan FARQLI: bu handler
 * "trafik qabul qilishga tayyormizmi?" savoliga javob beradi —
 * DB ping va question pool check majburiy. Deploy/monitoring faqat ready nodeni tanlashi kerak.
 *
 * `ping` inject qilinadi — unit testlar real DB'siz ishlaydi.
 */

import type { Request, Response } from 'express'

export const READINESS_TIMEOUT_MS = 3_000

export function createReadinessHandler(
  ping: () => Promise<unknown>,
  timeoutMs = READINESS_TIMEOUT_MS,
) {
  return async (_req: Request, res: Response): Promise<void> => {
    let timeoutId: NodeJS.Timeout | undefined
    const timeout = new Promise<'timeout'>((resolve) => {
      timeoutId = setTimeout(() => resolve('timeout'), timeoutMs)
    })
    try {
      const result = await Promise.race([ping().then(() => 'ok' as const), timeout])
      if (timeoutId) clearTimeout(timeoutId)
      if (result === 'timeout') {
        res.status(503).json({ status: 'not_ready', reason: 'timeout' })
        return
      }
      res.json({ status: 'ready' })
    } catch (err) {
      if (timeoutId) clearTimeout(timeoutId)
      const msg = err instanceof Error ? err.message : String(err)
      const reason = msg.includes('Question pool') ? 'pool_not_loaded' : 'db_error'
      res.status(503).json({ status: 'not_ready', reason })
    }
  }
}
