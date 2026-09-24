/**
 * Worker STRICT path allowlist — faqat 3 shablon; R2 key HECH QACHON
 * xom URL'dan olinmaydi (traversal/arbitrary key rad etiladi).
 */
import { describe, it, expect } from 'vitest'
import { parseContentPath, contentTypeFor } from '../../../workers/question-content/src/paths'

describe('parseContentPath — allowlist qabul qiladi', () => {
  it('manifest', () => {
    expect(parseContentPath('/questions/physics/v12/manifest.json')).toEqual({
      kind: 'manifest', subject: 'physics', version: 12,
      key: 'questions/physics/v12/manifest.json',
    })
  })

  it('chunk', () => {
    expect(parseContentPath('/questions/physics/v12/chunks/chunk-007.json')).toEqual({
      kind: 'chunk', subject: 'physics', version: 12, chunk: '007',
      key: 'questions/physics/v12/chunks/chunk-007.json',
    })
  })

  it('image (content-hash)', () => {
    expect(parseContentPath('/images/physics/0123456789abcdef.webp')).toEqual({
      kind: 'image', subject: 'physics', name: '0123456789abcdef', ext: 'webp',
      key: 'images/physics/0123456789abcdef.webp',
    })
  })

  it('image: png/jpg kengaytmalar ham', () => {
    expect(parseContentPath('/images/physics/0123456789abcdef.png')?.kind).toBe('image')
    expect(parseContentPath('/images/physics/0123456789abcdef.jpg')?.kind).toBe('image')
  })

  it('v1 (birinchi publish) ham yaroqli', () => {
    expect(parseContentPath('/questions/physics/v1/manifest.json')?.version).toBe(1)
  })
})

describe('parseContentPath — path traversal rad etiladi', () => {
  it.each([
    '/questions/physics/v12/../../../secret.json',
    '/questions/physics/v12/..%2F..%2Fsecret.json',
    '/questions/physics/%2e%2e/manifest.json',
    '/questions/physics\\v12\\manifest.json',
    '//questions/physics/v12/manifest.json',
    '/questions//physics/v12/manifest.json',
    '/questions/physics/v12/manifest.json%00',
    '/questions/physics/v12/manifest.json\u0000',
  ])('traversal/encoded: %s → null', (path) => {
    expect(parseContentPath(path)).toBeNull()
  })
})

describe('parseContentPath — arbitrary key / noma\'lum shakl rad etiladi', () => {
  it.each([
    '/',
    '/questions',
    '/questions/physics',
    '/questions/physics/v12',
    '/questions/physics/v12/',
    '/questions/physics/v12/manifest.json/extra',
    '/questions/physics/v12/topics/17/chunk-001.json', // eski per-topic shakl YO'Q
    '/questions/physics/v12/chunks/chunk-7.json',      // 3 xonali bo'lishi shart
    '/questions/physics/v12/chunks/chunk-001.exe',
    '/questions/physics/v12/chunks/../../v11/manifest.json',
    '/questions/physics/v0/manifest.json',             // versiya > 0
    '/questions/physics/vabc/manifest.json',
    '/images/physics/notahash.webp',                   // faqat 16 hex
    '/images/physics/0123456789abcdef.gif',
    '/images/physics/0123456789abcdef.webp/extra',
    '/admin/export',
    '/published.json',
    '/questions/physics/published.json',               // marker client'ga YO'Q
    '/env',
    '/questions/physics/v9999999/manifest.json',       // 6 xonadan oshiq
  ])('rad: %s → null', (path) => {
    expect(parseContentPath(path)).toBeNull()
  })

  it('juda uzun path rad etiladi', () => {
    expect(parseContentPath(`/questions/physics/v12/${'a'.repeat(300)}`)).toBeNull()
  })
})

describe('contentTypeFor', () => {
  it('json → application/json', () => {
    expect(contentTypeFor({ kind: 'manifest', subject: 'physics', version: 1, key: 'x' })).toContain('application/json')
    expect(contentTypeFor({ kind: 'chunk', subject: 'physics', version: 1, chunk: '001', key: 'x' })).toContain('application/json')
  })

  it('image → image/* (webp/png/jpeg)', () => {
    expect(contentTypeFor({ kind: 'image', subject: 'physics', name: 'a', ext: 'webp', key: 'x' })).toBe('image/webp')
    expect(contentTypeFor({ kind: 'image', subject: 'physics', name: 'a', ext: 'png', key: 'x' })).toBe('image/png')
    expect(contentTypeFor({ kind: 'image', subject: 'physics', name: 'a', ext: 'jpg', key: 'x' })).toBe('image/jpeg')
  })
})
