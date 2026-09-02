import { useState, useEffect, useMemo } from 'react'
import { Trophy, Crown, Swords } from 'lucide-react'
import { api, type DuelLeaderboardEntry, avatarSrcFor } from '../../../shared/api'
import { getAvatarFrame } from '../../../shared/config/avatar-frames'
import { playSound } from '../../../shared/lib/sounds'
import { haptics } from '../../../platform/haptics'
import { cn } from '../../../shared/lib/cn'

/** Duel reytingi davrlari — 'all' umrbod counterdan, qolgani duel_results'dan */
const RANK_TABS = ['daily', 'weekly', 'monthly', 'all'] as const
type RankTab = typeof RANK_TABS[number]

interface DuelLeaderboardViewProps {
  tt: ReturnType<typeof import('../../../shared/i18n')['useT']>
  user: { id: string; firstName: string; photoUrl?: string } | null | undefined
  onFind: () => void
}

function UserAvatar({ name, src, frame, size = 'sm' }: {
  name: string
  src?: string | null
  frame?: string | null
  size?: 'sm' | 'md' | 'top1' | 'top2'
}) {
  const frameClass = getAvatarFrame(frame)?.cssClass ?? null
  const sizeClasses =
    size === 'top1' ? 'size-[84px] text-2xl' :
    size === 'top2' ? 'size-[66px] text-xl' :
    size === 'md'   ? 'size-10 text-xs' :
    'size-8 text-[11px]'

  const letter = name[0]?.toUpperCase() ?? '?'

  const inner = (
    <div className={cn(
      sizeClasses,
      'rounded-full bg-psurface flex items-center justify-center text-pfg font-bold shrink-0 overflow-hidden',
      !frameClass && 'border border-pline'
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

/**
 * 👑 Top-3 Arc Showcase (Leaderboard bilan 100% bir xil yaltiroq Oltin, Kumush va Bronza nishonlari)
 */
function Top3ArcStage({ top3, tt }: {
  top3: readonly DuelLeaderboardEntry[]
  tt: ReturnType<typeof import('../../../shared/i18n')['useT']>
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
              {second.score} <span className="text-[9px] font-normal text-psubtle">{tt('duelWinsLabel').toLowerCase()}</span>
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
            {first.score} <span className="text-[9.5px] font-normal text-psubtle">{tt('duelWinsLabel').toLowerCase()}</span>
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
              {third.score} <span className="text-[9px] font-normal text-psubtle">{tt('duelWinsLabel').toLowerCase()}</span>
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

export function DuelLeaderboardView({
  tt,
  user,
  onFind,
}: DuelLeaderboardViewProps) {
  // Duel Leaderboard filtri: Kunlik / Haftalik / Oylik / Umumiy
  const [rankTab, setRankTab] = useState<RankTab>('daily')
  const [leaders, setLeaders] = useState<Record<RankTab, DuelLeaderboardEntry[] | null>>({
    daily: null, weekly: null, monthly: null, all: null,
  })
  const [loadingLeaders, setLoadingLeaders] = useState(false)

  // Tanlangan davr bo'yicha real duel g'alabalarini yuklash
  useEffect(() => {
    setLoadingLeaders(true)
    api.getLeaderboardDuel(50, user?.id, rankTab)
      .then((data) => setLeaders((prev) => ({ ...prev, [rankTab]: data })))
      .catch(() => setLeaders((prev) => ({ ...prev, [rankTab]: [] })))
      .finally(() => setLoadingLeaders(false))
  }, [rankTab, user?.id])

  // Joriy ro'yxat
  const currentLeaderList: DuelLeaderboardEntry[] = useMemo(
    () => leaders[rankTab] ?? [],
    [rankTab, leaders],
  )

  const isLeaderboardLoading = loadingLeaders && leaders[rankTab] === null

  return (
    <div className="space-y-4">
      {/* Segmented Control Tabs (Global Button Style) */}
      <div className="flex gap-1.5 bg-psurface p-1 rounded-2xl shadow-xs">
        {RANK_TABS.map((t) => {
          const label =
            t === 'daily'   ? tt('dailyTab')   :
            t === 'weekly'  ? tt('weeklyTab')  :
            t === 'monthly' ? tt('monthlyTab') :
            tt('allTimeTab')
          const active = rankTab === t

          return (
            <button
              key={t}
              type="button"
              onClick={() => { playSound('click'); haptics.select(); setRankTab(t) }}
              className={cn(
                'flex-1 py-2 rounded-xl text-xs font-semibold transition-all duration-[120ms] ease-out active:scale-[0.98]',
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

      {/* Top-3 Arc Podium Showcase (faqat kamida 3 ta g'olib bo'lsa) */}
      {currentLeaderList.length >= 3 && !isLeaderboardLoading && (
        <Top3ArcStage top3={currentLeaderList.slice(0, 3)} tt={tt} />
      )}

      {/* O'yinchilar Ro'yxati / Bo'sh holat / Skeleton */}
      {isLeaderboardLoading ? (
        <div className="overflow-hidden rounded-2xl bg-pcard divide-y divide-pline animate-pulse shadow-xs">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3.5">
              <div className="w-5 h-3.5 bg-psurface rounded shrink-0" />
              <div className="size-8 rounded-full bg-psurface shrink-0" />
              <div className="h-3.5 flex-1 bg-psurface rounded" />
              <div className="h-3.5 w-12 bg-psurface rounded shrink-0" />
            </div>
          ))}
        </div>
      ) : currentLeaderList.length === 0 ? (
        <div className="rounded-2xl bg-pcard p-8 text-center shadow-xs">
          <Trophy size={32} className="mx-auto text-psubtle mb-2" />
          <h4 className="text-sm font-bold text-pfg">
            {rankTab === 'daily'   ? tt('duelEmptyDaily')   :
             rankTab === 'weekly'  ? tt('duelEmptyWeekly')  :
             rankTab === 'monthly' ? tt('duelEmptyMonthly') :
             tt('duelEmptyAll')}
          </h4>
          <p className="text-xs text-psubtle mt-1">
            {tt('duelEmptyHint')}
          </p>
          <button
            type="button"
            onClick={() => { playSound('click'); haptics.impact('heavy'); onFind() }}
            className="mt-4 h-10 px-5 rounded-2xl bg-pprimary text-ponprimary text-xs font-bold shadow-xs active:scale-95 transition-all inline-flex items-center gap-2"
          >
            <Swords size={15} />
            <span>{tt('findOpponent')}</span>
          </button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl bg-pcard divide-y divide-pline shadow-xs">
          {(currentLeaderList.length >= 3 ? currentLeaderList.slice(3) : currentLeaderList).map((entry) => {
            const isYou = entry.isYou

            return (
              <div
                key={entry.userId}
                className={cn(
                  'flex items-center gap-3 px-4 py-3.5 transition-colors',
                  isYou ? 'bg-pwash font-bold' : 'hover:bg-psurface/40'
                )}
              >
                {/* Rank Badge */}
                <div className="flex items-center justify-center w-5 shrink-0">
                  <span className={cn(
                    'font-display text-[13px] font-semibold tabular-nums',
                    isYou ? 'text-pprimary font-bold' : 'text-psubtle'
                  )}>
                    {entry.rank}
                  </span>
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

                {/* Score: davr ichidagi g'alabalar + W-L-D / g'alaba foizi */}
                <div className="flex flex-col items-end shrink-0">
                  <div className="flex items-baseline gap-1">
                    <span className={cn(
                      'font-display text-[13px] font-bold tabular-nums',
                      isYou ? 'text-pprimary' : 'text-pfg'
                    )}>
                      {entry.score}
                    </span>
                    <span className="text-[11px] font-normal text-psubtle">
                      {tt('duelWinsLabel').toLowerCase()}
                    </span>
                  </div>
                  {rankTab !== 'all' && (
                    <span
                      className="text-[10px] text-psubtle tabular-nums"
                      title={`${tt('duelRecordLabel')} · ${tt('duelWinRateLabel')}`}
                    >
                      {entry.wins}–{entry.losses}–{entry.draws} · {entry.winRate}%
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
