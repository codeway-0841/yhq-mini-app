import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  getOriginCoordinates,
  calculateMaxRadius,
  isThemeDark,
  transitionTheme,
} from '../../../src/shared/lib/theme-transition'
import { useAppStore } from '../../../src/shared/store/useAppStore'

describe('theme-transition: getOriginCoordinates', () => {
  it('returns default top-right coordinate when origin is omitted', () => {
    const coords = getOriginCoordinates()
    expect(coords.y).toBe(44)
    expect(coords.x).toBe(window.innerWidth - 44)
  })

  it('accepts direct { x, y } coordinates', () => {
    const coords = getOriginCoordinates({ x: 150, y: 250 })
    expect(coords).toEqual({ x: 150, y: 250 })
  })

  it('extracts center point from an HTMLElement bounding rect', () => {
    const el = {
      getBoundingClientRect: () => ({
        left: 100,
        top: 50,
        width: 40,
        height: 40,
        right: 140,
        bottom: 90,
      }),
    } as unknown as HTMLElement

    const coords = getOriginCoordinates(el)
    expect(coords).toEqual({ x: 120, y: 70 })
  })

  it('extracts coordinates from a MouseEvent', () => {
    const event = { clientX: 200, clientY: 350 } as MouseEvent
    const coords = getOriginCoordinates(event)
    expect(coords).toEqual({ x: 200, y: 350 })
  })

  it('extracts coordinates from a TouchEvent', () => {
    const event = {
      touches: [{ clientX: 180, clientY: 290 }],
    } as unknown as TouchEvent
    const coords = getOriginCoordinates(event)
    expect(coords).toEqual({ x: 180, y: 290 })
  })
})

describe('theme-transition: calculateMaxRadius', () => {
  it('calculates radius large enough to cover the furthest corner', () => {
    const w = window.innerWidth
    const h = window.innerHeight
    const origin = { x: w - 20, y: 20 }
    const radius = calculateMaxRadius(origin.x, origin.y)

    // Furthest corner is (0, h)
    const distToBottomLeft = Math.hypot(origin.x - 0, h - origin.y)
    expect(radius).toBeGreaterThanOrEqual(distToBottomLeft)

    // All 4 corners are inside the circle
    expect(radius).toBeGreaterThan(Math.hypot(origin.x - 0, origin.y - 0))
    expect(radius).toBeGreaterThan(Math.hypot(w - origin.x, origin.y - 0))
    expect(radius).toBeGreaterThan(Math.hypot(w - origin.x, h - origin.y))
  })
})

describe('theme-transition: isThemeDark', () => {
  it('returns true for dark and false for light', () => {
    expect(isThemeDark('dark')).toBe(true)
    expect(isThemeDark('light')).toBe(false)
  })

  it('evaluates system scheme preference for system theme', () => {
    const originalMatchMedia = window.matchMedia
    window.matchMedia = vi.fn().mockReturnValue({ matches: true }) as any
    expect(isThemeDark('system')).toBe(true)

    window.matchMedia = vi.fn().mockReturnValue({ matches: false }) as any
    expect(isThemeDark('system')).toBe(false)

    window.matchMedia = originalMatchMedia
  })
})

describe('theme-transition: transitionTheme', () => {
  beforeEach(() => {
    useAppStore.setState({
      settings: {
        ...useAppStore.getState().settings,
        theme: 'light',
        noAnimation: false,
      },
    })
    document.body.dataset.theme = 'light'
    delete document.body.dataset.noAnimation
    delete document.documentElement.dataset.themeTransition
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('switches instantly without animation when document.startViewTransition is not supported', async () => {
    const originalSVT = (document as any).startViewTransition
    delete (document as any).startViewTransition

    await transitionTheme('dark')

    expect(document.body.dataset.theme).toBe('dark')
    expect(useAppStore.getState().settings.theme).toBe('dark')
    expect(document.documentElement.dataset.themeTransition).toBeUndefined()

    if (originalSVT) (document as any).startViewTransition = originalSVT
  })

  it('switches instantly when noAnimation setting is true', async () => {
    const mockSVT = vi.fn()
    ;(document as any).startViewTransition = mockSVT
    useAppStore.setState({
      settings: { ...useAppStore.getState().settings, noAnimation: true },
    })

    await transitionTheme('dark')

    expect(mockSVT).not.toHaveBeenCalled()
    expect(document.body.dataset.theme).toBe('dark')
  })

  it('executes Light -> Dark transition with expanding clipPath on ::view-transition-new', async () => {
    const animateMock = vi.fn().mockReturnValue({ finished: Promise.resolve() })
    document.documentElement.animate = animateMock

    let callbackExecuted = false
    const mockSVT = vi.fn((cb: () => void) => {
      cb()
      callbackExecuted = true
      return {
        ready: Promise.resolve(),
        finished: Promise.resolve(),
        updateCallbackDone: Promise.resolve(),
        skipTransition: vi.fn(),
      }
    })
    ;(document as any).startViewTransition = mockSVT

    await transitionTheme('dark', { x: 300, y: 50 })

    expect(mockSVT).toHaveBeenCalled()
    expect(callbackExecuted).toBe(true)
    expect(animateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        clipPath: expect.arrayContaining([
          expect.stringContaining('circle(0%'),
          expect.stringContaining('circle('),
        ]),
      }),
      expect.objectContaining({
        duration: 600,
        easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
        pseudoElement: '::view-transition-new(root)',
      })
    )
    expect(document.body.dataset.theme).toBe('dark')
  })

  it('executes Dark -> Light transition with contracting clipPath on ::view-transition-old', async () => {
    useAppStore.setState({
      settings: { ...useAppStore.getState().settings, theme: 'dark' },
    })
    document.body.dataset.theme = 'dark'

    const animateMock = vi.fn().mockReturnValue({ finished: Promise.resolve() })
    document.documentElement.animate = animateMock

    const mockSVT = vi.fn((cb: () => void) => {
      cb()
      return {
        ready: Promise.resolve(),
        finished: Promise.resolve(),
        updateCallbackDone: Promise.resolve(),
        skipTransition: vi.fn(),
      }
    })
    ;(document as any).startViewTransition = mockSVT

    await transitionTheme('light', { x: 350, y: 60 })

    expect(mockSVT).toHaveBeenCalled()
    expect(animateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        clipPath: expect.arrayContaining([
          expect.stringContaining('circle('),
          expect.stringContaining('circle(0%'),
        ]),
      }),
      expect.objectContaining({
        duration: 600,
        easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
        pseudoElement: '::view-transition-old(root)',
      })
    )
    expect(document.body.dataset.theme).toBe('light')
  })
})
