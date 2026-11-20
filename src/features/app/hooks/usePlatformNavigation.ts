import { useEffect, useRef } from 'react'
import { useLocation, useNavigate, useNavigationType } from 'react-router-dom'
import { goBack, useModalCount } from '../../../shared/lib/navigation'
import { pageScrollY, scrollPageTo } from '../../../shared/lib/page-scroll'
import { syncTelegramTheme } from '../../../platform/telegram'
import { bindAppBackButton } from '../../../platform/native'

const scrollPositions = new Map<string, number>()

function saveScrollPosition(key: string, y: number): void {
  if (scrollPositions.has(key)) scrollPositions.delete(key)
  scrollPositions.set(key, y)
  if (scrollPositions.size > 40) {
    const oldest = scrollPositions.keys().next().value
    if (oldest !== undefined) scrollPositions.delete(oldest)
  }
}

/**
 * Platform/Navigation integratsiyasi — Telegram BackButton, APK hardware back,
 * modal stack kuzatuvi, scroll tiklash (POP) va sahifa almashinuvi animatsiyalari.
 */
export function usePlatformNavigation() {
  const location = useLocation()
  const navigate = useNavigate()
  const navigationType = useNavigationType()
  const atHome = location.pathname === '/'
  const modalCount = useModalCount()
  const activeKeyRef = useRef(location.key)
  activeKeyRef.current = location.key

  // Joriy sahifa scroll pozitsiyasini kuzatib borish (orqaga qaytganda tiklash uchun)
  useEffect(() => {
    const onScroll = () => {
      saveScrollPosition(activeKeyRef.current, pageScrollY())
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    document.addEventListener('scroll', onScroll, { passive: true, capture: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      document.removeEventListener('scroll', onScroll, true)
    }
  }, [])

  // Sahifa almashganda: POP (orqaga) da oldingi scroll pozitsiyasini tiklash,
  // yangi PUSH/REPLACE da tepadan boshlash.
  const pageRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = pageRef.current
    const isPop = navigationType === 'POP'
    const targetY = isPop ? (scrollPositions.get(location.key) ?? 0) : 0
    const hasScrollTarget = Boolean(location.hash) || new URLSearchParams(location.search).has('section')

    if (isPop && targetY > 0) {
      if (el) el.scrollTop = targetY
      requestAnimationFrame(() => {
        scrollPageTo(targetY, 'auto')
      })
    } else if (!hasScrollTarget) {
      window.scrollTo(0, 0)
      if (el) el.scrollTop = 0
      // Telegram iOS fullscreen repaint fix (Issue #2061)
      const isIos = typeof navigator !== 'undefined' && (/iPhone|iPad|iPod/i.test(navigator.userAgent))
      if (isIos) {
        requestAnimationFrame(() => {
          window.scrollBy(0, 1)
          window.scrollBy(0, -1)
        })
      }
    }

    if (el) {
      el.classList.remove('route-page')
      void el.offsetWidth // reflow — CSS animatsiyani qayta boshlaydi
      el.classList.add('route-page')
    }

    // Har bir sahifa navigatsiyasida Telegram status bar & header rangini qayta mustahkamlash
    const isDark = typeof document !== 'undefined' && document.body.dataset.theme !== 'light'
    syncTelegramTheme(isDark)
  }, [location.pathname, location.search, location.hash, location.key, navigationType])

  // Platforma "orqaga" tugmasi — Telegram'da TG BackButton, APK'da hardware back.
  // visible: sub-sahifada bo'lsa YOKI biror modal/sheet ochiq bo'lsa (bosh sahifada ham).
  const shouldShowBack = !atHome || modalCount > 0
  useEffect(() => {
    return bindAppBackButton(shouldShowBack, () => goBack(navigate))
  }, [shouldShowBack, navigate])

  return {
    pageRef,
    location,
    navigate,
  }
}
