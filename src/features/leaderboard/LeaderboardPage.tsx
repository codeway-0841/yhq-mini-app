/**
 * Leaderboard — Foydalanuvchi taqdim etgan rasm dizayni asosidagi Premium UI.
 *
 * - Yuqori markaziy sarlavha va Segmented Tabs (Haftalik / Barcha vaqtlar).
 * - Radial nur (Sunburst) fonli Top-3 g'oliblar yarim doirasi (Arc Podium):
 *   * 1-o'rin (Yashil ring + Toj 👑 + "1" badge)
 *   * 2-o'rin (Binafsha ring + "2" badge)
 *   * 3-o'rin (Bronza/Oltin ring + "3" badge)
 * - "You Currently Rank" (Sizning o'rningiz) alohida ajratilgan qavariq karta.
 * - Har bir o'yinchi uchun qavariq alohida karta (Rank + ▲ trend + Avatar + Ism + Ball kapsulasi).
 */
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { goBack } from '../../shared/lib/navigation'
import {
  ChevronLeft, Crown, Gift, History, ChevronDown, ChevronUp, Trophy,
} from 'lucide-react'
import { useAppStore } from '../../shared/store/useAppStore'
import { useT } from '../../shared/i18n'
import {
  avatarSrcFor, type LeaderboardEntry as Entry, type LeagueWeekly, type TournamentSeason,
} from '../../shared/api'
import { leaderboardPageCaches } from '../../shared/lib/leaderboard-cache'
import { getAvatarFrame } from '../../shared/config/avatar-frames'
import { playSound } from '../../shared/lib/sounds'
import { haptics } from '../../platform/haptics'
import { cn } from '../../shared/lib/cn'

/** 'YYYY-MM-DD' (hafta dushanbasi) → "10.08–16.08" (dushanba–yakshanba) */
function fmtWeekRange(periodKey: string): string {
  const d = new Date(`${periodKey}T00:00:00Z`)
  if (Number.isNaN(d.getTime())) return periodKey
  const end = new Date(d.getTime() + 6 * 86_400_000)
  const fmt = (x: Date) =>
    `${String(x.getUTCDate()).padStart(2, '0')}.${String(x.getUTCMonth() + 1).padStart(2, '0')}`
  return `${fmt(d)}–${fmt(end)}`
}


function UserAvatar({ name, src, frame, size = 'md' }: {
  name: string
  src?: string | null
  frame?: string | null
  size?: 'sm' | 'md' | 'lg' | 'top1' | 'top2'
}) {
  const frameClass = getAvatarFrame(frame)?.cssClass ?? null
  const sizeClasses =
    size === 'top1' ? 'size-[84px] text-2xl' :
    size === 'top2' ? 'size-[66px] text-xl' :
    size === 'lg'   ? 'size-12 text-base' :
    size === 'sm'   ? 'size-8 text-[11px]' :
    'size-11 text-sm'

  const letter = name[0]?.toUpperCase() ?? '?'

  const inner = (
    <div className={cn(
      sizeClasses,
      'rounded-full bg-psurface flex items-center justify-center text-pfg font-bold shrink-0 overflow-hidden',
      !frameClass && 'shadow-2xs'
    )}>
      {src ? (
        <img src={src} alt={name} className="size-full object-cover" loading="lazy" />
      ) : (
        letter
      )}
    </div>
  )

  return frameClass ? <span className={cn('avatar-frame shrink-0', frameClass)}>{inner}</span> : inner
}

interface LeaderEntry {
  rank: number
  userId: string
  name: string
  score: number
  streak?: number
  isYou: boolean
  photoUrl?: string | null
  hasCustomAvatar?: boolean
  avatarFrame?: string | null
}

/**
 * 👑 Top-3 Arc Showcase (Yaltiroq Oltin, Kumush va Bronza metallik sahnasi)
 */
