import { flushSync } from 'react-dom'
import { useAppStore } from '../store/useAppStore'
import { syncStatusBarStyle } from '../../platform/native'
import { syncTelegramTheme } from '../../platform/telegram'

export type ThemeOption = 'dark' | 'light' | 'system'

export interface TransitionOrigin {
  x: number
  y: number
}

export type OriginInput =
  | TransitionOrigin
  | HTMLElement
  | React.MouseEvent
  | MouseEvent
  | React.TouchEvent
  | TouchEvent
  | null
  | undefined

interface ViewTransition {
  ready: Promise<void>
  finished: Promise<void>
  updateCallbackDone: Promise<void>
  skipTransition: () => void
}

let activeTransitionId = 0

/**
 * Extract viewport coordinates (x, y) from event, HTMLElement, or coordinate pair.
 * Always returns viewport-relative coordinates so the origin remains pinned to
 * the switch even when the page is scrolled.
 */
export function getOriginCoordinates(origin?: OriginInput): TransitionOrigin {
  if (!origin) {
    return {
      x: typeof window !== 'undefined' ? window.innerWidth - 44 : 300,
      y: 44,
    }
  }

  // Direct coordinates
  if ('x' in origin && 'y' in origin && typeof origin.x === 'number' && typeof origin.y === 'number') {
    return origin
  }

  // HTMLElement (e.g. event.currentTarget)
  if ('getBoundingClientRect' in origin && typeof origin.getBoundingClientRect === 'function') {
    const rect = origin.getBoundingClientRect()
    return {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    }
  }

  // TouchEvent
  if ('touches' in origin && origin.touches && origin.touches.length > 0) {
    const touch = origin.touches[0]
    return { x: touch.clientX, y: touch.clientY }
  }

  // MouseEvent
  if ('clientX' in origin && typeof origin.clientX === 'number') {
    return { x: origin.clientX, y: origin.clientY }
  }

  return {
    x: typeof window !== 'undefined' ? window.innerWidth - 44 : 300,
    y: 44,
  }
}

/**
 * Calculate the exact radius required to cover all four corners of the viewport
 * from the given origin point (x, y), with a small +2px safeguard.
 */
export function calculateMaxRadius(x: number, y: number): number {
  if (typeof window === 'undefined') return 1000
  const maxX = Math.max(x, window.innerWidth - x)
  const maxY = Math.max(y, window.innerHeight - y)
  return Math.ceil(Math.hypot(maxX, maxY)) + 2
}

/**
 * Resolve theme option to boolean isDark based on current preference / system scheme.
 */
export function isThemeDark(theme: ThemeOption): boolean {
  if (theme === 'dark') return true
  if (theme === 'light') return false
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  }
  return false
}

/**
 * Executes a Telegram-style circular reveal theme transition matching the reference motion:
 * - Light -> Dark: Dark expands outwards from the switch button.
 * - Dark -> Light: Dark contracts back into the switch button, unveiling light mode.
 * - Easing: cubic-bezier(0.22, 1, 0.36, 1) over ~600ms.
 * - Supports prefers-reduced-motion and noAnimation settings with instantaneous fallback.
 */
export async function transitionTheme(
  nextTheme: ThemeOption,
  origin?: OriginInput
): Promise<void> {
  if (typeof document === 'undefined') return

  const store = useAppStore.getState()
  const currentTheme = store.settings.theme
  const currentIsDark = isThemeDark(currentTheme)
  const nextIsDark = isThemeDark(nextTheme)

  const updateDOMAndState = () => {
    document.body.dataset.theme = nextIsDark ? 'dark' : 'light'
    syncStatusBarStyle(nextIsDark)
    syncTelegramTheme(nextIsDark)
    store.updateSettings({ theme: nextTheme })
  }

  const reduceMotion =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  const noAnimation = store.settings.noAnimation || document.body.dataset.noAnimation === 'true'

  const doc = document as unknown as {
    startViewTransition?: (callback: () => void | Promise<void>) => ViewTransition
  }

  const startViewTransition = doc.startViewTransition

  const canAnimate =
    typeof startViewTransition === 'function' &&
    !reduceMotion &&
    !noAnimation &&
    currentIsDark !== nextIsDark

  // Instant fallback for unsupported browsers, reduced-motion, or unchanged themes
  if (!canAnimate || typeof startViewTransition !== 'function') {
    updateDOMAndState()
    return
  }

  const { x, y } = getOriginCoordinates(origin)
  const maxRadius = calculateMaxRadius(x, y)

  const direction = nextIsDark ? 'to-dark' : 'to-light'
  document.documentElement.dataset.themeTransition = direction
  document.documentElement.style.setProperty('--theme-origin-x', `${x}px`)
  document.documentElement.style.setProperty('--theme-origin-y', `${y}px`)
  document.documentElement.style.setProperty('--theme-max-radius', `${maxRadius}px`)

  const transitionId = ++activeTransitionId
  let transition: ViewTransition | undefined

  try {
    // MUST call with this = document to prevent 'Illegal invocation' error on Document method
    transition = doc.startViewTransition.call(document, () => {
      try {
        flushSync(updateDOMAndState)
      } catch {
        updateDOMAndState()
      }
    })
  } catch (err) {
    // If startViewTransition threw immediately, guarantee theme update!
    updateDOMAndState()
    if (activeTransitionId === transitionId) {
      delete document.documentElement.dataset.themeTransition
      document.documentElement.style.removeProperty('--theme-origin-x')
      document.documentElement.style.removeProperty('--theme-origin-y')
      document.documentElement.style.removeProperty('--theme-max-radius')
    }
    return
  }

  try {
    await transition.ready

    if (direction === 'to-dark') {
      // Light -> Dark: Dark view expands outwards from switch
      try {
        document.documentElement.animate(
          {
            clipPath: [
              `circle(0px at ${x}px ${y}px)`,
              `circle(${maxRadius}px at ${x}px ${y}px)`,
            ],
          },
          {
            duration: 600,
            easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
            pseudoElement: '::view-transition-new(root)',
            fill: 'forwards',
          }
        )
      } catch {
        // Fallback to CSS animation if pseudoElement in Element.animate is unsupported
      }
    } else {
      // Dark -> Light: Dark snapshot contracts into switch
      try {
        document.documentElement.animate(
          {
            clipPath: [
              `circle(${maxRadius}px at ${x}px ${y}px)`,
              `circle(0px at ${x}px ${y}px)`,
            ],
          },
          {
            duration: 600,
            easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
            pseudoElement: '::view-transition-old(root)',
            fill: 'forwards',
          }
        )
      } catch {
        // Fallback to CSS animation if pseudoElement in Element.animate is unsupported
      }
    }

    await transition.finished
  } catch {
    // Transition aborted or skipped
  } finally {
    if (activeTransitionId === transitionId) {
      delete document.documentElement.dataset.themeTransition
      document.documentElement.style.removeProperty('--theme-origin-x')
      document.documentElement.style.removeProperty('--theme-origin-y')
      document.documentElement.style.removeProperty('--theme-max-radius')
    }
  }
}
