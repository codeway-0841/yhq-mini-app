export function SignalIndicator({ level }: { level: 1 | 2 | 3 | 4 }) {
  const bars = [
    { height: 8, threshold: 1 },
    { height: 12, threshold: 2 },
    { height: 16, threshold: 3 },
    { height: 20, threshold: 4 },
  ]

  return (
    <div className="flex items-end gap-[3px] h-6 w-6 select-none shrink-0" aria-hidden="true">
      {bars.map((bar, i) => {
        const active = level >= bar.threshold
        return (
          <span
            key={i}
            style={{ height: `${bar.height}px` }}
            className={`w-[4px] rounded-full transition-colors duration-200 ${
              active ? 'bg-[#10B981]' : 'bg-[#D1D5DB]'
            }`}
          />
        )
      })}
    </div>
  )
}
