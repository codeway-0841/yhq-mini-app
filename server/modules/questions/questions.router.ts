import { Router } from 'express'
import { wrap }   from '../../middleware/error-handler'
import { questionsRepository } from './questions.repository'

const router = Router()

// GET /api/questions?topicId=1
router.get('/questions', wrap(async (req, res) => {
  const topicId = req.query['topicId']
  const rows = topicId
    ? await questionsRepository.findByTopic(Number(topicId))
    : await questionsRepository.findAll()
  res.json(rows)
}))

// GET /api/topics
router.get('/topics', wrap(async (_req, res) => {
  const rows = await questionsRepository.findTopics()
  res.json(rows)
}))

export default router
