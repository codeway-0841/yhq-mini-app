import { useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Camera } from 'lucide-react'
import { useScrollAwareVisibility } from '../../../shared/hooks/useScrollAwareVisibility'
import { useModalCount } from '../../../shared/lib/navigation'
import { useAppStore } from '../../../shared/store/useAppStore'
import { playSound } from '../../../shared/lib/sounds'
import { haptics } from '../../../platform/haptics'

const HIDDEN_PREFIXES = [
  '/ai-tutor',
  '/snap-solve',
  '/test/',
  '/ai-test/',
  '/octagon',
  '/login',
  '/onboarding',
  '/verify-email',
  '/reset-password',
]

export default function SnapSolveFab() {
  const navigate = useNavigate()
  const location = useLocation()
  const lang = useAppStore((s) => s.settings.language)
  const modalCount = useModalCount()
  const isScrollVisible = useScrollAwareVisibility({ threshold: 15, topThreshold: 60 })

  const isHiddenRoute = HIDDEN_PREFIXES.some((prefix) => location.pathname.startsWith(prefix))
  const isVisible = !isHiddenRoute && modalCount === 0 && isScrollVisible

  const handleClick = useCallback(() => {
    playSound('click')
    haptics.impact('light')
    navigate('/ai-tutor')
  }, [navigate])

  if (isHiddenRoute) return null

  return (
    <div
      aria-hidden={!isVisible}
      className="pointer-events-none fixed inset-x-0 bottom-[calc(1.25rem+var(--safe-bottom,0px))] z-40 mx-auto max-w-2xl px-4 flex justify-end"
    >
      <button
        type="button"
        tabIndex={isVisible ? 0 : -1}
        onClick={handleClick}
        aria-label={lang === 'ru' ? 'Решить задачу по фото (AI)' : 'Suratdan yechish (AI)'}
        className={`pointer-events-auto group relative flex size-[52px] items-center justify-center rounded-full bg-pprimary text-white shadow-lg shadow-black/25 transition-all duration-200 ease-out active:scale-90 hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pprimary focus-visible:ring-offset-2 ${
          isVisible ? 'translate-y-0 scale-100 opacity-100' : 'translate-y-6 scale-75 opacity-0 pointer-events-none'
        }`}
      >
        <Camera size={23} strokeWidth={1.85} className="transition-transform group-hover:scale-110" />
        <span className="absolute -top-1 -right-1 flex items-center justify-center rounded-full bg-pcard px-1.5 py-0.5 text-[9.5px] font-black tracking-wider text-pprimary shadow-xs select-none">
          AI
        </span>
      </button>
    </div>
  )
}
