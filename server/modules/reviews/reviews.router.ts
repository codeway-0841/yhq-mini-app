/**
 * Reviews router — user review CRUD + helpful toggle.
 */
import { Router } from 'express'
import { z } from 'zod'
import { wrap, AppError } from '../../middleware/error-handler'
import { validate } from '../../middleware/validate'
import { SUBJECT_IDS } from '../../config/subjects'
import { reviewsRepository } from './reviews.repository'

const router = Router()

const SubjectSchema = z.enum(SUBJECT_IDS as [string, ...string[]]).optional()

const CreateReviewBody = z.object({
  subjectId: SubjectSchema,
  rating: z.number().int().min(1).max(5),
  title: z.string().trim().min(1).max(100),
  comment: z.string().trim().min(3).max(1000),
})

const ListQuery = z.object({
  subjectId: z.string().optional(),
  rating: z.coerce.number().int().min(1).max(5).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
})

// GET /api/reviews — public (tasdiqlangan sharhlar)
router.get(
  '/reviews',
  validate({ query: ListQuery }),
  wrap(async (req, res) => {
    const { subjectId, rating, limit, offset } = req.query as unknown as z.infer<typeof ListQuery>
    const [list, summary] = await Promise.all([
      reviewsRepository.listApproved({ subjectId, rating, limit, offset }),
      reviewsRepository.getSummary(subjectId),
    ])

    // If user is authenticated, include their liked review IDs
    const userId = (req as { userId?: string }).userId
    let likedIds: number[] = []
    if (userId) {
      const set = await reviewsRepository.getUserLikedIds(userId)
      likedIds = [...set]
    }

    res.json({ ok: true, reviews: list, summary, likedIds })
  }),
)

// POST /api/reviews — authenticated (yangi sharh)
router.post(
  '/reviews',
  validate({ body: CreateReviewBody }),
  wrap(async (req, res) => {
    const userId = (req as { userId?: string }).userId
    if (!userId) throw new AppError(401, 'Authentication required')

    // Har user faqat 1 ta faol sharh
    const hasActive = await reviewsRepository.hasActiveReview(userId)
    if (hasActive) throw new AppError(409, 'Sizda allaqachon sharh mavjud')

    const body = req.body as z.infer<typeof CreateReviewBody>
    const review = await reviewsRepository.create(userId, body)
    res.status(201).json({ ok: true, review })
  }),
)

// POST /api/reviews/:id/helpful — authenticated (foydali toggle)
router.post(
  '/reviews/:id/helpful',
  wrap(async (req, res) => {
    const userId = (req as { userId?: string }).userId
    if (!userId) throw new AppError(401, 'Authentication required')

    const reviewId = Number(req.params['id'])
    if (!Number.isInteger(reviewId) || reviewId < 1) throw new AppError(400, 'Invalid review id')

    const result = await reviewsRepository.toggleHelpful(reviewId, userId)
    res.json({ ok: true, ...result })
  }),
)

export default router
