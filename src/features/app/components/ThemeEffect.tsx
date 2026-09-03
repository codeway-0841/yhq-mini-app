import { useEffect } from 'react'
import { useAppStore } from '../../../shared/store/useAppStore'
import { resolveAccent } from '../../../shared/config/themes'
import { ensureFontLoaded } from '../../../shared/lib/fonts'
import { syncTelegramTheme } from '../../../platform/telegram'
import { syncStatusBarStyle } from '../../../platform/native'

/**
 * Light/Dark tema — settings.theme o'zgarishi bilan body ga qo'llanadi.
 * 'system' tanlansa, qurilma sozlamasiga ergashiladi (matchMedia).
 * Shuningdek accent, noAnimation, fontStyle va <html lang> sinxronlanadi.
 */
export default function ThemeEffect() {
  const theme       = useAppStore((s) => s.settings.theme)
  const noAnimation = useAppStore((s) => s.settings.noAnimation)
  const language    = useAppStore((s) => s.settings.language)
  const accent      = useAppStore((s) => s.accent)
  const tariff      = useAppStore((s) => s.tariff)
  const ownedItems  = useAppStore((s) => s.ownedItems)
  const fontStyle   = useAppStore((s) => s.settings.fontStyle)

  const applyTheme = (next: 'light' | 'dark') => {
    document.body.dataset.theme = next
    syncStatusBarStyle(next === 'dark')
    syncTelegramTheme(next === 'dark')
  }

  useEffect(() => {
    // <html lang> — screen reader talaffuzi uchun; qattiq "uz" bilan boshlanadi (index.html),
    // foydalanuvchi tilni almashtirsa sinxronlanadi.
    document.documentElement.lang = language ?? 'uz'
  }, [language])

  useEffect(() => {
    if (theme === 'system') {
      const mq = window.matchMedia('(prefers-color-scheme: light)')
      const apply = () => applyTheme(mq.matches ? 'light' : 'dark')
      apply()
      mq.addEventListener('change', apply)
      return () => mq.removeEventListener('change', apply)
    }
    applyTheme(theme)
  }, [theme])

  // Aksent temasi — yopiq temalar (premium/coin) egasiz foydalanuvchida default'ga tushadi
  useEffect(() => {
    document.body.dataset.accent = resolveAccent(accent, tariff === 'premium', new Set(ownedItems))
  }, [accent, tariff, ownedItems])

  useEffect(() => {
    // noAnimation setting — route transitionlar ham o'chadi (index.css)
    document.body.dataset.noAnimation = String(noAnimation)
  }, [noAnimation])

  useEffect(() => {
    // Ixtiyoriy oilalar boot'da emas, TANLANGANDA yuklanadi (shared/lib/fonts.ts)
    ensureFontLoaded(fontStyle)
    document.body.dataset.font = fontStyle || 'default'
  }, [fontStyle])

  return null
}
