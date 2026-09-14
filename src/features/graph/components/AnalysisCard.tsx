/**
 * Tahlil paneli — hosila, urinma va integral (Riemann) boshqaruvi.
 * Faqat ko'rsatish/qaytarish; hisob-kitob GraphPage'da (math core orqali).
 */
import { Pause, Play } from 'lucide-react'
import { Switch } from '../../../shared/components/ui/switch'
import { useT } from '../../../shared/i18n'
import { curveColor } from '../curve-colors'

export interface AnalysisOption {
  id: string
  label: string
  colorIdx: number
}

interface Props {
  language: 'uz' | 'ru'
  options: AnalysisOption[]
  selectedId: string | null
  onSelect: (id: string) => void

  derivativeOn: boolean
  onDerivative: (v: boolean) => void

  tangentOn: boolean
  onTangent: (v: boolean) => void
  x0: number
  onX0: (v: number) => void
  fValue: number
  slopeValue: number

  integralOn: boolean
  onIntegral: (v: boolean) => void
  a: number
  b: number
  onA: (v: number) => void
  onB: (v: number) => void
  rects: number
  onRects: (v: number) => void
  area: number
  riemannSum: number

  pointPlaying: boolean
  onTogglePoint: () => void

  markersOn: boolean
  onMarkers: (v: boolean) => void
  rootCount: number
  extremaCount: number
  crossCount: number
}

function fmt(v: number): string {
  if (!Number.isFinite(v)) return '—'
  return String(Number(v.toFixed(4)))
}

function SliderRow({ label, value, min, max, step, onChange, display }: {
  label: string
  value: number
  min: number
  max: number
  step: number
  onChange: (v: number) => void
  display: string
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-12 shrink-0 font-mono text-[12px] text-pmuted">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={Math.min(max, Math.max(min, Number.isFinite(value) ? value : min))}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={label}
        className="h-6 min-w-0 flex-1 cursor-pointer"
        style={{ accentColor: 'var(--p-primary)' }}
      />
      <span className="w-14 shrink-0 text-right font-mono text-[12px] tabular-nums text-pfg">{display}</span>
    </div>
  )
}

function ToggleRow({ label, checked, onChange }: {
  label: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[13px] font-semibold text-pfg">{label}</span>
      <Switch checked={checked} onCheckedChange={onChange} aria-label={label} />
    </div>
  )
}

export default function AnalysisCard({
  language, options, selectedId, onSelect,
  derivativeOn, onDerivative,
  tangentOn, onTangent, x0, onX0, fValue, slopeValue,
  integralOn, onIntegral, a, b, onA, onB, rects, onRects, area, riemannSum,
  pointPlaying, onTogglePoint,
  markersOn, onMarkers, rootCount, extremaCount, crossCount,
}: Props) {
  const tt = useT(language)

  return (
    <div className="rounded-2xl bg-pcard p-4 shadow-xs">
      <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-psubtle">
        {tt('graphAnalysis')}
      </p>

      {options.length > 0 && (
        <div className="mb-3 flex items-center gap-1.5 overflow-x-auto pb-0.5 [&::-webkit-scrollbar]:hidden" style={{ scrollbarWidth: 'none' }}>
          <span className="shrink-0 pr-1 text-[11px] text-psubtle">{tt('graphAnalysisFor')}</span>
          {options.map((o) => {
            const active = o.id === selectedId
            return (
              <button
                key={o.id}
                type="button"
                onClick={() => onSelect(o.id)}
                className={`flex h-8 shrink-0 items-center gap-1.5 rounded-xl px-2.5 font-mono text-[12px] transition-colors ${
                  active ? 'bg-psurface text-pfg' : 'text-psubtle hover:text-pfg'
                }`}
              >
                <span className="size-3 rounded-full" style={{ background: curveColor(o.colorIdx) }} />
                <span className="max-w-[120px] truncate">{o.label}</span>
              </button>
            )
          })}
        </div>
      )}

      <div className="flex flex-col gap-3">
        <ToggleRow label={tt('graphDerivative')} checked={derivativeOn} onChange={onDerivative} />

        <div>
          <ToggleRow label={tt('graphTangent')} checked={tangentOn} onChange={onTangent} />
          {tangentOn && (
            <div className="mt-2 flex flex-col gap-1.5">
              <SliderRow label="x₀" value={x0} min={-10} max={10} step={0.1} onChange={onX0} display={fmt(x0)} />
              <p className="text-[11.5px] text-pmuted">
                f(x₀) = <span className="font-mono tabular-nums text-pfg">{fmt(fValue)}</span>
                {' · '}
                f′(x₀) = <span className="font-mono tabular-nums text-pfg">{fmt(slopeValue)}</span>
              </p>
              <button
                type="button"
                onClick={onTogglePoint}
                className="mt-0.5 flex h-9 items-center justify-center gap-2 rounded-xl bg-psurface text-[12.5px] font-semibold text-pmuted transition-colors hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pprimary"
              >
                {pointPlaying ? <Pause size={14} strokeWidth={2} /> : <Play size={14} strokeWidth={2} />}
                {tt('graphPointAnim')}
              </button>
            </div>
          )}
        </div>

        <div>
          <ToggleRow label={tt('graphMarkers')} checked={markersOn} onChange={onMarkers} />
          {markersOn && (
            <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-pmuted">
              <span className="inline-flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-psuccess" />
                {tt('graphRoots')}: <span className="font-mono tabular-nums text-pfg">{rootCount}</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-pwarning" />
                {tt('graphExtrema')}: <span className="font-mono tabular-nums text-pfg">{extremaCount}</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-ppurple" />
                {tt('graphIntersections')}: <span className="font-mono tabular-nums text-pfg">{crossCount}</span>
              </span>
            </p>
          )}
        </div>

        <div>
          <ToggleRow label={tt('graphIntegral')} checked={integralOn} onChange={onIntegral} />
          {integralOn && (
            <div className="mt-2 flex flex-col gap-1.5">
              <SliderRow label="a" value={a} min={-10} max={10} step={0.1} onChange={onA} display={fmt(a)} />
              <SliderRow label="b" value={b} min={-10} max={10} step={0.1} onChange={onB} display={fmt(b)} />
              <SliderRow label="n" value={rects} min={1} max={80} step={1} onChange={onRects} display={String(Math.round(rects))} />
              <p className="text-[11.5px] text-pmuted">
                {tt('graphAreaValue')} ≈ <span className="font-mono tabular-nums text-pfg">{fmt(area)}</span>
                {' · '}
                {tt('graphRiemannValue')} = <span className="font-mono tabular-nums text-pfg">{fmt(riemannSum)}</span>
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
