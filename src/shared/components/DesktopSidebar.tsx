import { useState, useRef, useEffect, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  Home,
  BookOpen,
  Swords,
  LayoutGrid,
  Trophy,
  ShoppingBag,
  Flame,
  ChevronDown,
  User,
  Settings,
  Smartphone,
  LogOut,
  type LucideIcon,
} from 'lucide-react'
import { useAppStore } from '../store/useAppStore'
import { resetAccountToLoggedOut } from '../store/account'
import { avatarSrcFor } from '../api'
import SettingsModal from './SettingsModal'
import PremiumIcon from './PremiumIcon'
import CoinIcon from './CoinIcon'
import { useT } from '../i18n'
import { playSound } from '../lib/sounds'
import { cn } from '../lib/cn'

interface SidebarItem {
  id: string
  path: string
  labelKey: 'home' | 'testlarTitle' | 'duelTitle' | 'menuTitle' | 'leaderboard' | 'shopTitle'
  icon: LucideIcon
}

const MAIN_ITEMS: SidebarItem[] = [
  { id: 'home', path: '/', labelKey: 'home', icon: Home },
  { id: 'tests', path: '/testlar', labelKey: 'testlarTitle', icon: BookOpen },
  { id: 'octagon', path: '/octagon', labelKey: 'duelTitle', icon: Swords },
  { id: 'modes', path: '/rejimlar', labelKey: 'menuTitle', icon: LayoutGrid },
]

const EXTRA_ITEMS: SidebarItem[] = [
  { id: 'rating', path: '/reyting', labelKey: 'leaderboard', icon: Trophy },
  { id: 'shop', path: '/shop', labelKey: 'shopTitle', icon: ShoppingBag },
]

/**
 * Desktop chap sidebar (Wondering / Linear uslubida, 2026-09-22).
 *
 * - FAQAT desktop: `hidden lg:flex` — mobilda IosDock ishlaydi.
 * - Tartib:
 *   1. Logo (KIVVI)
 *   2. Asosiy bo'limlar + Qo'shimcha (Reyting, Do'kon)
 *   3. Seriya & Tangalar hisoblagichi (🔥 0, ⭐ 0)
 *   4. Premium / Upgrade kartasi (Profile tepasida, 2 ta bo'lishi yo'qotilgan)
 *   5. Profil bloki (eng pastda: avatar, ism, chevron) -> tepaga ochiluvchi popover menyu
 * - shared/ qatlami — features/'ga import YO'Q (import-boundaries).
 */
