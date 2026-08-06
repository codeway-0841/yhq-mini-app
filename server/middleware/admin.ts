/**
 * Admin authorization middleware — `telegramAuth`dan KEYIN ishlaydi.
 *
 * telegramAuth'dan o'tib kelgan `req.telegramUserId` users jadvalidagi
 * `is_admin` bilan tekshiriladi:
 *   - 401: initData yo'q/noto'g'ri (dev'da telegramUserId ham yo'q)
 *   - 403: foydalanuvchi mavjud, lekin admin emas
 *   - 200: admin → next()
 *
 * Faqat /api/admin/* route'lari uchun ishlatiladi (boshqa joyga qo'ymang).
 */

import { Request, Response, NextFunction } from 'express'
import { db } from '../db/connection'
import { users } from '../schema'
import { eq } from 'drizzle-orm'
import { isAuthEnforced } from './auth'

export async function requireAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    // Production: faqat telegramAuth tomonidan tasdiqlangan id.
    // Dev/test (auth o'chiq): body yoki query'dagi userId — xuddi boshqa
    // router'lardagi pattern (masalan tutor.router userId query/body oladi).
    const uid = (req as { telegramUserId?: string }).telegramUserId
      ?? (isAuthEnforced() ? undefined : (req.body as { userId?: unknown })?.userId ?? req.query['userId'])
    if (typeof uid !== 'string' || uid.length === 0) {
      res.status(401).json({ error: 'telegram_user_not_identified' })
      return
    }
    const bigintId = BigInt(uid)
    const [user] = await db.select({ isAdmin: users.isAdmin }).from(users).where(eq(users.id, bigintId))
    if (!user || !user.isAdmin) {
      res.status(403).json({ error: 'admin_required' })
      return
    }
    next()
  } catch {
    // BigInt cast xatosi yoki DB xatosi — 5xx emas, aniq 403 (xavfsizlik nuqtai
    // nazardan anonlik parolle aslida bu ichki xato bo'lsa ham)
    res.status(403).json({ error: 'admin_required' })
  }
}
