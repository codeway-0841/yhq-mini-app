import { useState, useMemo } from 'react'
import { ArrowLeft, CheckCircle2, Lock } from 'lucide-react'
import DialogOverlay from '../../../shared/components/DialogOverlay'
import ModalMathGrid from '../../../shared/components/ModalMathGrid'
import { ACHIEVEMENTS, isUnlocked, getBadgeUrl, type AchievementDef, type AchievementCategory } from '../../../shared/config/achievements'
import type { AchievementStats } from '../../../shared/api'
import { type useT } from '../../../shared/i18n'
import { cn } from '../../../shared/lib/cn'
import { haptics } from '../../../platform/haptics'
import { useAchievementCelebrationStore } from '../../../shared/store/useAchievementCelebrationStore'

export type TabKey = 'all' | AchievementCategory

/** Bitta yutuq kartasi (2-ustunli Apple / Taphey uslubi) */
function AchievementCard({
  a,
  stats,
  tt,
}: {
  a: AchievementDef
  stats: AchievementStats
  tt: ReturnType<typeof useT>
}) {
  const openDetailSheet = useAchievementCelebrationStore((s) => s.openDetailSheet)
  const unlocked = isUnlocked(a, stats)
  const cur = Math.min(a.get(stats), a.target)
  const badgeUrl = getBadgeUrl(a)

  const handleClick = () => {
    haptics.selection()
    openDetailSheet(a, { current: cur, target: a.target, unlocked })
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={`${tt(a.titleKey)}, ${unlocked ? tt('achStatusAchieved') : `${cur}/${a.target}`}`}
      className="group flex flex-col items-center text-center select-none cursor-pointer focus-visible:outline-none transition-transform duration-150 active:scale-95"
    >
      {/* Katta 3D Nishon (erishilgan bo'lsa to'liq rangli, erishilmagan bo'lsa rangsiz monoxrom) */}
      <div className="relative flex items-center justify-center size-32 sm:size-36 mb-1">
        {badgeUrl ? (
          <img
            src={badgeUrl}
            alt={tt(a.titleKey)}
            loading="lazy"
            decoding="async"
            draggable={false}
            className={cn(
              'size-28 sm:size-32 object-contain pointer-events-none select-none transition-all duration-300 group-hover:scale-105',
              unlocked
                ? 'drop-shadow-[0_10px_18px_rgba(0,0,0,0.12)]'
                : 'grayscale opacity-35 contrast-75 brightness-95',
            )}
          />
        ) : (
          <div className="size-28 rounded-2xl bg-gray-100 dark:bg-white/10 flex items-center justify-center text-3xl">
            🏆
          </div>
        )}
      </div>

      {/* Sarlavha */}
      <p
        className={cn(
          'text-[14px] sm:text-[15px] font-bold leading-snug px-1 text-center line-clamp-1',
          unlocked ? 'text-gray-900 dark:text-white' : 'text-gray-400 font-medium',
        )}
      >
        {tt(a.titleKey)}
      </p>

      {/* Holat: Erishildi (ko'k checkmark) yoki Qulf (kulrang qulf + progress) */}
      <div className="mt-1 flex items-center justify-center gap-1 text-[12px] font-semibold">
        {unlocked ? (
          <>
            <CheckCircle2 size={13} fill="#0066FF" className="text-white" />
            <span className="text-[#0066FF]">{tt('achStatusAchieved')}</span>
          </>
        ) : (
          <>
            <Lock size={12} className="text-gray-400" />
            <span className="text-gray-400 tabular-nums">
              {cur} / {a.target}
            </span>
          </>
        )}
      </div>
    </button>
  )
}

