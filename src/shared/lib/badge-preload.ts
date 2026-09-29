import { ACHIEVEMENTS, getBadgeUrl } from '../config/achievements'

let preloaded = false

/**
 * Barcha achievement badge rasmlarini brauzer keshiga oldindan yuklaydi.
 *
 * Muammo: Profil'dagi Nishonlar preview'lar (`BadgesPreviewSection`,
 * `MilestonesPreviewSection`, `AchievementsScreen`) har safar ekranga
 * chiqqanda webp'larni tarmoqdan tortardi — spinner/kechikish ko'rinardi.
 * Yechim: boot'dan keyin IDLE vaqtda (`App.tsx` prefetch yonida) HAMMA
 * badge URL'ini BIR MARTA `new Image()` orqali keshga olamiz. Keyingi
 * Profil kirishlarida rasmlar keshdan — bir zumda chiqadi.
 *
 * URL YAGONA (`getBadgeUrl` → CDN resolver): barcha iste'molchilar
 * (preview + plaque + screen) BIR XIL kalit bilan keshga yozadi/o'qiydi,
 * aks holda ikki nusxa yuklanardi.
 *
 * Idempotent — ikkinchi chaqiruv no-op. `document` yo'q muhitda (SSR/test
 * ayrim holatlari) jim qaytadi.
 */
export function preloadAchievementImages(): void {
  if (preloaded) return
  preloaded = true
  if (typeof document === 'undefined' || typeof Image === 'undefined') return
  const seen = new Set<string>()
  for (const def of ACHIEVEMENTS) {
    const url = getBadgeUrl(def)
    if (!url || seen.has(url)) continue
    seen.add(url)
    try {
      const img = new Image()
      img.decoding = 'async'
      img.src = url
    } catch {
      // Bitta rasm xatosi qolganlarini to'xtatmaydi
    }
  }
}

/** Faqat testlar uchun — idempotent bayroqni qayta o'rnatadi. */
export function resetBadgePreloadForTests(): void {
  preloaded = false
}
