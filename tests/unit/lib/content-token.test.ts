/**
 * Client kontent tokeni ushlab turuvchi (R2/Worker, BARCHA fanlar).
 *
 * Invariantlar:
 *  - har fan uchun alohida token (Map) + segment indeksi;
 *  - single-flight: parallel so'rovlar BITTA issuance'da birlashadi;
 *  - TTL 80% o'tganda yangilash;
 *  - rasm URL = Worker domen + ?ct=<token> (R2 CREDENTIAL YO'Q — faqat
 *    qisqa kontent tokeni); token segment bo'yicha topiladi (client'da
 *    fan↔segment MAPPING YO'Q);
 *  - token xotirada (localStorage'ga YO'Q).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../../src/shared/config', () => ({
  config: { contentWorkerUrl: 'https://content.kivvi.uz' },
}))

const h = vi.hoisted(() => ({
  calls: 0,
  expiresAt: new Date(Date.now() + 600_000).toISOString(),
  fail: null as Error | null,
}))

vi.mock('../../../src/shared/api', () => ({
  api: {
    getContentToken: vi.fn(async (subjectId: string) => {
      h.calls += 1
      if (h.fail) throw h.fail
      return {
        token: `tok-${subjectId}-${h.calls}`,
        expiresAt: h.expiresAt,
        version: 'cv1',
        segment: subjectId === 'fizika' ? 'physics' : subjectId,
      }
    }),
  },
}))

import {
  getContentToken,
  getContentTokenState,
  getCurrentContentToken,
  buildContentImageUrl,
  clearContentToken,
} from '../../../src/shared/lib/content-token'

beforeEach(() => {
  clearContentToken()
  h.calls = 0
  h.fail = null
  h.expiresAt = new Date(Date.now() + 600_000).toISOString()
  vi.useRealTimers()
})

describe('getContentToken — multi-fan holder', () => {
  it('birinchi chaqiruv token oladi va KESHlaydi (ikkinchisida API YO\'Q)', async () => {
    const t1 = await getContentToken('fizika')
    const t2 = await getContentToken('fizika')
    expect(t1).toBe('tok-fizika-1')
    expect(t2).toBe('tok-fizika-1')
    expect(h.calls).toBe(1)
  })

  it('har fan ALOHIDA token oladi (Worker scope: sid+versiya)', async () => {
    const fiz = await getContentToken('fizika')
    const mat = await getContentToken('matematika')
    expect(fiz).toBe('tok-fizika-1')
    expect(mat).toBe('tok-matematika-2')
    expect(h.calls).toBe(2)
  })

  it('SINGLE-FLIGHT: 5 parallel so\'rov → 1 issuance', async () => {
    const results = await Promise.all(Array.from({ length: 5 }, () => getContentToken('fizika')))
    expect(new Set(results).size).toBe(1)
    expect(h.calls).toBe(1)
  })

  it('TTL 80% o\'tsa yangi token olinadi', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-24T00:00:00Z'))
    h.expiresAt = new Date('2026-09-24T00:10:00Z').toISOString()
    await getContentToken('fizika')
    // 9 daqiqa o'tdi (TTL 90%)
    vi.setSystemTime(new Date('2026-09-24T00:09:00Z'))
    const t2 = await getContentToken('fizika')
    expect(t2).toBe('tok-fizika-2')
    expect(h.calls).toBe(2)
  })

  it('API xato → throw (caller fallback qiladi), keyingi chaqiruvda qayta urinadi', async () => {
    h.fail = new Error('503')
    await expect(getContentToken('fizika')).rejects.toThrow('503')
    h.fail = null
    await expect(getContentToken('fizika')).resolves.toBe('tok-fizika-2')
  })

  it('state segment bilan qaytadi (server SSOT)', async () => {
    const state = await getContentTokenState('fizika')
    expect(state.segment).toBe('physics')
    const mat = await getContentTokenState('matematika')
    expect(mat.segment).toBe('matematika')
  })
})

describe('buildContentImageUrl — rasm URL xavfsizligi', () => {
  it('/images/<segment>/ yo\'li → Worker domen + ?ct=<shu segment tokeni>', async () => {
    await getContentToken('fizika')
    await getContentToken('matematika')
    const urlFiz = buildContentImageUrl('/images/physics/0123456789abcdef.webp')
    const urlMat = buildContentImageUrl('/images/matematika/0123456789abcdef.webp')
    expect(urlFiz).toBe('https://content.kivvi.uz/images/physics/0123456789abcdef.webp?ct=tok-fizika-1')
    expect(urlMat).toBe('https://content.kivvi.uz/images/matematika/0123456789abcdef.webp?ct=tok-matematika-2')
  })

  it('URL\'da R2 CREDENTIAL YO\'Q — faqat qisqa kontent tokeni', async () => {
    await getContentToken('fizika')
    const url = buildContentImageUrl('/images/physics/0123456789abcdef.webp')!
    expect(url).not.toContain('X-Amz-Signature')
    expect(url).not.toContain('X-Amz-Credential')
    expect(url).not.toContain('cloudflarestorage.com')
  })

  it('token yo\'q segment → token\'siz Worker URL (Worker 401 qaytaradi, graceful)', async () => {
    await getContentToken('fizika')
    const url = buildContentImageUrl('/images/matematika/0123456789abcdef.webp')
    expect(url).toBe('https://content.kivvi.uz/images/matematika/0123456789abcdef.webp')
    expect(url).not.toContain('ct=')
  })

  it('R2 image shakliga mos kelmagan yo\'l → null (caller eski formatga o\'tkazadi)', () => {
    expect(buildContentImageUrl('/physics-print/x.webp')).toBeNull()
    expect(buildContentImageUrl('https://cdn.example.com/x.webp')).toBeNull()
    expect(buildContentImageUrl('/images/physics/notahash.webp')).toBeNull()
  })

  it('eskirgan token sinxron o\'qishda qaytarilmaydi', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-24T00:00:00Z'))
    h.expiresAt = new Date('2026-09-24T00:10:00Z').toISOString()
    await getContentToken('fizika')
    vi.setSystemTime(new Date('2026-09-24T00:11:00Z')) // TTL o'tdi
    expect(getCurrentContentToken('fizika')).toBeNull()
    expect(buildContentImageUrl('/images/physics/0123456789abcdef.webp'))
      .toBe('https://content.kivvi.uz/images/physics/0123456789abcdef.webp')
  })
})
