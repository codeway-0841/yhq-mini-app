import { memo } from 'react'
import { Sun, Moon, ChevronDown } from 'lucide-react'
import SettingsIcon from '../../../shared/components/SettingsIcon'
import { useAppStore, type ApiUser } from '../../../shared/store/useAppStore'
import { avatarSrcFor } from '../../../shared/api'
import { useSubjectStore } from '../../../shared/store/useSubjectStore'
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
    </div>
  )
})

// ── Top Bar (v3 KIWI) ───────────────────────────────────────────────────────
export const TopBar = memo(function TopBar({ user, displayName, onSettings, onProfile, onSubjects }: {
  user: ApiUser | null
  displayName: string | null
  onSubjects: () => void
  onSettings: () => void
  onProfile: () => void
}) {
  const lang = useAppStore((s) => s.settings.language)
  const tt = useT(lang)
  const subject = useSubjectStore((s) => s.subject)
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
      <div className="flex items-center justify-between gap-2 px-4 py-2">
        <button
          type="button"
          aria-label={tt('profile')}
          onClick={onProfile}
          className="flex shrink-0 items-center rounded-xl transition-opacity active:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pprimary focus-visible:ring-offset-2 focus-visible:ring-offset-pcanvas"
        >
          {/* avatarSrcFor — xom `photoUrl` EMAS: `hasCustomAvatar` persist
              qilingani uchun server avatar URL'i BIRINCHI KADRDA ma'lum bo'ladi.
              Ilgari u faqat hydrate'dan keyin (`customAvatar` o'rnatilganda)
              paydo bo'lardi, ya'ni avatar sezilarli kech chiqardi. */}
          <Avatar name={name} photoUrl={avatarSrcFor(user) ?? undefined} />
        </button>
        <button type="button" onClick={onSubjects} aria-label={`${tt('subjectSelect')}: ${lang === 'ru' ? subject.nameRu : subject.name}`}
          className="flex min-h-11 min-w-0 flex-1 items-center gap-1 rounded-xl px-1 text-left text-pfg hover:bg-psurface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pprimary">
          <span className="min-w-0 text-[14px] font-semibold leading-snug">{lang === 'ru' ? subject.nameRu : subject.name}</span>
          <ChevronDown size={16} className="shrink-0 text-pmuted" aria-hidden="true" />
        </button>

        <div className="flex flex-shrink-0 items-center gap-1">
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

          {/* Sozlamalar */}
          <Button
            variant="ghost"
            size="icon"
            onClick={onSettings}
            aria-label={tt('settingsTitle')}
            className="text-pmuted hover:text-pfg"
          >
            <SettingsIcon className="size-[18px]" />
          </Button>
        </div>
      </div>
    </header>
  )
})


