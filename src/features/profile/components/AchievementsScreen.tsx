import { ArrowLeft, Check } from 'lucide-react'
import DialogOverlay from '../../../shared/components/DialogOverlay'
import { ACHIEVEMENTS, isUnlocked, type AchievementDef } from '../../../shared/config/achievements'
import type { AchievementStats } from '../../../shared/api'
import { type useT } from '../../../shared/i18n'
import { cn } from '../../../shared/lib/cn'

/** Bitta yutuq katakchasi — squircle tile + nom + progress (eski profil grid'i dizayni). */
function AchievementTile({ a, stats, tt }: {
  a: AchievementDef
  stats: AchievementStats
  tt: ReturnType<typeof useT>
}) {
  const unlocked = isUnlocked(a, stats)
  const cur      = Math.min(a.get(stats), a.target)
  const pct      = a.target > 1 ? Math.round((cur / a.target) * 100) : (unlocked ? 100 : 0)
  const Icon     = a.icon
  return (
    <div className="flex flex-col items-center px-1 text-center">
      <div className="relative mb-2">
        <div
          className={cn(
            'flex size-[52px] items-center justify-center rounded-[16px] transition-colors duration-[120ms] ease-out',
            !unlocked && 'border border-pline bg-psurface opacity-50',
          )}
          style={unlocked
            ? {
                background: `color-mix(in srgb, ${a.color} 12%, transparent)`,
                border: `1px solid color-mix(in srgb, ${a.color} 26%, transparent)`,
              }
            : undefined}
        >
          <Icon size={22} strokeWidth={1.75} style={{ color: unlocked ? a.color : 'var(--p-subtle)' }} />
        </div>
        {unlocked && (
          <span className="absolute -bottom-1 -right-1 grid size-[18px] place-items-center rounded-full border-2 border-pcard bg-psuccess">
            <Check size={9} strokeWidth={3} className="text-white" />
          </span>
        )}
      </div>
      <p className={cn('line-clamp-2 text-[10.5px] font-semibold leading-tight text-pfg', !unlocked && 'opacity-60')}>
        {tt(a.titleKey)}
      </p>
      <div className="mt-2 h-[2px] w-full max-w-[64px] overflow-hidden rounded-[1px] bg-plineStrong">
        <div className="h-full rounded-[1px] transition-[width] duration-[400ms] ease-out"
          style={{ width: `${pct}%`, background: unlocked ? a.color : 'var(--p-subtle)' }} />
      </div>
      <p className="mt-1 text-[9.5px] font-semibold tabular-nums"
        style={{ color: unlocked ? a.color : 'var(--p-subtle)' }}>
        {cur}/{a.target}
      </p>
    </div>
  )
}

/**
 * AchievementsScreen — profildagi ixcham "Yutuqlarim" qatori bosilganda
 * ochiladigan TO'LIQ EKRAN (ModesSheet bilan bir xil pattern):
 * ← back + sarlavha + umumiy progress + 3-ustunli yutuq panjarasi.
 */
export default function AchievementsScreen({ stats, tt, onClose }: {
  stats: AchievementStats
  tt: ReturnType<typeof useT>
  onClose: () => void
}) {
  const unlockedCount = ACHIEVEMENTS.filter((a) => isUnlocked(a, stats)).length
  const sorted = [...ACHIEVEMENTS]
    .sort((a, b) => Number(isUnlocked(b, stats)) - Number(isUnlocked(a, stats)))

  return (
    <DialogOverlay onClose={onClose} labelId="ach-screen-title" position="center" className="!p-0" backdropClassName="hidden">
      <div className="relative w-full h-full bg-pcanvas flex flex-col animate-premiumIn">
        {/* Header — ← back + sarlavha */}
        <div className="flex items-center gap-3 px-4 pt-4 pb-3 safe-top">
          <button
            type="button"
            onClick={onClose}
            aria-label={tt('backWord')}
            className="w-10 h-10 rounded-full flex items-center justify-center text-pfg hover:bg-psurface active:scale-95 transition-all"
          >
            <ArrowLeft size={22} strokeWidth={2} />
          </button>
          <p id="ach-screen-title" className="text-[18px] font-semibold text-pfg">{tt('achTitle')}</p>
        </div>

        {/* Umumiy progress */}
        <div className="flex items-center gap-3 mx-4 mb-4 px-4 py-3 rounded-container border border-pline bg-pcard">
          <span className="text-[12px] font-semibold tabular-nums text-pmuted">
            {unlockedCount} / {ACHIEVEMENTS.length}
          </span>
          <div className="h-[3px] flex-1 overflow-hidden rounded-[2px] bg-plineStrong">
            <div className="h-full rounded-[2px] bg-pprimary transition-[width] duration-[400ms] ease-out"
              style={{ width: `${(unlockedCount / ACHIEVEMENTS.length) * 100}%` }} />
          </div>
        </div>

        {/* 3-ustunli yutuqlar panjarasi — olinganlari birinchi */}
        <div className="flex-1 overflow-y-auto px-4 pb-8 safe-bottom">
          <div className="grid grid-cols-3 gap-y-5 p-2">
            {sorted.map((a) => (
              <AchievementTile key={a.id} a={a} stats={stats} tt={tt} />
            ))}
          </div>
        </div>
      </div>
    </DialogOverlay>
  )
}
