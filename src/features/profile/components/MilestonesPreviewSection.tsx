import { useMemo } from 'react'
import { ChevronRight, Check } from 'lucide-react'
import { MILESTONES, isUnlocked, type AchievementDef } from '../../../shared/config/achievements'
import type { AchievementStats } from '../../../shared/api'
import { type useT } from '../../../shared/i18n'
import { cn } from '../../../shared/lib/cn'
import { haptics } from '../../../platform/haptics'

interface MilestonesPreviewSectionProps {
  stats: AchievementStats | null
  tt: ReturnType<typeof useT>
  onOpenAll: (tab?: 'all' | 'badge' | 'milestone') => void
}

function MilestonePreviewItem({
  a,
  stats,
  tt,
  onClick,
}: {
  a: AchievementDef
  stats: AchievementStats | null
  tt: ReturnType<typeof useT>
  onClick: () => void
}) {
  const unlocked = stats ? isUnlocked(a, stats) : false
  const cur = stats ? Math.min(a.get(stats), a.target) : 0
  const pct = a.target > 1 ? Math.round((cur / a.target) * 100) : (unlocked ? 100 : 0)

  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex flex-col items-center text-center focus-visible:outline-none select-none transition-transform duration-150 active:scale-95 cursor-pointer"
    >
      <div className="relative mb-1 flex size-11 items-center justify-center">
        <div
          className={cn(
            'flex size-11 items-center justify-center transition-all duration-200 ease-out',
            !unlocked && 'opacity-60 saturate-[0.5]',
          )}
        >
          {a.badgeImage ? (
            <img
              src={a.badgeImage}
              alt=""
              className="size-11 object-contain select-none pointer-events-none transition-transform duration-200 group-hover:scale-105"
              loading="lazy"
            />
          ) : null}
        </div>

        {unlocked && (
          <span className="absolute -bottom-0.5 -right-0.5 grid size-3.5 place-items-center rounded-full border border-pcanvas bg-psuccess shadow-xs">
            <Check size={8} strokeWidth={3} className="text-white" />
          </span>
        )}
      </div>

      <p className={cn('line-clamp-1 text-[10px] font-semibold text-pfg max-w-[68px]', !unlocked && 'opacity-65')}>
        {tt(a.titleKey)}
      </p>

      <div className="mt-1 h-[2px] w-full max-w-[48px] overflow-hidden rounded-[1px] bg-plineStrong">
        <div
          className="h-full rounded-[1px] transition-[width] duration-500 ease-out"
          style={{ width: `${pct}%`, background: unlocked ? a.color : 'var(--p-subtle)' }}
        />
      </div>
    </button>
  )
}

export function MilestonesPreviewSection({ stats, tt, onOpenAll }: MilestonesPreviewSectionProps) {
  const unlockedCount = useMemo(() => {
    if (!stats) return 0
    return MILESTONES.filter((a) => isUnlocked(a, stats)).length
  }, [stats])

  // Select 4 milestone badges: unlocked first, then closest upcoming milestone goals
  const previewMilestones = useMemo(() => {
    if (!stats) return MILESTONES.slice(0, 4)
    return [...MILESTONES]
      .sort((a, b) => {
        const aUn = isUnlocked(a, stats)
        const bUn = isUnlocked(b, stats)
        if (aUn !== bUn) return Number(bUn) - Number(aUn)
        const aPct = a.get(stats) / a.target
        const bPct = b.get(stats) / b.target
        return bPct - aPct
      })
      .slice(0, 4)
  }, [stats])

  return (
    <div className="mx-5 mb-4 rounded-2xl bg-pcard p-3.5 shadow-xs">
      {/* Header with Barchasi > */}
      <div className="flex items-center justify-between mb-2.5">
        <h3 className="font-display text-[14.5px] font-bold text-pfg tracking-tight">
          {tt('milestonesTitle')}
        </h3>

        <button
          type="button"
          onClick={() => {
            haptics.impact('light')
            onOpenAll('milestone')
          }}
          className="group flex items-center gap-1 text-[12px] font-semibold text-pmuted hover:text-pfg transition-colors active:opacity-70 cursor-pointer"
        >
          <span>{tt('viewAll')}</span>
          <span className="text-[11px] font-bold text-pprimary tabular-nums">
            {unlockedCount}/{MILESTONES.length}
          </span>
          <ChevronRight size={14} strokeWidth={2} className="text-psubtle group-hover:text-pfg group-hover:translate-x-0.5 transition-all" />
        </button>
      </div>

      {/* 4 Milestones Row */}
      <div className="grid grid-cols-4 gap-1.5 pt-0.5">
        {previewMilestones.map((a) => (
          <MilestonePreviewItem
            key={a.id}
            a={a}
            stats={stats}
            tt={tt}
            onClick={() => {
              haptics.impact('light')
              onOpenAll('milestone')
            }}
          />
        ))}
      </div>
    </div>
  )
}
