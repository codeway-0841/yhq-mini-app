import { useEffect, useState, useCallback, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { X, Forward, CheckCircle2, Sparkles, ArrowRight } from 'lucide-react'
import { useAchievementCelebrationStore } from '../store/useAchievementCelebrationStore'
import { useAppStore } from '../store/useAppStore'
import { useT } from '../i18n'
import { playSound } from '../lib/sounds'
import { haptics } from '../../platform/haptics'
import { shareUrl } from '../../platform/telegram'
import { config } from '../config'
import Confetti from './Confetti'
import { MilestonePlaque3D, hexToRgba } from './MilestonePlaque3D'
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

  const formattedDate = useMemo(() => {
    return new Intl.DateTimeFormat(lang === 'ru' ? 'ru-RU' : 'uz-UZ', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(new Date())
  }, [lang])

  if (!currentBadge) return null
  if (typeof document === 'undefined') return null

  const badgeColor = currentBadge.color || '#941B44'
  const totalCount = unlockedQueue.length + 1

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="milestone-modal-title"
      className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/45 backdrop-blur-sm animate-fadeIn select-none overflow-hidden"
    >
      {/* Confetti celebration pieces */}
      <Confetti count={40} />

      {/* ── Apple / Taphey Style Milestone Sheet (Full-height Scroll Container) ── */}
      <div
        className="relative w-full max-w-sm sm:max-w-[420px] rounded-t-[38px] sm:rounded-[38px] bg-[#f4f5f9] dark:bg-[#0f141c] text-gray-900 dark:text-white shadow-2xl overflow-y-auto max-h-[93dvh] flex flex-col animate-slideUp overscroll-contain"
      >
        {/* Dynamic Ambient Glow + Subtle Grid (Upper half only) */}
        <div
          className="absolute inset-x-0 top-0 h-[720px] pointer-events-none z-0 transition-colors duration-500"
          style={{
            backgroundImage: `radial-gradient(circle at 78% 8%, ${hexToRgba(badgeColor, 0.34)} 0%, ${hexToRgba(badgeColor, 0.10)} 42%, transparent 72%), radial-gradient(circle at 20% 22%, rgba(255,255,255,0.82) 0%, transparent 52%), linear-gradient(${hexToRgba(badgeColor, 0.10)} 1px, transparent 1px), linear-gradient(90deg, ${hexToRgba(badgeColor, 0.10)} 1px, transparent 1px)`,
            backgroundSize: 'auto, auto, 32px 32px, 32px 32px',
            WebkitMaskImage: 'linear-gradient(to bottom, black 0%, black 58%, transparent 96%)',
            maskImage: 'linear-gradient(to bottom, black 0%, black 58%, transparent 96%)',
          }}
        />

        {/* ── STICKY TOP CONTROLS (Seamlessly floating on the ambient glow, NO box, NO border!) ── */}
        <div
          data-floating-controls
          className="pointer-events-none sticky top-0 z-30 w-full min-h-[98px] bg-transparent pb-5 px-4 safe-top"
        >
          {/* Top Sheet Grab Handle */}
          <div className="w-9 h-1 rounded-full bg-gray-400/40 dark:bg-gray-600/40 mx-auto mb-4" />

          {/* Top Bar: Close (X) · "Milestone" · Share */}
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={dismissCurrent}
              aria-label={tt('close')}
              className="pointer-events-auto size-11 rounded-full bg-white/85 dark:bg-[#1c2431]/85 backdrop-blur-xl shadow-[0_2px_12px_rgba(0,0,0,0.08)] flex items-center justify-center text-gray-800 dark:text-gray-200 active:scale-95 transition-transform cursor-pointer"
            >
              <X size={20} strokeWidth={2.2} />
            </button>

            <div className="rounded-full bg-white/25 dark:bg-[#0f141c]/25 backdrop-blur-xl px-4 py-2 shadow-[0_2px_18px_rgba(255,255,255,0.18)] flex items-center justify-center">
              <span id="milestone-modal-title" className="text-[18px] font-bold text-gray-900 dark:text-white tracking-tight">
                {tt('achMilestoneTitle')}
              </span>
            </div>

            <button
              type="button"
              onClick={handleShare}
              aria-label={tt('achShareBadge')}
              className="pointer-events-auto size-11 rounded-full bg-white/85 dark:bg-[#1c2431]/85 backdrop-blur-xl shadow-[0_2px_12px_rgba(0,0,0,0.08)] flex items-center justify-center text-gray-800 dark:text-gray-200 active:scale-95 transition-transform cursor-pointer"
            >
              <Forward size={20} strokeWidth={2.2} fill="currentColor" />
            </button>
          </div>
        </div>

        {/* ── SCROLLABLE BODY CONTENT ── */}
        <div className="relative z-10 px-5 pt-2 pb-6 flex flex-col items-center text-center">
          {/* Brand Label: Kivvi */}
          <div className="flex items-center justify-center gap-1.5 mt-1 mb-1">
            <div className="size-5 rounded-md bg-[#22c55e] flex items-center justify-center text-white text-[11px] font-black shadow-xs">
              K
            </div>
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">Kivvi</span>
          </div>

          {/* ── 3D FLOATING ROTATABLE BADGE ── */}
          <MilestonePlaque3D
            achievement={currentBadge}
            unlocked={true}
            className="-mt-3 -mb-4 !py-2"
          />

          {/* Status Pill: Achieved */}
          <div className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1 text-xs font-bold shadow-2xs mt-3 bg-sky-100 dark:bg-sky-950/50 text-[#007aff] dark:text-sky-400">
            <CheckCircle2 size={13} fill="currentColor" />
            <span>{tt('achStatusAchieved')}</span>
          </div>

          {/* Big Bold Milestone Title */}
          <h2 className="text-[26px] sm:text-[28px] font-extrabold text-gray-900 dark:text-white tracking-tight mt-3 leading-snug px-2">
            {tt(currentBadge.titleKey)}
          </h2>

          {/* Reward Subtitle */}
          <p className="text-[16px] sm:text-[17px] font-bold mt-1 text-[#007aff] dark:text-sky-400">
            +{currentBadge.reward.xp} XP · +{currentBadge.reward.coins} 🪙
          </p>

          {/* Description Paragraph */}
          <p className="text-[14px] text-gray-500 dark:text-gray-400 max-w-[340px] mt-2.5 leading-relaxed px-4">
            {tt(currentBadge.descKey)}
          </p>

          {/* ── MILESTONE REACHED PROGRESS CARD ── */}
          <div className="mt-6 w-full max-w-[370px] rounded-2xl bg-white dark:bg-[#18202e] p-5 shadow-[0_2px_12px_rgba(0,0,0,0.03)] text-left">
            <div className="flex items-center justify-between text-[15px] font-bold text-gray-900 dark:text-white">
              <span>{tt('achMilestoneReached')}</span>
              <span className="tabular-nums">100%</span>
            </div>

            {/* Progress Bar (Standard blue, independent of badge color) */}
            <div className="h-1.5 w-full bg-gray-200 dark:bg-gray-700 rounded-full mt-3 overflow-hidden">
              <div className="h-full rounded-full w-full transition-all duration-700 bg-[#007aff]" />
            </div>

            {/* Recorded Date */}
            <p className="mt-3 text-[12px] text-gray-400 dark:text-gray-500">
              {tt('achFirstRecorded')} {formattedDate}
            </p>
          </div>

          {/* Claim Reward Button */}
          <div className="mt-6 w-full max-w-[370px] flex flex-col gap-2">
            <button
              type="button"
              onClick={handleClaim}
              disabled={isClaiming}
              className={cn(
                'group flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-pprimary text-ponprimary font-bold text-[14.5px] shadow-md active:scale-98 transition-all hover:brightness-105 cursor-pointer',
                isClaiming && 'opacity-80 scale-98',
              )}
            >
              <Sparkles size={16} />
              <span>
                {tt('achClaimReward')} (+{currentBadge.reward.xp} XP · +{currentBadge.reward.coins} 🪙)
              </span>
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
    </div>,
    document.body
  )
}
