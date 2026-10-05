import { useEffect, useState, useCallback } from 'react'
import DialogOverlay from './DialogOverlay'
import { X, Forward, CheckCircle2, ArrowRight } from 'lucide-react'
import { useAchievementCelebrationStore } from '../store/useAchievementCelebrationStore'
import { useAppStore } from '../store/useAppStore'
import { useT } from '../i18n'
import { playSound } from '../lib/sounds'
import { haptics } from '../../platform/haptics'
import { shareUrl } from '../../platform/telegram'
import { config } from '../config'
import Confetti from './Confetti'
import { CoinIcon } from './CoinIcon'
import { MilestonePlaque3D } from './MilestonePlaque3D'
import ModalMathGrid from './ModalMathGrid'
import { cn } from '../lib/cn'

export default function AchievementCelebrationModal() {
  const currentBadge = useAchievementCelebrationStore((s) => s.currentCelebration)
  const unlockedQueue = useAchievementCelebrationStore((s) => s.unlockedQueue)
  const dismissCurrent = useAchievementCelebrationStore((s) => s.dismissCurrent)
  const lang = useAppStore((s) => s.settings.language)
  const tt = useT(lang)

  const [isClaiming, setIsClaiming] = useState(false)

  // Fanfare and haptic vibration on open
  useEffect(() => {
    if (!currentBadge) return
    playSound('achievement')
    haptics.achievement()
  }, [currentBadge])

  const handleClaim = useCallback(() => {
    if (!currentBadge || isClaiming) return
    setIsClaiming(true)
    playSound('coins')
    haptics.success()

    const reward = currentBadge.reward
    useAppStore.setState((s) => ({
      coins: Math.max(0, s.coins + (reward?.coins ?? 0)),
      xp: Math.max(0, s.xp + (reward?.xp ?? 0)),
    }))

    setTimeout(() => {
      setIsClaiming(false)
      dismissCurrent()
    }, 280)
  }, [currentBadge, isClaiming, dismissCurrent])

  const handleShare = useCallback(() => {
    if (!currentBadge) return
    const uid = useAppStore.getState().user?.id ?? '0'
    const title = tt(currentBadge.titleKey)
    const text = `🏆 Men KIVVI platformasida yangi "${title}" nishonini qo'lga kiritdim! Siz ham bilimingizni sinab ko'ring:`
    const link = `https://t.me/${config.botUsername}?start=ref_${uid}`
    shareUrl(link, text)
  }, [currentBadge, tt])

  if (!currentBadge) return null
  if (typeof document === 'undefined') return null

  const badgeColor = currentBadge.color || '#941B44'
  const totalCount = unlockedQueue.length + 1

  return (
    <DialogOverlay
      onClose={dismissCurrent}
      labelId="milestone-modal-title"
      position="bottom"
      swipeToDismiss
      zIndex={80}
      className="!p-0"
      backdropClassName="bg-black/45 dark:bg-black/75 backdrop-blur-sm"
    >
      {/* Confetti celebration pieces */}
      <Confetti count={40} />

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
              onClick={dismissCurrent}
              aria-label={tt('close')}
              className="pointer-events-auto size-10 rounded-full bg-white dark:bg-white/10 shadow-[0_2px_8px_rgba(0,0,0,0.06)] dark:shadow-none border border-black/[0.04] dark:border-white/10 flex items-center justify-center text-gray-700 dark:text-white active:scale-95 transition-transform cursor-pointer"
            >
              <X size={18} strokeWidth={2.4} />
            </button>

            <span id="milestone-modal-title" className="text-[17px] font-semibold text-gray-900 dark:text-white tracking-tight">
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
            achievement={currentBadge}
            unlocked={true}
            className="my-2"
          />

          {/* Status Pill: Achieved */}
          <div className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1 text-xs font-semibold shadow-2xs mt-3 bg-[#EBF3FF] dark:bg-[#002B5B] text-[#0066FF] dark:text-[#3894FF] border border-[#D0E2FF]/80 dark:border-[#004B99]/60">
            <CheckCircle2 size={13} fill="currentColor" />
            <span>{tt('achStatusAchieved')}</span>
          </div>

          {/* Big Bold Milestone Title */}
          <h2 className="text-[25px] sm:text-[27px] font-bold text-gray-900 dark:text-white tracking-tight mt-2.5 leading-snug px-3">
            {tt(currentBadge.titleKey)}
          </h2>

          {/* Reward Subtitle — tanga GLOBAL CoinIcon bilan (endi emoji vizuali,
              lekin bitta komponent orqali — butun ilova bir xil ko'rinadi) */}
          <p className="mt-1 inline-flex flex-wrap items-center justify-center gap-1.5 text-[15px] font-semibold text-[#0066FF] dark:text-[#3894FF] sm:text-[16px]">
            <span className="tabular-nums">+{currentBadge.reward.xp} XP · +{currentBadge.reward.coins}</span>
            <CoinIcon size={17} />
          </p>

          {/* Description Paragraph */}
          <p className="text-[14px] text-gray-500 dark:text-gray-400 max-w-[340px] mt-2 leading-relaxed px-4">
            {tt(currentBadge.descKey)}
          </p>

          {/* Claim Reward Button */}
          <div className="mt-6 w-full max-w-[370px] flex flex-col gap-2">
            <button
              type="button"
              onClick={handleClaim}
              disabled={isClaiming}
              className={cn(
                'group flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-pprimary text-ponprimary font-bold text-[15px] shadow-md active:scale-98 transition-all hover:brightness-105 cursor-pointer',
                isClaiming && 'opacity-80 scale-98',
              )}
            >
              <span>{tt('achClaimReward')}</span>
              {totalCount > 1 && (
                <span className="ml-1 text-xs opacity-80 flex items-center gap-0.5">
                  <ArrowRight size={13} />
                  (1/{totalCount})
                </span>
              )}
            </button>
          </div>
        </div>
      </div>
    </DialogOverlay>
  )
}
