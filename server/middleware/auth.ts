/**
 * Telegram authentication middleware.
 *
 * Verifies the `x-telegram-init-data` header (HMAC-SHA256, signed by Telegram).
 * When verified, the embedded Telegram user id becomes the ONLY trusted id —
 * the client can no longer spoof `userId` params/body.
 *
 * Enforcement policy:
 *   - Production + BOT_TOKEN set       → required (401 without/invalid)
 *   - Dev / BOT_TOKEN missing          → skipped (open) so local dev still works
 */

import { Request, Response, NextFunction } from 'express'
import { config }          from '../config'
import { verifyInitData }  from '../utils/telegram'

/** Routes whose first path segment carries a userId: /:userId/... */
const USER_SEGMENTS = new Set(['profile', 'progress', 'settings', 'saved', 'users'])

/**
 * Public read-only content — no per-user data, safe to cache on the CDN.
 * Questions/topics are identical for every user, so auth is NOT required.
 * This lets Vercel's CDN serve them from the edge (huge DB-load win).
 */
const PUBLIC_GET = new Set(['questions', 'topics', 'dashboard'])

function isPublicGet(req: Request): boolean {
  if (req.method !== 'GET') return false
  const seg = req.path.split('/').filter(Boolean)[0]
  return PUBLIC_GET.has(seg)
}

export function isAuthEnforced(): boolean {
  return Boolean(config.telegram.botToken) && config.isProd
}

export function telegramAuth(req: Request, res: Response, next: NextFunction): void {
  if (isPublicGet(req)) { next(); return }

  const header = req.headers['x-telegram-init-data']
  const initData = Array.isArray(header) ? header[0] : header

  // Verification is optional outside production — validate when present though
  if (!isAuthEnforced()) {
    if (initData && config.telegram.botToken) {
      const user = verifyInitData(initData, config.telegram.botToken)
      if (user) (req as { telegramUserId?: string }).telegramUserId = String(user.id)
    }
    next()
    return
  }

  if (!initData) {
    res.status(401).json({ error: 'Missing Telegram initData' })
    return
  }

  const user = verifyInitData(initData, config.telegram.botToken!)
  if (!user) {
    res.status(401).json({ error: 'Invalid Telegram initData signature' })
    return
  }

  const verifiedId = String(user.id)
  ;(req as { telegramUserId?: string }).telegramUserId = verifiedId

  // Anti-spoofing: the :userId in the URL must match the verified Telegram id.
  // req.path here is relative to the /api mount point.
  const seg = req.path.split('/').filter(Boolean)
  if (seg.length >= 2 && USER_SEGMENTS.has(seg[0]) && seg[1] !== verifiedId) {
    res.status(403).json({ error: 'Forbidden — cannot access another user\u2019s data' })
    return
  }

  // /init: the id in the body must match the verified Telegram id
  if (seg.length === 1 && seg[0] === 'init' && req.method === 'POST') {
    const bodyId = (req.body as { id?: unknown })?.id
    if (bodyId != null && String(bodyId) !== verifiedId) {
      res.status(403).json({ error: 'Forbidden — id mismatch' })
      return
    }
  }

  next()
}
