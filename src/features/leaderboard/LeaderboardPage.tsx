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
import { Trophy, Shield, Gift, History, ChevronLeft, Award, Flame } from 'lucide-react'
import { useAppStore } from '../../shared/store/useAppStore'
import { useT } from '../../shared/i18n'
import { api, avatarSrcFor, type LeaderboardEntry as Entry, type LeagueWeekly, type TournamentSeason } from '../../shared/api'
import { getAvatarFrame } from '../../shared/config/avatar-frames'

/** 'YYYY-MM-DD' (hafta dushanbasi) → "10.08–16.08" (dushanba–yakshanba) */
function fmtWeekRange(periodKey: string): string {
  const d = new Date(`${periodKey}T00:00:00Z`)
  if (Number.isNaN(d.getTime())) return periodKey
  const end = new Date(d.getTime() + 6 * 86_400_000)
  const fmt = (x: Date) =>
    `${String(x.getUTCDate()).padStart(2, '0')}.${String(x.getUTCMonth() + 1).padStart(2, '0')}`
  return `${fmt(d)}–${fmt(end)}`
}

const LEAGUES: Record<string, { color: string; titleKey: 'leagueBronze' | 'leagueSilver' | 'leagueGold' | 'leaguePlat' }> = {
  bronze:   { color: 'var(--p-warning)', titleKey: 'leagueBronze' },
  silver:   { color: 'var(--p-muted)',   titleKey: 'leagueSilver' },
  gold:     { color: 'var(--p-gold)',    titleKey: 'leagueGold' },
  platinum: { color: 'var(--p-blue)',    titleKey: 'leaguePlat' },
}

function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-pline animate-pulse">
      <div className="w-6 h-4 bg-psurface rounded" />
      <div className="w-8 h-8 rounded-full bg-psurface" />
      <div className="flex-1 h-4 bg-psurface rounded" />
      <div className="w-10 h-4 bg-psurface rounded" />
    </div>
  )
}

/** Reyting o'rni — v3: 🥇🥈🥉 emoji o'rniga rang kodlangan tabular raqam.
 *  Top-3 aksent/oltin/kumush/bronza tuslarida, qolgani neytral. */
function Medal({ rank }: { rank: number }) {
  const tone = rank === 1 ? 'text-pgold' : rank === 2 ? 'text-psubtle' : rank === 3 ? 'text-[#b8763e]' : 'text-pmuted'
  return <span className={`w-6 text-center text-[13px] font-semibold tabular-nums ${tone}`}>{rank}</span>
}

