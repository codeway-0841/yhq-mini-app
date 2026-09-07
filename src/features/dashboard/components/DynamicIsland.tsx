import { useEffect, useId, useState, useMemo, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import {
  BarChart3,
  Palette,
  ShoppingBag,
  Trophy,
  X,
  LayoutGrid,
  Flame,
  Sparkles,
  Play,
} from 'lucide-react'
import DialogOverlay from '../../../shared/components/DialogOverlay'
import SettingsModal from '../../../shared/components/SettingsModal'
import { useAppStore } from '../../../shared/store/useAppStore'
import { useSubjectStore } from '../../../shared/store/useSubjectStore'
import { useDailyStore } from '../../../shared/store/useDailyStore'
import { useTestSessionStore } from '../../../shared/store/useTestSessionStore'
import { useT } from '../../../shared/i18n'
import { type AchievementStats } from '../../../shared/api'
import { fetchAchievements, getAchievementsCache } from '../../../shared/lib/achievements-cache'
import { AchievementsScreen } from '../../profile'
import { subscribeModalStack } from '../../../shared/lib/navigation'
import { haptics } from '../../../platform/haptics'
import { playSound } from '../../../shared/lib/sounds'
import { resumeRouteState } from '../next-step'
import { remainingSeconds, testDurationSeconds } from '../../../shared/lib/test-session'
import { useScrollAwareVisibility } from '../hooks/useScrollAwareVisibility'

function DashboardAchievements({ onClose }: { onClose: () => void }) {
  const userId = useAppStore((s) => s.user?.id)
  const lang = useAppStore((s) => s.settings.language)
  const tt = useT(lang)
  const titleId = useId()
  const [stats, setStats] = useState<AchievementStats | null>(() => (userId ? getAchievementsCache(userId).peek() : null))
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let active = true
    if (!userId) return
    fetchAchievements(userId)
      .then((result) => {
        if (active) setStats(result)
      })
      .catch(() => {
        if (active) setFailed(true)
      })
    return () => {
      active = false
    }
  }, [userId, lang, attempt])

  if (stats) return <AchievementsScreen stats={stats} tt={tt} onClose={onClose} />
  return (
    <DialogOverlay onClose={onClose} labelId={titleId} position="center">
      <div className="relative w-full max-w-sm rounded-3xl bg-pcard p-6 text-pfg shadow-xl">
        <h2 id={titleId} className="mb-4 text-lg font-semibold">
          {tt('achTitle')}
        </h2>
        <p role="status" className="text-sm text-pmuted">
          {failed || !userId
            ? lang === 'ru'
              ? 'Не удалось загрузить достижения'
              : 'Yutuqlarni yuklab bo‘lmadi'
            : tt('loadingDots')}
        </p>
        <div className="mt-5 flex justify-end gap-3">
          {failed && (
            <button
              type="button"
              className="min-h-11 rounded-xl px-4 text-pprimary"
              onClick={() => {
                setFailed(false)
                setAttempt((n) => n + 1)
              }}
            >
              {tt('retry')}
            </button>
          )}
          <button type="button" className="min-h-11 rounded-xl bg-psurface px-4" onClick={onClose}>
            {tt('close')}
          </button>
        </div>
      </div>
    </DialogOverlay>
  )
}

/**
 * KIVVI Dynamic Island (Dashboard Dinamik Kapsula).
 *
 * Senior darajadagi arxitektura:
 * - 3 ta rejim: Idle Capsule (tinch holat), Live Activity (davom etayotgan test), Expanded Dock (boshqaruv doki).
 * - Real-time taymer (chala qolgan test aniqlanganda sekundma-sekund sanash).
 * - Ekranning pastki markazida, thumb-zone uchun eng qulay ergonomikada joylashadi.
 * - Glassmorphism, GPU-accelerated spring animatsiyalar va haptic feedback.
 * - A11y (ARIA dialog, focus management, Escape va Android back navigation).
 */
