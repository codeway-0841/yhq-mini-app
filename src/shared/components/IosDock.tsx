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

  // Sliding active indicator (Telegram Android v12.10.1 / Material 3 uslubi):
  // Faol kapsula butun katakchani emas, aynan ikona balandligidagi maydonni
  // (h-8, rounded-full, moviy tus) o'raydi. Barcha 5 ustun flex-1 (= aniq 20%)
  // bo'lgani uchun pill w-1/5 + translateX(idx*100%) orqali sirg'aladi.
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
      className={`fixed inset-x-0 bottom-0 z-40 flex justify-center pb-[max(0.5rem,var(--safe-bottom,0px))] px-3 sm:px-4 pointer-events-none transition-[transform,opacity] duration-300 ease-out motion-reduce:transition-none lg:hidden ${
        isVisible ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0'
      }`}
    >
      {/* Suzuvchi pill (Telegram Android v12.10.1 uslubi):
          To'liq yumaloq (rounded-full), qoramtir shaffof shisha (backdrop-blur-2xl),
          nozik chegara va yumshoq soya. */}
      <nav
        role="navigation"
        aria-label="Asosiy navigatsiya"
        className="pointer-events-auto w-full max-w-[440px] rounded-full bg-[rgb(var(--p-card-rgb)/0.92)] p-[3px] shadow-2xl shadow-black/40 backdrop-blur-2xl saturate-150"
      >
        <div className="relative flex items-center justify-around">
          {/* Sliding active indicator (Telegram Android v12.10.1 uslubi):
              Faol kapsula dock chegarasiga 2-3px masofada to'liq joylashadi. */}
          <span
            aria-hidden="true"
            data-testid="dock-active-pill"
            className={`pointer-events-none absolute inset-y-0 left-0 flex w-1/5 items-center justify-center transition-[transform,opacity] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none ${
              activeIndex >= 0 ? 'opacity-100' : 'opacity-0'
            }`}
            style={{ transform: `translateX(${Math.max(activeIndex, 0) * 100}%)` }}
          >
            <span className="h-full w-[68px] sm:w-[74px] rounded-full bg-[rgb(var(--p-primary-rgb)/0.22)] shadow-xs dark:bg-[rgb(var(--p-primary-rgb)/0.28)]" />
          </span>

          {navItems.map((item) => {
            const isActive = item.path === '/'
              ? location.pathname === '/'
              : location.pathname.startsWith(item.path)
            const Icon = item.icon

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNav(item)}
                aria-label={item.isCenter ? item.shortLabel[lang] : tt(item.labelKey)}
                aria-current={isActive ? 'page' : undefined}
                title={tt(item.labelKey)}
                className={`group relative z-10 flex min-w-0 flex-1 flex-col items-center justify-center rounded-full py-1.5 transition-all duration-150 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pprimary ${
                  isActive ? 'text-pprimary font-semibold' : 'text-pmuted hover:text-pfg'
                }`}
              >
                <Icon
                  size={23}
                  strokeWidth={isActive ? 2.4 : 1.8}
                  className={`transition-colors duration-200 ${
                    isActive ? 'text-pprimary' : 'text-pmuted group-hover:text-pfg'
                  }`}
                />

                <span
                  className={`mt-1 whitespace-nowrap text-[11px] leading-tight tracking-tight transition-colors duration-200 ${
                    isActive ? 'font-semibold text-pprimary' : 'font-medium text-pmuted group-hover:text-pfg'
                  }`}
                >
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
