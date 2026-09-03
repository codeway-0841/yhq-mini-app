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

/**
 * Extract viewport coordinates (x, y) from event, HTMLElement, or coordinate pair.
 * Viewport-relative coordinates ensure origin stays at the toggle even when scrolled.
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

  // HTMLElement
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
 * from the given origin point (x, y), with a +2px safety buffer.
 */
export function calculateMaxRadius(x: number, y: number): number {
  if (typeof window === 'undefined') return 1000
  const maxX = Math.max(x, window.innerWidth - x)
  const maxY = Math.max(y, window.innerHeight - y)
  return Math.ceil(Math.hypot(maxX, maxY)) + 2
}

/**
 * Resolve theme option to boolean isDark.
 */
export function isThemeDark(theme: ThemeOption): boolean {
  if (theme === 'dark') return true
  if (theme === 'light') return false
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  }
  return true
}

/**
 * Executes a Telegram-style circular reveal theme transition.
 * - Origin: Exactly at the switch button (viewport x, y).
 * - The new theme view (::view-transition-new) expands outward in a circle
 *   covering all corners of the screen.
 * - Easing: cubic-bezier(0.22, 1, 0.36, 1) over 600ms.
 * - Instant fallback for prefers-reduced-motion, noAnimation, or unsupported browsers.
 */
export async function transitionTheme(
  nextTheme: ThemeOption,
  origin?: OriginInput
): Promise<void> {
  if (typeof document === 'undefined') return

  const store = useAppStore.getState()
  // Single source of truth for current displayed state
  const currentIsDark = document.body.dataset.theme !== 'light'
  const nextIsDark = nextTheme === 'light' ? false : (nextTheme === 'dark' ? true : isThemeDark('system'))

  const updateDOMAndState = () => {
    const themeStr = nextIsDark ? 'dark' : 'light'
    document.body.dataset.theme = themeStr
    document.documentElement.dataset.theme = themeStr
    document.documentElement.style.colorScheme = themeStr
    syncStatusBarStyle(nextIsDark)
    syncTelegramTheme(nextIsDark)
    store.updateSettings({ theme: nextTheme })
  }

  const reduceMotion =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  const noAnimation = store.settings.noAnimation || document.body.dataset.noAnimation === 'true'

  type DocumentWithTransition = Document & {
    startViewTransition: (callback: () => void | Promise<void>) => ViewTransition
  }
  const docWithTransition = document as DocumentWithTransition

  const canAnimate =
    typeof docWithTransition.startViewTransition === 'function' &&
    !reduceMotion &&
    !noAnimation &&
    currentIsDark !== nextIsDark

  // Instant update if animation cannot/should not run
  if (!canAnimate) {
    updateDOMAndState()
    return
  }

  const { x, y } = getOriginCoordinates(origin)
  const maxRadius = calculateMaxRadius(x, y)

  let transition: ViewTransition | undefined

  try {
    transition = docWithTransition.startViewTransition(() => {
      try {
        flushSync(updateDOMAndState)
      } catch {
        updateDOMAndState()
      }
    })
  } catch {
    // If startViewTransition threw, guarantee immediate DOM/state update
    updateDOMAndState()
    return
  }

  try {
    await transition.ready

    const animation = document.documentElement.animate(
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
      }
    )

    await animation.finished.catch(() => {})
  } catch {
    // Gracefully handle aborted or skipped transitions
  }
}
