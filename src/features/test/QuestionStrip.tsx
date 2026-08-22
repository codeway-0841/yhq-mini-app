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
        let cls = 'bg-psurface border-2 border-pline text-pmuted'
        if (ans === 'correct')      cls = 'bg-pprimary text-ponprimary' + (isCurrent ? ' border-2 border-pprimary ' : '')
        else if (ans === 'wrong')   cls = 'bg-pdanger text-white' + (isCurrent ? ' border-2 border-pprimary ' : '')
        // pending: offline — server tasdig'ini kutmoqda (outbox'da navbatda)
        else if (ans === 'pending') cls = 'bg-psurface border-2 border-pblue text-pblue'
        else if (isCurrent)         cls = 'bg-psurface border-2 border-pprimary text-pfg '
        return (
          <button key={i} onClick={() => onSelect(i)}
            aria-current={isCurrent ? 'true' : undefined}
            className={`flex-none w-9 h-9 rounded-lg text-[13px] font-semibold transition-all ${cls}`}>
            {i + 1}
          </button>
        )
      })}
    </div>
  )
}
