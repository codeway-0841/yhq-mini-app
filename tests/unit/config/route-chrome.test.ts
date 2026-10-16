import { describe, expect, it } from 'vitest'
import {
  getRouteChrome,
  isTabRootRoute,
  TAB_ROOT_PATHS,
} from '../../../src/shared/config/route-chrome'

describe('route chrome registry', () => {
  it('faqat canonical top-level route-larda bottom navigation ko\'rsatadi', () => {
    expect(TAB_ROOT_PATHS).toEqual(['/', '/testlar', '/octagon', '/rejimlar'])

    for (const pathname of TAB_ROOT_PATHS) {
      expect(getRouteChrome(pathname), pathname).toMatchObject({
        mode: 'tab',
        bottomNavigation: true,
        shell: 'standard',
      })
      expect(isTabRootRoute(pathname), pathname).toBe(true)
    }
  })

  it('detail va dynamic flow route-larda dockni yashiradi', () => {
    for (const pathname of ['/profil', '/mavzular', '/octagon/abc123', '/test/fizika', '/live/room-1']) {
      expect(getRouteChrome(pathname).bottomNavigation, pathname).toBe(false)
      expect(isTabRootRoute(pathname), pathname).toBe(false)
    }

    expect(getRouteChrome('/profil').mode).toBe('detail')
    expect(getRouteChrome('/test/fizika').mode).toBe('immersive')
    expect(getRouteChrome('/octagon/abc123').mode).toBe('immersive')
  })

  it('AI va canvas route-larni workspace sifatida belgilaydi', () => {
    for (const pathname of ['/ai-tutor', '/ai-test', '/ai-test/session-1', '/camai', '/doska']) {
      expect(getRouteChrome(pathname), pathname).toMatchObject({
        mode: 'workspace',
        bottomNavigation: false,
        shell: 'standard',
      })
    }
  })

  it('Wonder route-larini to\'liq ekranli shellga chiqaradi', () => {
    for (const pathname of ['/wonder', '/wonder/session-1', '/wonder-studio']) {
      expect(getRouteChrome(pathname), pathname).toEqual({
        mode: 'immersive',
        bottomNavigation: false,
        shell: 'fullscreen',
      })
    }
  })

  it('trailing slash route siyosatini o\'zgartirmaydi', () => {
    expect(getRouteChrome('/testlar/')).toEqual(getRouteChrome('/testlar'))
    expect(getRouteChrome('/ai-tutor/')).toEqual(getRouteChrome('/ai-tutor'))
  })
})

