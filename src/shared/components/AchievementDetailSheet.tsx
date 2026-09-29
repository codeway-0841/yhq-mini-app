import { useCallback, useMemo } from 'react'
import { X, Forward, CheckCircle2, Lock, Sparkles } from 'lucide-react'
import { useAchievementCelebrationStore } from '../store/useAchievementCelebrationStore'
import { useAppStore } from '../store/useAppStore'
import { useT } from '../i18n'
import { shareUrl } from '../../platform/telegram'
import { config } from '../config'
import { cn } from '../lib/cn'
import { MilestonePlaque3D } from './MilestonePlaque3D'
import DialogOverlay from './DialogOverlay'
import ModalMathGrid from './ModalMathGrid'

export default function AchievementDetailSheet() {
  const badge = useAchievementCelebrationStore((s) => s.inspectBadge)
  const progress = useAchievementCelebrationStore((s) => s.inspectBadgeStatsProgress)
  const closeDetailSheet = useAchievementCelebrationStore((s) => s.closeDetailSheet)

  const lang = useAppStore((s) => s.settings.language)
  const tt = useT(lang)

  const handleShare = useCallback(() => {
    if (!badge) return
    const uid = useAppStore.getState().user?.id ?? '0'
    const title = tt(badge.titleKey)
    const text = `🏆 Men KIVVI platformasida "${title}" marrasini zabt etdim! Siz ham bilimingizni sinab ko'ring:`
    const link = `https://t.me/${config.botUsername}?start=ref_${uid}`
    shareUrl(link, text)
  }, [badge, tt])

  const formattedDate = useMemo(() => {
    return new Intl.DateTimeFormat(lang === 'ru' ? 'ru-RU' : 'uz-UZ', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(new Date())
  }, [lang])

  if (!badge) return null
  if (typeof document === 'undefined') return null

  const badgeColor = badge.color || '#941B44'
  const isUnlocked = progress ? progress.unlocked : true
  const currentVal = progress ? Math.min(progress.current, progress.target) : badge.target
  const targetVal = progress ? progress.target : badge.target
  const pct = targetVal > 0 ? Math.min(100, Math.round((currentVal / targetVal) * 100)) : (isUnlocked ? 100 : 0)
  const remaining = Math.max(0, targetVal - currentVal)

  return (
    <DialogOverlay
      onClose={closeDetailSheet}
      labelId="milestone-detail-title"
      position="bottom"
      swipeToDismiss
      zIndex={70}
      className="!p-0"
      backdropClassName="bg-black/45 dark:bg-black/75 backdrop-blur-sm"
    >
      {/* ── Apple / Taphey Style Milestone Sheet (Full-height Scroll Container, Always Pristine) ── */}
      <div
        className="relative w-full sm:max-w-[440px] rounded-t-[32px] sm:rounded-[36px] bg-[#FAF9FC] dark:bg-[#0B0C10] text-gray-900 dark:text-white shadow-2xl dark:shadow-[0_25px_60px_rgba(0,0,0,0.8)] overflow-y-auto max-h-[calc(100dvh-max(var(--safe-top,0px),24px))] flex flex-col overscroll-contain transition-colors"
      >
        {/* Dynamic Ambient Glow + Subtle Grid */}
        <ModalMathGrid glowColor={badgeColor} height={620} maskEnd="95%" />

        {/* ── TOP HEADER (Transparent so math grid / kataklar show seamlessly to the top) ── */}
        <div
          data-floating-controls
          className="pointer-events-none sticky top-[0px] /* safe-top: sheet header */ z-30 w-full shrink-0 bg-transparent pt-3 pb-1 px-4"
        >
          {/* Top Sheet Grab Handle */}
          <div data-drag-handle className="pointer-events-auto flex justify-center py-1 cursor-grab active:cursor-grabbing touch-none select-none">
            <div data-drag-handle className="w-10 h-1 rounded-full bg-gray-300 dark:bg-white/20 mb-2" />
          </div>

          {/* Top Bar: Close (X) · "Milestone" (Clean typography) · Share */}
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={closeDetailSheet}
              aria-label={tt('close')}
              className="pointer-events-auto size-10 rounded-full bg-white dark:bg-white/10 shadow-[0_2px_8px_rgba(0,0,0,0.06)] dark:shadow-none border border-black/[0.04] dark:border-white/10 flex items-center justify-center text-gray-700 dark:text-white active:scale-95 transition-transform cursor-pointer"
            >
              <X size={18} strokeWidth={2.4} />
            </button>

            <span id="milestone-detail-title" className="text-[17px] font-semibold text-gray-900 dark:text-white tracking-tight">
              {tt('achMilestoneTitle')}
            </span>

            <button
              type="button"
              onClick={handleShare}
              aria-label={tt('achShareBadge')}
              className="pointer-events-auto size-10 rounded-full bg-white dark:bg-white/10 shadow-[0_2px_8px_rgba(0,0,0,0.06)] dark:shadow-none border border-black/[0.04] dark:border-white/10 flex items-center justify-center text-gray-700 dark:text-white active:scale-95 transition-transform cursor-pointer"
            >
              <Forward size={18} strokeWidth={2.2} fill="currentColor" />
            </button>
          </div>
        </div>

        {/* ── SCROLLABLE BODY CONTENT ── */}
        <div className="relative z-10 px-5 pt-4 pb-8 flex flex-col items-center text-center">
          {/* ── 3D FLOATING ROTATABLE BADGE ── */}
          <MilestonePlaque3D
            achievement={badge}
            unlocked={isUnlocked}
            progress={{ current: currentVal, target: targetVal, unlocked: isUnlocked }}
            className="my-2"
          />

          {/* Status Pill: Achieved or In Progress */}
          <div
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full px-3.5 py-1 text-xs font-semibold shadow-2xs mt-3 transition-colors duration-300',
              isUnlocked
                ? 'bg-[#EBF3FF] dark:bg-[#002B5B] text-[#0066FF] dark:text-[#3894FF] border border-[#D0E2FF]/80 dark:border-[#004B99]/60'
                : 'bg-gray-100 dark:bg-white/10 text-gray-500 dark:text-gray-400 border border-gray-200/80 dark:border-white/10',
            )}
          >
            {isUnlocked ? (
              <>
                <CheckCircle2 size={13} fill="currentColor" />
                <span>{tt('achStatusAchieved')}</span>
              </>
            ) : (
              <>
                <Lock size={13} />
                <span>{tt('achStatusLocked')} ({pct}%)</span>
              </>
            )}
          </div>

          {/* Big Bold Milestone Title */}
          <h2 className="text-[25px] sm:text-[27px] font-bold text-gray-900 dark:text-white tracking-tight mt-2.5 leading-snug px-3">
            {tt(badge.titleKey)}
          </h2>

          {/* Reward Subtitle */}
          <p className="text-[15px] sm:text-[16px] font-semibold mt-1 text-[#0066FF] dark:text-[#3894FF]">
            +{badge.reward.xp} XP · +{badge.reward.coins} 🪙
          </p>

          {/* Description Paragraph */}
          <p className="text-[14px] text-gray-500 dark:text-gray-400 max-w-[340px] mt-2 leading-relaxed px-4">
            {tt(badge.descKey)}
          </p>

          {/* ── MILESTONE REACHED PROGRESS CARD ── */}
          <div className="mt-5 w-full max-w-[370px] rounded-2xl bg-white dark:bg-[#15161E] p-5 shadow-[0_2px_12px_rgba(0,0,0,0.04)] dark:shadow-[0_4px_20px_rgba(0,0,0,0.4)] border border-gray-100 dark:border-white/10 text-left">
            <div className="flex items-center justify-between text-[15px] font-bold text-gray-900 dark:text-white">
              <span>{tt('achMilestoneReached')}</span>
              <span className="tabular-nums">{pct}%</span>
            </div>

            {/* Progress Bar (Standard blue, independent of badge color) */}
            <div className="h-1.5 w-full bg-gray-100 dark:bg-white/10 rounded-full mt-3 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700 bg-[#007aff]"
                style={{ width: `${pct}%` }}
              />
            </div>

            {/* Remaining or Date Meta */}
            {!isUnlocked && remaining > 0 ? (
              <p className="mt-3 text-[12px] font-semibold text-[#0066FF] dark:text-[#3894FF]">
                {tt('achRemainingToUnlock').replace('{count}', String(remaining))}
              </p>
            ) : (
              <p className="mt-3 text-[12px] text-gray-400 dark:text-gray-400 font-medium">
                {tt('achFirstRecorded')} {formattedDate}
              </p>
            )}
          </div>

          {/* ── Tantanani ko'rish (Celebration preview) ── */}
          <button
            type="button"
            onClick={() => {
              closeDetailSheet()
              useAchievementCelebrationStore.getState().triggerCelebration(badge)
            }}
            className="mt-4 inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-3 text-[14px] font-bold text-gray-800 dark:text-white bg-white dark:bg-white/10 border border-gray-200/80 dark:border-white/10 shadow-[0_2px_8px_rgba(0,0,0,0.04)] dark:shadow-none hover:bg-gray-50 dark:hover:bg-white/15 active:scale-95 transition-all cursor-pointer"
          >
            <Sparkles size={16} className="text-amber-500" />
            <span>{tt('achViewCelebration')}</span>
          </button>
        </div>
      </div>
    </DialogOverlay>
  )
}
