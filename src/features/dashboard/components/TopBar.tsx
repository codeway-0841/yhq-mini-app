import { memo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Sun, Moon, Trophy } from 'lucide-react'
import SettingsIcon from '../../../shared/components/SettingsIcon'
import { useAppStore, type ApiUser } from '../../../shared/store/useAppStore'
import { avatarSrcFor } from '../../../shared/api'
import { useT } from '../../../shared/i18n'
import { getAvatarFrame } from '../../../shared/config/avatar-frames'
import { transitionTheme } from '../../../shared/lib/theme-transition'
import { Button } from '../../../shared/components/ui/button'
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
      <span className="absolute -bottom-0.5 -right-0.5 size-3.5 rounded-full border-[2.5px] border-pcanvas bg-psuccess" />
    </div>
  )
})

// ── Top Bar (v3 KIWI) ───────────────────────────────────────────────────────
export const TopBar = memo(function TopBar({ user, displayName, level: _level, onSettings, onProfile }: {
  user: ApiUser | null
  displayName: string | null
  level?: number
  onSettings: () => void
  onProfile: () => void
}) {
  const navigate = useNavigate()
  const lang = useAppStore((s) => s.settings.language)
  const tt = useT(lang)
  const theme = useAppStore((s) => s.settings.theme)
  const name = displayName ?? user?.firstName ?? tt('guestName')

  // Dark / Light rejimini bir bosishda silliq aylanma ochilish (circular reveal) bilan almashtirish
  const toggleTheme = (e: React.MouseEvent<HTMLButtonElement>) => {
    playSound('toggle')
    haptics.impact('light')
    const rect = e.currentTarget?.getBoundingClientRect()
    const coords = rect
      ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
      : { x: e.clientX, y: e.clientY }
    // Hozirgi ekrandagi haqiqiy holatdan kelib chiqib aniq almashtirish
    const currentIsDark = typeof document !== 'undefined'
      ? document.body.dataset.theme !== 'light'
      : theme !== 'light'
    const next = currentIsDark ? 'light' : 'dark'
    void transitionTheme(next, coords)
  }

  const isDark = theme === 'light' ? false : (theme === 'dark' ? true : (typeof document !== 'undefined' ? document.body.dataset.theme !== 'light' : true))

  return (
    <header className="sticky top-0 z-30 -mt-[var(--safe-top-body,0px)] pt-[var(--safe-top,0px)] bg-pcanvas border-b border-pline mb-3">
      <div className="flex items-center justify-between gap-3 px-4 py-2">
        <button
          onClick={onProfile}
          className="flex min-w-0 items-center gap-3 rounded-xl transition-opacity active:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pprimary focus-visible:ring-offset-2 focus-visible:ring-offset-pcanvas"
        >
          {/* avatarSrcFor — xom `photoUrl` EMAS: `hasCustomAvatar` persist
              qilingani uchun server avatar URL'i BIRINCHI KADRDA ma'lum bo'ladi.
              Ilgari u faqat hydrate'dan keyin (`customAvatar` o'rnatilganda)
              paydo bo'lardi, ya'ni avatar sezilarli kech chiqardi. */}
          <Avatar name={name} photoUrl={avatarSrcFor(user) ?? undefined} />
          <div className="min-w-0 text-left">
            <p className="text-[12px] font-medium text-psubtle">{tt('greeting')},</p>
            <p className="truncate font-display text-[18px] font-semibold leading-tight tracking-[-0.015em] text-pfg">
              {name}
            </p>
          </div>
        </button>

        <div className="flex flex-shrink-0 items-center gap-1">
          {/* Reyting / Leaderboard */}
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => { playSound('click'); haptics.impact('light'); navigate('/reyting') }}
            aria-label={tt('leaderboard')}
            className="size-8 text-pmuted hover:text-pfg transition-transform active:scale-90"
          >
            <Trophy size={18} strokeWidth={1.75} />
          </Button>

          {/* Dark / Light rejim toggle tugmasi */}
          {/* Dark / Light rejim toggle tugmasi */}
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={toggleTheme}
            aria-label={isDark ? 'Light mode' : 'Dark mode'}
            className="theme-toggle-btn size-8 text-pmuted hover:text-pfg transition-colors"
          >
            {isDark ? (
              <Moon size={18} strokeWidth={1.75} className="text-pmuted hover:text-pfg" />
            ) : (
              <Sun size={18} strokeWidth={1.75} className="text-pmuted hover:text-pfg" />
            )}
          </Button>

          {/* Sozlamalar */}
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onSettings}
            aria-label={tt('settingsTitle')}
            className="size-8 text-pmuted hover:text-pfg"
          >
            <SettingsIcon className="size-[18px]" />
          </Button>
        </div>
      </div>
    </header>
  )
})


