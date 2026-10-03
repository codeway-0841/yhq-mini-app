import { Star } from 'lucide-react'
import type { ReviewSummary } from '@/shared/api'

interface Props {
  summary: ReviewSummary
}

export default function RatingSummary({ summary }: Props) {
  // Barlar foizini jami sharhlar soniga nisbatan hisoblaymiz (rasmdagidek)
  const total = Math.max(summary.total, 1)

  return (
    <div className="mx-4 mt-1 bg-white dark:bg-card rounded-2xl p-4 sm:p-5 shadow-xs border border-slate-100 dark:border-white/5">
      {/* Katta raqam va yulduzlar bloki */}
      <div className="flex items-center gap-3.5 mb-3.5">
        <div className="text-[44px] font-black tracking-tight leading-none text-slate-900 dark:text-foreground">
          {summary.average.toFixed(1)}
        </div>
        <div className="flex flex-col justify-center">
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <Star
                key={star}
                size={15}
                className={
                  star <= Math.round(summary.average)
                    ? 'fill-[#c7820a] text-[#c7820a]'
                    : 'fill-slate-200 text-slate-200 dark:fill-slate-700 dark:text-slate-700'
                }
              />
            ))}
          </div>
          <span className="text-xs font-semibold text-slate-400 dark:text-muted-foreground mt-0.5">
            {summary.total} reviews
          </span>
        </div>
      </div>

      {/* 5★ dan 1★ gacha taqsimot barlari */}
      <div className="space-y-1.5">
        {[5, 4, 3, 2, 1].map((rating) => {
          const count = summary.distribution[rating] ?? 0
          const pct = Math.round((count / total) * 100)
          return (
            <div key={rating} className="flex items-center gap-2 text-xs font-semibold">
              <span className="w-5 text-right text-slate-400 dark:text-muted-foreground flex items-center justify-end gap-0.5">
                {rating} <Star size={9} className="fill-[#c7820a] text-[#c7820a]" />
              </span>
              <div className="flex-1 h-2 rounded-full bg-slate-100 dark:bg-white/5 overflow-hidden">
                <div
                  className="h-full rounded-full bg-[#c7820a] transition-all duration-700"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="w-5 text-right text-slate-400 dark:text-muted-foreground font-medium text-[11px]">
                {count}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
