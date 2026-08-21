/**
 * Leaderboard — ikki rejim:
 *  1) HAFTALIK LIGA (asosiy): joriy hafta yig'ilgan to'g'ri javoblar bo'yicha
 *     reyting + liga tizimi (Bronze→Silver→Gold→Platina). Har dushanba cron
 *     o'tgan hafta natijasiga ko'ra top 30% — yuqoriga, pastki 30% — pastga suradi.
 *     Ro'yxatda: yuqori 30% = YASHIL (otish zonasi), pastki 30% = QIZIL (tushish).
 *  2) UMUMIY: barcha vaqtlar bo'yicha reyting (eski holat).
 */
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { goBack } from '../../shared/lib/navigation'
import { Trophy, Shield, Gift } from 'lucide-react'
import { useAppStore } from '../../shared/store/useAppStore'
import { useT } from '../../shared/i18n'
import { api, avatarSrcFor, type LeaderboardEntry as Entry, type LeagueWeekly } from '../../shared/api'
import { getAvatarFrame } from '../../shared/config/avatar-frames'

const LEAGUES: Record<string, { color: string; titleKey: 'leagueBronze' | 'leagueSilver' | 'leagueGold' | 'leaguePlat' }> = {
  bronze:   { color: 'var(--p-warning)', titleKey: 'leagueBronze' },
  silver:   { color: 'var(--p-muted)',   titleKey: 'leagueSilver' },
  gold:     { color: 'var(--p-gold)',    titleKey: 'leagueGold' },
  platinum: { color: 'var(--p-blue)',    titleKey: 'leaguePlat' },
}

function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-line animate-pulse">
      <div className="w-6 h-4 bg-elevated rounded" />
      <div className="w-8 h-8 rounded-full bg-elevated" />
      <div className="flex-1 h-4 bg-elevated rounded" />
      <div className="w-10 h-4 bg-elevated rounded" />
    </div>
  )
}

function Medal({ rank }: { rank: number }) {
  if (rank === 1) return <span className="text-lg">🥇</span>
  if (rank === 2) return <span className="text-lg">🥈</span>
  if (rank === 3) return <span className="text-lg">🥉</span>
  return <span className="text-xs text-muted w-6 text-center">{rank}</span>
}

function InitialAvatar({ name, src, frame }: { name: string; src?: string | null; frame?: string | null }) {
  const frameClass = getAvatarFrame(frame)?.cssClass ?? null
  const inner = (
    <div className={`w-8 h-8 rounded-full bg-elevated flex items-center justify-center text-muted text-xs font-black flex-shrink-0 overflow-hidden${frameClass ? '' : ' border border-line'}`}>
      {src ? <img src={src} alt={name} className="w-full h-full object-cover" loading="lazy" /> : (name[0]?.toUpperCase() ?? '?')}
    </div>
  )
  // Do'kon ramkasi (cosmetic) — Profil Avatar bilan bir xil wrapper (avatar-frames config)
  return frameClass ? <span className={`avatar-frame ${frameClass} flex-shrink-0`}>{inner}</span> : inner
}

interface LeaderEntry {
  rank: number
  userId: string
  name: string
  score: number
  streak: number
  isYou: boolean
  photoUrl?: string | null
  hasCustomAvatar?: boolean
  avatarFrame?: string | null
}

/** Top-3 podium: oltin/kumush/bronza */
function Podium({ top3 }: { top3: LeaderEntry[] }) {
  const [first, second, third] = [top3[0], top3[1], top3[2]]
  const col = [
    { e: second, medal: '🥈', h: 'h-16', ring: 'ring-pmuted',   bg: 'var(--p-muted)' },
    { e: first,  medal: '🥇', h: 'h-24', ring: 'ring-pgold',   bg: 'var(--p-gold)' },
    { e: third,  medal: '🥉', h: 'h-12', ring: 'ring-pwarning', bg: 'var(--p-warning)' },
  ]
  return (
    <div className="flex items-end justify-center gap-4 px-4 pt-6 pb-2">
      {col.map(({ e, medal, h, ring, bg }, i) => e && (
        <div key={i} className="flex flex-col items-center gap-1.5 flex-1 max-w-[110px]">
          <span className="text-lg">{medal}</span>
          {(() => {
            const frameClass = getAvatarFrame(e.avatarFrame)?.cssClass ?? null
            const circle = (
              <div className={`w-14 h-14 rounded-full bg-elevated flex items-center justify-center text-fg text-xl font-black overflow-hidden${frameClass ? '' : ` ring-2 ${ring}`}`}>
                {(() => { const src = avatarSrcFor(e); return src
                  ? <img src={src} alt={e.name} className="w-full h-full object-cover" loading="lazy" />
                  : (e.name[0]?.toUpperCase() ?? '?') })()}
              </div>
            )
            return frameClass ? <span className={`avatar-frame ${frameClass}`}>{circle}</span> : circle
          })()}
          <p className="text-xs font-bold truncate max-w-full">{e.name}</p>
          <p className="text-sm font-black" style={{ color: bg }}>{e.score}</p>
          <div className={`w-full ${h} rounded-t-xl opacity-30`} style={{ background: bg }} />
        </div>
      ))}
    </div>
  )
}

