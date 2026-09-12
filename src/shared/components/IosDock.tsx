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
      className={`fixed inset-x-0 bottom-0 z-40 w-full transition-transform duration-300 ease-out ${
        isVisible ? 'translate-y-0 pointer-events-auto' : 'translate-y-full pointer-events-none'
      }`}
    >
      <nav
        role="navigation"
        aria-label="Asosiy navigatsiya"
        className="w-full bg-pcard/95 backdrop-blur-xl border-t border-pline shadow-[0_-4px_24px_rgba(0,0,0,0.06)] dark:shadow-[0_-4px_24px_rgba(0,0,0,0.4)] pb-[calc(0.35rem+var(--safe-bottom,0px))] pt-1.5"
      >
        <div className="mx-auto flex max-w-lg items-end justify-around px-2">
          {navItems.map((item) => {
            const isActive = item.path === '/'
              ? location.pathname === '/'
              : location.pathname.startsWith(item.path)
            const Icon = item.icon

            if (item.isCenter) {
              return (
                <div key={item.id} className="flex-1 flex flex-col items-center justify-center -mt-5">
                  <button
                    type="button"
                    onClick={() => handleNav(item)}
                    aria-label={item.shortLabel[lang]}
                    className="group relative flex size-12 items-center justify-center rounded-full bg-pprimary text-ponprimary shadow-lg shadow-pprimary/35 ring-4 ring-pcanvas transition-all duration-150 active:scale-90 hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pprimary focus-visible:ring-offset-2"
                  >
                    <Icon size={22} strokeWidth={2.2} className="transition-transform group-hover:scale-110" />
                    <span className="absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full bg-white dark:bg-pcard text-[9px] font-black text-pprimary shadow-xs select-none">
                      ✨
                    </span>
                  </button>
                  <span className="text-[10px] font-bold text-pprimary mt-1 tracking-tight whitespace-nowrap">
                    {item.shortLabel[lang]}
                  </span>
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
                className={`flex-1 flex flex-col items-center justify-center min-w-0 py-1 transition-all duration-150 active:scale-90 ${
                  isActive ? 'text-pprimary font-semibold' : 'text-pmuted hover:text-pfg'
                }`}
              >
                <Icon
                  size={20}
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
