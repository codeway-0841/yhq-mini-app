import { Volume2, Video, BookOpen, MessageCircle } from 'lucide-react'

export type Option = { id: string; text: string }

/** Single answer option with correct/wrong highlight after answering. */
export default function OptionButton({ option, state, onSelect, answered, fontSize }: {
  option: Option
  state: 'correct' | 'wrong' | 'default'
  onSelect: () => void
  answered: boolean
  fontSize: string
}) {
  const base = 'w-full text-left rounded-xl border p-3 transition-all active:scale-[0.98]'
  let style  = 'bg-[#161b22] border-[#30363d] text-[#e6edf3]'
  let icon   = null

  if (state === 'correct') {
    style = 'bg-green-900/60 border-green-500 text-white'
    icon  = <span className="text-green-400 font-bold">✓</span>
  } else if (state === 'wrong') {
    style = 'bg-red-900/60 border-red-500 text-white'
    icon  = <span className="text-red-400 font-bold">✗</span>
  }

  const fontClass =
    fontSize === 'small' ? 'text-sm' : fontSize === 'large' ? 'text-lg' : 'text-base'

  return (
    <div className="mb-2">
      <button className={`${base} ${style}`} onClick={onSelect} disabled={answered}>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <span className="flex-none w-7 h-7 rounded-full border border-current/40 flex items-center justify-center text-xs font-bold opacity-70">
              {option.id}
            </span>
            <span className={fontClass}>{option.text}</span>
          </div>
          {icon}
        </div>
      </button>

      {answered && (state === 'correct' || state === 'wrong') && (
        <div className="flex gap-2 mt-1 px-1">
          {[
            { icon: Volume2,       label: 'Ovozli'   },
            { icon: Video,         label: 'Video'    },
            { icon: BookOpen,      label: 'Qoidasi'  },
            { icon: MessageCircle, label: 'Muhokama' },
          ].map(({ icon: Icon, label }) => (
            <button key={label} disabled title="Tez kunda"
              className="flex items-center gap-1 text-[11px] text-[#8b949e]/60 bg-[#21262d] px-2 py-1 rounded-lg cursor-not-allowed">
              <Icon size={12} />
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
