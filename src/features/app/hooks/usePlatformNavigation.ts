import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { goBack, subscribeModalStack } from '../../../shared/lib/navigation'
import { syncTelegramTheme } from '../../../platform/telegram'
import { bindAppBackButton } from '../../../platform/native'

/**
 * Platform/Navigation integratsiyasi — Telegram BackButton, APK hardware back,
 * modal stack kuzatuvi, iOS repaint fix va sahifa almashinuvi animatsiyalari.
 */
export function usePlatformNavigation() {
  const location = useLocation()
  const navigate = useNavigate()
  const atHome = location.pathname === '/'
  const [modalCount, setModalCount] = useState(0)

  // Modal stack holatini kuzatish — modal ochiq bo'lsa BackButton ko'rinadi va eng oxirgi modalni yopadi
  useEffect(() => {
    return subscribeModalStack((count) => setModalCount(count))
  }, [])

  // Sahifa almashganda tepadan boshlash — body scroll (min-h-screen) saqlanmasin
  useEffect(() => {
    window.scrollTo(0, 0)
    // Telegram iOS fullscreen repaint fix (Issue #2061: orqaga qaytganda tepa soha repaintsiz oq/bo'sh qolmasligi uchun)
    const isIos = typeof navigator !== 'undefined' && (/iPhone|iPad|iPod/i.test(navigator.userAgent))
    if (isIos) {
      requestAnimationFrame(() => {
        window.scrollBy(0, 1)
        window.scrollBy(0, -1)
      })
    }
    // Har bir sahifa navigatsiyasida Telegram status bar & header rangini qayta mustahkamlash
    const isDark = typeof document !== 'undefined' && document.body.dataset.theme !== 'light'
    syncTelegramTheme(isDark)
  }, [location.pathname])

  // Platforma "orqaga" tugmasi — Telegram'da TG BackButton, APK'da hardware back.
  // visible: sub-sahifada bo'lsa YOKI biror modal/sheet ochiq bo'lsa (bosh sahifada ham).
  const shouldShowBack = !atHome || modalCount > 0
  useEffect(() => {
    return bindAppBackButton(shouldShowBack, () => goBack(navigate))
  }, [shouldShowBack, navigate])

  // Sahifa o'tishida scroll reset + transition — key={pathname} EMAS (audit L11b):
  // key har navigatsiyada BUTUN sahifani REMOUNT qilardi (komponent state'lari
  // yo'qolardi); animation endi class restart bilan (remount'siz, perf saqlanadi).
  const pageRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = pageRef.current
    if (!el) return
    el.scrollTop = 0
    el.classList.remove('route-page')
    void el.offsetWidth // reflow — CSS animatsiyani qayta boshlaydi
    el.classList.add('route-page')
  }, [location.pathname])

  return {
    pageRef,
    location,
    navigate,
  }
}
