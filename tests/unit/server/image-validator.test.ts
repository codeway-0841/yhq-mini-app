import { describe, it, expect } from 'vitest'
import sharp from 'sharp'
import {
  detectImageFormat,
  validateImageBuffer,
  getMaxSizeBytes,
  AVATAR_MAX_SIZE_BYTES,
  DEFAULT_MAX_SIZE_BYTES,
} from '../../../server/modules/storage/image-validator'

describe('Image Validator Module', () => {
  it('detects format from magic bytes correctly', async () => {
    // Generate valid test buffers with sharp
    const pngBuf = await sharp({
      create: { width: 10, height: 10, channels: 4, background: { r: 255, g: 0, b: 0, alpha: 1 } },
    }).png().toBuffer()

    const jpegBuf = await sharp({
      create: { width: 10, height: 10, channels: 3, background: { r: 0, g: 255, b: 0 } },
    }).jpeg().toBuffer()

    const webpBuf = await sharp({
      create: { width: 10, height: 10, channels: 4, background: { r: 0, g: 0, b: 255, alpha: 0.5 } },
    }).webp().toBuffer()

    expect(detectImageFormat(pngBuf)).toBe('png')
    expect(detectImageFormat(jpegBuf)).toBe('jpeg')
    expect(detectImageFormat(webpBuf)).toBe('webp')

    // Invalid buffer
    expect(detectImageFormat(Buffer.from('not an image at all'))).toBeNull()
    expect(detectImageFormat(Buffer.alloc(5))).toBeNull()
  })

  it('validates a correct PNG image buffer', async () => {
    const pngBuf = await sharp({
      create: { width: 100, height: 100, channels: 4, background: { r: 100, g: 150, b: 200, alpha: 0.8 } },
    }).png().toBuffer()

    const res = await validateImageBuffer(pngBuf, 'image/png')
    expect(res.valid).toBe(true)
    expect(res.format).toBe('png')
    expect(res.mimeType).toBe('image/png')
    expect(res.width).toBe(100)
    expect(res.height).toBe(100)
    expect(res.error).toBeUndefined()
  })

  it('validates a correct JPEG image buffer', async () => {
    const jpegBuf = await sharp({
      create: { width: 200, height: 150, channels: 3, background: { r: 50, g: 50, b: 50 } },
    }).jpeg().toBuffer()

    const res = await validateImageBuffer(jpegBuf, 'image/jpeg')
    expect(res.valid).toBe(true)
    expect(res.format).toBe('jpeg')
    expect(res.width).toBe(200)
    expect(res.height).toBe(150)
  })

  it('validates a correct WebP image buffer with transparency', async () => {
    const webpBuf = await sharp({
      create: { width: 80, height: 80, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
    }).webp().toBuffer()

    const res = await validateImageBuffer(webpBuf, 'image/webp')
    expect(res.valid).toBe(true)
    expect(res.format).toBe('webp')
    expect(res.width).toBe(80)
    expect(res.height).toBe(80)
  })

  it('rejects empty or corrupt buffers', async () => {
    const emptyRes = await validateImageBuffer(Buffer.alloc(0))
    expect(emptyRes.valid).toBe(false)
    expect(emptyRes.error).toContain('Bo\'sh rasm')

    const fakeBuf = Buffer.from('GIF89a fake gif image')
    const fakeRes = await validateImageBuffer(fakeBuf)
    expect(fakeRes.valid).toBe(false)
    expect(fakeRes.error).toContain('Faqat JPG, PNG va WebP')
  })

  it('rejects image exceeding max size', async () => {
    const pngBuf = await sharp({
      create: { width: 10, height: 10, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 1 } },
    }).png().toBuffer()

    const res = await validateImageBuffer(pngBuf, 'image/png', { maxSize: 10 }) // only 10 bytes allowed
    expect(res.valid).toBe(false)
    expect(res.error).toContain('oshmasligi kerak')
  })

  it('enforces avatar max size boundaries', () => {
    expect(getMaxSizeBytes('avatar')).toBe(AVATAR_MAX_SIZE_BYTES)
    expect(getMaxSizeBytes('badge')).toBe(DEFAULT_MAX_SIZE_BYTES)
    expect(getMaxSizeBytes('book_cover')).toBe(DEFAULT_MAX_SIZE_BYTES)
    expect(getMaxSizeBytes('test_image')).toBe(DEFAULT_MAX_SIZE_BYTES)
  })
})