/**
 * AchievementsScreen — profildagi "Nishonlar" yoki "Marralar" bosilganda
 * ochiladigan Apple / Taphey uslubidagi "Arxiv" kolleksiyasi:
 * 2-ustunli katta nishonlar, yuqori progress kartasi, toza yorug' fon.
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

  const tabAchievements = useMemo(() => {
    return ACHIEVEMENTS.filter((a) => {
      if (activeTab === 'all') return true
      return a.category === activeTab
    })
  }, [activeTab])

  const unlockedCount = useMemo(() => {
    return tabAchievements.filter((a) => isUnlocked(a, stats)).length
  }, [tabAchievements, stats])

  // Tartiblash: erishilganlari oldinda, qulflanganlari ortda
  const sorted = useMemo(() => {
    return [...tabAchievements].sort((a, b) => Number(isUnlocked(b, stats)) - Number(isUnlocked(a, stats)))
  }, [tabAchievements, stats])

  // Keyingi zabt etilmagan marra
  const nextTarget = useMemo(() => {
    return tabAchievements.find((a) => !isUnlocked(a, stats))
  }, [tabAchievements, stats])

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'all', label: tt('tabAll') },
    { key: 'milestone', label: tt('tabMilestones') },
    { key: 'badge', label: tt('tabBadges') },
  ]

  // Metrika soni (masalan jami to'g'ri javoblar)
  const totalMetric = stats.totalCorrect ?? 0
  const formattedMetric = new Intl.NumberFormat('fr-FR').format(totalMetric)
  const pct = Math.min(100, Math.round((unlockedCount / Math.max(tabAchievements.length, 1)) * 100))

  const content = (
    <DialogOverlay
      onClose={onClose}
      labelId="ach-screen-title"
      position="bottom"
      swipeToDismiss
      className="!p-0"
      backdropClassName="bg-black/50 backdrop-blur-xs"
      zIndex={60}
    >
      {/* ── Apple / Taphey Style Collection Screen (Always Pristine) ── */}
      <div className="relative w-full max-w-2xl mx-auto h-[calc(100dvh-max(var(--safe-top,0px),16px))] max-h-[calc(100dvh-max(var(--safe-top,0px),16px))] rounded-t-[28px] sm:rounded-t-[32px] bg-[#FAF9FC] dark:bg-[#0B0C10] text-gray-900 dark:text-white flex flex-col overflow-hidden shadow-2xl transition-colors">
        {/* Subtle Ambient Radial Glow + Math Grid */}
        <ModalMathGrid glowColor="#0066FF" height={420} maskEnd="95%" />

        {/* Top Sheet Grab Handle */}
        <div
          data-drag-handle
          className="pt-2.5 pb-1 flex justify-center shrink-0 cursor-grab active:cursor-grabbing touch-none select-none relative z-10"
        >
          <div data-drag-handle className="w-10 h-1 rounded-full bg-gray-300 dark:bg-white/20" />
        </div>

        {/* Sticky Header: Back (✕) · Title · Spacer */}
        <header className="shrink-0 flex items-center justify-between px-4 py-1.5 relative z-10">
          <button
            type="button"
            onClick={onClose}
            aria-label={tt('backWord')}
            className="size-12 rounded-full bg-white dark:bg-white/10 shadow-[0_2px_8px_rgba(0,0,0,0.06)] dark:shadow-none border border-black/[0.04] dark:border-white/10 flex items-center justify-center text-gray-700 dark:text-white active:scale-95 transition-transform cursor-pointer"
          >
            <ArrowLeft size={20} strokeWidth={2.25} />
          </button>

          <h2 id="ach-screen-title" className="text-[17px] font-bold text-gray-900 dark:text-white tracking-tight">
            {tt('achTitle')}
          </h2>

          <div className="size-10" />
        </header>

        {/* Tab Controls (Barchasi | Marralar | Nishonlar) */}
        <div className="mx-4 mt-1 mb-2.5 flex items-center rounded-xl bg-gray-200/60 dark:bg-white/10 p-1 relative z-10">
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
                    ? 'bg-white dark:bg-white/20 text-gray-900 dark:text-white shadow-xs font-bold'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white',
                )}
              >
                {t.label}
              </button>
            )
          })}
        </div>

        {/* Scrollable Container */}
        <div className="flex-1 overflow-y-auto px-4 pb-12 safe-bottom relative z-10">
          {/* ── TOP STATS / SUMMARY CARD (Taphey Archives Style) ── */}
          <div className="mt-1 mb-5 rounded-2xl bg-white dark:bg-[#15161E] p-5 shadow-[0_2px_12px_rgba(0,0,0,0.04)] dark:shadow-[0_4px_20px_rgba(0,0,0,0.4)] border border-gray-100 dark:border-white/10">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[28px] font-extrabold text-gray-900 dark:text-white tracking-tight tabular-nums leading-none">
                  {formattedMetric}
                </span>
                <p className="text-xs font-medium text-gray-400 mt-1">
                  {tt('achCorrect100Desc').split(' ')[0] || "To'g'ri"} javoblar
                </p>
              </div>
              <div className="text-right">
                <span className="text-[15px] font-bold text-gray-500 dark:text-gray-400 tabular-nums">
                  {unlockedCount} / {tabAchievements.length}
                </span>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="h-1.5 w-full bg-gray-100 dark:bg-white/10 rounded-full mt-3 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700 bg-[#007aff]"
                style={{ width: `${pct}%` }}
              />
            </div>

            {/* Next Milestone Meta */}
            <div className="flex items-center justify-between mt-2.5 text-[11.5px] font-medium text-gray-400">
              <span>
                {nextTarget ? `Keyingi: ${tt(nextTarget.titleKey)}` : 'Barcha marralar zabt etildi!'}
              </span>
              {nextTarget && (
                <span className="tabular-nums">
                  {Math.max(0, nextTarget.target - Math.min(nextTarget.get(stats), nextTarget.target))} qoldi
                </span>
              )}
            </div>
          </div>

          {/* Section Sarlavhasi (The collection) */}
          <div className="flex items-center justify-between px-1 mb-4">
            <h3 className="text-[19px] font-bold text-gray-900 dark:text-white tracking-tight">
              Kolleksiya
            </h3>
            <span className="text-xs font-medium text-gray-400 tabular-nums">
              {tabAchievements.length} ta yutuq
            </span>
          </div>

          {/* ── 2-USTUNLI KATTA NISHONLAR PANJARASI (Taphey Style) ── */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-8 p-1">
            {sorted.map((a) => (
              <AchievementCard key={a.id} a={a} stats={stats} tt={tt} />
            ))}
          </div>
        </div>
      </div>
    </DialogOverlay>
  )

  if (typeof document === 'undefined') return null
  return content
}
