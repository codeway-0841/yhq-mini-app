import { useCallback, useMemo } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Home, BookOpen, Camera, Swords, LayoutGrid } from 'lucide-react'
import { useModalCount } from '../lib/navigation'
import { useAppStore } from '../store/useAppStore'
import { useT } from '../i18n'
import { playSound } from '../lib/sounds'
import { haptics } from '../../platform/haptics'

/**
 * Pastki dock FAQAT tab-root (asosiy bo'lim) sahifalarda ko'rinadi.
 *
 * Qonun (iOS HIG "Tab Bars" + Material 3 "Navigation bar"): tab bar FAQAT
 * top-level destination'larda — ichki/detail/flow ekranlarda yashirinadi
 * (`hidesBottomBarWhenPushed`). Ichki sahifalarda orqaga qaytish —
 * PageHeader'dagi back tugma orqali (2026-09-15 "har joyda nav" fix:
 * eski HIDDEN_PREFIXES denylist o'rniga allowlist).
 * `/ai-tutor` ro'yxatda EMAS: kamera-first fullscreen ekran (o'z back tugmasi bor),
 * dock kamera UI'ni to'sib qoladi (2026-09-16). Markaz tugma baribir o'sha yerga olib boradi.
 */
export const TAB_ROOT_PATHS = ['/', '/testlar', '/octagon', '/rejimlar'] as const
export function isTabRootRoute(pathname: string): boolean {
  return (TAB_ROOT_PATHS as readonly string[]).includes(pathname)
}

interface NavItem {
  id: string
  path: string
  labelKey: 'home' | 'testlarTitle' | 'snapSolveTitle' | 'duelTitle' | 'menuTitle'
  shortLabel: { uz: string; ru: string }
  icon: typeof Home
  isCenter?: boolean
}

