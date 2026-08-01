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
        let bg = 'bg-elevated border-2 border-line text-muted'
        if (ans === 'correct')    bg = 'bg-duo-green border-duo-green text-white'
        else if (ans === 'wrong') bg = 'bg-duo-red border-duo-red text-white'
        const ring = isCurrent && ans !== 'correct' && ans !== 'wrong'
          ? 'border-duo-blue text-fg' : ''
        return (
          <button key={i} onClick={() => onSelect(i)}
            className={`flex-none w-9 h-9 rounded-lg text-[13px] font-black transition-all ${bg} ${ring}`}>
            {i + 1}
          </button>
        )
      })}
    </div>
  )
}
