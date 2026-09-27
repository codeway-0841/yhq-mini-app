import { useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { X, Share2, Forward, CheckCircle2, Lock, Sparkles, Play } from 'lucide-react'
import { useAchievementCelebrationStore } from '../store/useAchievementCelebrationStore'
import { useAppStore } from '../store/useAppStore'
import { useT } from '../i18n'
import { haptics } from '../../platform/haptics'
import { shareUrl } from '../../platform/telegram'
import { config } from '../config'
import { cn } from '../lib/cn'
import { MilestonePlaque3D, hexToRgba } from './MilestonePlaque3D'
import { createPortal } from 'react-dom'

export default function AchievementDetailSheet() {
  const badge = useAchievementCelebrationStore((s) => s.inspectBadge)
  const progress = useAchievementCelebrationStore((s) => s.inspectBadgeStatsProgress)
  const closeDetailSheet = useAchievementCelebrationStore((s) => s.closeDetailSheet)
  const triggerCelebration = useAchievementCelebrationStore((s) => s.triggerCelebration)

  const navigate = useNavigate()
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

  const handleReplayCelebration = useCallback(() => {
    if (!badge) return
    closeDetailSheet()
    triggerCelebration(badge)
  }, [badge, closeDetailSheet, triggerCelebration])

  const handleStartPractice = useCallback(() => {
    closeDetailSheet()
    haptics.selection()
    navigate('/testlar')
  }, [closeDetailSheet, navigate])

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

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="milestone-detail-title"
      className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/45 backdrop-blur-sm animate-fadeIn select-none overflow-hidden"
      onClick={closeDetailSheet}
    >
      {/* ── Apple / Taphey Style Milestone Sheet (Full-height Scroll Container) ── */}
      <div
        className="relative w-full max-w-sm sm:max-w-[420px] rounded-t-[38px] sm:rounded-[38px] bg-[#f4f5f9] dark:bg-[#0f141c] text-gray-900 dark:text-white shadow-2xl overflow-y-auto max-h-[93dvh] flex flex-col animate-slideUp overscroll-contain"
        onClick={(e) => e.stopPropagation()}
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
              onClick={closeDetailSheet}
              aria-label={tt('close')}
              className="pointer-events-auto size-11 rounded-full bg-white/85 dark:bg-[#1c2431]/85 backdrop-blur-xl shadow-[0_2px_12px_rgba(0,0,0,0.08)] flex items-center justify-center text-gray-800 dark:text-gray-200 active:scale-95 transition-transform cursor-pointer"
            >
              <X size={20} strokeWidth={2.2} />
            </button>

            <div className="rounded-full bg-white/25 dark:bg-[#0f141c]/25 backdrop-blur-xl px-4 py-2 shadow-[0_2px_18px_rgba(255,255,255,0.18)] flex items-center justify-center">
              <span id="milestone-detail-title" className="text-[18px] font-bold text-gray-900 dark:text-white tracking-tight">
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
          <div className="flex items-center justify-center gap-1.5 mb-2">
            <div className="size-5 rounded-md bg-[#22c55e] flex items-center justify-center text-white text-[11px] font-black shadow-xs">
              K
            </div>
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">Kivvi</span>
          </div>

          {/* ── 3D FLOATING ROTATABLE BADGE ── */}
          <MilestonePlaque3D
            achievement={badge}
            unlocked={isUnlocked}
            progress={{ current: currentVal, target: targetVal, unlocked: isUnlocked }}
            className="-mt-3 -mb-4 !py-2"
          />

          {/* Status Pill: Achieved or In Progress */}
          <div
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full px-3.5 py-1 text-xs font-bold shadow-2xs mt-4 transition-colors duration-300',
              isUnlocked
                ? 'bg-sky-100 dark:bg-sky-950/50 text-[#007aff] dark:text-sky-400'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400',
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
          <h2 className="text-[26px] sm:text-[28px] font-extrabold text-gray-900 dark:text-white tracking-tight mt-3 leading-snug px-2">
            {tt(badge.titleKey)}
          </h2>

          {/* Reward Subtitle */}
          <p className="text-[16px] sm:text-[17px] font-bold mt-1 text-[#007aff] dark:text-sky-400">
            +{badge.reward.xp} XP · +{badge.reward.coins} 🪙
          </p>

          {/* Description Paragraph */}
          <p className="text-[14px] text-gray-500 dark:text-gray-400 max-w-[340px] mt-2.5 leading-relaxed px-4">
            {tt(badge.descKey)}
          </p>

          {/* ── MILESTONE REACHED PROGRESS CARD ── */}
          <div className="mt-6 w-full max-w-[370px] rounded-2xl bg-white dark:bg-[#18202e] p-5 shadow-[0_2px_12px_rgba(0,0,0,0.03)] text-left">
            <div className="flex items-center justify-between text-[15px] font-bold text-gray-900 dark:text-white">
              <span>{tt('achMilestoneReached')}</span>
              <span className="tabular-nums">{pct}%</span>
            </div>

            {/* Progress Bar (Standard blue, independent of badge color) */}
            <div className="h-1.5 w-full bg-gray-200 dark:bg-gray-700 rounded-full mt-3 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700 bg-[#007aff]"
                style={{ width: `${pct}%` }}
              />
            </div>

            {/* Remaining or Date Meta */}
            {!isUnlocked && remaining > 0 ? (
              <p className="mt-3 text-[12px] font-semibold text-[#007aff] dark:text-sky-400">
                {tt('achRemainingToUnlock').replace('{count}', String(remaining))}
              </p>
            ) : (
              <p className="mt-3 text-[12px] text-gray-400 dark:text-gray-500">
                {tt('achFirstRecorded')} {formattedDate}
              </p>
            )}
          </div>

          {/* Action Buttons */}
          <div className="mt-6 w-full max-w-[370px] flex gap-2.5">
            {isUnlocked ? (
              <>
                <button
                  type="button"
                  onClick={handleReplayCelebration}
                  className="flex-1 h-12 rounded-2xl bg-gray-100 dark:bg-[#1c2431] text-gray-800 dark:text-gray-200 font-semibold text-xs hover:bg-gray-200 dark:hover:bg-[#253040] transition-all active:scale-98 cursor-pointer flex items-center justify-center gap-1.5 shadow-xs"
                >
                  <Sparkles size={15} className="text-amber-500" />
                  <span>{tt('achViewCelebration')}</span>
                </button>
                <button
                  type="button"
                  onClick={handleShare}
                  className="flex-[1.2] h-12 rounded-2xl bg-pprimary text-ponprimary font-bold text-xs transition-all active:scale-98 cursor-pointer flex items-center justify-center gap-1.5 shadow-sm hover:brightness-105"
                >
                  <Share2 size={15} />
                  <span>{tt('achShareBadge')}</span>
                </button>
              </>
            ) : (
              <div className="w-full flex gap-2">
                <button
                  type="button"
                  onClick={handleStartPractice}
                  className="flex-1 h-12 rounded-2xl bg-pprimary text-ponprimary font-bold text-xs transition-all active:scale-98 cursor-pointer flex items-center justify-center gap-1.5 shadow-sm hover:brightness-105"
                >
                  <Play size={14} fill="currentColor" />
                  <span>{tt('achStartTest')}</span>
                </button>
                <button
                  type="button"
                  onClick={handleReplayCelebration}
                  className="h-12 px-4 rounded-2xl bg-gray-100 dark:bg-[#1c2431] text-gray-800 dark:text-gray-200 font-semibold text-xs hover:bg-gray-200 dark:hover:bg-[#253040] transition-all active:scale-98 cursor-pointer flex items-center justify-center gap-1.5 shadow-xs"
                  title={tt('achViewCelebration')}
                >
                  <Sparkles size={15} className="text-amber-500" />
                  <span>{tt('achViewCelebration')}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
