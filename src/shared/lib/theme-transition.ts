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
 * Executes a gentle, silky Telegram-style circular reveal theme transition:
 * - Mayin boshlanib, mayin tugaydi (cubic-bezier(0.35, 0, 0.25, 1), 550ms)
 * - Zero flicker: `:root.theme-to-dark::view-transition-new` CSS'da circle(0%) qilib oldindan qotiriladi
 * - Light -> Dark: yangi qorong'u qatlam tugmadan mayin yoyilib butun ekranni qoplaydi
 * - Dark -> Light: eski qorong'u qatlam butun ekrandan mayin tortilib tugma ichiga kiradi
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

  const canAnimate =
    typeof docWithTransition.startViewTransition === 'function' &&
    !reduceMotion &&
    !noAnimation &&
    currentIsDark !== nextIsDark

  // Instant fallback
  if (!canAnimate) {
    updateDOMAndState()
    syncStatusBarStyle(nextIsDark)
    syncTelegramTheme(nextIsDark)
    return
  }

  if (activeVT && typeof activeVT.skipTransition === 'function') {
    try { activeVT.skipTransition() } catch (_) {}
  }

  // Viewport va tugma markazining aniq nisbiy koordinatalari
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

  const root = document.documentElement
  // MUHIM: startViewTransition'dan OLDIN o'rnatiladi — yangi qatlam 1-freymdayoq 0% li bo'lib ochiladi
  root.style.setProperty('--theme-origin-x', `${px}%`)
  root.style.setProperty('--theme-origin-y', `${py}%`)
  root.classList.remove('theme-to-dark', 'theme-to-light')
  root.classList.add(nextIsDark ? 'theme-to-dark' : 'theme-to-light')

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
    root.classList.remove('theme-to-dark', 'theme-to-light')
    root.style.removeProperty('--theme-origin-x')
    root.style.removeProperty('--theme-origin-y')
    return
  }

  activeVT = vt

  try {
    await vt.ready

    if (activeVT !== vt) return

    // Mayin boshlanuvchi va mayin to'xtovchi silliq egri chiziq
    const animationKeyframes = nextIsDark
      ? { clipPath: [collapsed, covering] }
      : { clipPath: [covering, collapsed] }

    const targetPseudo = nextIsDark
      ? '::view-transition-new(root)'
      : '::view-transition-old(root)'

    const anim = root.animate(animationKeyframes, {
      duration: 550,
      easing: 'cubic-bezier(0.35, 0, 0.25, 1)',
      fill: 'forwards',
      pseudoElement: targetPseudo,
    })

    await anim.finished.catch(() => {})
    // Doira to'liq yoyilgandan KEYIN Telegram header va status barni sinxronlash
    syncStatusBarStyle(nextIsDark)
    syncTelegramTheme(nextIsDark)
  } catch {
    // Graceful fallback for interrupted transitions
  } finally {
    if (activeVT === vt) {
      activeVT = null
      root.classList.remove('theme-to-dark', 'theme-to-light')
      root.style.removeProperty('--theme-origin-x')
      root.style.removeProperty('--theme-origin-y')
      syncStatusBarStyle(nextIsDark)
      syncTelegramTheme(nextIsDark)
    }
  }
}
