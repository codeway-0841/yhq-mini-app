import { warmRiveAssetCache } from '../config/cdn'

/**
 * APK hajmini kichik saqlash uchun R2 ga chiqarilgan ikkilamchi Koji/Rive fayllar.
 * Boot kritik yo'lidan keyin IDLE vaqtda ketma-ket `CacheStorage` ga yoziladi —
 * shunda foydalanuvchi Leaderboard, Xatolar, Adaptiv yoki Premium ekraniga birinchi
 * marta kirganida ham animatsiya keshdan bir zumda ochiladi.
 */
export const SECONDARY_PROD_RIVE_FILES = [
  'leagues-badges.45867fa0.riv',
  'lcr-koji-transition.c8f8f68d.riv',
  'level-check.e74e7c3c.riv',
  'level-check-assessment-intro.1dfae46f.riv',
  'personalized-practice-nudge.8d7e7c26.riv',
  'level-insertion-intro.fb376b71.riv',
  'post-checkout-flow-premium-pro.a15dbd04.riv',
] as const

let warmed = false

export function preloadSecondaryRiveAssets(): void {
  if (warmed) return
  warmed = true
  void warmRiveAssetCache(SECONDARY_PROD_RIVE_FILES)
}
