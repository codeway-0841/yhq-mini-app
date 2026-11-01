import { useCallback, useMemo } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Home, BookOpen, Camera, Swords, LayoutGrid } from 'lucide-react'
import { useModalCount } from '../lib/navigation'
import { useAppStore } from '../store/useAppStore'
import { useT } from '../i18n'
import { playSound } from '../lib/sounds'
import { isTabRootRoute } from '../config/route-chrome'
import { haptics } from '../../platform/haptics'

export { isTabRootRoute, TAB_ROOT_PATHS } from '../config/route-chrome'

/**
 * Pastki dock FAQAT tab-root (asosiy bo'lim) sahifalarda ko'rinadi.
 *
 * Brilliant 1:1 uslubi:
 * - Pastki qismga yopishgan to'liq kenglikdagi navigatsiya paneli (edge-to-edge).
 * - Markazda Kamera (AI Yechish) joylashgan: 5 ta mutanosib bo'lim (2 chap + 1 markaz + 2 o'ng).
 * - Faol bo'lim ikonasida Brilliant'ga xos yumshoq squircle/pill fon, qora/oq matn va qalin shrift.
 */
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

  if (!isTabRoot) return null

  return (
    <div
      aria-hidden={!isVisible}
      className={`fixed inset-x-0 bottom-0 z-40 w-full pointer-events-none pb-[calc(var(--safe-bottom,0px)*0)] transition-[transform,opacity] duration-200 ease-out motion-reduce:transition-none lg:hidden ${
        isVisible ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0'
      }`}
    >
      <nav
        role="navigation"
        aria-label="Asosiy navigatsiya"
        className="pointer-events-auto w-full bg-pcanvas pt-2 pb-[max(1.25rem,calc(var(--safe-bottom,0px)+0.5rem))] px-1 select-none"
        style={{ backgroundColor: 'var(--p-canvas)' }}
      >
        <div className="mx-auto flex max-w-[480px] items-center justify-around">
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
                className="group relative flex min-w-0 flex-1 flex-col items-center justify-center py-0.5 touch-manipulation transition-transform duration-150 active:scale-95 focus-visible:outline-none"
              >
                {/* Brilliant 1:1 icon squircle/pill: faol bo'lsa yumaloq fon, nofaol bo'lsa shaffof */}
                <span
                  data-testid={isActive ? 'dock-active-pill' : undefined}
                  className={`flex h-[30px] w-[52px] items-center justify-center rounded-full transition-colors duration-200 ${
                    item.isCenter
                      ? isActive
                        ? 'bg-[rgb(var(--p-primary-rgb)/0.2)] text-pprimary dark:text-white'
                        : 'bg-[rgb(var(--p-primary-rgb)/0.12)] text-pprimary dark:bg-[rgb(var(--p-primary-rgb)/0.18)] dark:text-sky-300'
                      : isActive
                        ? 'bg-black/[0.07] text-pfg dark:bg-white/10 dark:text-white'
                        : 'bg-transparent text-pmuted [@media(hover:hover)]:group-hover:text-pfg'
                  }`}
                >
                  <Icon
                    size={21}
                    strokeWidth={isActive ? 2.3 : item.isCenter ? 2.1 : 1.9}
                    className="transition-transform duration-150"
                  />
                </span>

                <span
                  className={`mt-1 whitespace-nowrap text-[11px] leading-tight tracking-tight transition-colors duration-150 ${
                    item.isCenter
                      ? isActive
                        ? 'font-bold text-pprimary dark:text-white'
                        : 'font-semibold text-pprimary dark:text-sky-300'
                      : isActive
                        ? 'font-bold text-pfg dark:text-white'
                        : 'font-medium text-pmuted [@media(hover:hover)]:group-hover:text-pfg'
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
