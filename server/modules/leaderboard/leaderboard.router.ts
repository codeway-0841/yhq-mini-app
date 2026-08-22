/**
 * Leaderboard router.
 */

import { Router }                     from 'express'
import { wrap }                       from '../../middleware/error-handler'
import { parseUserId, parseLimit }    from '../../utils/parse'
import { leaderboardRepository }      from './leaderboard.repository'
import { getOnlineUsers }            from '../../octagon'

import { getLatestTournamentWinners, getTournamentHistory } from './tournament-prize.service'

const router = Router()

// GET /api/leaderboard/tournament-winners → oxirgi haftalik turnir g'oliblari
router.get(
  '/leaderboard/tournament-winners',
  wrap(async (_req, res) => {
    const winners = await getLatestTournamentWinners()
    res.json({ ok: true, winners })
  }),
)

// GET /api/leaderboard/tournament-history?limit=6&userId=<caller> →
// o'tgan N haftalik turnir g'oliblari tarixi (#47 — eng yangi davr birinchi)
router.get(
  '/leaderboard/tournament-history',
  wrap(async (req, res) => {
    const limit     = parseLimit(req.query['limit'], 6, 24)
    const callerUid = parseUserId(String(req.query['userId'] ?? ''))
    const seasons   = await getTournamentHistory(limit, callerUid)
    res.json({ ok: true, seasons })
  }),
)

// GET /api/leaderboard?limit=50&userId=<caller>          → umumiy (all-time) reyting
// GET /api/leaderboard?limit=50&userId=<caller>&mode=daily   → kunlik reyting
// GET /api/leaderboard?limit=50&userId=<caller>&mode=weekly  → haftalik liga reytingi
// GET /api/leaderboard?limit=50&userId=<caller>&mode=monthly → oylik reyting
// GET /api/leaderboard?limit=50&userId=<caller>&mode=duel    → duel (Oktagon) reytingi
// GET /api/leaderboard?userId=<caller>&mode=online          → faqat haqiqiy online ulangan foydalanuvchilar
router.get(
  '/leaderboard',
  wrap(async (req, res) => {
    const limit      = parseLimit(req.query['limit'], 50, 100)
    const callerUid  = parseUserId(String(req.query['userId'] ?? ''))
    const mode       = String(req.query['mode'] ?? '')

    if (mode === 'online') {
      res.json(await getOnlineUsers(callerUid))
      return
    }
    if (mode === 'daily') {
      res.json(await leaderboardRepository.dailyTop(limit, callerUid))
      return
    }
    if (mode === 'weekly') {
      res.json(await leaderboardRepository.weeklyTop(limit, callerUid))
      return
    }
    if (mode === 'monthly') {
      res.json(await leaderboardRepository.monthlyTop(limit, callerUid))
      return
    }
    if (mode === 'duel') {
      const timeframe = (String(req.query['timeframe'] ?? 'all')) as 'daily' | 'weekly' | 'monthly' | 'all'
      res.json(await leaderboardRepository.duelTop(limit, callerUid, timeframe))
      return
    }
    res.json(await leaderboardRepository.topN(limit, callerUid))
  }),
)

export default router
