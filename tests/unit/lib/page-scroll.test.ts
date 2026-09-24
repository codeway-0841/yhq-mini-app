import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

describe('page-scroll SSOT (wondering-shell)', () => {
  const ROUTE_PAGE = 'route-page'

  beforeEach(() => {
    document.body.innerHTML = ''
    vi.restoreAllMocks()
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  function loadHelper() {
    vi.resetModules()
    return import('../../../src/shared/lib/page-scroll')
  }

  it('mobil/document rejim: scroller null, Y window dan', async () => {
    const { getPageScroller, pageScrollY, isDesktopPanelScroll } = await loadHelper()
    expect(isDesktopPanelScroll()).toBe(false)
    expect(getPageScroller()).toBeNull()
    expect(pageScrollY()).toBe(0)
  })

  it('desktop panel rejim: scroller = .route-page', async () => {
    const el = document.createElement('div')
    el.className = ROUTE_PAGE
    // jsdom'da scrollTop yozish/o'qish
    Object.defineProperty(el, 'scrollTop', { value: 120, writable: true, configurable: true })
    document.body.appendChild(el)
    vi.stubGlobal('matchMedia', () => ({ matches: true }))

    const { isDesktopPanelScroll, getPageScroller, pageScrollY } = await loadHelper()
    try {
      expect(isDesktopPanelScroll()).toBe(true)
      expect(getPageScroller()).toBe(el)
      expect(pageScrollY()).toBe(120)
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('scrollPageToTop panel scrollTop ni nollaydi (desktop)', async () => {
    const el = document.createElement('div')
    el.className = ROUTE_PAGE
    let top = 300
    Object.defineProperty(el, 'scrollTop', {
      get: () => top,
      set: (v: number) => { top = v },
      configurable: true,
    })
    const scrollTo = vi.fn((opts: { top: number }) => { top = opts.top })
    el.scrollTo = scrollTo as unknown as typeof el.scrollTo
    document.body.appendChild(el)
    vi.stubGlobal('matchMedia', () => ({ matches: true }))

    const { scrollPageToTop, scrollPageTo } = await loadHelper()
    try {
      scrollPageToTop()
      expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'auto' })
      scrollPageTo(500, 'smooth')
      expect(scrollTo).toHaveBeenCalledWith({ top: 500, behavior: 'smooth' })
      scrollPageTo(-50)
      expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'auto' })
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('addPageScrollListener har ikki manbaga ulanadi va tozalaydi', async () => {
    const el = document.createElement('div')
    el.className = ROUTE_PAGE
    document.body.appendChild(el)
    const { addPageScrollListener } = await loadHelper()

    const cb = vi.fn()
    const detach = addPageScrollListener(cb)
    window.dispatchEvent(new Event('scroll'))
    el.dispatchEvent(new Event('scroll'))
    expect(cb).toHaveBeenCalledTimes(2)
    detach()
    window.dispatchEvent(new Event('scroll'))
    el.dispatchEvent(new Event('scroll'))
    expect(cb).toHaveBeenCalledTimes(2)
  })
})
