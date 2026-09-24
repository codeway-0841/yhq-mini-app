import { memo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Sun, Moon, ChevronDown, Flame } from 'lucide-react'
import { useAppStore, type ApiUser } from '../../../shared/store/useAppStore'
import { avatarSrcFor } from '../../../shared/api'
import { useSubjectStore } from '../../../shared/store/useSubjectStore'
import { useT } from '../../../shared/i18n'
import { getAvatarFrame } from '../../../shared/config/avatar-frames'
import { transitionTheme } from '../../../shared/lib/theme-transition'
import { Button } from '../../../shared/components/ui/button'
import CoinIcon from '../../../shared/components/CoinIcon'
import { playSound } from '../../../shared/lib/sounds'
import { haptics } from '../../../platform/haptics'

// ── Avatar ──────────────────────────────────────────────────────────────────
// DIQQAT: bu avatar DOIRA bo'lib qoladi (ui/Avatar squircle emas) — sotib
// olinadigan ramka kosmetikasi (avatar-frames) doira halqa uchun chizilgan.
const Avatar = memo(function Avatar({ name, photoUrl }: { name: string; photoUrl?: string }) {
  const customAvatar = useAppStore((s) => s.customAvatar)
  const avatarFrame  = useAppStore((s) => s.avatarFrame)
  const frameClass = getAvatarFrame(avatarFrame)?.cssClass ?? null
  const src = customAvatar ?? photoUrl
  const letter = name?.[0]?.toUpperCase() || 'F'
  const inner = src ? (
    <img src={src} alt="" className="size-11 rounded-full object-cover shadow-2xs" />
  ) : (
    <div className="flex size-11 items-center justify-center rounded-full bg-pwash text-lg font-bold text-pprimary shadow-2xs">
      {letter}
    </div>
  )
  return (
    <div className="relative flex-shrink-0">
      {/* #40: sotib olingan avatar ramkasi (CSS-only, avatar-frames config) */}
      {frameClass ? (
        <span className={`avatar-frame ${frameClass}`}>{inner}</span>
      ) : inner}
    </div>
  )
})

// ── Top Bar (v3 KIWI) ───────────────────────────────────────────────────────
export const TopBar = memo(function TopBar({ user, displayName, onSettings: _onSettings, onProfile, onSubjects }: {
  user: ApiUser | null
  displayName: string | null
  onSubjects: () => void
  onSettings?: () => void
  onProfile: () => void
}) {
  const navigate = useNavigate()
  const lang = useAppStore((s) => s.settings.language)
  const tt = useT(lang)
  const subject = useSubjectStore((s) => s.subject)
  const theme = useAppStore((s) => s.settings.theme)
  const streak = useAppStore((s) => s.streak)
  const coins = useAppStore((s) => s.coins)
  const name = displayName ?? user?.firstName ?? tt('guestName')

  // Dark / Light rejimini bir bosishda silliq aylanma ochilish (circular reveal) bilan almashtirish
  const toggleTheme = (e: React.MouseEvent<HTMLButtonElement>) => {
    playSound('toggle')
    haptics.impact('light')
    const rect = e.currentTarget?.getBoundingClientRect()
    const coords = rect
      ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
      : { x: e.clientX, y: e.clientY }
    // Focus halqasi bosgandan keyin yopishib qolmasligi uchun (videodagi ko'k border)
    e.currentTarget?.blur?.()
    // Hozirgi ekrandagi haqiqiy holatdan kelib chiqib aniq almashtirish
    const currentIsDark = typeof document !== 'undefined'
      ? document.body.dataset.theme !== 'light'
      : theme !== 'light'
    const next = currentIsDark ? 'light' : 'dark'
    void transitionTheme(next, coords)
  }

  const isDark = theme === 'light' ? false : (theme === 'dark' ? true : (typeof document !== 'undefined' ? document.body.dataset.theme !== 'light' : true))

  return (
    <header className="sticky top-0 z-30 -mt-[var(--safe-top-body,0px)] pt-[var(--safe-top,0px)] page-header mb-3 lg:static lg:mt-0 lg:pt-3 lg:bg-transparent lg:backdrop-blur-none lg:[-webkit-backdrop-filter:none] lg:border-none lg:shadow-none">
      <div className="flex items-center justify-between gap-2 px-4 py-2">
        <button
          type="button"
          aria-label={tt('profile')}
          onClick={onProfile}
          className="flex shrink-0 items-center rounded-xl transition-opacity active:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pprimary focus-visible:ring-offset-2 focus-visible:ring-offset-pcanvas lg:hidden"
        >
          <Avatar name={name} photoUrl={avatarSrcFor(user) ?? undefined} />
        </button>
        <button
          type="button"
          onClick={onSubjects}
          aria-label={`${tt('subjectSelect')}: ${lang === 'ru' ? subject.nameRu : subject.name}`}
          className="flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-xl px-2 text-left text-pfg transition-[transform,background-color] duration-150 ease-out motion-safe:active:scale-[0.98] [@media(hover:hover)]:hover:bg-psurface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pprimary lg:ml-0 lg:flex-initial lg:border lg:border-pline lg:bg-pwash hover:lg:bg-psurface lg:px-3.5 lg:py-1.5 lg:shadow-2xs cursor-pointer"
        >
          <span aria-hidden="true" className="size-2.5 shrink-0 rounded-full shadow-2xs" style={{ backgroundImage: `linear-gradient(135deg, ${subject.color}, ${subject.colorDark})` }} />
          <span className="min-w-0 text-[14px] font-semibold leading-snug">{lang === 'ru' ? subject.nameRu : subject.name}</span>
          <ChevronDown size={16} className="shrink-0 text-pmuted" aria-hidden="true" />
        </button>

        <div className="flex flex-shrink-0 items-center gap-2 lg:mr-0">
          {/* Wondering-uslub Flame (Olov) va Coin (Tanga) kapsulasi */}
          <div className="hidden sm:flex items-center rounded-xl border border-pline bg-pwash px-3 py-1.5 shadow-2xs gap-3 text-[13px] font-semibold text-pfg">
            <button
              type="button"
              onClick={() => { playSound('click'); navigate('/streak') }}
              title={tt('intizomTitle')}
              className="flex items-center gap-1.5 transition-colors hover:text-orange-500 cursor-pointer"
            >
              <Flame size={15} className="text-orange-500 fill-orange-500 shrink-0" />
              <span>{streak || 0}</span>
            </button>
            <span className="h-3 w-px bg-pline" aria-hidden="true" />
            <button
              type="button"
              onClick={() => { playSound('click'); navigate('/shop') }}
              title={tt('shopTitle')}
              className="flex items-center gap-1.5 transition-colors hover:text-amber-500 cursor-pointer"
            >
              <CoinIcon size={15} className="text-amber-500 shrink-0" />
              <span>{coins || 0}</span>
            </button>
          </div>

          {/* Dark / Light rejim toggle tugmasi */}
          {/* Dark / Light rejim toggle tugmasi */}
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            aria-label={isDark ? 'Light mode' : 'Dark mode'}
            className="theme-toggle-btn text-pmuted hover:text-pfg transition-colors"
          >
            {isDark ? (
              <Moon size={18} strokeWidth={1.75} className="text-pmuted hover:text-pfg" />
            ) : (
              <Sun size={18} strokeWidth={1.75} className="text-pmuted hover:text-pfg" />
            )}
          </Button>
        </div>
      </div>
    </header>
  )
})


