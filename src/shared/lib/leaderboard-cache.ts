/**
 * Leaderboard SWR keshi (audit tezlik skelet muammosi): Dashboard preview va
 * Leaderboard sahifasi HAR ochilishda yangi so'rov kutardi — endi keshdagi
 * ma'lumot DARHOL chiziladi, yangilanish orqa fonda (TTL 60s; tarix 5 daq).
 *
 * Eslatma: entry'lardagi `isYou` bayrog'i USER-SPECIFIC — akkaunt almashganda
 * (account.ts resetAccountState) `invalidateLeaderboardCache()` chaqirilishi
 * shart, aks holda shared qurilmada eski flag ko'rinib qolardi.
 */

import { api, type LeaderboardEntry, type LeagueWeekly, type TournamentSeason } from '../api'
import { createTtlCache } from './ttl-cache'

export interface LeaderboardPreviewEntry {
  rank: number
  name: string
  score: number
  isYou: boolean
}

const previewCache = createTtlCache<LeaderboardPreviewEntry[]>(60_000)
const dailyCache   = createTtlCache<LeaderboardEntry[]>(60_000)
const weeklyCache  = createTtlCache<LeagueWeekly>(60_000)
const monthlyCache = createTtlCache<LeaderboardEntry[]>(60_000)
const seasonsCache = createTtlCache<TournamentSeason[]>(5 * 60_000)

const mapPreview = (r: LeaderboardEntry[]): LeaderboardPreviewEntry[] =>
  r.slice(0, 3).map((e) => ({ rank: e.rank, name: e.name, score: e.score, isYou: e.isYou }))

/** Dashboard preview (top-3) — kesh peek + yangilanish. */
export function getLeaderboardPreview(userId?: string): Promise<LeaderboardPreviewEntry[]> {
  return previewCache.fetch(() => api.getLeaderboard(3, userId).then(mapPreview))
}

export function peekLeaderboardPreview(): LeaderboardPreviewEntry[] | null {
  return previewCache.peek()
}

/** App boot (hydrate'dan keyin): Dashboard ochilgach skeletsiz bo'lishi uchun
 *  preview keshini oldindan isitamiz (fire-and-forget). */
export function prefetchLeaderboardPreview(userId?: string): void {
  void getLeaderboardPreview(userId).catch(() => {})
}

// ── Leaderboard sahifasi (to'liq) — per-tab keshlar ─────────────────────────

export const leaderboardPageCaches = {
  daily:   { peek: dailyCache.peek,   fetch: (userId?: string) => dailyCache.fetch(() => api.getLeaderboardDaily(50, userId)) },
  weekly:  { peek: weeklyCache.peek,  fetch: (userId?: string) => weeklyCache.fetch(() => api.getLeagueWeekly(50, userId)) },
  monthly: { peek: monthlyCache.peek, fetch: (userId?: string) => monthlyCache.fetch(() => api.getLeaderboardMonthly(50, userId)) },
  seasons: { peek: seasonsCache.peek, fetch: (userId?: string) => seasonsCache.fetch(() => api.getTournamentHistory(6, userId).then((r) => r.seasons)) },
}

/** Account switch'da CHAQIRILADI (account.ts) — isYou bayroqlari yangi user'niki bo'lishi shart. */
export function invalidateLeaderboardCache(): void {
  previewCache.invalidate()
  dailyCache.invalidate()
  weeklyCache.invalidate()
  monthlyCache.invalidate()
  seasonsCache.invalidate()
}
