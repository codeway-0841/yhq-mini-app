/**
 * Lab rejimi — o'lchov nuqtalari va chiziqli regression (eng kichik kvadratlar).
 * Nuqtalarni qo'lda kiritish yoki grafikni bosib yig'ish mumkin.
 */
import { Plus, Trash2 } from 'lucide-react'
import { Sheet, SheetHeader, SheetTitle, SheetBody, SheetClose } from '../../../shared/components/ui/sheet'
import { Switch } from '../../../shared/components/ui/switch'
import { useT } from '../../../shared/i18n'
import { linearRegression } from '../lib/math'
import type { GraphPoint } from '../../../../shared/contracts/graph'

interface Props {
  open: boolean
  onClose: () => void
  language: 'uz' | 'ru'
  points: GraphPoint[]
  onChangePoint: (index: number, patch: Partial<GraphPoint>) => void
  onAdd: () => void
  onRemove: (index: number) => void
  onClear: () => void
  pickMode: boolean
  onPickMode: (v: boolean) => void
}

function fmt(v: number, digits = 4): string {
  if (!Number.isFinite(v)) return '—'
  return String(Number(v.toFixed(digits)))
}

export default function LabSheet({
  open, onClose, language, points, onChangePoint, onAdd, onRemove, onClear,
  pickMode, onPickMode,
}: Props) {
  const tt = useT(language)
  if (!open) return null

  const reg = linearRegression(points)

  return (
    <Sheet open={open} onClose={onClose}>
      <SheetHeader>
        <SheetTitle>{tt('graphLab')}</SheetTitle>
      </SheetHeader>
      <SheetClose onClose={onClose} label={tt('graphClose')} />
      <SheetBody className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3 rounded-2xl bg-psurface p-3">
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-semibold text-pfg">{tt('graphLabPick')}</p>
            <p className="mt-0.5 text-[11px] text-psubtle">{tt('graphLabPickHint')}</p>
          </div>
          <Switch checked={pickMode} onCheckedChange={onPickMode} aria-label={tt('graphLabPick')} />
        </div>

        {points.length === 0 ? (
          <p className="py-3 text-center text-[12px] text-psubtle">{tt('graphLabEmpty')}</p>
        ) : (
          <div className="flex flex-col gap-2">
            {points.map((p, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="w-5 shrink-0 text-right font-mono text-[11px] text-psubtle">{i + 1}</span>
                <input
                  type="number"
                  inputMode="decimal"
                  step="any"
                  value={Number.isFinite(p.x) ? p.x : ''}
                  onChange={(e) => onChangePoint(i, { x: Number(e.target.value) })}
                  aria-label={`x${i + 1}`}
                  className="h-11 min-w-0 flex-1 rounded-xl bg-psurface px-2.5 font-mono text-base text-pfg outline-none focus:ring-2 focus:ring-pprimary"
                />
                <input
                  type="number"
                  inputMode="decimal"
                  step="any"
                  value={Number.isFinite(p.y) ? p.y : ''}
                  onChange={(e) => onChangePoint(i, { y: Number(e.target.value) })}
                  aria-label={`y${i + 1}`}
                  className="h-11 min-w-0 flex-1 rounded-xl bg-psurface px-2.5 font-mono text-base text-pfg outline-none focus:ring-2 focus:ring-pprimary"
                />
                <button
                  type="button"
                  onClick={() => onRemove(i)}
                  aria-label={tt('graphDelete')}
                  className="grid size-9 shrink-0 place-items-center rounded-xl text-pmuted transition-colors hover:text-pdanger"
                >
                  <Trash2 size={15} strokeWidth={1.75} />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onAdd}
            className="flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl bg-psurface text-[12.5px] font-semibold text-pmuted transition-colors hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pprimary"
          >
            <Plus size={15} strokeWidth={1.75} />
            {tt('graphLabAdd')}
          </button>
          {points.length > 0 && (
            <button
              type="button"
              onClick={onClear}
              className="flex h-10 items-center justify-center gap-1.5 rounded-xl bg-psurface px-4 text-[12.5px] font-semibold text-pmuted transition-colors hover:text-pdanger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pprimary"
            >
              {tt('graphLabClear')}
            </button>
          )}
        </div>

        {reg && (
          <div className="rounded-2xl bg-psurface p-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-psubtle">
              {tt('graphLabRegression')}
            </p>
            {reg.vertical ? (
              <p className="mt-1.5 font-mono text-[13px] text-pfg">x = {fmt(reg.intercept)}</p>
            ) : (
              <p className="mt-1.5 font-mono text-[13px] text-pfg">
                y = {fmt(reg.slope)}·x {reg.intercept >= 0 ? '+' : '−'} {fmt(Math.abs(reg.intercept))}
              </p>
            )}
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11.5px] text-pmuted">
              <span>
                {tt('graphLabSlope')}: <span className="font-mono tabular-nums text-pfg">{reg.vertical ? '∞' : fmt(reg.slope)}</span>
              </span>
              <span>
                {tt('graphLabIntercept')}: <span className="font-mono tabular-nums text-pfg">{fmt(reg.intercept)}</span>
              </span>
              <span>
                R²: <span className="font-mono tabular-nums text-pfg">{fmt(reg.r2, 4)}</span>
              </span>
              <span>
                n = <span className="font-mono tabular-nums text-pfg">{reg.n}</span>
              </span>
            </div>
          </div>
        )}
      </SheetBody>
    </Sheet>
  )
}