function InitialAvatar({ name, src, frame }: { name: string; src?: string | null; frame?: string | null }) {
  const frameClass = getAvatarFrame(frame)?.cssClass ?? null
  const inner = (
    <div className={`w-8 h-8 rounded-full bg-psurface flex items-center justify-center text-pmuted text-xs font-semibold flex-shrink-0 overflow-hidden${frameClass ? '' : ' border border-pline'}`}>
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
    { e: second, rank: 2, h: 'h-16', ring: 'ring-pmuted',   bg: 'var(--p-muted)' },
    { e: first,  rank: 1, h: 'h-24', ring: 'ring-pgold',    bg: 'var(--p-gold)' },
    { e: third,  rank: 3, h: 'h-12', ring: 'ring-pwarning', bg: 'var(--p-warning)' },
  ]
  return (
    <div className="flex items-end justify-center gap-4 px-4 pt-6 pb-2">
      {col.map(({ e, rank, h, ring, bg }, i) => e && (
        <div key={i} className="flex flex-col items-center gap-1.5 flex-1 max-w-[110px]">
          {rank === 1
            ? <Trophy size={18} strokeWidth={1.75} style={{ color: bg }} />
            : <Award size={18} strokeWidth={1.75} style={{ color: bg }} />}
          {(() => {
            const frameClass = getAvatarFrame(e.avatarFrame)?.cssClass ?? null
            const circle = (
              <div className={`w-14 h-14 rounded-full bg-psurface flex items-center justify-center text-pfg text-xl font-semibold overflow-hidden${frameClass ? '' : ` ring-2 ${ring}`}`}>
                {(() => { const src = avatarSrcFor(e); return src
                  ? <img src={src} alt={e.name} className="w-full h-full object-cover" loading="lazy" />
                  : (e.name[0]?.toUpperCase() ?? '?') })()}
              </div>
            )
            return frameClass ? <span className={`avatar-frame ${frameClass}`}>{circle}</span> : circle
          })()}
          <p className="text-xs font-semibold truncate max-w-full">{e.name}</p>
          <p className="text-sm font-semibold" style={{ color: bg }}>{e.score}</p>
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
  // Chempionlar tarixi (#47) — xato bo'lsa butun sahifani yemaydi (jimgina yashirish)
  const [seasons, setSeasons] = useState<TournamentSeason[] | null>(null)
  const [error, setError]     = useState(false)

  useEffect(() => {
    // api helper initData headerini qo'shadi (production'da auth talab qiladi)
    // va o'zining 8s timeout'iga ega — alohida AbortController shart emas.
    api.getLeagueWeekly(50, user?.id).then(setWeekly).catch(() => setError(true))
    api.getLeaderboard(50, user?.id).then(setEntries).catch(() => setError(true))
    api.getTournamentHistory(6, user?.id).then((r) => setSeasons(r.seasons)).catch(() => {})
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
      <div className="flex items-center gap-2 px-4 pt-4 pb-3 border-b border-pline">
        <button onClick={() => goBack(navigate)} aria-label="Orqaga"
          className="grid size-11 place-items-center rounded-control text-pmuted transition-colors duration-[120ms] ease-out hover:bg-psurface hover:text-pfg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pprimary">
          <ChevronLeft size={20} strokeWidth={1.75} />
        </button>
        <Trophy size={20} className="text-pgold" />
        <h1 className="text-lg font-semibold">{tt('leaderboard')}</h1>
      </div>

      {/* Tablar: Liga / Umumiy */}
      <div className="flex gap-2 px-4 pt-3">
        {(['weekly', 'all'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-control text-[13px] font-semibold transition-all ${
              tab === t ? 'bg-pprimary text-ponprimary' : 'bg-psurface text-psubtle'
            }`}>
            {t === 'weekly' ? tt('leagueTab') : tt('allTimeTab')}
          </button>
        ))}
      </div>

      {error && (
        <p className="text-center text-pmuted text-sm py-16">{tt('leaderboardError')}</p>
      )}

      {/* ══ LIGA rejimi ══ */}
      {tab === 'weekly' && !error && (
        <>
          {!weekly && Array.from({ length: 10 }, (_, i) => <SkeletonRow key={i} />)}
          {weekly && (
            <>
              {/* Mening ligam */}
              <div className="mx-4 mt-3 rounded-container border border-pline bg-pcard flex items-center gap-3 px-4 py-3"
                style={{ borderColor: `${leagueCfg.color}66` }}>
                <Shield size={26} style={{ color: leagueCfg.color }} fill={leagueCfg.color} fillOpacity={0.3} />
                <div className="flex-1">
                  <p className="text-[13px] font-semibold" style={{ color: leagueCfg.color }}>
                    {tt(leagueCfg.titleKey)} {tt('leagueTab').toLowerCase()}si
                  </p>
                  <p className="text-[10.5px] text-psubtle font-semibold">{tt('leagueWeekInfo')}</p>
                </div>
              </div>

              {/* Haftalik Turnir Sovrinlari */}
              <div className="mx-4 mt-3 rounded-container bg-psurface border border-ppurple/30 p-3.5 shadow-sm space-y-2.5">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-control bg-ppurple/15 flex items-center justify-center text-ppurple flex-shrink-0">
                    <Gift size={18} />
                  </div>
                  <div>
                    <h3 className="text-xs font-semibold text-pfg flex items-center gap-1.5">
                      {tt('tournamentPrizesTitle')}
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-ppurple/20 text-ppurple">
                        Dushanba
                      </span>
                    </h3>
                    <p className="text-[10.5px] text-pmuted leading-tight mt-0.5">{tt('tournamentPrizesDesc')}</p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-control bg-card border border-pwarning/30 p-2 text-center flex flex-col items-center">
                    <Trophy size={16} strokeWidth={1.75} className="text-pgold" />
                    <span className="text-[10px] font-semibold text-pgold mt-0.5">1-O'rin</span>
                    <span className="text-[9px] font-semibold text-pmuted mt-0.5 leading-tight">{tt('tournamentRank1')}</span>
                  </div>
                  <div className="rounded-control bg-card border border-pline p-2 text-center flex flex-col items-center">
                    <Award size={16} strokeWidth={1.75} className="text-psubtle" />
                    <span className="text-[10px] font-semibold text-psubtle mt-0.5">2-O'rin</span>
                    <span className="text-[9px] font-semibold text-pmuted mt-0.5 leading-tight">{tt('tournamentRank2')}</span>
                  </div>
                  <div className="rounded-control bg-card border border-pline p-2 text-center flex flex-col items-center">
                    <Award size={16} strokeWidth={1.75} className="text-[#b8763e]" />
                    <span className="text-[10px] font-semibold text-[#b8763e] mt-0.5">3-O'rin</span>
                    <span className="text-[9px] font-semibold text-pmuted mt-0.5 leading-tight">{tt('tournamentRank3')}</span>
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
                      className={`flex items-center gap-3 px-4 py-3 border-b border-pline ${
                        isPromote ? 'bg-pprimary/10 border-l-2 border-l-pprimary' :
                        isDemote  ? 'bg-pdanger/10 border-l-2 border-l-pdanger' :
                        entry.isYou ? 'bg-pprimary/10' : ''
                      }`}>
                      <div className="w-8 flex items-center justify-center flex-shrink-0">
                        <Medal rank={entry.rank} />
                      </div>
                      <InitialAvatar name={entry.name} src={avatarSrcFor(entry)} frame={entry.avatarFrame} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate">
                          {entry.name}
                          {entry.isYou && (
                            <span className="ml-1.5 text-[10px] text-pblue font-semibold">{tt('youLabel')}</span>
                          )}
                        </p>
                        <p className="text-[10px] font-semibold" style={{ color: lg.color }}>
                          {tt(lg.titleKey)}
                        </p>
                      </div>
                      <span className="text-sm font-semibold text-pprimary">{entry.score}</span>
                    </div>
                  )
                })}
              </div>

              {/* Zone tushuntirish */}
              <div className="mx-4 mt-4 flex items-center gap-3 text-[10px] font-semibold text-psubtle">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm bg-pprimary" />
                  {tt('promoteZone')}
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm bg-pdanger" />
                  {tt('demoteZone')}
                </span>
              </div>

              {/* Chempionlar tarixi (#47) — o'tgan haftalik turnir g'oliblari */}
              {seasons !== null && (
                <div className="mx-4 mt-4 rounded-container bg-psurface border border-pline p-3.5 shadow-sm space-y-2.5">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-control bg-psurface flex items-center justify-center text-psubtle flex-shrink-0">
                      <History size={18} />
                    </div>
                    <h3 className="text-xs font-semibold text-pfg">{tt('tournamentHistoryTitle')}</h3>
                  </div>

                  {seasons.length === 0 && (
                    <p className="text-[11px] text-pmuted font-semibold">{tt('noWinnersYet')}</p>
                  )}

                  {seasons.map((s, si) => (
                    <div key={s.periodKey} className={si > 0 ? 'pt-2.5 border-t border-pline' : ''}>
                      <p className="text-[10px] font-semibold text-pmuted mb-1">
                        {si === 0 ? `${tt('pastWinnersTitle')} · ` : ''}{fmtWeekRange(s.periodKey)}
                      </p>
                      {s.winners.map((w) => (
                        <div key={w.rank}
                          className={`flex items-center gap-2.5 py-1.5 ${w.isYou ? 'rounded-lg bg-pprimary/10 px-2 -mx-2' : ''}`}>
                          <div className="w-6 flex items-center justify-center flex-shrink-0">
                            <Medal rank={w.rank} />
                          </div>
                          <InitialAvatar name={w.name} src={avatarSrcFor(w)} frame={w.avatarFrame} />
                          <p className="flex-1 min-w-0 text-xs font-semibold truncate">
                            {w.name}
                            {w.isYou && (
                              <span className="ml-1.5 text-[10px] text-pblue font-semibold">{tt('youLabel')}</span>
                            )}
                          </p>
                          <span className="text-xs font-semibold text-pprimary flex-shrink-0">{w.score}</span>
                          <span className="text-[10px] font-semibold text-pgold flex-shrink-0 inline-flex items-center gap-1">
                            <Gift size={11} strokeWidth={1.75} />
                            {w.prizeDays} {tt('premiumDaysShort')}
                          </span>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}
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
                  className={`flex items-center gap-3 px-4 py-3 border-b border-pline ${entry.isYou ? 'bg-pprimary/10' : ''}`}>
                  <div className="w-8 flex items-center justify-center flex-shrink-0">
                    <Medal rank={entry.rank} />
                  </div>
                  <InitialAvatar name={entry.name} src={avatarSrcFor(entry)} frame={entry.avatarFrame} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">
                      {entry.name}
                      {entry.isYou && (
                        <span className="ml-1.5 text-[10px] text-pblue font-semibold">{tt('youLabel')}</span>
                      )}
                    </p>
                    {entry.streak > 0 && (
                      <p className="flex items-center gap-1 text-[11px] text-pwarning">
                        <Flame size={11} strokeWidth={1.75} />
                        {entry.streak} {tt('streakCol')}
                      </p>
                    )}
                  </div>
                  <span className="text-sm font-semibold text-pprimary">{entry.score}</span>
                </div>
              ))}
            </div>
          )}
          {notInTop50 && user && (
            <div className="mx-4 mt-4 bg-psurface border border-pline rounded-container px-4 py-3">
              <p className="text-xs text-pmuted mb-2">{tt('yourRank')}</p>
              <div className="flex items-center gap-3">
                <InitialAvatar name={user.firstName} src={avatarSrcFor(user)} frame={myFrame} />
                <span className="flex-1 text-sm font-semibold">{user.firstName}</span>
                <span className="text-xs text-pmuted">{tt('notInTop50')}</span>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
