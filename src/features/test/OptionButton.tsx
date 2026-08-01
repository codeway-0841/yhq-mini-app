export type Option = { id: string; text: string }

/** Single answer option with correct/wrong highlight after answering. */
export default function OptionButton({ option, state, onSelect, answered, fontSize }: {
  option: Option
  state: 'correct' | 'wrong' | 'default'
  onSelect: () => void
  answered: boolean
  fontSize: string
}) {
  const base = 'w-full text-left rounded-2xl border-2 p-3 transition-all'
  let style  = 'btn-3d-ghost font-semibold'
  let chip   = 'bg-elevated border-line text-subtle'
  let icon   = null

  if (state === 'correct') {
    style = 'bg-duo-green/15 border-duo-green text-fg'
    chip  = 'bg-duo-green border-duo-green text-white'
    icon  = <span className="text-duo-green font-black text-lg">✓</span>
  } else if (state === 'wrong') {
    style = 'bg-duo-red/15 border-duo-red text-duo-red'
    chip  = 'bg-duo-red border-duo-red text-white'
    icon  = <span className="text-duo-red font-black text-lg">✗</span>
  }

  const fontClass =
    fontSize === 'small' ? 'text-sm' : fontSize === 'large' ? 'text-lg' : 'text-base'

  return (
    <button className={`${base} ${style} mb-2`} onClick={onSelect} disabled={answered}>
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
