import { useState } from 'react'
import { ArrowLeft, Check, Sparkles } from 'lucide-react'
import { createPortal } from 'react-dom'
import DialogOverlay from '../../../shared/components/DialogOverlay'
import { ACHIEVEMENTS, isUnlocked, type AchievementDef, type AchievementCategory } from '../../../shared/config/achievements'
import type { AchievementStats } from '../../../shared/api'
import { type useT } from '../../../shared/i18n'
import { cn } from '../../../shared/lib/cn'
import { haptics } from '../../../platform/haptics'

import { useAchievementCelebrationStore } from '../../../shared/store/useAchievementCelebrationStore'
import { BadgeCard3D } from '../../../shared/components/BadgeCard3D'

export type TabKey = 'all' | AchievementCategory

/** Bitta yutuq katakchasi — 3D badge + nom + progress + tap to inspect */
function AchievementTile({ a, stats, tt }: {
  a: AchievementDef
  stats: AchievementStats
  tt: ReturnType<typeof useT>
}) {
  const openDetailSheet = useAchievementCelebrationStore((s) => s.openDetailSheet)
  const unlocked = isUnlocked(a, stats)
  const cur      = Math.min(a.get(stats), a.target)
  const pct      = a.target > 1 ? Math.round((cur / a.target) * 100) : (unlocked ? 100 : 0)

  const handleClick = () => {
    haptics.selection()
    openDetailSheet(a, { current: cur, target: a.target, unlocked })
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={`${tt(a.titleKey)}, ${unlocked ? tt('achStatusUnlocked') : `${cur}/${a.target}`}`}
      className="group flex flex-col items-center px-1 text-center select-none cursor-pointer focus-visible:outline-none transition-transform duration-150 active:scale-95"
    >
      <div className="relative mb-1.5 flex size-14 items-center justify-center">
        <BadgeCard3D
          achievement={a}
          unlocked={unlocked}
          size="sm"
          interactive={false}
          showTierGlow={unlocked}
        />

        {unlocked && (
          <span className="absolute -bottom-0.5 -right-0.5 grid size-[18px] place-items-center rounded-full border-2 border-pcanvas bg-psuccess shadow-xs z-20">
            <Check size={9} strokeWidth={3} className="text-white" />
          </span>
        )}
      </div>

      <p className={cn('line-clamp-2 text-[10.5px] font-semibold leading-tight text-pfg', !unlocked && 'opacity-60')}>
        {tt(a.titleKey)}
      </p>

      <div className="mt-2 h-[2px] w-full max-w-[64px] overflow-hidden rounded-[1px] bg-plineStrong">
        <div
          className="h-full rounded-[1px] transition-[width] duration-500 ease-out"
          style={{ width: `${pct}%`, background: unlocked ? a.color : 'var(--p-subtle)' }}
        />
      </div>

      <p
        className="mt-1 text-[9.5px] font-semibold tabular-nums"
        style={{ color: unlocked ? a.color : 'var(--p-subtle)' }}
      >
        {cur}/{a.target}
      </p>
    </button>
  )
}

/**
 * AchievementsScreen — profildagi "Nishonlar" yoki "Marralar" bosilganda
 * ochiladigan TO'LIQ EKRAN:
 * ← back + sarlavha + tablar (Barchasi, Nishonlar, Marralar) + umumiy progress + 3-ustunli panjara.
 */
export default function AchievementsScreen({
  stats,
  tt,
  initialTab = 'all',
  onClose,
}: {
  stats: AchievementStats
  tt: ReturnType<typeof useT>
  initialTab?: TabKey
  onClose: () => void
}) {
  const [activeTab, setActiveTab] = useState<TabKey>(initialTab)

  const tabAchievements = ACHIEVEMENTS.filter((a) => {
    if (activeTab === 'all') return true
    return a.category === activeTab
  })

  const unlockedCount = tabAchievements.filter((a) => isUnlocked(a, stats)).length
  const sorted = [...tabAchievements]
    .sort((a, b) => Number(isUnlocked(b, stats)) - Number(isUnlocked(a, stats)))

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'all', label: tt('tabAll') },
    { key: 'badge', label: tt('tabBadges') },
    { key: 'milestone', label: tt('tabMilestones') },
  ]

  const content = (
    <DialogOverlay onClose={onClose} labelId="ach-screen-title" position="center" className="!p-0" backdropClassName="hidden" zIndex={60}>
      <div className="relative w-full h-full bg-pcanvas flex flex-col animate-premiumIn">
        {/* Header — SSOT safe-top header */}
        <header className="shrink-0 flex items-center justify-between px-4 pb-3 pt-[calc(var(--safe-top,0px)+0.75rem)] bg-pcanvas border-b border-pline">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              aria-label={tt('backWord')}
              className="size-9 rounded-xl bg-psurface flex items-center justify-center text-pfg active:scale-95 shadow-xs transition-all cursor-pointer"
            >
              <ArrowLeft size={20} strokeWidth={2} />
            </button>
            <p id="ach-screen-title" className="text-[17px] font-bold text-pfg">{tt('achTitle')}</p>
          </div>
          <button
            type="button"
            onClick={() => {
              const demoBadge = tabAchievements.find((a) => a.id === 'perfectRun') || tabAchievements[0] || ACHIEVEMENTS[0]
              useAchievementCelebrationStore.getState().triggerCelebration(demoBadge)
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-psurface text-xs font-semibold text-pfg hover:bg-[rgb(var(--p-surface-rgb)/0.8)] active:scale-95 transition-all cursor-pointer shadow-xs"
            title={tt('achViewCelebration')}
          >
            <Sparkles size={13} className="text-pgold" />
            <span>{tt('achViewCelebration')}</span>
          </button>
        </header>

        {/* Tab Controls (Barchasi | Nishonlar | Marralar) */}
        <div className="mx-4 mt-3 mb-2 flex items-center rounded-xl bg-psurface p-1 shadow-2xs">
          {tabs.map((t) => {
            const isSelected = activeTab === t.key
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => {
                  haptics.selection()
                  setActiveTab(t.key)
                }}
                className={cn(
                  'flex-1 rounded-lg py-1.5 text-[12.5px] font-semibold transition-all duration-150 cursor-pointer text-center',
                  isSelected
                    ? 'bg-pcard text-pfg shadow-xs font-bold'
                    : 'text-pmuted hover:text-pfg',
                )}
              >
                {t.label}
              </button>
            )
          })}
        </div>

        {/* Umumiy progress */}
        <div className="flex items-center gap-3 mx-4 mb-3 px-4 py-3 rounded-2xl bg-pcard shadow-xs">
          <span className="text-[12px] font-semibold tabular-nums text-pmuted">
            {unlockedCount} / {tabAchievements.length}
          </span>
          <div className="h-[3px] flex-1 overflow-hidden rounded-[2px] bg-plineStrong">
            <div
              className="h-full rounded-[2px] bg-pprimary transition-[width] duration-500 ease-out"
              style={{ width: `${(unlockedCount / Math.max(tabAchievements.length, 1)) * 100}%` }}
            />
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

  if (typeof document === 'undefined') return null
  return createPortal(content, document.body)
}
