/** Circular pass/fail chart for the results modal. */
export default function DonutChart({ correct, total, passedLabel = "O'tdi ✓", failedLabel = "O'tmadi ✗" }: {
  correct: number; total: number; passedLabel?: string; failedLabel?: string
}) {
  const r             = 52
  const cx            = 70
  const cy            = 70
  const circumference = 2 * Math.PI * r
  const percent       = total > 0 ? Math.round((correct / total) * 100) : 0
  const correctArc    = total > 0 ? (correct / total) * circumference : 0
  const wrongArc      = circumference - correctArc
  const passed        = percent >= 90

  return (
    <div className="relative w-40 h-40 mx-auto my-4">
      <svg viewBox="0 0 140 140" className="w-full h-full -rotate-90">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--theme-line)" strokeWidth="14" />
        {wrongArc > 0 && (
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="#ff4b4b" strokeWidth="14"
            strokeDasharray={`${wrongArc} ${circumference}`}
            strokeDashoffset={-correctArc} />
        )}
        {correctArc > 0 && (
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="#58cc02" strokeWidth="14"
            strokeDasharray={`${correctArc} ${circumference}`}
            strokeDashoffset={0} />
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-4xl font-black text-white">{percent}%</span>
        <span className={`text-sm font-bold mt-0.5 ${passed ? 'text-green-400' : 'text-red-400'}`}>
          {passed ? passedLabel : failedLabel}
        </span>
      </div>
    </div>
  )
}
