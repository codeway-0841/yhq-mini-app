import { memo, useEffect, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { api } from '../../../shared/api'
import { useT } from '../../../shared/i18n'

// ── Leaderboard Preview ─────────────────────────────────────────────────────
export const LeaguePreview = memo(function LeaguePreview({ lang, onSeeAll, userId }: {
  lang: 'uz' | 'ru'; onSeeAll: () => void; userId: string | undefined
}) {
  const tt = useT(lang)
  const [entries, setEntries] = useState<{ rank: number; name: string; score: number; isYou: boolean }[]>([])

  useEffect(() => {
    let alive = true
    api.getLeaderboard(3, userId)
      .then((r) => { if (alive) setEntries(r.slice(0, 3).map((e) => ({ rank: e.rank, name: e.name, score: e.score, isYou: e.isYou }))) })
      .catch(() => {})
    return () => { alive = false }
  }, [userId])

  if (entries.length === 0) return null

  return (
    <div className="px-5 mb-4">
      <div className="flex items-center justify-between mb-2.5">
        <h3 className="text-[15px] font-bold text-pfg tracking-tight">{tt('leaderboard')}</h3>
        <button onClick={onSeeAll} className="text-[12px] font-semibold flex items-center gap-0.5 active:opacity-70"
          style={{ color: 'var(--p-link)' }}>
          {tt('seeAll')} <ChevronDown size={14} className="-rotate-90" />
        </button>
      </div>
      <div className="card-premium divide-y divide-pline">
        {entries.map((e) => (
          <div key={e.rank}
            className={`flex items-center gap-3 px-4 py-3 ${e.isYou ? 'bg-[color-mix(in_srgb,var(--p-primary)_6%,transparent)]' : ''}`}>
            <span className="w-5 text-center text-sm">
              {e.rank === 1 ? '🥇' : e.rank === 2 ? '🥈' : '🥉'}
            </span>
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold text-pblue"
              style={{ background: 'rgba(59, 130, 246, 0.12)', border: '1px solid rgba(59, 130, 246, 0.25)' }}>
              {e.name[0]?.toUpperCase() ?? '?'}
            </div>
            <span className={`flex-1 min-w-0 truncate text-[13px] font-semibold ${e.isYou ? 'text-pprimary' : 'text-pfg'}`}>
              {e.isYou ? `${e.name} (${lang === 'ru' ? 'Вы' : 'Siz'})` : e.name}
            </span>
            <span className="text-[13px] font-bold text-pfg tabular-nums">{e.score}</span>
          </div>
        ))}
      </div>
    </div>
  )
})
