import { useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  Home,
  BookOpen,
  Swords,
  LayoutGrid,
  Trophy,
  ShoppingBag,
  Crown,
  User,
  type LucideIcon,
} from 'lucide-react'
import { useAppStore } from '../store/useAppStore'
import { useT } from '../i18n'
import { playSound } from '../lib/sounds'
import { cn } from '../lib/cn'

interface SidebarItem {
  id: string
  path: string
  labelKey: 'home' | 'testlarTitle' | 'duelTitle' | 'menuTitle' | 'leaderboard' | 'shopTitle' | 'premiumTariff' | 'profile'
  icon: LucideIcon
  section: 'main' | 'extra'
}

const MAIN_ITEMS: SidebarItem[] = [
  { id: 'home', path: '/', labelKey: 'home', icon: Home, section: 'main' },
  { id: 'tests', path: '/testlar', labelKey: 'testlarTitle', icon: BookOpen, section: 'main' },
  { id: 'octagon', path: '/octagon', labelKey: 'duelTitle', icon: Swords, section: 'main' },
  { id: 'modes', path: '/rejimlar', labelKey: 'menuTitle', icon: LayoutGrid, section: 'main' },
]

const EXTRA_ITEMS: SidebarItem[] = [
  { id: 'rating', path: '/reyting', labelKey: 'leaderboard', icon: Trophy, section: 'extra' },
  { id: 'shop', path: '/shop', labelKey: 'shopTitle', icon: ShoppingBag, section: 'extra' },
  { id: 'premium', path: '/premium', labelKey: 'premiumTariff', icon: Crown, section: 'extra' },
  { id: 'profile', path: '/profil', labelKey: 'profile', icon: User, section: 'extra' },
]

/**
 * Desktop chap sidebar (production shell, 2026-09-15).
 *
 * - FAQAT desktop: `hidden lg:flex` — mobilda IosDock ishlaydi.
 * - Sticky + safe-top: TG fullscreen/APK edge-to-edge'da status bar ostida qolmaydi
 *   (safe-area testi: sticky bilan literal top-N TAQIQLANGAN).
 * - Navigatsiya IosDock TAB_ROOT bilan sinxron (4 ta asosiy) + desktop'da
 *   tez kirish uchun 4 ta ikkilamchi (reyting/shop/premium/profil).
 * - shared/ qatlami — features/'ga import YO'Q (import-boundaries).
 */
export default function DesktopSidebar() {
  const navigate = useNavigate()
  const location = useLocation()
  const lang = useAppStore((s) => s.settings.language)
  const tt = useT(lang)

  const handleNav = useCallback(
    (path: string) => {
      playSound('click')
      navigate(path)
    },
    [navigate],
  )

  const renderItem = (item: SidebarItem) => {
    const isActive =
      item.path === '/'
        ? location.pathname === '/'
        : location.pathname === item.path || location.pathname.startsWith(`${item.path}/`)
    const Icon = item.icon
    return (
      <button
        key={item.id}
        type="button"
        onClick={() => handleNav(item.path)}
        aria-label={tt(item.labelKey)}
        aria-current={isActive ? 'page' : undefined}
        className={cn(
          'group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[14px] font-medium transition-all duration-150 ease-out',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pprimary focus-visible:ring-offset-2 focus-visible:ring-offset-pcanvas',
          'active:scale-[0.99]',
          isActive
            ? 'bg-pwash font-semibold text-pfg'
            : 'text-pmuted hover:bg-psurface hover:text-pfg',
        )}
      >
        <Icon
          size={19}
          strokeWidth={isActive ? 2.2 : 1.75}
          aria-hidden="true"
          className={cn('shrink-0', isActive ? 'text-pprimary' : 'text-pmuted group-hover:text-pfg')}
        />
        <span className="min-w-0 flex-1 truncate">{tt(item.labelKey)}</span>
        {isActive && (
          <span aria-hidden="true" className="h-5 w-1 shrink-0 rounded-full bg-pprimary" />
        )}
      </button>
    )
  }

  return (
    <aside
      aria-label="Desktop navigatsiya"
      className="desktop-sidebar hidden w-64 shrink-0 flex-col border-r border-pline bg-pcard/60 backdrop-blur-xl lg:flex xl:w-72 sticky top-[var(--safe-top,0px)] h-[calc(100dvh-var(--safe-top-body,0px))] max-h-[calc(100dvh-var(--safe-top-body,0px))]"
    >
      <div className="flex items-center gap-2.5 px-5 pb-4 pt-6">
        <span aria-hidden="true" className="grid size-9 place-items-center rounded-xl bg-pprimary text-lg font-bold text-ponprimary shadow-xs">
          K
        </span>
        <span className="font-display text-[17px] font-bold tracking-tight text-pfg">KIVVI</span>
      </div>
      <nav aria-label="Asosiy bo'limlar" className="flex-1 overflow-y-auto px-3 pb-4">
        <div className="flex flex-col gap-1">{MAIN_ITEMS.map(renderItem)}</div>
        <p className="mb-1.5 mt-5 px-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-pmuted">
          {lang === 'ru' ? 'Дополнительно' : "Qo'shimcha"}
        </p>
        <div className="flex flex-col gap-1">{EXTRA_ITEMS.map(renderItem)}</div>
      </nav>
      <div className="border-t border-pline p-3">
        <button
          type="button"
          onClick={() => handleNav('/premium')}
          className="flex w-full items-center gap-3 rounded-2xl bg-pwash px-3.5 py-3 text-left shadow-2xs transition-all duration-150 ease-out hover:brightness-[1.04] active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pprimary"
        >
          <Crown size={18} strokeWidth={1.75} aria-hidden="true" className="shrink-0 text-pgold" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13.5px] font-semibold text-pfg">
              {tt('premiumTariff')}
            </span>
            <span className="block truncate text-xs text-pmuted">{tt('premiumTagline')}</span>
          </span>
        </button>
      </div>
    </aside>
  )
}
