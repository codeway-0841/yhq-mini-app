import { useEffect, useRef } from 'react'

/** Horizontal numbered strip showing per-question answer state. */
export default function QuestionStrip({ total, current, answers, onSelect }: {
  total: number; current: number
  answers: (string | null)[]
  onSelect: (i: number) => void
}) {
  const stripRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = stripRef.current?.children[current]
    el?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
  }, [current])

  return (
    <div ref={stripRef}
      className="flex gap-1.5 overflow-x-auto px-4 py-2 [&::-webkit-scrollbar]:hidden"
      style={{ scrollbarWidth: 'none' }}>
      {Array.from({ length: total }, (_: unknown, i: number) => {
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
