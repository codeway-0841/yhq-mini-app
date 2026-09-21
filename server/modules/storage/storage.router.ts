/**
 * Storage Router — HTTP upload endpoints for images
 */

import { Router } from 'express'
import { z } from 'zod'
import { wrap, AppError } from '../../middleware/error-handler'
import { validate } from '../../middleware/validate'
import { dbRateLimit } from '../../middleware/db-rate-limiter'
import { identityKey } from '../../middleware/rate-limiter'
import { requireAdmin } from '../../middleware/admin'
import { storageService } from './storage.service'
import type { ImageType } from './storage.types'

const router = Router()

const uploadLimiter = dbRateLimit({
  maxPerMinute: 20,
  bucket: 'image:upload',
  keyFn: identityKey,
})

const ImageTypeEnum = z.enum(['avatar', 'badge', 'book_cover', 'test_image', 'general'])

const JsonUploadSchema = z.object({
  /** Base64 string yoki data:image/... URL */
  image: z.string().min(1, 'Rasm yuborilishi shart').max(15_000_000, 'Fayl hajmi 10MB dan oshmasligi kerak'),
  type: ImageTypeEnum.default('general'),
  filename: z.string().max(255).optional(),
})

/** Parse base64 or data URL into a binary buffer */
export function parseImagePayload(raw: string): { buffer: Buffer; mimeType?: string } {
  const trimmed = raw.trim()
  const dataUrlMatch = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/.exec(trimmed)

  if (dataUrlMatch) {
    const mimeType = dataUrlMatch[1]
    const base64Data = dataUrlMatch[2]!
    const buffer = Buffer.from(base64Data, 'base64')
    return { buffer, mimeType }
  }

  // Plain base64 string
  const buffer = Buffer.from(trimmed, 'base64')
  return { buffer }
}

// ── POST /api/upload/image — Foydalanuvchi/umumiy rasm yuklash ─────────────
router.post(
  '/upload/image',
  uploadLimiter,
  validate({ body: JsonUploadSchema }),
  wrap(async (req, res) => {
    const { image, type, filename } = req.body as z.infer<typeof JsonUploadSchema>
    const userId = (req as { userId?: string }).userId

    const { buffer, mimeType } = parseImagePayload(image)
    if (buffer.length === 0) {
      throw new AppError(400, 'Bo\'sh rasm ma\'lumoti')
    }

    const stored = await storageService.uploadImage({
      fileBuffer: buffer,
      mimeType,
      type: type as ImageType,
      originalName: filename,
      userId,
    })

    res.status(201).json({
      ok: true,
      image: {
        id: stored.id,
        hash: stored.hash,
        type: stored.type,
        key: stored.key,
        publicUrl: stored.publicUrl,
        width: stored.width,
        height: stored.height,
        sizeBytes: stored.sizeBytes,
        mime: stored.mime,
        variants: stored.variants,
        isDuplicate: stored.isDuplicate ?? false,
      },
    })
  }),
)

// ── POST /api/admin/upload — Admin aktivlarini yuklash (badge, cover, test image) ─
router.post(
  '/admin/upload',
  requireAdmin,
  validate({ body: JsonUploadSchema }),
  wrap(async (req, res) => {
    const { image, type, filename } = req.body as z.infer<typeof JsonUploadSchema>
    const userId = (req as { userId?: string }).userId

    const { buffer, mimeType } = parseImagePayload(image)
    if (buffer.length === 0) {
      throw new AppError(400, 'Bo\'sh rasm ma\'lumoti')
    }

    const stored = await storageService.uploadImage({
      fileBuffer: buffer,
      mimeType,
      type: type as ImageType,
      originalName: filename,
      userId,
    })

    res.status(201).json({
      ok: true,
      image: {
        id: stored.id,
        hash: stored.hash,
        type: stored.type,
        key: stored.key,
        publicUrl: stored.publicUrl,
        width: stored.width,
        height: stored.height,
        sizeBytes: stored.sizeBytes,
        mime: stored.mime,
        variants: stored.variants,
        isDuplicate: stored.isDuplicate ?? false,
      },
    })
  }),
)

export default router