export default function LeaderboardPage() {
  // Selector'li obuna — whole-store EMAS
  const settings = useAppStore((s) => s.settings)
  const user     = useAppStore((s) => s.user)
  const myFrame  = useAppStore((s) => s.avatarFrame)
  const navigate = useNavigate()
  const tt = useT(settings.language)

  const [tab, setTab]         = useState<'weekly' | 'all'>('weekly')
  const [entries, setEntries] = useState<Entry[] | null>(null)
  const [weekly, setWeekly]   = useState<LeagueWeekly | null>(null)
  const [error, setError]     = useState(false)

  useEffect(() => {
    // api helper initData headerini qo'shadi (production'da auth talab qiladi)
    // va o'zining 8s timeout'iga ega — alohida AbortController shart emas.
    api.getLeagueWeekly(50, user?.id).then(setWeekly).catch(() => setError(true))
    api.getLeaderboard(50, user?.id).then(setEntries).catch(() => setError(true))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const notInTop50 = entries !== null && user !== null && !entries.find((e) => e.isYou)

  // Liga zonalar: top 30% — otish, pastki 30% — tushish (dushanba cron ham shanaqa)
  const wEntries = weekly?.entries ?? []
  const n = wEntries.length
  const promoteN = useMemo(() => (n >= 2 ? Math.max(1, Math.round(n * 0.3)) : 0), [n])
  const demoteN  = useMemo(() => (n >= 3 ? Math.max(1, Math.round(n * 0.3)) : 0), [n])

  const myLeague  = weekly?.myLeague ?? 'bronze'
  const leagueCfg = LEAGUES[myLeague] ?? LEAGUES['bronze']

  return (
    <div className="pb-24">
      <div className="flex items-center gap-2 px-4 pt-4 pb-3 border-b border-line">
        <button onClick={() => goBack(navigate)} aria-label="Orqaga"
          className="text-muted hover:text-fg text-xl px-1">←</button>
        <Trophy size={20} className="text-pgold" />
        <h1 className="text-lg font-black">{tt('leaderboard')}</h1>
      </div>

      {/* Tablar: Liga / Umumiy */}
      <div className="flex gap-2 px-4 pt-3">
        {(['weekly', 'all'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-xl text-[13px] font-black transition-all ${
              tab === t ? 'bg-duo-green text-ponprimary' : 'bg-elevated text-subtle'
            }`}>
            {t === 'weekly' ? tt('leagueTab') : tt('allTimeTab')}
          </button>
        ))}
      </div>

      {error && (
        <p className="text-center text-muted text-sm py-16">{tt('leaderboardError')}</p>
      )}

      {/* ══ LIGA rejimi ══ */}
      {tab === 'weekly' && !error && (
        <>
          {!weekly && Array.from({ length: 10 }, (_, i) => <SkeletonRow key={i} />)}
          {weekly && (
            <>
              {/* Mening ligam */}
              <div className="mx-4 mt-3 card-neon flex items-center gap-3 px-4 py-3"
                style={{ borderColor: `${leagueCfg.color}66` }}>
                <Shield size={26} style={{ color: leagueCfg.color }} fill={leagueCfg.color} fillOpacity={0.3} />
                <div className="flex-1">
                  <p className="text-[13px] font-black" style={{ color: leagueCfg.color }}>
                    {tt(leagueCfg.titleKey)} {tt('leagueTab').toLowerCase()}si
                  </p>
                  <p className="text-[10.5px] text-subtle font-semibold">{tt('leagueWeekInfo')}</p>
                </div>
              </div>

              {/* Haftalik Turnir Sovrinlari */}
              <div className="mx-4 mt-3 rounded-2xl bg-surface border border-duo-purple/30 p-3.5 shadow-sm space-y-2.5">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-duo-purple/15 flex items-center justify-center text-duo-purple flex-shrink-0">
                    <Gift size={18} />
                  </div>
                  <div>
                    <h3 className="text-xs font-black text-fg flex items-center gap-1.5">
                      {tt('tournamentPrizesTitle')}
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-duo-purple/20 text-duo-purple">
                        Dushanba
                      </span>
                    </h3>
                    <p className="text-[10.5px] text-muted leading-tight mt-0.5">{tt('tournamentPrizesDesc')}</p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-xl bg-card border border-duo-yellow/30 p-2 text-center flex flex-col items-center">
                    <span className="text-base">🥇</span>
                    <span className="text-[10px] font-black text-pgold mt-0.5">1-O'rin</span>
                    <span className="text-[9px] font-bold text-muted mt-0.5 leading-tight">{tt('tournamentRank1')}</span>
                  </div>
                  <div className="rounded-xl bg-card border border-line p-2 text-center flex flex-col items-center">
                    <span className="text-base">🥈</span>
                    <span className="text-[10px] font-black text-slate-300 mt-0.5">2-O'rin</span>
                    <span className="text-[9px] font-bold text-muted mt-0.5 leading-tight">{tt('tournamentRank2')}</span>
                  </div>
                  <div className="rounded-xl bg-card border border-line p-2 text-center flex flex-col items-center">
                    <span className="text-base">🥉</span>
                    <span className="text-[10px] font-black text-amber-600 mt-0.5">3-O'rin</span>
                    <span className="text-[9px] font-bold text-muted mt-0.5 leading-tight">{tt('tournamentRank3')}</span>
                  </div>
                </div>
              </div>

              {/* Zone chiziqlari bilan reyting */}
              <div className="mt-2">
                {wEntries.map((entry, i) => {
                  const lg  = LEAGUES[entry.league] ?? LEAGUES['bronze']
                  const isPromote = promoteN > 0 && i < promoteN
                  const isDemote  = demoteN > 0 && i >= n - demoteN
                  return (
                    <div key={entry.userId}
                      className={`flex items-center gap-3 px-4 py-3 border-b border-line ${
                        isPromote ? 'bg-duo-green/10 border-l-2 border-l-duo-green' :
                        isDemote  ? 'bg-duo-red/10 border-l-2 border-l-duo-red' :
                        entry.isYou ? 'bg-duo-green/10' : ''
                      }`}>
                      <div className="w-8 flex items-center justify-center flex-shrink-0">
                        <Medal rank={entry.rank} />
                      </div>
                      <InitialAvatar name={entry.name} src={avatarSrcFor(entry)} frame={entry.avatarFrame} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate">
                          {entry.name}
                          {entry.isYou && (
                            <span className="ml-1.5 text-[10px] text-duo-blue font-bold">{tt('youLabel')}</span>
                          )}
                        </p>
                        <p className="text-[10px] font-bold" style={{ color: lg.color }}>
                          {tt(lg.titleKey)}
                        </p>
                      </div>
                      <span className="text-sm font-bold text-pprimary">{entry.score}</span>
                    </div>
                  )
                })}
              </div>

              {/* Zone tushuntirish */}
              <div className="mx-4 mt-4 flex items-center gap-3 text-[10px] font-semibold text-subtle">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm bg-duo-green" />
                  {tt('promoteZone')}
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm bg-duo-red" />
                  {tt('demoteZone')}
                </span>
              </div>
            </>
          )}
        </>
      )}

      {/* ══ UMUMIY rejim (eski all-time) ══ */}
      {tab === 'all' && !error && (
        <>
          {!entries && Array.from({ length: 10 }, (_, i) => <SkeletonRow key={i} />)}
          {entries && entries.length >= 3 && <Podium top3={entries.slice(0, 3)} />}
          {entries && (
            <div className="mt-2">
              {entries.map((entry) => (
                <div key={entry.userId}
                  className={`flex items-center gap-3 px-4 py-3 border-b border-line ${entry.isYou ? 'bg-duo-green/10' : ''}`}>
                  <div className="w-8 flex items-center justify-center flex-shrink-0">
                    <Medal rank={entry.rank} />
                  </div>
                  <InitialAvatar name={entry.name} src={avatarSrcFor(entry)} frame={entry.avatarFrame} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">
                      {entry.name}
                      {entry.isYou && (
                        <span className="ml-1.5 text-[10px] text-duo-blue font-bold">{tt('youLabel')}</span>
                      )}
                    </p>
                    {entry.streak > 0 && (
                      <p className="text-[11px] text-pwarning">🔥 {entry.streak} {tt('streakCol')}</p>
                    )}
                  </div>
                  <span className="text-sm font-bold text-pprimary">{entry.score}</span>
                </div>
              ))}
            </div>
          )}
          {notInTop50 && user && (
            <div className="mx-4 mt-4 bg-surface border border-line rounded-2xl px-4 py-3">
              <p className="text-xs text-muted mb-2">{tt('yourRank')}</p>
              <div className="flex items-center gap-3">
                <InitialAvatar name={user.firstName} src={avatarSrcFor(user)} frame={myFrame} />
                <span className="flex-1 text-sm font-semibold">{user.firstName}</span>
                <span className="text-xs text-muted">{tt('notInTop50')}</span>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