export default function DesktopSidebar() {
  const navigate = useNavigate()
  const location = useLocation()
  const lang = useAppStore((s) => s.settings.language)
  const tt = useT(lang)

  const user = useAppStore((s) => s.user)
  const displayName = useAppStore((s) => s.displayName)
  const customAvatar = useAppStore((s) => s.customAvatar)
  const streak = useAppStore((s) => s.streak)
  const coins = useAppStore((s) => s.coins)
  const tariff = useAppStore((s) => s.tariff)
  const isPremium = tariff === 'premium'

  const [userDropdownOpen, setUserDropdownOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown on outside click
  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setUserDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [])

  const name =
    displayName ||
    user?.firstName ||
    (user?.username ? `@${user.username}` : lang === 'ru' ? 'Пользователь' : 'Foydalanuvchi')
  const avatarLetter = (name.charAt(0) || 'K').toUpperCase()
  const avatarSrc = customAvatar || (user ? avatarSrcFor(user) : null)

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
          'group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[14px] font-medium transition-all duration-150 ease-out cursor-pointer',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pprimary focus-visible:ring-offset-2 focus-visible:ring-offset-pcanvas',
          'active:scale-[0.99]',
          isActive
            ? 'bg-pwash font-semibold text-pprimary'
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
      </button>
    )
  }

  return (
    <>
      <aside
        aria-label="Desktop navigatsiya"
        className="desktop-sidebar hidden w-64 shrink-0 flex-col border-r border-pline bg-[rgb(var(--p-card-rgb)/0.6)] backdrop-blur-xl lg:flex xl:w-72 sticky top-[var(--safe-top,0px)] h-[calc(100dvh-var(--safe-top-body,0px))] max-h-[calc(100dvh-var(--safe-top-body,0px))]"
      >
        {/* Top Logo */}
        <div className="flex items-center gap-2.5 px-5 pb-4 pt-6">
          <span
            aria-hidden="true"
            className="grid size-9 place-items-center rounded-xl bg-pprimary text-lg font-bold text-ponprimary shadow-xs"
          >
            K
          </span>
          <span className="font-display text-[17px] font-bold tracking-tight text-pfg">KIVVI</span>
        </div>

        {/* Main Nav Items */}
        <nav aria-label="Asosiy bo'limlar" className="flex-1 overflow-y-auto px-3 pb-4">
          <div className="flex flex-col gap-1">{MAIN_ITEMS.map(renderItem)}</div>
          <p className="mb-1.5 mt-5 px-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-pmuted">
            {lang === 'ru' ? 'Дополнительно' : "Qo'shimcha"}
          </p>
          <div className="flex flex-col gap-1">{EXTRA_ITEMS.map(renderItem)}</div>
        </nav>

        {/* Bottom Section: Metrics + Premium (Upgrade) + Profile */}
        <div className="border-t border-pline p-3">
          {/* Subtle Stats / Counters (🔥 0, 🪙 0) */}
          <div className="mb-2.5 flex items-center gap-4 px-2 text-[12px] font-semibold text-pmuted">
            <button
              type="button"
              onClick={() => handleNav('/streak')}
              className="flex items-center gap-1.5 transition-colors hover:text-pfg cursor-pointer"
            >
              <Flame size={14} className="shrink-0 text-amber-500" />
              <span>{streak || 0}</span>
            </button>
            <button
              type="button"
              onClick={() => handleNav('/shop')}
              className="flex items-center gap-1.5 transition-colors hover:text-pfg cursor-pointer"
            >
              <CoinIcon size={14} className="shrink-0 text-amber-500" />
              <span>{coins || 0}</span>
            </button>
          </div>

          {/* Upgrade / Premium Banner Card (Directly above profile, clear sky blue, no icon box/border) */}
          <div className="mb-2">
            <button
              type="button"
              onClick={() => handleNav('/premium')}
              className="group relative flex w-full items-center gap-3 rounded-2xl bg-sky-100/90 p-3 text-left transition-all duration-150 ease-out hover:bg-sky-200/80 active:scale-[0.99] dark:bg-sky-900/40 dark:hover:bg-sky-900/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pprimary cursor-pointer shadow-2xs"
            >
              <PremiumIcon size={20} className="shrink-0 text-sky-600 dark:text-sky-400" />
              <div className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-bold text-sky-950 dark:text-sky-100">
                  {isPremium ? 'Kivvi Pro' : lang === 'ru' ? 'Премиум' : 'Upgrade'}
                </span>
                <span className="block truncate text-[11.5px] font-medium text-sky-700/85 dark:text-sky-300/85">
                  {isPremium
                    ? lang === 'ru'
                      ? 'Активная подписка'
                      : 'Faol obuna'
                    : lang === 'ru'
                      ? 'Учитесь без ограничений'
                      : 'Learn without limits'}
                </span>
              </div>
              {!isPremium && <span className="size-2 shrink-0 rounded-full bg-sky-500 shadow-xs" />}
            </button>
          </div>

          {/* Profile Button at the Very Bottom with Upward Popover */}
          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setUserDropdownOpen((v) => !v)}
              className={cn(
                'flex w-full items-center gap-2.5 rounded-xl px-2 py-2 text-left transition-all duration-150 ease-out hover:bg-psurface active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pprimary cursor-pointer',
                userDropdownOpen && 'bg-psurface',
              )}
            >
              <div className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-sky-100 text-[12.5px] font-bold text-sky-700 dark:bg-sky-950 dark:text-sky-300">
                {avatarSrc ? (
                  <img src={avatarSrc} alt="" className="size-full object-cover" />
                ) : (
                  avatarLetter
                )}
              </div>
              <span className="min-w-0 flex-1 truncate text-[13.5px] font-semibold text-pfg">
                {name}
              </span>
              <ChevronDown
                size={16}
                className={cn(
                  'shrink-0 text-pmuted transition-transform duration-200',
                  userDropdownOpen && 'rotate-180',
                )}
              />
            </button>

            {/* Upward Popover Dropdown Menu */}
            {userDropdownOpen && (
              <div className="absolute bottom-full inset-x-0 mb-2 z-50 overflow-hidden rounded-2xl border border-pline bg-pcard p-1.5 shadow-2xl backdrop-blur-xl animate-in fade-in duration-150">
                <button
                  type="button"
                  onClick={() => {
                    setUserDropdownOpen(false)
                    handleNav('/profil')
                  }}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-[13.5px] font-medium text-pfg transition-colors hover:bg-psurface cursor-pointer"
                >
                  <User size={16} className="shrink-0 text-pmuted" />
                  <span>{tt('profile')}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setUserDropdownOpen(false)
                    setSettingsOpen(true)
                  }}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-[13.5px] font-medium text-pfg transition-colors hover:bg-psurface cursor-pointer"
                >
                  <Settings size={16} className="shrink-0 text-pmuted" />
                  <span>{tt('settingsTitle')}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setUserDropdownOpen(false)
                    handleNav('/apk')
                  }}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-[13.5px] font-medium text-pfg transition-colors hover:bg-psurface cursor-pointer"
                >
                  <Smartphone size={16} className="shrink-0 text-pmuted" />
                  <span>{lang === 'ru' ? 'Скачать приложение' : 'Ilovani yuklab olish'}</span>
                </button>

                <div className="my-1 h-px bg-pline" />

                <button
                  type="button"
                  onClick={() => {
                    setUserDropdownOpen(false)
                    resetAccountToLoggedOut()
                  }}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-[13.5px] font-semibold text-rose-500 transition-colors hover:bg-rose-500/10 dark:text-rose-400 cursor-pointer"
                >
                  <LogOut size={16} className="shrink-0" />
                  <span>{lang === 'ru' ? 'Выйти' : 'Chiqish'}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Settings Modal (agar popoverdan Sozlamalar bosilsa) */}
      {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}
    </>
  )
}
