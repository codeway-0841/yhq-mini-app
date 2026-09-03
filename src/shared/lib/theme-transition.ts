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

let activeVT: ViewTransition | null = null

/**
 * Extract viewport coordinates (x, y) from event, HTMLElement, or coordinate pair.
 */
export function getOriginCoordinates(origin?: OriginInput): TransitionOrigin {
  if (!origin) {
    if (typeof window !== 'undefined') {
      const btn = document.querySelector('.theme-toggle-btn')
      if (btn) {
        const r = btn.getBoundingClientRect()
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
      }
      return { x: window.innerWidth - 44, y: 44 }
    }
    return { x: 300, y: 44 }
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
 * Calculate the exact radius required to cover all four corners of the viewport.
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
 * Option 1: Exact Telegram Ads Theme Transition
 * - Eski qatlam (::view-transition-old) doim tepada (z-index: 9999) turadi
 * - Dark -> Light: eski qorong'u qatlam tugmaga qarab qisqaradi (clipPath)
 * - Light -> Dark: eski yorug' qatlamda tugmadan radial-gradient mask teshigi ochilib boradi (--theme-hole-radius)
 * - Hech qachon oq sahifa birdan qorayib ketmaydi
 */
export async function transitionTheme(
  nextTheme: ThemeOption,
  origin?: OriginInput
): Promise<void> {
  if (typeof document === 'undefined') return

  const store = useAppStore.getState()
  const currentIsDark = document.body.dataset.theme !== 'light'
  const nextIsDark = nextTheme === 'light' ? false : (nextTheme === 'dark' ? true : isThemeDark('system'))

  const updateDOMAndState = () => {
    const themeStr = nextIsDark ? 'dark' : 'light'
    document.body.dataset.theme = themeStr
    document.documentElement.dataset.theme = themeStr
    document.documentElement.style.colorScheme = themeStr
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

  if (typeof docWithTransition.startViewTransition !== 'function' || reduceMotion || noAnimation || currentIsDark === nextIsDark) {
    updateDOMAndState()
    syncStatusBarStyle(nextIsDark)
    syncTelegramTheme(nextIsDark)
    return
  }

  if (activeVT && typeof activeVT.skipTransition === 'function') {
    try { activeVT.skipTransition() } catch (_) {}
  }

  const vw = document.documentElement.clientWidth || window.innerWidth || 1
  const vh = document.documentElement.clientHeight || window.innerHeight || 1
  const { x: cx, y: cy } = getOriginCoordinates(origin)

  const end = Math.hypot(Math.max(cx, vw - cx), Math.max(cy, vh - cy))
  const ref = Math.hypot(vw, vh) / Math.SQRT2
  const px = (cx / vw) * 100
  const py = (cy / vh) * 100
  const rpct = ref ? (end / ref) * 100 + 1 : 145
  const collapsed = `circle(0% at ${px}% ${py}%)`
  const covering = `circle(${rpct}% at ${px}% ${py}%)`
  const holeRadius = Math.ceil(end * 1.05)

  const root = document.documentElement
  root.style.setProperty('--theme-origin-x', `${px}%`)
  root.style.setProperty('--theme-origin-y', `${py}%`)
  root.classList.toggle('theme-hole-reveal', nextIsDark)

  let vt: ViewTransition | undefined
  try {
    vt = docWithTransition.startViewTransition(() => {
      try {
        flushSync(updateDOMAndState)
      } catch {
        updateDOMAndState()
      }
    })
  } catch {
    updateDOMAndState()
    syncStatusBarStyle(nextIsDark)
    syncTelegramTheme(nextIsDark)
    root.classList.remove('theme-hole-reveal')
    root.style.removeProperty('--theme-origin-x')
    root.style.removeProperty('--theme-origin-y')
    return
  }

  activeVT = vt

  try {
    await vt.ready
    if (activeVT !== vt) return

    const animationKeyframes = nextIsDark
      ? { '--theme-hole-radius': ['0px', `${holeRadius}px`] }
      : { clipPath: [covering, collapsed] }

    const anim = root.animate(animationKeyframes, {
      duration: nextIsDark ? 650 : 550,
      easing: 'cubic-bezier(0.35, 0, 0.25, 1)',
      fill: 'forwards',
      pseudoElement: '::view-transition-old(root)',
    })

    await anim.finished.catch(() => {})
    syncStatusBarStyle(nextIsDark)
    syncTelegramTheme(nextIsDark)
  } catch {
    // Graceful fallback
  } finally {
    if (activeVT === vt) {
      activeVT = null
      root.classList.remove('theme-hole-reveal')
      root.style.removeProperty('--theme-origin-x')
      root.style.removeProperty('--theme-origin-y')
      syncStatusBarStyle(nextIsDark)
      syncTelegramTheme(nextIsDark)
    }
  }
}