function Top3ArcStage({ top3, tt }: {
  top3: readonly LeaderEntry[]
  tt: (k: Parameters<ReturnType<typeof useT>>[0]) => string
}) {
  const first  = top3[0]
  const second = top3[1]
  const third  = top3[2]
  if (!first) return null

  return (
    <div className="relative flex flex-col items-center justify-center pt-2 pb-6 px-4 overflow-hidden">
      {/* Yumshoq nurlanuvchi radial fon nurlari */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="size-[280px] rounded-full bg-gradient-to-b from-amber-400/15 via-purple-500/10 to-transparent blur-2xl" />
      </div>

      {/* 3 ta Avatar: Chapda #2 (Kumush badge), O'rtada #1 (Oltin badge), O'ngda #3 (Bronza badge) */}
      <div className="relative z-10 flex items-center justify-center gap-4 sm:gap-7 mt-1">
        {/* 2-o'rin (Kumush / Silver badge) */}
        {second && (
          <div className="flex flex-col items-center">
            <div className="relative flex items-center justify-center">
              <div className="rounded-full shadow-md overflow-hidden bg-pcard ring-2 ring-psurface">
                <UserAvatar name={second.name} src={avatarSrcFor(second)} frame={second.avatarFrame} size="top2" />
              </div>
              <div className="absolute -bottom-2.5 flex size-6 items-center justify-center rounded-full bg-gradient-to-b from-slate-200 via-slate-400 to-slate-500 text-white font-display text-xs font-black shadow-md border-2 border-pcanvas">
                2
              </div>
            </div>
            <p className="mt-3.5 max-w-[80px] truncate text-center text-[12px] font-bold text-pfg">{second.name}</p>
            <p className="font-display text-[12px] font-extrabold text-slate-500 dark:text-slate-300 tabular-nums">
              {second.score} <span className="text-[9px] font-normal text-psubtle">{tt('scoreUnit')}</span>
            </p>
          </div>
        )}

        {/* 1-o'rin (Oltin / Gold badge + Oltin Toj 👑) */}
        <div className="flex flex-col items-center -mt-4">
          <div className="relative flex flex-col items-center">
            {/* Oltin Toj — avatar borderi ustida nafis tegib turadi */}
            <div className="-mb-0.5 z-20">
              <Crown size={25} className="fill-amber-400 stroke-amber-500 drop-shadow-[0_2px_8px_rgba(245,158,11,0.55)]" />
            </div>
            <div className="relative z-10 rounded-full shadow-lg overflow-hidden bg-pcard ring-2 ring-psurface">
              <UserAvatar name={first.name} src={avatarSrcFor(first)} frame={first.avatarFrame} size="top1" />
            </div>
            <div className="absolute -bottom-3 z-20 flex size-7 items-center justify-center rounded-full bg-gradient-to-b from-yellow-300 via-amber-400 to-amber-600 text-amber-950 font-display text-sm font-black shadow-lg border-2 border-pcanvas">
              1
            </div>
          </div>
          <p className="mt-4 max-w-[95px] truncate text-center text-[13.5px] font-extrabold text-pfg">{first.name}</p>
          <p className="font-display text-[13.5px] font-black text-amber-500 dark:text-amber-400 tabular-nums">
            {first.score} <span className="text-[9.5px] font-normal text-psubtle">{tt('scoreUnit')}</span>
          </p>
        </div>

        {/* 3-o'rin (Issiq Bronza / Bronze badge) */}
        {third && (
          <div className="flex flex-col items-center">
            <div className="relative flex items-center justify-center">
              <div className="rounded-full shadow-md overflow-hidden bg-pcard ring-2 ring-psurface">
                <UserAvatar name={third.name} src={avatarSrcFor(third)} frame={third.avatarFrame} size="top2" />
              </div>
              <div className="absolute -bottom-2.5 flex size-6 items-center justify-center rounded-full bg-gradient-to-b from-orange-300 via-amber-600 to-amber-800 text-white font-display text-xs font-black shadow-md border-2 border-pcanvas">
                3
              </div>
            </div>
            <p className="mt-3.5 max-w-[80px] truncate text-center text-[12px] font-bold text-pfg">{third.name}</p>
            <p className="font-display text-[12px] font-extrabold text-amber-700 dark:text-amber-500 tabular-nums">
              {third.score} <span className="text-[9px] font-normal text-psubtle">{tt('scoreUnit')}</span>
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

export default function LeaderboardPage() {
  const settings = useAppStore((s) => s.settings)
  const user     = useAppStore((s) => s.user)
  const navigate = useNavigate()
  const tt = useT(settings.language)

  const [tab, setTab] = useState<'daily' | 'weekly' | 'monthly'>('daily')
  // SWR (audit tezlik): keshdagi ma'lumot DARHOL — qayta ochilganda skelet yo'q;
  // tarmoq javobi kelgach state yangilanadi (fonda, dedup'langan so'rov).
  const [dailyEntries, setDailyEntries]     = useState<Entry[] | null>(() => leaderboardPageCaches.daily.peek())
  const [weekly, setWeekly]                 = useState<LeagueWeekly | null>(() => leaderboardPageCaches.weekly.peek())
  const [monthlyEntries, setMonthlyEntries] = useState<Entry[] | null>(() => leaderboardPageCaches.monthly.peek())
  const [seasons, setSeasons]               = useState<TournamentSeason[] | null>(() => leaderboardPageCaches.seasons.peek())
  const [error, setError]                   = useState(false)
  const [showHistory, setShowHistory]       = useState(false)

  useEffect(() => {
    leaderboardPageCaches.daily.fetch(user?.id).then(setDailyEntries).catch(() => setError(true))
    leaderboardPageCaches.weekly.fetch(user?.id).then(setWeekly).catch(() => setError(true))
    leaderboardPageCaches.monthly.fetch(user?.id).then(setMonthlyEntries).catch(() => setError(true))
    leaderboardPageCaches.seasons.fetch(user?.id).then(setSeasons).catch(() => {})
  }, [user?.id])

  const wEntries = weekly?.entries ?? []
  const n = wEntries.length
  const promoteN = useMemo(() => (n >= 2 ? Math.max(1, Math.round(n * 0.3)) : 0), [n])
  const demoteN  = useMemo(() => (n >= 3 ? Math.max(1, Math.round(n * 0.3)) : 0), [n])

  const currentEntries =
    tab === 'daily'   ? dailyEntries :
    tab === 'weekly'  ? (weekly ? weekly.entries : null) :
    monthlyEntries

  const isLoading = currentEntries === null
  const entriesList = currentEntries ?? []

  // Kamida 3 ta bo'lsa — Top 3 podiumda, qolgani pastda (4+)
  // Agar 1 yoki 2 ta bo'lsa — hammasi pastdagi kartochkalarda ko'rinadi
  const hasTop3 = entriesList.length >= 3
  const restEntries = hasTop3 ? entriesList.slice(3) : entriesList

  return (
    <div className="pb-8">
      {/* ── Top Bar & Segmented Control Tabs ── */}
      <header className="sticky top-0 z-30 -mt-[var(--safe-top-body,0px)] pt-[var(--safe-top,0px)] bg-pcanvas border-b border-pline pb-2.5 mb-3">
        <div className="relative flex items-center justify-center px-4 py-2">
          <button
            onClick={() => goBack(navigate)}
            aria-label={tt('backWord')}
            className="absolute left-4 top-1.5 grid size-10 place-items-center rounded-xl text-pmuted transition-colors duration-150 ease-out hover:bg-psurface hover:text-pfg active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pprimary"
          >
            <ChevronLeft size={22} strokeWidth={2.2} />
          </button>
          <h1 className="font-display text-[20px] font-extrabold tracking-tight text-pprimary">
            {tt('leaderboard')}
          </h1>
        </div>

        <div className="px-4">
          <div className="flex gap-1.5 bg-psurface p-1 rounded-2xl shadow-xs">
            {(['daily', 'weekly', 'monthly'] as const).map((t) => {
              const label =
                t === 'daily'   ? tt('dailyTab') :
                t === 'weekly'  ? tt('weeklyTab') :
                tt('monthlyTab')
              const active = tab === t

              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => { playSound('click'); haptics.select(); setTab(t) }}
                  className={cn(
                    'flex-1 py-2 rounded-xl text-xs font-semibold transition-all duration-150 ease-out active:scale-[0.98]',
                    active
                      ? 'bg-pprimary text-ponprimary shadow-xs font-bold'
                      : 'text-pmuted hover:text-pfg'
                  )}
                >
                  {label}
                </button>
              )
            })}
          </div>
        </div>
      </header>

      {error && (
        <p className="text-center text-sm font-medium text-pmuted py-16">{tt('leaderboardError')}</p>
      )}

      {/* ── Top-3 Arc Podium Showcase ── */}
      {hasTop3 && <Top3ArcStage top3={entriesList.slice(0, 3)} tt={tt} />}

      {/* ── O'yinchilar Ro'yxati / Bo'sh holat / Skeleton ── */}
      {isLoading ? (
        <div className="mx-4 overflow-hidden rounded-2xl bg-pcard divide-y divide-pline animate-pulse shadow-xs">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3.5">
              <div className="w-5 h-3.5 bg-psurface rounded shrink-0" />
              <div className="size-8 rounded-full bg-psurface shrink-0" />
              <div className="h-3.5 flex-1 bg-psurface rounded" />
              <div className="h-3.5 w-12 bg-psurface rounded shrink-0" />
            </div>
          ))}
        </div>
      ) : entriesList.length === 0 ? (
        <div className="mx-4 mt-6 flex flex-col items-center justify-center rounded-3xl bg-pcard p-8 text-center shadow-xs">
          <div className="mb-3 flex size-14 items-center justify-center rounded-2xl bg-pprimary/10 text-pprimary">
            <Trophy size={28} />
          </div>
          <h3 className="font-display text-base font-extrabold text-pfg">
            {tt('emptyLeaderboardTitle')}
          </h3>
          <p className="mt-1.5 max-w-[240px] text-xs text-psubtle">
            {tt('emptyLeaderboardDesc')}
          </p>
          <button
            type="button"
            onClick={() => navigate('/testlar')}
            className="mt-5 rounded-full bg-pprimary px-6 py-2.5 text-xs font-bold text-ponprimary shadow-md transition-transform active:scale-95"
          >
            {tt('startTestBtn')}
          </button>
        </div>
      ) : (
        <div className="mx-4 overflow-hidden rounded-2xl bg-pcard divide-y divide-pline shadow-xs">
          {restEntries.map((entry) => {
            const isYou = entry.isYou
            const isPromote = tab === 'weekly' && promoteN > 0 && entry.rank <= promoteN
            const isDemote  = tab === 'weekly' && demoteN > 0 && n > 0 && entry.rank > n - demoteN

            return (
              <div
                key={entry.userId}
                className={cn(
                  'flex items-center gap-3 px-4 py-3.5 transition-colors',
                  isYou ? 'bg-pwash font-bold' : 'hover:bg-psurface/40'
                )}
              >
                {/* Rank + Trend Arrow */}
                <div className="flex items-center justify-center w-5 shrink-0 gap-0.5">
                  <span className={cn(
                    'font-display text-[13px] font-semibold tabular-nums',
                    isYou ? 'text-pprimary font-bold' : 'text-psubtle'
                  )}>
                    {entry.rank}
                  </span>
                  {isPromote ? (
                    <span className="text-[8px] text-psuccess font-black leading-none">▲</span>
                  ) : isDemote ? (
                    <span className="text-[8px] text-pdanger font-black leading-none">▼</span>
                  ) : null}
                </div>

                {/* Avatar */}
                <UserAvatar name={entry.name} src={avatarSrcFor(entry)} frame={entry.avatarFrame} size="sm" />

                {/* Name */}
                <div className="min-w-0 flex-1">
                  <span className={cn(
                    'truncate text-[13px] block',
                    isYou ? 'font-bold text-pprimary' : 'font-medium text-pfg'
                  )}>
                    {entry.name}
                    {isYou && (
                      <span className="ml-1.5 rounded-full bg-pprimary/20 px-1.5 py-0.2 text-[9px] font-extrabold text-pprimary">
                        {tt('youLabel')}
                      </span>
                    )}
                  </span>
                </div>

                {/* Score */}
                <div className="flex items-baseline gap-1 shrink-0">
                  <span className={cn(
                    'font-display text-[13px] font-bold tabular-nums',
                    isYou ? 'text-pprimary' : 'text-pfg'
                  )}>
                    {entry.score}
                  </span>
                  <span className="text-[11px] font-normal text-psubtle">
                    {tt('scoreUnit')}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Chempionlar Tarixi (Accordion) ── */}
      {seasons && seasons.length > 0 && (
        <div className="mx-4 mt-6 rounded-2xl bg-pcard p-4 shadow-xs">
          <button
            type="button"
            onClick={() => setShowHistory((h) => !h)}
            className="flex w-full items-center justify-between text-left"
          >
            <div className="flex items-center gap-2.5">
              <div className="flex size-8 items-center justify-center rounded-xl bg-psurface text-psubtle shadow-2xs">
                <History size={16} strokeWidth={1.8} />
              </div>
              <div>
                <h3 className="text-xs font-bold text-pfg">{tt('tournamentHistoryTitle')}</h3>
                <p className="text-[10px] text-psubtle">{seasons.length} {tt('pastWinnersTitle')}</p>
              </div>
            </div>
            {showHistory ? <ChevronUp size={16} className="text-psubtle" /> : <ChevronDown size={16} className="text-psubtle" />}
          </button>

          {showHistory && (
            <div className="mt-3.5 space-y-3 border-t border-pline pt-3">
              {seasons.map((s, si) => (
                <div key={s.periodKey} className={si > 0 ? 'border-t border-pline pt-2.5' : ''}>
                  <p className="mb-2 text-[10.5px] font-bold text-psubtle">
                    {fmtWeekRange(s.periodKey)}
                  </p>
                  <div className="space-y-1.5">
                    {s.winners.map((w) => (
                      <div
                        key={w.rank}
                        className={cn(
                          'flex items-center gap-2.5 rounded-xl p-1.5',
                          w.isYou && 'bg-pprimary/10 ring-1 ring-pprimary/20'
                        )}
                      >
                        <span className="w-5 text-center font-display text-xs font-bold text-psubtle">{w.rank}</span>
                        <UserAvatar name={w.name} src={avatarSrcFor(w)} frame={w.avatarFrame} size="sm" />
                        <span className="flex-1 truncate text-xs font-semibold text-pfg">{w.name}</span>
                        <span className="font-display text-xs font-bold text-pprimary tabular-nums">{w.score}</span>
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-pgold">
                          <Gift size={11} strokeWidth={2} /> +{w.prizeDays}d
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
