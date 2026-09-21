import { describe, it, expect } from 'vitest'
import sharp from 'sharp'
import {
  computeSha256,
  optimizeToWebpVariant,
  processImage,
  IMAGE_TYPE_VARIANTS,
} from '../../../server/modules/storage/image-processor'

describe('Image Processor Module (Sharp)', () => {
  it('computes sha256 hash deterministically', () => {
    const buf1 = Buffer.from('hello kivvi image storage')
    const buf2 = Buffer.from('hello kivvi image storage')
    const buf3 = Buffer.from('different image content')

    expect(computeSha256(buf1)).toBe(computeSha256(buf2))
    expect(computeSha256(buf1)).not.toBe(computeSha256(buf3))
    expect(computeSha256(buf1)).toMatch(/^[a-f0-9]{64}$/)
  })

  it('optimizes to WebP and preserves transparency', async () => {
    // Transparent red circle on transparent canvas
    const input = await sharp({
      create: {
        width: 300,
        height: 300,
        channels: 4,
        background: { r: 255, g: 0, b: 0, alpha: 0.5 },
      },
    }).png().toBuffer()

    const variant = await optimizeToWebpVariant(input, {
      name: 'test-128',
      width: 128,
      height: 128,
      fit: 'contain',
    })

    expect(variant.width).toBe(128)
    expect(variant.height).toBe(128)
    expect(variant.buffer.length).toBeGreaterThan(0)

    const meta = await sharp(variant.buffer).metadata()
    expect(meta.format).toBe('webp')
    expect(meta.hasAlpha).toBe(true)
  })

  it('generates all avatar size variants (64, 128, 256)', async () => {
    const input = await sharp({
      create: { width: 500, height: 400, channels: 3, background: { r: 100, g: 200, b: 50 } },
    }).jpeg().toBuffer()

    const processed = await processImage(input, 'avatar', (key) => `https://cdn.kivvi.uz/${key}`)

    expect(processed.type).toBe('avatar')
    expect(processed.mime).toBe('image/webp')
    expect(processed.variants['64']).toBeDefined()
    expect(processed.variants['128']).toBeDefined()
    expect(processed.variants['256']).toBeDefined()

    expect(processed.variants['64']!.width).toBe(64)
    expect(processed.variants['64']!.height).toBe(64)
    expect(processed.variants['256']!.width).toBe(256)
    expect(processed.variants['256']!.height).toBe(256)

    expect(processed.bufferMap.size).toBe(3)
  })

  it('generates all badge size variants (64, 128, 256, 512)', async () => {
    const input = await sharp({
      create: { width: 600, height: 600, channels: 4, background: { r: 255, g: 215, b: 0, alpha: 1 } },
    }).png().toBuffer()

    const processed = await processImage(input, 'badge', (key) => `https://cdn.kivvi.uz/${key}`)

    expect(processed.type).toBe('badge')
    expect(processed.variants['64']).toBeDefined()
    expect(processed.variants['128']).toBeDefined()
    expect(processed.variants['256']).toBeDefined()
    expect(processed.variants['512']).toBeDefined()

    expect(processed.variants['512']!.width).toBe(512)
    expect(processed.variants['512']!.height).toBe(512)
    expect(processed.bufferMap.size).toBe(4)
  })

  it('generates book cover size variants (300x450, 600x900)', async () => {
    const input = await sharp({
      create: { width: 800, height: 1200, channels: 3, background: { r: 30, g: 40, b: 90 } },
    }).jpeg().toBuffer()

    const processed = await processImage(input, 'book_cover', (key) => `https://cdn.kivvi.uz/${key}`)

    expect(processed.type).toBe('book_cover')
    expect(processed.variants['300x450']).toBeDefined()
    expect(processed.variants['600x900']).toBeDefined()

    expect(processed.variants['300x450']!.width).toBe(300)
    expect(processed.variants['300x450']!.height).toBe(450)
    expect(processed.variants['600x900']!.width).toBe(600)
    expect(processed.variants['600x900']!.height).toBe(900)
  })

  it('generates test image variant (max width 1200, without enlargement)', async () => {
    const smallInput = await sharp({
      create: { width: 800, height: 600, channels: 3, background: { r: 200, g: 100, b: 50 } },
    }).jpeg().toBuffer()

    const processed = await processImage(smallInput, 'test_image', (key) => `https://cdn.kivvi.uz/${key}`)

    expect(processed.type).toBe('test_image')
    expect(processed.variants['1200']).toBeDefined()
    // Since input is 800px (<1200) and withoutEnlargement is true, width should stay 800
    expect(processed.variants['1200']!.width).toBe(800)
    expect(processed.variants['1200']!.height).toBe(600)
  })
})
