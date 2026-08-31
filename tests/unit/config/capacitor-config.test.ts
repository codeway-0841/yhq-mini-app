import { describe, it, expect } from 'vitest'
import config from '../../../capacitor.config'

/**
 * capacitor.config.ts regression-guard (2026-08-31 APK incident):
 * appStartPath='app.html' (slash'siz) bo'lganda Capacitor 8 Bridge.java
 * https scheme'da "https://localhost" + "app.html" = "https://localhostapp.html"
 * hosil qilib, WebView ERR_NAME_NOT_RESOLVED bilan ochilmas edi.
 * Shuning uchun: leading slash SHART + faqat app.html (dist/index.html = LANDING!).
 */
describe('capacitor.config — APK start path', () => {
  it('appStartPath leading slash bilan boshlanadi (https scheme concat xavfsizligi)', () => {
    const startPath = config.server?.appStartPath
    expect(startPath).toBeDefined()
    expect(startPath!.startsWith('/')).toBe(true)
  })

  it("appStartPath = '/app.html' (dist/index.html — marketing landing, APK'da EMAS)", () => {
    expect(config.server?.appStartPath).toBe('/app.html')
  })

  it("server.url YO'Q (APK lokal dist bundle'dan yuklanadi)", () => {
    expect(config.server?.url).toBeUndefined()
  })

  it('https androidScheme (WebView origin https://localhost — CORS allowlist bilan mos)', () => {
    expect(config.server?.androidScheme).toBe('https')
  })
})
