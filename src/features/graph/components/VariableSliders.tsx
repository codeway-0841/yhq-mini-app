import { Pause, Play } from 'lucide-react'
import { useT } from '../../../shared/i18n'
import type { GraphRange } from '../useGraphStore'

interface Props {
  language: 'uz' | 'ru'
  names: string[]
  values: Record<string, number>
  ranges: Record<string, GraphRange>
  onChange: (name: string, value: number) => void
  /** Animatsiya holati (GraphPage rAF orqali boshqaradi) */
  animatingName?: string | null
  animValue?: number | null
  onToggleAnimate?: (name: string) => void
}

export default function VariableSliders({
  language, names, values, ranges, onChange, animatingName = null, animValue = null, onToggleAnimate,
}: Props) {
  const tt = useT(language)
  if (names.length === 0) return null

  return (
    <div className="rounded-2xl bg-pcard p-4 shadow-xs">
      <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-psubtle">
        {tt('graphVariables')}
      </p>
      <div className="flex flex-col gap-4">
        {names.map((name) => {
          const range = ranges[name] ?? { min: -10, max: 10, step: 0.1 }
          const animating = animatingName === name && animValue != null
          const raw = animating ? animValue : values[name] ?? 0
          const value = Math.min(range.max, Math.max(range.min, Number.isFinite(raw) ? raw : 0))
          return (
            <div key={name}>
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <span className="font-mono text-[13px] font-semibold text-pfg">{name}</span>
                <span className="flex items-center gap-1.5">
                  {onToggleAnimate && (
                    <button
                      type="button"
                      onClick={() => onToggleAnimate(name)}
                      aria-label={animating ? tt('graphPause') : tt('graphPlay')}
                      className={`grid size-7 place-items-center rounded-lg transition-colors ${
                        animating ? 'bg-pprimary text-ponprimary' : 'text-pmuted hover:bg-psurface hover:text-fg'
                      }`}
                    >
                      {animating ? <Pause size={13} strokeWidth={2} /> : <Play size={13} strokeWidth={2} />}
                    </button>
                  )}
                  <span className="rounded-lg bg-psurface px-2 py-0.5 font-mono text-[12px] tabular-nums text-pmuted">
                    {Number(value.toFixed(4))}
                  </span>
                </span>
              </div>
              <input
                type="range"
                min={range.min}
                max={range.max}
                step={range.step}
                value={value}
                onChange={(e) => onChange(name, Number(e.target.value))}
                aria-label={name}
                className="h-6 w-full cursor-pointer"
                style={{ accentColor: 'var(--p-primary)' }}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}
