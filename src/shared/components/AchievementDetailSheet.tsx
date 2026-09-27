import { useCallback, useMemo } from 'react'
import { X, Forward, CheckCircle2, Lock } from 'lucide-react'
import { useAchievementCelebrationStore } from '../store/useAchievementCelebrationStore'
import { useAppStore } from '../store/useAppStore'
import { useT } from '../i18n'
import { shareUrl } from '../../platform/telegram'
import { config } from '../config'
import { cn } from '../lib/cn'
import { MilestonePlaque3D, hexToRgba } from './MilestonePlaque3D'
import { createPortal } from 'react-dom'

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

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="milestone-detail-title"
      className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/45 backdrop-blur-sm animate-fadeIn select-none overflow-hidden"
      onClick={closeDetailSheet}
    >
      {/* ── Apple / Taphey Style Milestone Sheet (Full-height Scroll Container, Always Pristine Light) ── */}
      <div
        className="relative w-full max-w-sm sm:max-w-[420px] rounded-t-[36px] sm:rounded-[36px] bg-[#FAF9FC] text-gray-900 shadow-2xl overflow-y-auto max-h-[92dvh] flex flex-col animate-slideUp overscroll-contain"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Dynamic Ambient Glow + Subtle Grid (Upper half, pastel badgeColor on light canvas) */}
        <div
          className="absolute inset-x-0 top-0 h-[620px] pointer-events-none z-0 transition-colors duration-500"
          style={{
            backgroundImage: `radial-gradient(circle at 82% 14%, ${hexToRgba(badgeColor, 0.22)} 0%, ${hexToRgba(badgeColor, 0.05)} 45%, transparent 70%), radial-gradient(circle at 18% 18%, rgba(255,255,255,0.95) 0%, transparent 55%), linear-gradient(rgba(0, 0, 0, 0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(0, 0, 0, 0.035) 1px, transparent 1px)`,
            backgroundSize: 'auto, auto, 28px 28px, 28px 28px',
            WebkitMaskImage: 'linear-gradient(to bottom, black 0%, black 55%, transparent 95%)',
            maskImage: 'linear-gradient(to bottom, black 0%, black 55%, transparent 95%)',
          }}
        />

        {/* ── STICKY TOP CONTROLS (Floating cleanly without boxes, with white circle buttons) ── */}
        <div
          data-floating-controls
          className="pointer-events-none sticky top-[var(--safe-top)] z-30 w-full bg-transparent pt-2.5 pb-1 px-4"
        >
          {/* Top Sheet Grab Handle */}
          <div className="w-9 h-1 rounded-full bg-gray-300 mx-auto mb-2" />

          {/* Top Bar: Close (X) · "Milestone" (Clean typography) · Share */}
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={closeDetailSheet}
              aria-label={tt('close')}
              className="pointer-events-auto size-10 rounded-full bg-white shadow-[0_2px_8px_rgba(0,0,0,0.06)] border border-black/[0.04] flex items-center justify-center text-gray-700 active:scale-95 transition-transform cursor-pointer"
            >
              <X size={18} strokeWidth={2.4} />
            </button>

            <span id="milestone-detail-title" className="text-[17px] font-semibold text-gray-900 tracking-tight">
              {tt('achMilestoneTitle')}
            </span>

            <button
              type="button"
              onClick={handleShare}
              aria-label={tt('achShareBadge')}
              className="pointer-events-auto size-10 rounded-full bg-white shadow-[0_2px_8px_rgba(0,0,0,0.06)] border border-black/[0.04] flex items-center justify-center text-gray-700 active:scale-95 transition-transform cursor-pointer"
            >
              <Forward size={18} strokeWidth={2.2} fill="currentColor" />
            </button>
          </div>
        </div>

        {/* ── SCROLLABLE BODY CONTENT ── */}
        <div className="relative z-10 px-5 pt-1 pb-6 flex flex-col items-center text-center">
          {/* ── 3D FLOATING ROTATABLE BADGE ── */}
          <MilestonePlaque3D
            achievement={badge}
            unlocked={isUnlocked}
            progress={{ current: currentVal, target: targetVal, unlocked: isUnlocked }}
            className="my-1 !py-1"
          />

          {/* Status Pill: Achieved or In Progress */}
          <div
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full px-3.5 py-1 text-xs font-semibold shadow-2xs mt-3 transition-colors duration-300',
              isUnlocked
                ? 'bg-[#EBF3FF] text-[#0066FF] border border-[#D0E2FF]/80'
                : 'bg-gray-100 text-gray-500 border border-gray-200/80',
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
          <h2 className="text-[25px] sm:text-[27px] font-bold text-gray-900 tracking-tight mt-2.5 leading-snug px-3">
            {tt(badge.titleKey)}
          </h2>

          {/* Reward Subtitle */}
          <p className="text-[15px] sm:text-[16px] font-semibold mt-1 text-[#0066FF]">
            +{badge.reward.xp} XP · +{badge.reward.coins} 🪙
          </p>

          {/* Description Paragraph */}
          <p className="text-[14px] text-gray-500 max-w-[340px] mt-2 leading-relaxed px-4">
            {tt(badge.descKey)}
          </p>

          {/* ── MILESTONE REACHED PROGRESS CARD ── */}
          <div className="mt-5 w-full max-w-[370px] rounded-2xl bg-white p-5 shadow-[0_2px_12px_rgba(0,0,0,0.04)] border border-gray-100 text-left">
            <div className="flex items-center justify-between text-[15px] font-bold text-gray-900">
              <span>{tt('achMilestoneReached')}</span>
              <span className="tabular-nums">{pct}%</span>
            </div>

            {/* Progress Bar (Standard blue, independent of badge color) */}
            <div className="h-1.5 w-full bg-gray-100 rounded-full mt-3 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700 bg-[#007aff]"
                style={{ width: `${pct}%` }}
              />
            </div>

            {/* Remaining or Date Meta */}
            {!isUnlocked && remaining > 0 ? (
              <p className="mt-3 text-[12px] font-semibold text-[#0066FF]">
                {tt('achRemainingToUnlock').replace('{count}', String(remaining))}
              </p>
            ) : (
              <p className="mt-3 text-[12px] text-gray-400 font-medium">
                {tt('achFirstRecorded')} {formattedDate}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
