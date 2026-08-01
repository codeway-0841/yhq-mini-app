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
        let bg = 'bg-elevated border border-line'
        if (ans === 'correct')    bg = 'bg-green-600 border-green-500'
        else if (ans === 'wrong') bg = 'bg-red-700 border-red-600'
        const ring = isCurrent ? 'ring-2 ring-duo-blue ring-offset-1 ring-offset-canvas' : ''
        return (
          <button key={i} onClick={() => onSelect(i)}
            className={`flex-none w-8 h-8 rounded-lg text-xs font-bold transition-all ${bg} ${ring}`}>
            {i + 1}
          </button>
        )
      })}
    </div>
  )
}
