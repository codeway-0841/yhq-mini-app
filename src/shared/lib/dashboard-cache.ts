/**
 * Dashboard kartalarining SWR keshlari — SHARED qatlamda, feature ichida emas.
 *
 * Nima uchun bu yerda: karta (BossCard) lazy chunk'da
 * yashaydi, ya'ni uning so'rovi Dashboard MOUNT bo'lgandan keyin
 * boshlanardi — splash tugagach yana round-trip. Kesh shu modulda
 * bo'lgani uchun App boot'i uni chunk'ni tortmasdan oldindan isita
 * oladi (`prefetchDashboardCards`), so'rov auth bilan PARALLEL ketadi.
 *
 * Persist qilinadi: Mini App har ochilishda sahifani qayta
 * yuklaydi, shuning uchun faqat xotiradagi kesh boot'da hech qachon
 * to'lmasdi va user har safar skelet ko'rardi.
 */

import { api } from '../api'
import { createTtlCache } from './ttl-cache'

export type BossState = Awaited<ReturnType<typeof api.getBossState>>

export const bossCache = createTtlCache<BossState>(60_000, {
  persistKey: 'boss-state',
  maxAgeMs:   24 * 3600_000,
})

/**
 * Boss trust-boundary: buzilgan payload (`{ok:true}` kabi) — THROW.
 * BossCard catch'da `failed` ga tushib jimgina yashirinadi (butun Dashboard
 * ErrorBoundary'ga EMAS). Maydonlar minimal shaklda tekshiriladi — BossCard
 * ularni shartsiz o'qiydi (toLocaleString, .length).
 */
export function normalizeBossState(r: unknown): BossState | null {
  if (!r || typeof r !== 'object') return null
  const s = r as Record<string, unknown>
  if (typeof s.hpTotal !== 'number' || typeof s.totalDamage !== 'number') return null
  if (typeof s.bossKey !== 'string' || typeof s.periodKey !== 'string') return null
  if (typeof s.status !== 'string' || !Array.isArray(s.top)) return null
  return s as unknown as BossState
}

export const fetchBossState = () =>
  bossCache.fetch(async () => {
    const s = normalizeBossState(await api.getBossState())
    if (!s) throw new Error('boss_malformed')
    return s
  })

/** App boot'dan (hydrate'dan keyin) — fire-and-forget, boot'ni kutdirmaydi. */
export function prefetchDashboardCards(): void {
  void fetchBossState().catch(() => {})
}