export default function IosDock() {
  const navigate = useNavigate()
  const location = useLocation()
  const lang = useAppStore((s) => s.settings.language)
  const tt = useT(lang)
  const modalCount = useModalCount()

  const isTabRoot = isTabRootRoute(location.pathname)
  const isVisible = isTabRoot && modalCount === 0

  const navItems: NavItem[] = useMemo(() => [
    {
      id: 'home',
      path: '/',
      labelKey: 'home',
      shortLabel: { uz: 'Bosh', ru: 'Главная' },
      icon: Home,
    },
    {
      id: 'tests',
      path: '/testlar',
      labelKey: 'testlarTitle',
      shortLabel: { uz: 'Testlar', ru: 'Тесты' },
      icon: BookOpen,
    },
    {
      id: 'ai-tutor',
      path: '/ai-tutor',
      labelKey: 'snapSolveTitle',
      shortLabel: { uz: 'AI Yechish', ru: 'Решить AI' },
      icon: Camera,
      isCenter: true,
    },
    {
      id: 'octagon',
      path: '/octagon',
      labelKey: 'duelTitle',
      shortLabel: { uz: 'Duel', ru: 'Дуэль' },
      icon: Swords,
    },
    {
      id: 'modes',
      path: '/rejimlar',
      labelKey: 'menuTitle',
      shortLabel: { uz: 'Menyu', ru: 'Меню' },
      icon: LayoutGrid,
    },
  ], [])

  const handleNav = useCallback((item: NavItem) => {
    playSound('click')
    if (item.isCenter) {
      haptics.impact('medium')
    } else {
      haptics.selection()
    }
    navigate(item.path)
  }, [navigate])

  // Sliding active pill (transitions.dev "tabs-sliding"): bitta umumiy pill
  // active tab ortidan `translateX` bilan sirg'aladi. 5 ustun HAMMASI `flex-1`
  // (= aniq 20%) bo'lgani uchun JS o'lchash (getBoundingClientRect/RO) SHART
  // EMAS — pill `w-1/5` + `translateX(idx*100%)`, transition faqat transform'da
  // (compositor-friendly, layout thrash yo'q). Uslub skrinshot'day (2026-09-16):
  // NEYTRAL kapsula (`rounded-full bg-psurface` — aksent wash EMAS) + active
  // matn `text-pfg`; pill katakchani TO'LIQ egallaydi (`inset-y-0` — tepa/past
  // bo'shliq YO'Q, rasmda kapsula bar ichini to'ldirgani kabi). Yon tab'dan
  // yon tab'ga o'tishda pill markaziy FAB ostidan o'tadi (FAB opaque + z-10).
  const activeIndex = useMemo(() => navItems.findIndex((item) => {
    if (item.isCenter) return false
    return item.path === '/'
      ? location.pathname === '/'
      : location.pathname.startsWith(item.path)
  }), [navItems, location.pathname])

  if (!isTabRoot) return null

  return (
    <div
      aria-hidden={!isVisible}
      className={`fixed inset-x-0 bottom-[calc(0.75rem+var(--safe-bottom,0px))] z-40 flex justify-center px-4 transition-[transform,opacity] duration-300 ease-out motion-reduce:transition-none lg:hidden ${
        isVisible ? 'translate-y-0 opacity-100 pointer-events-auto' : 'translate-y-[calc(100%+1.5rem+var(--safe-bottom,0px))] opacity-0 pointer-events-none'
      }`}
    >
      {/* Suzuvchi pill (iOS Liquid Glass): pastdan uzilgan, yumaloq, blur.
          Opaque fallback YO'Q — rgb-triplet/alpha barcha WebView'da ishlaydi
          (DesktopSidebar/IosDock eski pattern). */}
      <nav
        role="navigation"
        aria-label="Asosiy navigatsiya"
        className="pointer-events-auto w-full max-w-md rounded-3xl border border-pline bg-[rgb(var(--p-card-rgb)/0.75)] px-2 py-2 shadow-lg backdrop-blur-2xl saturate-150"
      >
        <div className="relative flex items-center justify-around">
          {/* Sliding pill — tugmalar (z-10) ostida, pointer event olmaydi */}
          <span
            aria-hidden="true"
            data-testid="dock-active-pill"
            className={`pointer-events-none absolute inset-y-0 left-0 w-1/5 rounded-full bg-psurface transition-[transform,opacity] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none ${
              activeIndex >= 0 ? 'opacity-100' : 'opacity-0'
            }`}
            style={{ transform: `translateX(${Math.max(activeIndex, 0) * 100}%)` }}
          />
          {navItems.map((item) => {
            const isActive = item.path === '/'
              ? location.pathname === '/'
              : location.pathname.startsWith(item.path)
            const Icon = item.icon

            if (item.isCenter) {
              return (
                <div key={item.id} className="relative z-10 flex-1 flex flex-col items-center justify-center">
                  <button
                    type="button"
                    onClick={() => handleNav(item)}
                    aria-label={item.shortLabel[lang]}
                    className="group relative flex size-12 items-center justify-center rounded-full bg-pprimary text-ponprimary shadow-lg [--tw-shadow-color:rgb(var(--p-primary-rgb)/0.35)] transition-all duration-150 active:scale-90 hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pprimary focus-visible:ring-offset-2"
                  >
                    <Icon size={22} strokeWidth={2.2} className="transition-transform group-hover:scale-110" />
                  </button>
                </div>
              )
            }

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNav(item)}
                aria-label={tt(item.labelKey)}
                aria-current={isActive ? 'page' : undefined}
                title={tt(item.labelKey)}
                className={`relative z-10 flex-1 flex flex-col items-center justify-center min-w-0 py-2.5 rounded-full transition-all duration-150 active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pprimary ${
                  isActive ? 'text-pfg font-semibold' : 'text-pmuted hover:text-pfg'
                }`}
              >
                <Icon
                  size={22}
                  strokeWidth={isActive ? 2.4 : 1.8}
                  className="transition-transform"
                />
                <span className="text-[10.5px] tracking-tight mt-1 whitespace-nowrap">
                  {item.shortLabel[lang]}
                </span>
              </button>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