export default function DynamicIsland() {
  const [modalCount, setModalCount] = useState(0)
  useEffect(() => subscribeModalStack(setModalCount), [])
  const isScrollVisible = useScrollAwareVisibility()
  const [panel, setPanel] = useState<'menu' | 'themes' | 'achievements' | null>(null)

  const lang = useAppStore((s) => s.settings.language)
  const userId = useAppStore((s) => s.user?.id)
  const subject = useSubjectStore((s) => s.subject)
  const dailyStreak = useDailyStore((s) => s.streaks[subject.id] ?? 0)
  const session = useTestSessionStore((s) => s.session)

  // Start achievements preload
  useEffect(() => {
    if (userId) void fetchAchievements(userId).catch(() => {})
  }, [userId])

  const tt = useT(lang)
  const navigate = useNavigate()
  const titleId = useId()
  const menuLabel = lang === 'ru' ? 'Меню' : 'Menyu'

  const close = useCallback(() => setPanel(null), [])

  // Live Test Activity tekshiruvi
  const resume = useMemo(() => resumeRouteState(session, subject.id), [session, subject.id])
  const [now, setNow] = useState(Date.now)

  const isResumable = Boolean(resume && session)
  const totalSeconds = useMemo(
    () => (isResumable && session ? testDurationSeconds(session.mode) : 0),
    [isResumable, session],
  )
  const rem = useMemo(
    () => (isResumable && session ? remainingSeconds(session.startedAt, totalSeconds, now) : 0),
    [isResumable, session, totalSeconds, now],
  )

  useEffect(() => {
    if (!isResumable || rem <= 0) return
    const interval = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(interval)
  }, [isResumable, rem])

  const hasLiveTest = isResumable && rem > 0
  const formattedTime = useMemo(() => {
    const m = Math.floor(rem / 60)
    const s = rem % 60
    if (m >= 60) {
      const h = Math.floor(m / 60)
      const min = m % 60
      return `${h}:${min < 10 ? '0' : ''}${min}:${s < 10 ? '0' : ''}${s}`
    }
    return `${m}:${s < 10 ? '0' : ''}${s}`
  }, [rem])

  const handleResume = useCallback(() => {
    if (!resume) return
    playSound('click')
    haptics.impact('light')
    navigate('/test/1', { state: resume })
  }, [navigate, resume])

  const openMenu = useCallback(() => {
    playSound('toggle')
    haptics.selection()
    haptics.impact('light')
    setPanel('menu')
  }, [])

  const actions = useMemo(
    () => [
      {
        label: tt('statsTitle'),
        Icon: BarChart3,
        color: 'bg-blue-500/15 text-blue-500 dark:text-blue-300',
        run: () => {
          close()
          navigate('/statistika')
        },
      },
      {
        label: tt('achTitle'),
        Icon: Trophy,
        color: 'bg-amber-500/15 text-amber-500 dark:text-amber-300',
        run: () => setPanel('achievements'),
      },
      {
        label: tt('shopThemesTitle'),
        Icon: Palette,
        color: 'bg-purple-500/15 text-purple-500 dark:text-purple-300',
        run: () => setPanel('themes'),
      },
      {
        label: tt('shopMenuItem'),
        Icon: ShoppingBag,
        color: 'bg-emerald-500/15 text-emerald-500 dark:text-emerald-300',
        run: () => {
          close()
          navigate('/shop')
        },
      },
    ],
    [close, navigate, tt],
  )

  const isHidden = !isScrollVisible
  const isSheetOpen = Boolean(panel || modalCount > 0)

  return createPortal(
    <>
      {/* Dynamic Island Floating Anchor */}
      <div
        style={{ visibility: isSheetOpen ? 'hidden' : undefined }}
        className="dynamic-island-anchor dashboard-menu-anchor pointer-events-none fixed inset-x-0 z-40 mx-auto flex max-w-2xl justify-center px-4"
      >
        <div
          style={{ visibility: isSheetOpen ? 'hidden' : undefined }}
          className={`dynamic-island pointer-events-auto flex items-center rounded-full transition-all duration-300 ease-out ${
            isHidden ? 'translate-y-6 opacity-0 pointer-events-none' : 'translate-y-0 opacity-100'
          }`}
          role="region"
          aria-label="Dynamic Island"
        >
          {hasLiveTest ? (
            /* Live Activity State: Davom etayotgan test */
            <div
              style={{ visibility: isSheetOpen ? 'hidden' : undefined }}
              className="flex items-center gap-2 p-1.5 pl-3.5 pr-1.5"
            >
              <div
                className="flex items-center gap-2 cursor-pointer select-none"
                onClick={handleResume}
                title={tt('guideContinueTest')}
              >
                <span className="relative flex size-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex size-2.5 rounded-full bg-emerald-500" />
                </span>
                <span className="font-mono text-[13px] font-bold text-emerald-400 tabular-nums">
                  ⏱ {formattedTime}
                </span>
              </div>
              <div className="h-4 w-[1px] bg-black/10 dark:bg-white/20" />
              <button
                type="button"
                aria-label={lang === 'ru' ? 'Продолжить' : 'Davom etish'}
                onClick={handleResume}
                onPointerDown={() => haptics.selection()}
                className="flex items-center gap-1.5 py-1.5 px-3 rounded-full bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white text-[12.5px] font-bold transition-all shadow-xs"
              >
                <span>{lang === 'ru' ? 'Продолжить' : 'Davom etish'}</span>
                <Play size={11} fill="currentColor" />
              </button>
              <button
                type="button"
                aria-label={menuLabel}
                aria-haspopup="dialog"
                aria-expanded={panel === 'menu'}
                onClick={openMenu}
                onPointerDown={() => haptics.selection()}
                className="grid size-8 place-items-center rounded-full bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20 active:scale-95 transition-all text-slate-800 dark:text-white/90"
              >
                <LayoutGrid size={15} />
              </button>
            </div>
          ) : (
            /* Idle State: Gamifikatsiya ko'rsatkichi + Menyu trigger */
            <div
              style={{ visibility: isSheetOpen ? 'hidden' : undefined }}
              className="flex items-center gap-2 p-1.5 pl-3 pr-1.5"
            >
              {dailyStreak > 0 ? (
                <button
                  type="button"
                  onClick={() => {
                    haptics.selection()
                    navigate('/streak')
                  }}
                  className="flex items-center gap-1.5 active:scale-95 transition-transform"
                  title={tt('intizomTitle')}
                >
                  <Flame size={17} className="text-amber-500 fill-amber-500/30" />
                  <span className="text-[13px] font-bold tracking-tight text-slate-800 dark:text-white">
                    {dailyStreak} {tt('daysWord')}
                  </span>
                </button>
              ) : (
                <div className="flex items-center gap-1.5 select-none text-slate-700 dark:text-white/85">
                  <Sparkles size={15} className="text-pprimary" />
                  <span className="text-[12.5px] font-semibold">
                    {lang === 'ru' ? subject.nameRu : subject.name}
                  </span>
                </div>
              )}

              <div className="h-4 w-[1px] bg-black/10 dark:bg-white/15" />

              <button
                type="button"
                aria-label={menuLabel}
                aria-haspopup="dialog"
                aria-expanded={panel === 'menu'}
                onClick={openMenu}
                onPointerDown={() => haptics.selection()}
                className="flex items-center gap-1.5 py-1 px-3 rounded-full bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/15 active:scale-95 transition-all text-[13px] font-semibold text-slate-800 dark:text-white"
              >
                <LayoutGrid size={15} strokeWidth={2} />
                <span>{menuLabel}</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Expanded State: Dynamic Island Command Dock */}
      {panel === 'menu' && (
        <DialogOverlay onClose={close} labelId={titleId} position="bottom" backdropClassName="bg-black/50 backdrop-blur-xs">
          <div className="dynamic-island-anchor pointer-events-none fixed inset-x-0 z-40 mx-auto flex max-w-sm justify-center px-4">
            <div className="dynamic-island-dock pointer-events-auto w-full rounded-3xl p-4 animate-dynamic-island-expand">
              {/* Dock Header */}
              <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-black/10 dark:border-white/10">
                <div className="flex items-center gap-2">
                  <span className="size-2 rounded-full bg-pprimary animate-pulse" />
                  <h2 id={titleId} className="text-[14px] font-bold tracking-tight text-slate-800 dark:text-white">
                    {menuLabel}
                  </h2>
                </div>
                <button
                  type="button"
                  aria-label={tt('close')}
                  onClick={close}
                  onPointerDown={() => haptics.selection()}
                  className="grid size-7 place-items-center rounded-full bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20 active:scale-90 transition-transform text-slate-600 dark:text-white/80"
                >
                  <X size={15} />
                </button>
              </div>

              {/* 2x2 Icon Grid (iOS/Launchpad Style) */}
              <div className="grid grid-cols-2 gap-2.5">
                {actions.map(({ label, Icon, color, run }) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => {
                      haptics.selection()
                      run()
                    }}
                    className="group flex flex-col items-center justify-center gap-2 py-3 px-2 rounded-2xl bg-black/[0.04] dark:bg-white/[0.06] hover:bg-black/[0.07] dark:hover:bg-white/12 active:scale-[0.95] transition-all text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pprimary"
                  >
                    <span className={`grid size-12 shrink-0 place-items-center rounded-2xl shadow-xs transition-transform group-active:scale-95 ${color}`}>
                      <Icon size={22} strokeWidth={2} />
                    </span>
                    <span className="text-[12.5px] font-semibold tracking-tight text-slate-800 dark:text-white">
                      {label}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </DialogOverlay>
      )}


      {panel === 'themes' && <SettingsModal initialPicker="accent" onClose={close} />}
      {panel === 'achievements' && <DashboardAchievements key={userId} onClose={close} />}
    </>
  , document.body)
}
