/**
 * Image Validation Module
 *
 * Verifies magic bytes, declared MIME type, size boundaries, and image decodability.
 */

import sharp from 'sharp'
import type { ImageType, ImageValidationResult } from './storage.types'

export const DEFAULT_MAX_SIZE_BYTES = 10 * 1024 * 1024 // 10 MB
export const AVATAR_MAX_SIZE_BYTES = 5 * 1024 * 1024   // 5 MB

export const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
])

/**
 * Magic bytes sniffing
 */
export function detectImageFormat(buffer: Buffer): 'jpeg' | 'png' | 'webp' | null {
  if (!buffer || buffer.length < 12) return null

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'jpeg'
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return 'png'
  }

  // WebP: 'RIFF' at 0..3 and 'WEBP' at 8..11
  if (
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return 'webp'
  }

  return null
}

export function getMaxSizeBytes(type?: ImageType): number {
  if (type === 'avatar') return AVATAR_MAX_SIZE_BYTES
  return DEFAULT_MAX_SIZE_BYTES
}

/**
 * Validates buffer format, size, magic bytes, and decodability.
 */
export async function validateImageBuffer(
  buffer: Buffer,
  declaredMime?: string,
  options?: { maxSize?: number; type?: ImageType },
): Promise<ImageValidationResult> {
  const sizeBytes = buffer?.length ?? 0
  if (!buffer || sizeBytes === 0) {
    return {
      valid: false,
      mimeType: '',
      format: 'jpeg',
      sizeBytes: 0,
      error: 'Bo\'sh rasm fayli yuborildi',
    }
  }

  const maxLimit = options?.maxSize ?? getMaxSizeBytes(options?.type)
  if (sizeBytes > maxLimit) {
    const maxMb = Math.round(maxLimit / (1024 * 1024))
    return {
      valid: false,
      mimeType: declaredMime || '',
      format: 'jpeg',
      sizeBytes,
      error: `Rasm hajmi ${maxMb}MB dan oshmasligi kerak (joriy hajm: ${(sizeBytes / (1024 * 1024)).toFixed(2)}MB)`,
    }
  }

  const magicFormat = detectImageFormat(buffer)
  if (!magicFormat) {
    return {
      valid: false,
      mimeType: declaredMime || '',
      format: 'jpeg',
      sizeBytes,
      error: 'Qo\'llab-quvvatlanmaydigan fayl formati. Faqat JPG, PNG va WebP qabul qilinadi',
    }
  }

  if (declaredMime) {
    const norm = declaredMime.toLowerCase().trim()
    if (!ALLOWED_MIME_TYPES.has(norm)) {
      return {
        valid: false,
        mimeType: norm,
        format: magicFormat,
        sizeBytes,
        error: `Ruxsat etilmagan MIME type: ${norm}. Faqat image/jpeg, image/png, image/webp qabul qilinadi`,
      }
    }
  }

  // Verify that Sharp can decode the image
  try {
    const metadata = await sharp(buffer).metadata()
    if (!metadata.width || !metadata.height) {
      return {
        valid: false,
        mimeType: `image/${magicFormat}`,
        format: magicFormat,
        sizeBytes,
        error: 'Rasm o\'lchamlarini aniqlab bo\'lmadi yoki rasm fayli buzilgan',
      }
    }

    return {
      valid: true,
      mimeType: `image/${magicFormat}`,
      format: magicFormat,
      sizeBytes,
      width: metadata.width,
      height: metadata.height,
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Noma\'lum xato'
    return {
      valid: false,
      mimeType: `image/${magicFormat}`,
      format: magicFormat,
      sizeBytes,
      error: `Rasm faylini o'qib bo'lmadi: ${msg}`,
    }
  }
}
