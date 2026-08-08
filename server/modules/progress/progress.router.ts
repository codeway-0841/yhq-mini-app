/**
 * Progress router.
 */

import { Router }               from 'express'
import { z }                    from 'zod'
import { wrap, AppError }       from '../../middleware/error-handler'
import { validate }             from '../../middleware/validate'
import { parseBigInt }          from '../../utils/parse'
import { rateLimit }            from '../../middleware/rate-limiter'
import { progressRepository }   from './progress.repository'
import { SUBJECT_IDS, resolveSubject } from '../../config/subjects'
import { getProvider }          from '../../providers'
import { tashkentDate }         from '../../utils/date'

const router = Router()

const ResultSchema = z.object({
  questionId:     z.number().int().positive(),
  selectedAnswer: z.string().min(1).max(32).nullable(),
  subjectId:      z.string().refine((id) => SUBJECT_IDS.includes(id), 'Unknown subject'),
  /** Offline outbox idempotency: har mantiqiy javob uchun 1 UUID.
   *  Replay shu token bilan keladi — counterlar FAQAT 1 marta yoziladi. */
  clientToken:    z.string().min(8).max(64).optional(),
})

// POST /api/progress/:userId/result
router.post(
  '/progress/:userId/result',
  rateLimit({ maxPerMinute: 120 }),
  validate({ body: ResultSchema }),
  wrap(async (req, res) => {
    const uid = parseBigInt(req.params['userId'])
    if (!uid) throw new AppError(400, 'Invalid userId')

    const { questionId, selectedAnswer, subjectId, clientToken } = req.body as z.infer<typeof ResultSchema>
    const date = tashkentDate()
    const subject = resolveSubject(subjectId)
    if (!subject.isActive) throw new AppError(400, 'Subject is not active')

    const question = await getProvider(subject.dataSourceId).getQuestionById(questionId)
    if (!question) throw new AppError(404, 'Question not found')
    const correct = selectedAnswer !== null && selectedAnswer === question.correctAnswer

    // Progress counterlari + daily record + streak BITTA atomik SQL statement'da.
    const { updated, dailyStreak, duplicate } = await progressRepository.recordAnswer({
      userId: uid, correct, questionId, date, subjectId, clientToken,
    })
    if (!updated) throw new AppError(404, 'Progress row not found — call /init first')

    // POST-ANSWER REVEAL: correctAnswer endi public /questions'da yo'q —
    // client feedback uchun FAQAT javob bergandan keyin shu yerda oladi.
    // (Reveal "bepul" emas: har reveal attempt sifatida hisobga olingan.)
    res.json({
      ok: true, correct, correctAnswer: question.correctAnswer, dailyStreak,
      ...(duplicate ? { duplicate: true } : {}),
    })
  }),
)

// DELETE /api/progress/:userId  (reset)
router.delete(
  '/progress/:userId',
  wrap(async (req, res) => {
    const uid = parseBigInt(req.params['userId'])
    if (!uid) throw new AppError(400, 'Invalid userId')

    await progressRepository.reset(uid)
    res.json({ ok: true })
  }),
)

export default router
