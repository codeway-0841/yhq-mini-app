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
    try { getHaptics()?.impactOccurred(style) } catch { /* not in Telegram */ }
  },
  notify(type: HapticNotification): void {
    try { getHaptics()?.notificationOccurred(type) } catch { /* not in Telegram */ }
  },
  select(): void {
    try { getHaptics()?.selectionChanged() } catch { /* not in Telegram */ }
  },
}
