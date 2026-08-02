import { Router } from 'express'
import { wrap } from '../../middleware/error-handler'
import { resolveSubject, SUBJECT_REGISTRY } from '../../config/subjects'
import { getProvider } from '../../providers'

const router = Router()

/**
 * GET /api/dashboard?subject=fizika
 *
 * Universal dashboard meta-ma'lumotlari — subject'dan mustaqil format.
 * Backend subjectId → dataSourceId → provider resolve qiladi (frontend
 * qaysi bazadan ekanini bilmaydi).
 *
 * Javob: fan konfigi + baza statistikasi + demo flag + mavjud fanlar ro'yxati.
 */
router.get('/dashboard', wrap(async (req, res) => {
  const subjectParam = typeof req.query['subject'] === 'string' ? req.query['subject'] : undefined
  const entry    = resolveSubject(subjectParam)
  const provider = getProvider(entry.dataSourceId)
  const stats    = await provider.getStats()

  res.json({
    subject: {
      id:       entry.id,
      name:     entry.name,
      nameRu:   entry.nameRu,
      icon:     entry.icon,
      isActive: entry.isActive,
      demoData: entry.demoData,
    },
    stats,
    availableSubjects: SUBJECT_REGISTRY.filter((s) => s.isActive).map((s) => s.id),
  })
}))

export default router
