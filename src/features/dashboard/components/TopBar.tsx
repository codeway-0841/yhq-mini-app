import { memo } from 'react'
import { Sun, Moon, ChevronDown, Menu } from 'lucide-react'
import SettingsIcon from '../../../shared/components/SettingsIcon'
import { useAppStore, type ApiUser } from '../../../shared/store/useAppStore'
import { useSubjectStore } from '../../../shared/store/useSubjectStore'
import { useT } from '../../../shared/i18n'
import { transitionTheme } from '../../../shared/lib/theme-transition'
import { Button } from '../../../shared/components/ui/button'
import { playSound } from '../../../shared/lib/sounds'
import { haptics } from '../../../platform/haptics'

// ── Top Bar (v3 KIWI) ───────────────────────────────────────────────────────
export const TopBar = memo(function TopBar({ onSettings, onSubjects, onMenu, onProfile }: {
  user?: ApiUser | null
  displayName?: string | null
  onSubjects: () => void
  onSettings: () => void
  onProfile?: () => void
  onMenu?: () => void
}) {
  const lang = useAppStore((s) => s.settings.language)
  const tt = useT(lang)
  const subject = useSubjectStore((s) => s.subject)
  const theme = useAppStore((s) => s.settings.theme)

  const handleMenu = () => {
    playSound('click')
    haptics.selection()
    if (onMenu) onMenu()
    else if (onProfile) onProfile()
  }

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
          aria-label={lang === 'ru' ? 'Меню' : 'Menyu'}
          onClick={handleMenu}
          className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-psurface text-pfg hover:bg-psurface/80 active:scale-95 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pprimary focus-visible:ring-offset-2 focus-visible:ring-offset-pcanvas shadow-2xs"
        >
          <Menu size={22} strokeWidth={2} />
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


