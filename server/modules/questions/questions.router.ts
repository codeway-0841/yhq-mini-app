import { Router } from 'express'
import { wrap }   from '../../middleware/error-handler'
import { questionsRepository } from './questions.repository'

const router = Router()

/**
 * Public content — CDN edge cache (24 h) + browser cache (1 h).
 * Kontent faqat qo'lda yangilanadi (seed), shuning uchun kunlik cache ok.
 */
const CONTENT_CACHE = 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=3600'

// GET /api/questions?topicId=1
router.get('/questions', wrap(async (req, res) => {
  const topicId = req.query['topicId']
  const rows = topicId
    ? await questionsRepository.findByTopic(Number(topicId))
    : await questionsRepository.findAll()
  res.set('Cache-Control', CONTENT_CACHE)
  res.json(rows)
}))

// GET /api/topics
router.get('/topics', wrap(async (_req, res) => {
  const rows = await questionsRepository.findTopics()
  res.set('Cache-Control', CONTENT_CACHE)
  res.json(rows)
}))

export default router
