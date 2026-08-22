import { memo, useEffect, useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { api } from '../../../shared/api'
import { useT } from '../../../shared/i18n'
import { Skeleton } from '../../../shared/components/ui/skeleton'
import { cn } from '../../../shared/lib/cn'

// ── Leaderboard Preview ─────────────────────────────────────────────────────
export const LeaguePreview = memo(function LeaguePreview({ lang, onSeeAll, userId }: {
  lang: 'uz' | 'ru'; onSeeAll: () => void; userId: string | undefined
}) {
  const tt = useT(lang)
  const [entries, setEntries] = useState<{ rank: number; name: string; score: number; isYou: boolean }[]>([])
  // "Yuklanmoqda" va "bo'sh" holatlari AJRATILDI: ilgari ikkalasi ham null
  // qaytarardi va ma'lumot kelganda sahifa sakrardi (layout shift).
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    api.getLeaderboard(3, userId)
      .then((r) => { if (alive) setEntries(r.slice(0, 3).map((e) => ({ rank: e.rank, name: e.name, score: e.score, isYou: e.isYou }))) })
      .catch(() => {})
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [userId])

  if (loading) {
    return (
      <div className="mb-6 px-5">
        <div className="mb-2.5 flex items-center justify-between">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-3 w-16" />
        </div>
        <div className="divide-y divide-pline overflow-hidden rounded-container border border-pline bg-pcard">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3">
              <Skeleton className="size-4 shrink-0" />
              <Skeleton className="size-8 shrink-0 rounded-[10px]" />
              <Skeleton className="h-3 flex-1" />
              <Skeleton className="h-3 w-8 shrink-0" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (entries.length === 0) return null

  return (
    <div className="mb-6 px-5">
      <div className="mb-2.5 flex items-center justify-between">
        <h3 className="font-display text-[16px] font-semibold tracking-[-0.015em] text-pfg">{tt('leaderboard')}</h3>
        <button
          onClick={onSeeAll}
          className="flex items-center gap-0.5 rounded-control text-[13px] font-semibold text-pprimary transition-opacity active:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pprimary"
        >
          {tt('seeAll')} <ChevronRight size={14} strokeWidth={1.75} />
        </button>
      </div>
      <div className="divide-y divide-pline overflow-hidden rounded-container border border-pline bg-pcard">
        {entries.map((e) => (
          <div
            key={e.rank}
            className={cn('flex items-center gap-3 px-4 py-3', e.isYou && 'bg-pwash')}
          >
            {/* v3: 🥇🥈🥉 emoji O'RNIGA tabular o'rin raqami — ro'yxatning
                qolgan qismi bilan bir xil o'qiladi va lokalizatsiyaga bog'liq emas */}
            <span className="w-5 shrink-0 text-center text-[13px] font-semibold tabular-nums text-psubtle">
              {e.rank}
            </span>
            <div className="flex size-8 shrink-0 items-center justify-center rounded-[10px] border border-pline bg-psurface text-[11px] font-bold text-pmuted">
              {e.name[0]?.toUpperCase() ?? '?'}
            </div>
            <span className={cn('min-w-0 flex-1 truncate text-[13px] font-semibold', e.isYou ? 'text-pprimary' : 'text-pfg')}>
              {e.isYou ? `${e.name} (${lang === 'ru' ? 'Вы' : 'Siz'})` : e.name}
            </span>
            <span className="text-[13px] font-semibold tabular-nums text-pfg">{e.score}</span>
          </div>
        ))}
      </div>
    </div>
  )
})
