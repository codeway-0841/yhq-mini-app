import { describe, it, expect, vi, afterEach } from 'vitest'
import { Capacitor } from '@capacitor/core'
import {
  KIVVI_WEB_CDN_URL,
  PUBLIC_R2_CDN_URL,
  fetchRiveAssetBuffer,
  resolveCdnUrl,
  warmRiveAssetCache,
} from '../../../src/shared/config/cdn'
import { formatImageSrc } from '../../../src/features/test/hooks/useImagePreload'

describe('config/cdn — Cloudflare R2 & native media URL resolution', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('brauzerda R2 prefikslarni lokal nisbiy yo‘lda qoldiradi', () => {
    vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(false)
    expect(resolveCdnUrl('/badges/badge-100.webp')).toBe('/badges/badge-100.webp')
    expect(resolveCdnUrl('/images/signs/1.1.webp')).toBe('/images/signs/1.1.webp')
    expect(resolveCdnUrl('/lessons/fizika/ch01/index.html')).toBe('/lessons/fizika/ch01/index.html')
    expect(formatImageSrc('/images/authors/pushkin.jpg')).toBe('/images/authors/pushkin.jpg')
  })

  it('native Android (Capacitor) muhitida og‘ir medialarni Cloudflare R2 va kivvi.uz ga yo‘naltiradi', () => {
    vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(true)

    expect(resolveCdnUrl('/images/signs/1.1.webp')).toBe(`${PUBLIC_R2_CDN_URL}/images/signs/1.1.webp`)
    expect(resolveCdnUrl('/images/authors/pushkin.jpg')).toBe(`${PUBLIC_R2_CDN_URL}/images/authors/pushkin.jpg`)
    expect(resolveCdnUrl('/badges/badge-100.webp')).toBe(`${PUBLIC_R2_CDN_URL}/badges/badge-100.webp`)
    expect(resolveCdnUrl('/leagues/hydrogen.png?v=rive2')).toBe(`${PUBLIC_R2_CDN_URL}/leagues/hydrogen.png?v=rive2`)
    expect(resolveCdnUrl('/brilliant/courses/path-icon-01.png')).toBe(`${PUBLIC_R2_CDN_URL}/brilliant/courses/path-icon-01.png`)
    expect(resolveCdnUrl('/lessons/fizika/ch01/index.html')).toBe(`${PUBLIC_R2_CDN_URL}/lessons/fizika/ch01/index.html`)
    expect(resolveCdnUrl('/pdfjs/cmaps/')).toBe(`${PUBLIC_R2_CDN_URL}/pdfjs/cmaps/`)

    // YHQ / math-print / physics-print / kutubxona mavjud Web CDN yo‘lini saqlaydi
    expect(resolveCdnUrl('/images/yhq/1.webp')).toBe(`${KIVVI_WEB_CDN_URL}/images/yhq/1.webp`)
    expect(formatImageSrc('/images/signs/2.1.webp')).toBe(`${PUBLIC_R2_CDN_URL}/images/signs/2.1.webp`)
  })

  it('fetchRiveAssetBuffer native muhitda lokal 404 bo‘lsa R2 ga tushadi', async () => {
    vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(true)

    const bytes = new Uint8Array([0x52, 0x49, 0x56, 0x45]).buffer
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input)
      if (url === '/brilliant/test-remote-only.riv') {
        return new Response(null, { status: 404 })
      }
      if (url === `${PUBLIC_R2_CDN_URL}/brilliant/test-remote-only.riv`) {
        return new Response(bytes, { status: 200 })
      }
      return new Response(null, { status: 404 })
    })

    const buf = await fetchRiveAssetBuffer('test-remote-only.riv')
    expect(new Uint8Array(buf)).toEqual(new Uint8Array(bytes))
    const calledUrls = fetchSpy.mock.calls.map(([u]) => String(u))
    expect(calledUrls).toContain('/brilliant/test-remote-only.riv')
    expect(calledUrls).toContain(`${PUBLIC_R2_CDN_URL}/brilliant/test-remote-only.riv`)
  })

  it('lokal 200 text/html SPA fallback bo‘lsa ham R2 dan haqiqiy RIVE buferini yuklaydi', async () => {
    vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(true)

    const validRive = new Uint8Array([0x52, 0x49, 0x56, 0x45, 0x07, 0x00]).buffer
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input)
      if (url === '/brilliant/test-spa-html.riv') {
        return new Response('<!doctype html><html></html>', {
          status: 200,
          headers: { 'Content-Type': 'text/html' },
        })
      }
      if (url === `${PUBLIC_R2_CDN_URL}/brilliant/test-spa-html.riv`) {
        return new Response(validRive, { status: 200 })
      }
      return new Response(null, { status: 404 })
    })

    const buf = await fetchRiveAssetBuffer('test-spa-html.riv')
    expect(new Uint8Array(buf)).toEqual(new Uint8Array(validRive))
  })

  it('CacheStorage buzuq yozuvini o‘chiradi va warmRiveAssetCache faqat keshda yo‘q R2 fayllarini yuklaydi', async () => {
    vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(true)

    const validRive = new Uint8Array([0x52, 0x49, 0x56, 0x45, 0x01, 0x02]).buffer
    const corruptUrl = `${PUBLIC_R2_CDN_URL}/brilliant/test-corrupt-cache.riv`
    const cachedAlreadyUrl = `${PUBLIC_R2_CDN_URL}/brilliant/test-already-cached.riv`
    const warmTargetUrl = `${PUBLIC_R2_CDN_URL}/brilliant/test-warm-me.riv`

    const store = new Map<string, Response>([
      [corruptUrl, new Response('bad-html', { status: 200, headers: { 'Content-Type': 'text/html' } })],
      [cachedAlreadyUrl, new Response(validRive.slice(0), { status: 200 })],
    ])
    const deleteSpy = vi.fn(async (key: string) => store.delete(key))
    const putSpy = vi.fn(async (key: string, res: Response) => { store.set(key, res) })
    const fakeCache = {
      match: async (key: string) => store.get(key) ?? undefined,
      put: putSpy,
      delete: deleteSpy,
    }
    vi.stubGlobal('caches', { open: vi.fn(async () => fakeCache) })

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input)
      if (url === corruptUrl || url === warmTargetUrl) {
        return new Response(validRive.slice(0), { status: 200 })
      }
      return new Response(null, { status: 404 })
    })

    const repaired = await fetchRiveAssetBuffer('test-corrupt-cache.riv')
    expect(new Uint8Array(repaired)).toEqual(new Uint8Array(validRive))
    expect(deleteSpy).toHaveBeenCalledWith(corruptUrl)
    expect(putSpy).toHaveBeenCalledWith(corruptUrl, expect.any(Response))

    fetchSpy.mockClear()
    putSpy.mockClear()
    await warmRiveAssetCache(['test-already-cached.riv', 'test-warm-me.riv'])

    const warmedUrls = fetchSpy.mock.calls.map(([u]) => String(u))
    expect(warmedUrls).not.toContain(cachedAlreadyUrl)
    expect(warmedUrls).toContain(warmTargetUrl)
    expect(putSpy).toHaveBeenCalledWith(warmTargetUrl, expect.any(Response))
    vi.unstubAllGlobals()
  })
})
