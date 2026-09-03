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

  it('switches instantly when reduceMotion is active', async () => {
    const originalMatchMedia = window.matchMedia
    window.matchMedia = vi.fn().mockImplementation((query) => ({
      matches: query.includes('prefers-reduced-motion'),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }))

    await transitionTheme('dark')

    expect(document.body.dataset.theme).toBe('dark')
    expect(useAppStore.getState().settings.theme).toBe('dark')

    window.matchMedia = originalMatchMedia
  })

  it('switches instantly when noAnimation setting is true', async () => {
    useAppStore.setState({
      settings: { ...useAppStore.getState().settings, noAnimation: true },
    })

    await transitionTheme('dark')

    expect(document.body.dataset.theme).toBe('dark')
  })

  it('executes Light -> Dark transition with expanding GPU circular overlay', async () => {
    const animateMock = vi.fn().mockReturnValue({ finished: Promise.resolve() })
    const origAnimate = HTMLElement.prototype.animate
    HTMLElement.prototype.animate = animateMock

    await transitionTheme('dark', { x: 300, y: 50 })

    expect(animateMock).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ clipPath: expect.stringContaining('circle(0px at 300px 50px)') }),
        expect.objectContaining({ clipPath: expect.stringContaining('circle(') }),
      ]),
      expect.objectContaining({
        duration: 480,
        easing: 'cubic-bezier(0.35, 0, 0.25, 1)',
        fill: 'forwards',
      })
    )
    expect(document.body.dataset.theme).toBe('dark')
    expect(document.querySelector('.theme-transition-overlay')).toBeNull()

    HTMLElement.prototype.animate = origAnimate
  })

  it('executes Dark -> Light transition with expanding GPU circular overlay', async () => {
    useAppStore.setState({
      settings: { ...useAppStore.getState().settings, theme: 'dark' },
    })
    document.body.dataset.theme = 'dark'

    const animateMock = vi.fn().mockReturnValue({ finished: Promise.resolve() })
    const origAnimate = HTMLElement.prototype.animate
    HTMLElement.prototype.animate = animateMock

    await transitionTheme('light', { x: 350, y: 60 })

    expect(animateMock).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ clipPath: expect.stringContaining('circle(0px at 350px 60px)') }),
        expect.objectContaining({ clipPath: expect.stringContaining('circle(') }),
      ]),
      expect.objectContaining({
        duration: 480,
        easing: 'cubic-bezier(0.35, 0, 0.25, 1)',
        fill: 'forwards',
      })
    )
    expect(document.body.dataset.theme).toBe('light')
    expect(document.querySelector('.theme-transition-overlay')).toBeNull()

    HTMLElement.prototype.animate = origAnimate
  })
})
