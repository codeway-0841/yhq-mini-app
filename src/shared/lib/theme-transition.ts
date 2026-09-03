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

let activeOverlay: HTMLElement | null = null
let activeAnim: Animation | null = null

/**
 * Executes a gentle, silky Telegram-style circular reveal theme transition:
 * - Mayin boshlanib, mayin tugaydi (cubic-bezier(0.35, 0, 0.25, 1), 480ms)
 * - 100% flicker-free: GPU-accelerated overlay yordamida har qanday mobil qurilma
 *   (Android Telegram WebView, iOS, Desktop) da 60/120 FPS da ishlaydi.
 * - Eski sahifa xotiradan yo'qolmaydi, qora freymlar va sakrashlar 0% ga tushiriladi.
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

  if (reduceMotion || noAnimation || currentIsDark === nextIsDark || !document.body) {
    updateDOMAndState()
    syncStatusBarStyle(nextIsDark)
    syncTelegramTheme(nextIsDark)
    return
  }

  // Oldingi aktiv o'tish bo'lsa, uni to'xtatib tozalaymiz
  if (activeOverlay) {
    try { activeAnim?.cancel() } catch (_) {}
    try { activeOverlay.remove() } catch (_) {}
    activeOverlay = null
    activeAnim = null
  }

  const { x: cx, y: cy } = getOriginCoordinates(origin)
  const vw = window.innerWidth || document.documentElement.clientWidth || 1
  const vh = window.innerHeight || document.documentElement.clientHeight || 1
  const maxRadius = Math.ceil(Math.hypot(Math.max(cx, vw - cx), Math.max(cy, vh - cy))) + 20

  // Yangi temaning asosiy fon rangi
  const targetBgColor = nextIsDark ? '#0d1117' : '#fafaf9'

  // GPU tezlatgichli toza doiraviy qatlam yaratish
  const overlay = document.createElement('div')
  overlay.className = 'theme-transition-overlay'
  overlay.style.position = 'fixed'
  overlay.style.top = '0'
  overlay.style.left = '0'
  overlay.style.width = '100vw'
  overlay.style.height = '100vh'
  overlay.style.zIndex = '999999'
  overlay.style.pointerEvents = 'none'
  overlay.style.backgroundColor = targetBgColor
  overlay.style.clipPath = `circle(0px at ${cx}px ${cy}px)`
  overlay.style.willChange = 'clip-path'

  document.body.appendChild(overlay)
  activeOverlay = overlay

  try {
    const anim = overlay.animate(
      [
        { clipPath: `circle(0px at ${cx}px ${cy}px)` },
        { clipPath: `circle(${maxRadius}px at ${cx}px ${cy}px)` }
      ],
      {
        duration: 480,
        easing: 'cubic-bezier(0.35, 0, 0.25, 1)',
        fill: 'forwards'
      }
    )
    activeAnim = anim

    await anim.finished.catch(() => {})

    // Ekran to'liq yoyilgan qatlam bilan qoplangach, orqadagi DOMni yangilaymiz
    updateDOMAndState()
    syncStatusBarStyle(nextIsDark)
    syncTelegramTheme(nextIsDark)

    // Yangi tema render bo'lishi uchun 1 ta RAF kutamiz
    await new Promise((resolve) => requestAnimationFrame(resolve))
  } finally {
    if (activeOverlay === overlay) {
      activeOverlay = null
      activeAnim = null
      overlay.remove()
    }
  }
}
