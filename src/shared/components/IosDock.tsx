import { useCallback, useMemo } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Home, BookOpen, Camera, Swords, User } from 'lucide-react'
import { useModalCount } from '../lib/navigation'
import { useAppStore } from '../store/useAppStore'
import { useT } from '../i18n'
import { playSound } from '../lib/sounds'
import { haptics } from '../../platform/haptics'

const HIDDEN_PREFIXES = [
  '/test/',
  '/ai-test/',
  '/adaptive',
  '/speed',
  '/ai-tutor',
  '/snap-solve',
  '/login',
  '/onboarding',
  '/verify-email',
  '/reset-password',
]

interface NavItem {
  id: string
  path: string
  labelKey: 'home' | 'testlarTitle' | 'snapSolveTitle' | 'duelTitle' | 'profile'
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

  const isHiddenRoute = HIDDEN_PREFIXES.some((prefix) => location.pathname.startsWith(prefix))
  const isVisible = !isHiddenRoute && modalCount === 0

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
      id: 'profile',
      path: '/profil',
      labelKey: 'profile',
      shortLabel: { uz: 'Profil', ru: 'Профиль' },
      icon: User,
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

  if (isHiddenRoute) return null

  return (
    <div
      aria-hidden={!isVisible}
      className={`pointer-events-none fixed inset-x-0 bottom-[calc(0.75rem+var(--safe-bottom,0px))] z-40 mx-auto flex justify-center px-3 transition-all duration-300 ease-out ${
        isVisible
          ? 'translate-y-0 opacity-100'
          : 'translate-y-12 opacity-0 pointer-events-none'
      }`}
    >
      <nav
        role="navigation"
        aria-label="Asosiy navigatsiya"
        className="pointer-events-auto ios-glass flex items-center gap-1 sm:gap-1.5 rounded-full p-1.5 shadow-2xl shadow-black/20 dark:shadow-black/60 border border-plineStrong/50 ring-1 ring-black/5 dark:ring-white/10"
      >
        {navItems.map((item) => {
          const isActive = item.path === '/'
            ? location.pathname === '/'
            : location.pathname.startsWith(item.path)
          const Icon = item.icon

          if (item.isCenter) {
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNav(item)}
                aria-label={item.shortLabel[lang]}
                className="group relative flex items-center gap-1.5 rounded-full bg-pprimary px-3.5 py-2 text-ponprimary shadow-md shadow-pprimary/30 transition-all duration-200 active:scale-95 hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pprimary focus-visible:ring-offset-2"
              >
                <Icon size={18} strokeWidth={2.2} className="shrink-0 transition-transform group-hover:scale-110" />
                <span className="text-[12px] font-bold tracking-tight whitespace-nowrap">
                  {item.shortLabel[lang]}
                </span>
                <span className="absolute -top-1 -right-1 flex size-3.5 items-center justify-center rounded-full bg-white dark:bg-pcard text-[8px] font-black text-pprimary shadow-xs">
                  ✨
                </span>
              </button>
            )
          }

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleNav(item)}
              aria-label={tt(item.labelKey)}
              aria-current={isActive ? 'page' : undefined}
              className={`flex flex-col items-center justify-center rounded-full px-2.5 sm:px-3.5 py-1.5 transition-all duration-200 active:scale-90 ${
                isActive
                  ? 'bg-psurface/80 dark:bg-white/15 text-pprimary dark:text-white font-semibold shadow-xs'
                  : 'text-pmuted hover:text-pfg hover:bg-psurface/40'
              }`}
            >
              <Icon
                size={18}
                strokeWidth={isActive ? 2.2 : 1.75}
                className="transition-transform"
              />
              <span className="text-[10px] tracking-tight mt-0.5 whitespace-nowrap">
                {item.shortLabel[lang]}
              </span>
            </button>
          )
        })}
      </nav>
    </div>
  )
}
