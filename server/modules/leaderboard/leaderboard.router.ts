/**
 * Leaderboard router.
 */

import { Router }                     from 'express'
import { wrap }                       from '../../middleware/error-handler'
import { parseBigInt, parseLimit }    from '../../utils/parse'
import { leaderboardRepository }      from './leaderboard.repository'

const router = Router()

// GET /api/leaderboard?limit=50&userId=<caller>
router.get(
  '/leaderboard',
  wrap(async (req, res) => {
    const limit      = parseLimit(req.query['limit'], 50, 100)
    const callerUid  = parseBigInt(String(req.query['userId'] ?? ''))
    res.json(await leaderboardRepository.topN(limit, callerUid))
  }),
)

export default router
