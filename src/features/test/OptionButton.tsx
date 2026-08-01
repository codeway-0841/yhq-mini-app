import { Volume2, Video, BookOpen, MessageCircle } from 'lucide-react'
import { useAppStore } from '../../shared/store/useAppStore'
import { useT } from '../../shared/i18n'

export type Option = { id: string; text: string }

/** Single answer option with correct/wrong highlight after answering. */
export default function OptionButton({ option, state, onSelect, answered, fontSize }: {
  option: Option
  state: 'correct' | 'wrong' | 'default'
  onSelect: () => void
  answered: boolean
  fontSize: string
}) {
  const tt = useT(useAppStore((s) => s.settings.language))

  const base = 'w-full text-left rounded-2xl border-2 p-3 transition-all'
  let style  = 'btn-3d-ghost font-semibold'
  let icon   = null

  if (state === 'correct') {
    style = 'bg-duo-green/15 border-duo-green text-fg'
    icon  = <span className="text-duo-green font-black text-lg">✓</span>
  } else if (state === 'wrong') {
    style = 'bg-duo-red/15 border-duo-red text-fg'
    icon  = <span className="text-duo-red font-black text-lg">✗</span>
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
            { icon: Volume2,       label: tt('voiceLesson') },
            { icon: Video,         label: tt('videoLesson') },
            { icon: BookOpen,      label: tt('ruleBook')    },
            { icon: MessageCircle, label: tt('discuss')     },
          ].map(({ icon: Icon, label }) => (
            <button key={label} disabled title={tt('comingSoon')}
              className="flex items-center gap-1 text-[11px] text-muted/60 bg-elevated px-2 py-1 rounded-lg cursor-not-allowed">
              <Icon size={12} />
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
