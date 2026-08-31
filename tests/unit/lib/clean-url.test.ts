import { describe, it, expect, vi, afterEach } from 'vitest'
import { APP_HOST, strippedAppUrl, stripAppHtmlFromAddressBar } from '../../../src/shared/lib/clean-url'

describe('strippedAppUrl', () => {
  it("'/app.html' ni '/' ga o'giradi", () => {
    expect(strippedAppUrl('/app.html')).toBe('/')
  })

  it("query va hash'ni saqlaydi (HashRouter state + tg paramlar)", () => {
    expect(strippedAppUrl('/app.html', '?tgWebAppPlatform=android', '#/profil')).toBe(
      '/?tgWebAppPlatform=android#/profil'
    )
  })

  it('nested path — faqat suffix olib tashlanadi', () => {
    expect(strippedAppUrl('/some/dir/app.html', '', '#/x')).toBe('/some/dir#/x')
  })

  it.each(['/', '/belgilar', '/app.htm', '/app.htmlx', '/app.html/extra'])(
    'strip shart emas: %s → null',
    (path) => {
      expect(strippedAppUrl(path)).toBeNull()
    }
  )
})

describe('stripAppHtmlFromAddressBar', () => {
  const originalLocation = window.location

  afterEach(() => {
    Object.defineProperty(window, 'location', { writable: true, configurable: true, value: originalLocation })
    vi.restoreAllMocks()
  })

  function mockLocation(hostname: string, pathname: string, search = '', hash = '') {
    Object.defineProperty(window, 'location', {
      writable: true,
      configurable: true,
      value: { ...originalLocation, hostname, pathname, search, hash },
    })
  }

  function spyReplaceState() {
    return vi.spyOn(window.history, 'replaceState').mockImplementation(() => {})
  }

  it('app hostda /app.html strip qilinadi, hash saqlanadi', () => {
    mockLocation(APP_HOST, '/app.html', '', '#/biletlar')
    const spy = spyReplaceState()
    stripAppHtmlFromAddressBar()
    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy).toHaveBeenCalledWith(null, '', '/#/biletlar')
  })

  it.each(['localhost', 'yhq-mini-app.vercel.app', 'kivvi.uz', 'www.kivvi.uz'])(
    "boshqa hostda tegmaydi (`/` landing'ni serve qiladi — reload xavfi): %s",
    (host) => {
      mockLocation(host, '/app.html', '', '#/x')
      const spy = spyReplaceState()
      stripAppHtmlFromAddressBar()
      expect(spy).not.toHaveBeenCalled()
    }
  )

  it('app hostda ham boshqa path tegilmasligi shart (deep-link rewrite)', () => {
    mockLocation(APP_HOST, '/belgilar', '', '#/belgilar')
    const spy = spyReplaceState()
    stripAppHtmlFromAddressBar()
    expect(spy).not.toHaveBeenCalled()
  })

  it("replaceState xato tashlasa — yutadi (WebView cheklovi, ilova ishlayveradi)", () => {
    mockLocation(APP_HOST, '/app.html')
    spyReplaceState().mockImplementation(() => {
      throw new Error('SecurityError')
    })
    expect(() => stripAppHtmlFromAddressBar()).not.toThrow()
  })
})
