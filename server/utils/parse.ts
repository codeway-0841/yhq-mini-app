/**
 * Parsing utilities shared across route handlers.
 * Pure functions — no side effects, easy to unit test.
 */

/** Parse a string/number into a positive BigInt. Returns null on failure. */
export function parseBigInt(val: unknown): bigint | null {
  if (val == null) return null
  try {
    const n = BigInt(String(val).trim())
    return n > 0n ? n : null
  } catch {
    return null
  }
}

/** Parse ?limit query param. Returns a clamped integer within [1, max]. */
export function parseLimit(val: unknown, defaultVal: number, max: number): number {
  const n = Number(val ?? defaultVal)
  if (!Number.isFinite(n) || n < 1) return defaultVal
  return Math.min(Math.floor(n), max)
}
