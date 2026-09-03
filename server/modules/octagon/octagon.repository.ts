/**
 * Octagon PvP — Database Access qatlami.
 * Drizzle ORM / SQL so'rovlari va bazaga yozish/o'qish amallari faqat shu yerda.
 */

import { inArray, sql, eq } from 'drizzle-orm'
import { db } from '../../db/connection'
import { users, progress } from '../../schema'
import { progressRepository, type DuelResultRow } from '../progress/progress.repository'
import type { LeaderboardEntry } from '../leaderboard/leaderboard.repository'

export const AVATAR_UID_RE = /^(?:\d{1,20}|p_\d{9,15}|e_[0-9a-f]{32})$/

const ONLINE_CACHE_TTL_MS = 5_000

let onlineRowsCache: { at: number; gen: number; rows: LeaderboardEntry[] } | null = null

// ── Online users cache & query ─────────────────────────────────────────────

/** Online userlarning profil qatorlari — generation + 5s TTL keshli snapshot (isYou: false). */
export async function fetchOnlineRowsCached(onlineUserIds: string[], onlineGen: number): Promise<LeaderboardEntry[]> {
  const c = onlineRowsCache
  if (c && c.gen === onlineGen && Date.now() - c.at < ONLINE_CACHE_TTL_MS) {
    return c.rows
  }
  const validIds = onlineUserIds.filter((id) => AVATAR_UID_RE.test(id))
  if (validIds.length === 0) {
    onlineRowsCache = { at: Date.now(), gen: onlineGen, rows: [] }
    return []
  }
  try {
    const rows = await db
      .select({
        id:              users.id,
        firstName:       users.firstName,
        lastName:        users.lastName,
        photoUrl:        users.photoUrl,
        hasCustomAvatar: sql<boolean>`(${users.avatarWebp} IS NOT NULL)`,
        avatarFrame:     users.avatarFrame,
        streak:          sql<number>`COALESCE(${progress.streak}, 0)`,
        score:           sql<number>`COALESCE(${progress.octagonWins}, 0)`,
      })
      .from(users)
      .leftJoin(progress, eq(progress.userId, users.id))
      .where(inArray(users.id, validIds))

    const mapped: LeaderboardEntry[] = rows.map((r, i) => ({
      rank: i + 1,
      userId: r.id,
      name: `${r.firstName} ${r.lastName ?? ''}`.trim(),
      score: Number(r.score),
      streak: Number(r.streak),
      isYou: false,
      photoUrl: r.photoUrl || null,
      hasCustomAvatar: !!r.hasCustomAvatar,
      avatarFrame: r.avatarFrame ?? null,
    }))
    onlineRowsCache = { at: Date.now(), gen: onlineGen, rows: mapped }
    return mapped
  } catch (err) {
    console.error('[octagon.repository] online rows error:', err)
    return onlineRowsCache?.rows ?? []
  }
}

/** Hozirgi jonli online foydalanuvchilar ro'yxati (faqat haqiqiy ulanganlar) */
export async function getOnlineUsers(
  onlineUserIds: string[],
  callerUserId: string | null,
  onlineGen: number,
): Promise<LeaderboardEntry[]> {
  const rows = await fetchOnlineRowsCached(onlineUserIds, onlineGen)
  return rows.map((r) => ({ ...r, isYou: callerUserId !== null && r.userId === callerUserId }))
}

// ── Avatar resolve ─────────────────────────────────────────────────────────

export async function resolveAvatars(...ids: string[]): Promise<Map<string, { avatar: string | null; frame: string | null }>> {
  const clean = [...new Set(ids.filter((id) => AVATAR_UID_RE.test(id)))]
  const out = new Map<string, { avatar: string | null; frame: string | null }>()
  if (!clean.length) return out
  try {
    const rows = await db
      .select({
        id:          users.id,
        photoUrl:    users.photoUrl,
        hasCustom:   sql<boolean>`(${users.avatarWebp} IS NOT NULL)`,
        avatarFrame: users.avatarFrame,
      })
      .from(users)
      .where(inArray(users.id, clean))
    for (const r of rows) {
      out.set(r.id, {
        avatar: r.hasCustom ? `/api/avatar/${encodeURIComponent(r.id)}` : (r.photoUrl || null),
        frame:  r.avatarFrame ?? null,
      })
    }
  } catch (err) {
    console.error('[octagon.repository] avatar resolve xatosi (matched davom etadi):', err)
  }
  return out
}

// ── Match results DB operations ────────────────────────────────────────────

/** Oxirgi 24 soatdagi juftlik matchlar soni (anti-farm uchun) */
export async function countDuelPairsLast24h(u1: string, u2: string): Promise<number> {
  return progressRepository.duelPairCountLast24h(u1, u2)
}

/** G'olibga +1 octagon win yozish (fire-and-forget, xatolik log qilinadi) */
export function addOctagonWin(winnerId: string): void {
  if (!winnerId || winnerId === '0') return
  void progressRepository.addOctagonWin(winnerId)
    .catch((err) => console.error('[octagon.repository] addOctagonWin failed:', err?.message ?? err))
}

/** Duel natijalarini DB ga saqlash */
export async function recordDuelResultRows(rows: DuelResultRow[]): Promise<void> {
  if (rows.length === 0) return
  await progressRepository.recordDuelResults(rows)
}
