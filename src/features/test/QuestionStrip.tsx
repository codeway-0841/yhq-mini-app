import { useEffect, useRef } from 'react'

const MAX_WINDOW_SIZE = 61
const HALF_WINDOW = 30

/** Horizontal numbered strip showing per-question answer state with windowing. */
export default function QuestionStrip({ total, current, answers, onSelect }: {
  total: number; current: number
  answers: (string | null)[]
  onSelect: (i: number) => void
}) {
  const stripRef = useRef<HTMLDivElement>(null)

  const windowSize = Math.min(total, MAX_WINDOW_SIZE)
  const start = total <= MAX_WINDOW_SIZE
    ? 0
    : Math.max(0, Math.min(total - MAX_WINDOW_SIZE, current - HALF_WINDOW))
  const end = Math.min(total, start + windowSize)

  useEffect(() => {
    const localIndex = current - start
    const el = stripRef.current?.children[localIndex]
    if (el instanceof HTMLElement && typeof el.scrollIntoView === 'function') {
      el.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
    }
  }, [current, start])

  return (
    <div ref={stripRef}
      className="flex gap-1.5 overflow-x-auto px-4 py-2 [&::-webkit-scrollbar]:hidden"
      style={{ scrollbarWidth: 'none' }}>
      {Array.from({ length: end - start }, (_: unknown, idx: number) => {
        const i         = start + idx
        const ans       = answers[i]
        const isCurrent = i === current
        // Joriy savol HAR QANDAY holatda ko'k border bilan ajratiladi
        // (javoblangan: to'liq rang + ko'k border · javobsiz: kulrang + ko'k border)
        let cls = 'bg-psurface text-pmuted'
        if (ans === 'correct')      cls = 'bg-pprimary text-ponprimary shadow-xs' + (isCurrent ? ' ring-2 ring-offset-2 ring-offset-pcanvas ring-pprimary font-bold' : '')
        else if (ans === 'wrong')   cls = 'bg-pdanger text-white shadow-xs' + (isCurrent ? ' ring-2 ring-offset-2 ring-offset-pcanvas ring-pprimary font-bold' : '')
        // pending: offline — server tasdig'ini kutmoqda (outbox'da navbatda)
        else if (ans === 'pending') cls = 'bg-psurface text-pblue ring-2 ring-pblue'
        else if (isCurrent)         cls = 'bg-psurface text-pprimary ring-2 ring-pprimary shadow-xs font-bold'
        return (
          <button key={i} onClick={() => onSelect(i)}
            aria-current={isCurrent ? 'true' : undefined}
            className={`flex-none w-9 h-9 rounded-xl text-[13px] font-semibold transition-all ${cls}`}>
            {i + 1}
          </button>
        )
      })}
    </div>
  )
}

