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
        let cls = 'bg-elevated border-2 border-line text-muted'
        if (ans === 'correct')      cls = 'bg-duo-green text-ponprimary' + (isCurrent ? ' border-2 border-neon-blue shadow-[0_0_10px_rgba(59,130,246,0.5)]' : '')
        else if (ans === 'wrong')   cls = 'bg-duo-red text-white' + (isCurrent ? ' border-2 border-neon-blue shadow-[0_0_10px_rgba(59,130,246,0.5)]' : '')
        else if (isCurrent)         cls = 'bg-elevated border-2 border-neon-blue text-fg shadow-[0_0_10px_rgba(59,130,246,0.5)]'
        return (
          <button key={i} onClick={() => onSelect(i)}
            aria-current={isCurrent ? 'true' : undefined}
            className={`flex-none w-9 h-9 rounded-lg text-[13px] font-black transition-all ${cls}`}>
            {i + 1}
          </button>
        )
      })}
    </div>
  )
}
