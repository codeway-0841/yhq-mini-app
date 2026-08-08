export type Option = { id: string; text: string }

/** Single answer option with correct/wrong neon glow highlight after answering (v1.1). */
export default function OptionButton({ option, state, onSelect, answered, fontSize }: {
  option: Option
  state: 'correct' | 'wrong' | 'pending' | 'default'
  onSelect: () => void
  answered: boolean
  fontSize: string
}) {
  const base = 'w-full text-left rounded-2xl border-2 p-3 transition-all'
  let style  = 'btn-3d-ghost font-semibold border-transparent hover:border-duo-green/50'
  let chip   = 'bg-elevated border-line text-subtle'
  let icon   = null
  let glow: string | undefined

  if (state === 'correct') {
    style = 'bg-duo-green/15 border-duo-green text-fg'
    chip  = 'bg-duo-green border-duo-green text-ponprimary'
    icon  = <span className="text-duo-green font-black text-lg">✓</span>
    glow  = '0 0 20px var(--p-glow)'
  } else if (state === 'wrong') {
    style = 'bg-duo-red/15 border-duo-red text-duo-red'
    chip  = 'bg-duo-red border-duo-red text-white'
    icon  = <span className="text-duo-red font-black text-lg">✗</span>
    glow  = '0 0 20px rgba(239, 68, 68, 0.30)'
  } else if (state === 'pending') {
    // Server javobi kutilmoqda (yoki offline — keyin tasdiqlanadi)
    style = 'bg-duo-blue/10 border-duo-blue/60 text-fg animate-pulse'
    chip  = 'bg-duo-blue/20 border-duo-blue text-duo-blue'
  }

  const fontClass =
    fontSize === 'small' ? 'text-sm' : fontSize === 'large' ? 'text-lg' : 'text-base'

  return (
    <button className={`${base} ${style} mb-2`} style={glow ? { boxShadow: glow } : undefined}
      onClick={onSelect} disabled={answered}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span className={`flex-none w-8 h-8 rounded-lg border flex items-center justify-center text-xs font-black ${chip}`}>
            {option.id}
          </span>
          <span className={fontClass}>{option.text}</span>
        </div>
        {icon}
      </div>
    </button>
  )
}
