/**
 * In-isolate sliding-window limiter — YUMSHOQ anti-scrape ishqalanishi.
 *
 * Ataylab sodda: Cloudflare isolate xotirasida (per-instance, aniq global
 * counter EMAS). Qattiq multi-instance kvotalar token ISSUANCE'da yashaydi
 * (Vercel/Neon: 5/min + kunlik cap) — bu yerda maqsad bitta isolate'ga
 * tushgan skript-burst'ni sekinlashtirish, normal user'ga tegmaslik.
 *
 * Asosiy identitet — token'dagi userId (CGNAT'da IP begonalarni urmasligi
 * uchun); IP faqat burst fallback.
 */

export interface RateResult {
  allowed: boolean
  /** 429 qaytganda Retry-After (sekund) */
  retryAfterSec: number
  limitedBy: 'user' | 'ip' | null
}

interface Bucket {
  timestamps: number[]
}

export class SlidingWindowLimiter {
  private buckets = new Map<string, Bucket>()

  constructor(
    private readonly maxUserPerWindow: number,
    private readonly maxIpPerWindow: number,
    private readonly windowMs = 60_000,
  ) {}

  private consume(key: string, max: number, now: number): { allowed: boolean; oldestInWindow: number | null } {
    let bucket = this.buckets.get(key)
    if (!bucket) {
      bucket = { timestamps: [] }
      this.buckets.set(key, bucket)
    }
    const cutoff = now - this.windowMs
    // Eskirgan yozuvlarni tozalash (massiv kichik — 300/60s)
    bucket.timestamps = bucket.timestamps.filter((t) => t > cutoff)
    if (bucket.timestamps.length >= max) {
      return { allowed: false, oldestInWindow: bucket.timestamps[0] ?? null }
    }
    bucket.timestamps.push(now)
    return { allowed: true, oldestInWindow: null }
  }

  /** userKey — token sub; ipKey — CF-Connecting-IP. now injektsiya (test). */
  check(userKey: string | null, ipKey: string | null, now = Date.now()): RateResult {
    if (userKey) {
      const hit = this.consume(`u:${userKey}`, this.maxUserPerWindow, now)
      if (!hit.allowed) {
        return { allowed: false, retryAfterSec: this.retryAfter(hit.oldestInWindow, now), limitedBy: 'user' }
      }
    }
    if (ipKey) {
      const hit = this.consume(`i:${ipKey}`, this.maxIpPerWindow, now)
      if (!hit.allowed) {
        return { allowed: false, retryAfterSec: this.retryAfter(hit.oldestInWindow, now), limitedBy: 'ip' }
      }
    }
    return { allowed: true, retryAfterSec: 0, limitedBy: null }
  }

  private retryAfter(oldestInWindow: number | null, now: number): number {
    if (oldestInWindow === null) return 1
    return Math.max(1, Math.ceil((oldestInWindow + this.windowMs - now) / 1000))
  }

  /** Xotira oqmasligi uchun davriy tozalash (handler'dan chaqiriladi). */
  sweep(now = Date.now()): void {
    const cutoff = now - this.windowMs
    for (const [key, bucket] of this.buckets) {
      bucket.timestamps = bucket.timestamps.filter((t) => t > cutoff)
      if (bucket.timestamps.length === 0) this.buckets.delete(key)
    }
  }

  get size(): number {
    return this.buckets.size
  }
}
