/**
 * Parsing utilities shared across route handlers.
 * Pure functions — no side effects, easy to unit test.
 */

/**
 * Canonical user id (text): Telegram userlar Telegram id'sining raqam-string
 * shaklida ('12345...'), telefon+parol akkauntlari 'p_<digits>' formatida.
 * Multi-provider auth (users.id TEXT bo'lganidan keyin) barcha user-scoped
 * route'lar shu parserdan o'tadi — noto'g'ri format 400 beradi.
 */
const USER_ID_RE = /^(?:\d{1,20}|p_\d{9,15}|e_[0-9a-f]{32})$/

/** Parse a route param/query into a canonical user id string. Returns null on failure. */
export function parseUserId(val: unknown): string | null {
  if (val == null) return null
  const s = String(val).trim()
  return USER_ID_RE.test(s) ? s : null
}

/** Parse ?limit query param. Returns a clamped integer within [1, max]. */
export function parseLimit(val: unknown, defaultVal: number, max: number): number {
  const n = Number(val ?? defaultVal)
  if (!Number.isFinite(n) || n < 1) return defaultVal
  return Math.min(Math.floor(n), max)
}
