/**
 * Telegram WebApp HapticFeedback — safe wrappers that no-op outside Telegram.
 */

type HapticStyle = 'light' | 'medium' | 'heavy' | 'rigid' | 'soft'
type HapticNotification = 'error' | 'success' | 'warning'

interface HapticFeedback {
  impactOccurred(style: HapticStyle): void
  notificationOccurred(type: HapticNotification): void
  selectionChanged(): void
}

function getHaptics(): HapticFeedback | undefined {
  return (window as { Telegram?: { WebApp?: { HapticFeedback?: HapticFeedback } } })
    .Telegram?.WebApp?.HapticFeedback
}

export const haptics = {
  impact(style: HapticStyle = 'light'): void {
    const tgHaptics = getHaptics()
    if (tgHaptics) {
      try { tgHaptics.impactOccurred(style); return } catch { /* noop */ }
    }
    try {
      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        const ms = style === 'heavy' ? 30 : style === 'medium' ? 18 : 10
        navigator.vibrate(ms)
      }
    } catch { /* noop */ }
  },
  notify(type: HapticNotification): void {
    const tgHaptics = getHaptics()
    if (tgHaptics) {
      try { tgHaptics.notificationOccurred(type); return } catch { /* noop */ }
    }
    try {
      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        const pattern = type === 'success' ? [12, 35, 18] : type === 'error' ? [25, 40, 25] : [15, 30, 15]
        navigator.vibrate(pattern)
      }
    } catch { /* noop */ }
  },
  select(): void {
    const tgHaptics = getHaptics()
    if (tgHaptics) {
      try { tgHaptics.selectionChanged(); return } catch { /* noop */ }
    }
    try {
      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        navigator.vibrate(8)
      }
    } catch { /* noop */ }
  },

  // ── Domain ierarxiyasi (Senior UX Hierarchy) ──
  /** BottomNav tablar va mayin selektorlar uchun (sezilar-sezilmas yengil chertish) */
  selection(): void {
    haptics.select()
  },
  /** To'g'ri javoblar va tasdiqlashlar uchun */
  success(): void {
    haptics.notify('success')
  },
  /** Noto'g'ri javoblar yoki xatoliklar uchun */
  error(): void {
    haptics.notify('error')
  },
  /** Ogohlantirishlar uchun */
  warning(): void {
    haptics.notify('warning')
  },
  /** Sheet yopilish chegarasi yoki snap nuqtasi */
  threshold(): void {
    haptics.impact('light')
  },
  /** Test yakunlanishi natijasi */
  complete(): void {
    haptics.impact('medium')
  },
  /** Yutuq, unvon yoki rekord ochilishi */
  achievement(): void {
    haptics.impact('heavy')
  },
}
