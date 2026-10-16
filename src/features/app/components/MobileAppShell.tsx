import { Suspense, useEffect, type ReactNode } from 'react'
import DesktopSidebar from '../../../shared/components/DesktopSidebar'
import IosDock from '../../../shared/components/IosDock'
import PageLoader from '../../../shared/components/PageLoader'
import { getStartParam } from '../../../platform/telegram'
import { usePlatformNavigation } from '../hooks/usePlatformNavigation'
import { useRouteChrome } from '../hooks/useRouteChrome'

interface MobileAppShellProps {
  children: ReactNode
}

/**
 * KIVVI'ning yagona responsive app shell'i.
 *
 * Route sahifalar kontentga egalik qiladi; shell esa faqat viewport, desktop
 * panel, mobil dock, safe-area va platform navigatsiyasini boshqaradi.
 */
export default function MobileAppShell({ children }: MobileAppShellProps) {
  const { pageRef, navigate } = usePlatformNavigation()
  const { pathname, chrome } = useRouteChrome()

  // Duel invite-link (ikki manba): Telegram start_param yoki URL query param.
  useEffect(() => {
    const startParam = getStartParam()
    const fromTelegram = startParam && (startParam.startsWith('duel-') || /^\d{4,8}$/.test(startParam))
      ? startParam
      : undefined
    const fromQuery = new URLSearchParams(window.location.search).get('duel') ?? undefined
    const rawCode = fromTelegram ?? fromQuery

    if (rawCode) {
      const cleanCode = rawCode.trim().toLowerCase().replace(/^(?:duel|room)-/, '')
      navigate(`/octagon/${cleanCode}`)
    }
  }, [navigate])

  if (chrome.shell === 'fullscreen') {
    return (
      <div
        className="w-full h-screen overflow-hidden bg-[#F6F4EE] dark:bg-[#150F0D]"
        data-app-shell="fullscreen"
        data-chrome-mode={chrome.mode}
      >
        <Suspense fallback={<PageLoader />}>
          {children}
        </Suspense>
      </div>
    )
  }

  return (
    // Mobil rejimda document scroll qiladi; desktopda route-page yagona panel
    // scrollport. Oraliq overflow konteyner qo'shish sticky headerlarni buzadi.
    <div
      className="relative flex flex-col min-h-screen bg-pcanvas text-pfg overflow-x-clip lg:flex-row lg:items-stretch lg:justify-center lg:h-[calc(100dvh-var(--safe-top-body,0px))] lg:overflow-hidden"
      data-app-shell="standard"
      data-chrome-mode={chrome.mode}
    >
      <DesktopSidebar />
      <div
        className="route-page relative z-10 flex-1 w-full pb-[calc(4.5rem+var(--safe-bottom,0px))] lg:pb-0 px-0 lg:min-w-0 lg:min-h-0 lg:my-2 lg:mr-2 lg:ml-2 lg:rounded-2xl lg:border lg:border-plineStrong lg:shadow-md lg:overflow-y-auto lg:overscroll-contain lg:bg-pcanvas flex flex-col"
        id="app-route-content"
        ref={pageRef}
        data-route-path={pathname}
        data-chrome-mode={chrome.mode}
        data-tabroot={chrome.bottomNavigation ? 'true' : 'false'}
      >
        <Suspense fallback={<PageLoader />}>
          {children}
        </Suspense>
      </div>
      <IosDock />
    </div>
  )
}
