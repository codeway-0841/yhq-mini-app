/**
 * Admin authorization middleware — `telegramAuth`dan KEYIN ishlaydi.
 *
 * telegramAuth'dan o'tib kelgan `req.userId` users jadvalidagi
 * `is_admin` bilan tekshiriladi:
 *   - 401: credentials yo'q/noto'g'ri (dev'da req.userId ham yo'q)
 *   - 403: foydalanuvchi mavjud, lekin admin emas
 *   - 200: admin → next()
 *
 * Faqat /api/admin/* route'lari uchun ishlatiladi (boshqa joyga qo'ymang).
 */

import { Request, Response, NextFunction } from 'express'
import { db } from '../db/connection'
import { users } from '../schema'
import { eq } from 'drizzle-orm'

export async function requireAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    // FAQAT auth middleware tomonidan tasdiqlangan req.userId — body/query'dan
    // olish (eski dev fallback) olib tashlandi: NODE_ENV=development qoldirilgan
    // prod host butun admin API'ni credential'siz ochib qoldirardi.
    const uid = (req as { userId?: string }).userId
    if (typeof uid !== 'string' || uid.length === 0) {
      res.status(401).json({ error: 'telegram_user_not_identified' })
      return
    }
    const [user] = await db.select({ isAdmin: users.isAdmin }).from(users).where(eq(users.id, uid))
    if (!user || !user.isAdmin) {
      res.status(403).json({ error: 'admin_required' })
      return
    }
    next()
  } catch {
    // DB xatosi — 5xx emas, aniq 403 (xavfsizlik nuqtai nazardan anonlik
    // parolle aslida bu ichki xato bo'lsa ham)
    res.status(403).json({ error: 'admin_required' })
  }
}
