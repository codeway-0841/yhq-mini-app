import { useT } from '../../../shared/i18n'

const TOKENS = [
  'sin(', 'cos(', 'tan(', 'sqrt(', 'ln(', 'abs(', 'log(',
  '^', '(', ')', 'π', 'θ', 'ω', 'e', 'x', 't', '+', '-', '*', '/',
]

interface Props {
  language: 'uz' | 'ru'
  onInsert: (token: string) => void
}

export default function TokenPad({ language, onInsert }: Props) {
  const tt = useT(language)
  return (
    <div
      className="flex gap-1.5 overflow-x-auto pb-0.5 [&::-webkit-scrollbar]:hidden"
      style={{ scrollbarWidth: 'none' }}
      aria-label={tt('graphTokenPad')}
    >
      {TOKENS.map((token) => (
        <button
          key={token}
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onInsert(token)}
          className="min-h-11 flex-shrink-0 rounded-xl bg-psurface px-3 font-mono text-[13px] font-semibold text-pmuted transition-colors hover:text-pfg active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pprimary"
        >
          {token}
        </button>
      ))}
    </div>
  )
}
