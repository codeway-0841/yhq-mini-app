/**
 * Boss Battle router — faqat O'QISH. Zarar POST'lar yo'q (scoring trust
 * boundary): zarar FAQAT progress /result gate'dan o'tgan fresh to'g'ri
 * javobdan server tomonidan qo'llanadi.
 */
import { Router } from 'express'
import { wrap, AppError } from '../../middleware/error-handler'
import { bossPeriodKey } from '../../../shared/boss-battle'
import { bossRepository } from './boss.repository'

const router = Router()

function requireUserId(req: unknown): string {
  const userId = (req as { userId?: string }).userId
  if (!userId || userId === '0') {
    throw new AppError(401, 'AUTH_REQUIRED')
  }
  return userId
}

// GET /api/boss/state — joriy hafta bossi + mening zararam + top-3 (lazy yaratiladi)
router.get(
  '/boss/state',
  wrap(async (req, res) => {
    const userId = requireUserId(req)
    const periodKey = bossPeriodKey()
    const state = await bossRepository.getState(userId, periodKey)
    if (!state) throw new AppError(500, 'BOSS_STATE_FAILED')
    res.json({ ok: true, periodKey, ...state })
  }),
)

export default router
