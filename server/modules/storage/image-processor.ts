/**
 * Image Processing & Optimization Pipeline (Sharp)
 *
 * Converts input images to high-efficiency WebP (quality 80, transparency preserved)
 * and generates required size variants for each image category.
 */

import { createHash } from 'node:crypto'
import sharp from 'sharp'
import type { ImageType, ImageVariantSpec, ProcessedImage, ImageVariantResult } from './storage.types'

export const IMAGE_TYPE_VARIANTS: Record<ImageType, ImageVariantSpec[]> = {
  avatar: [
    { name: '64', width: 64, height: 64, fit: 'cover' },
    { name: '128', width: 128, height: 128, fit: 'cover' },
    { name: '256', width: 256, height: 256, fit: 'cover' },
  ],
  badge: [
    { name: '64', width: 64, height: 64, fit: 'contain' },
    { name: '128', width: 128, height: 128, fit: 'contain' },
    { name: '256', width: 256, height: 256, fit: 'contain' },
    { name: '512', width: 512, height: 512, fit: 'contain' },
  ],
  book_cover: [
    { name: '300x450', width: 300, height: 450, fit: 'cover' },
    { name: '600x900', width: 600, height: 900, fit: 'cover' },
  ],
  test_image: [
    { name: '1200', width: 1200, fit: 'inside', withoutEnlargement: true },
  ],
  general: [
    { name: 'default', width: 1600, fit: 'inside', withoutEnlargement: true },
  ],
}

export function computeSha256(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex')
}

/**
 * Optimizes a buffer into WebP with specified size and fit
 */
export async function optimizeToWebpVariant(
  inputBuffer: Buffer,
  spec: ImageVariantSpec,
): Promise<{ buffer: Buffer; width: number; height: number }> {
  let pipeline = sharp(inputBuffer)

  // Rotate based on EXIF orientation tag if present
  pipeline = pipeline.rotate()

  if (spec.fit === 'contain') {
    pipeline = pipeline.resize(spec.width, spec.height, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
      withoutEnlargement: spec.withoutEnlargement ?? false,
    })
  } else if (spec.fit === 'inside') {
    pipeline = pipeline.resize(spec.width, spec.height, {
      fit: 'inside',
      withoutEnlargement: spec.withoutEnlargement ?? true,
    })
  } else {
    // 'cover' / square crop
    pipeline = pipeline.resize(spec.width, spec.height, {
      fit: 'cover',
      position: sharp.strategy.attention, // smart crop focusing on visually interesting areas
      withoutEnlargement: spec.withoutEnlargement ?? false,
    })
  }

  // WebP 80 quality with transparent alpha preservation
  const optimizedBuffer = await pipeline
    .webp({
      quality: 80,
      alphaQuality: 100,
      effort: 4,
    })
    .toBuffer()

  const meta = await sharp(optimizedBuffer).metadata()

  return {
    buffer: optimizedBuffer,
    width: meta.width ?? spec.width ?? 0,
    height: meta.height ?? spec.height ?? 0,
  }
}

/**
 * Full image processing pipeline for an input buffer and image category.
 */
export async function processImage(
  inputBuffer: Buffer,
  type: ImageType,
  publicUrlResolver: (key: string) => string,
): Promise<ProcessedImage> {
  const hash = computeSha256(inputBuffer)
  const variantSpecs = IMAGE_TYPE_VARIANTS[type] || IMAGE_TYPE_VARIANTS.general

  const variantsRecord: Record<string, ImageVariantResult> = {}
  const bufferMap = new Map<string, Buffer>()

  // Process all variants
  for (const spec of variantSpecs) {
    const { buffer: variantBuffer, width, height } = await optimizeToWebpVariant(inputBuffer, spec)
    const key = `images/${type}/${hash}/${spec.name}.webp`
    const publicUrl = publicUrlResolver(key)

    variantsRecord[spec.name] = {
      key,
      publicUrl,
      width,
      height,
      sizeBytes: variantBuffer.length,
    }
    bufferMap.set(key, variantBuffer)
  }

  // Primary variant selection: largest or default variant
  const primarySpec = variantSpecs[variantSpecs.length - 1]!
  const primaryVariant = variantsRecord[primarySpec.name]!

  return {
    hash,
    type,
    key: primaryVariant.key,
    publicUrl: primaryVariant.publicUrl,
    width: primaryVariant.width,
    height: primaryVariant.height,
    sizeBytes: primaryVariant.sizeBytes,
    mime: 'image/webp',
    variants: variantsRecord,
    bufferMap,
  }
}
