/**
 * Jadval rejimi — joriy ko'rinish oralig'ida x va funksiya qiymatlari.
 * Nusxalash TSV formatida (Excel/Sheets'ga to'g'ridan-to'g'ri qo'yiladi).
 */
import { useMemo } from 'react'
import { Copy } from 'lucide-react'
import { Sheet, SheetHeader, SheetTitle, SheetBody, SheetClose } from '../../../shared/components/ui/sheet'
import { useToast } from '../../../shared/components/ToastContainer'
import { useT } from '../../../shared/i18n'
import type { CompiledExpression } from '../lib/math'

export interface TableColumn {
  id: string
  label: string
  color: string
  fn: CompiledExpression
}

interface Props {
  open: boolean
  onClose: () => void
  language: 'uz' | 'ru'
  columns: TableColumn[]
  xVar: string
  scope: Record<string, number>
  xMin: number
  xMax: number
}

const ROWS = 14

function fmt(v: number): string {
  if (!Number.isFinite(v)) return '—'
  return String(Number(v.toFixed(4)))
}

export default function TableSheet({
  open, onClose, language, columns, xVar, scope, xMin, xMax,
}: Props) {
  const tt = useT(language)
  const { success, error: toastError } = useToast()

  const rows = useMemo(() => {
    if (!open || columns.length === 0) return []
    const lo = xMin
    const hi = xMax
    const out: { x: number; values: number[] }[] = []
    for (let i = 0; i < ROWS; i++) {
      const x = lo + ((hi - lo) * i) / (ROWS - 1)
      const values = columns.map((c) => c.fn({ ...scope, [xVar]: x }))
      out.push({ x, values })
    }
    return out
  }, [open, columns, xVar, scope, xMin, xMax])

  if (!open) return null

  const copyTable = async (): Promise<void> => {
    const header = [xVar, ...columns.map((c) => c.label)].join('\t')
    const body = rows
      .map((r) => [fmt(r.x), ...r.values.map(fmt)].join('\t'))
      .join('\n')
    try {
      await navigator.clipboard.writeText(`${header}\n${body}`)
      success(tt('graphCopied'))
    } catch {
      toastError(tt('graphOpenError'))
    }
  }

  return (
    <Sheet open={open} onClose={onClose}>
      <SheetHeader>
        <SheetTitle>{tt('graphTable')}</SheetTitle>
      </SheetHeader>
      <SheetClose onClose={onClose} label={tt('graphClose')} />
      <SheetBody className="flex flex-col gap-3">
        <button
          type="button"
          onClick={copyTable}
          className="flex h-10 items-center justify-center gap-2 rounded-xl bg-psurface text-[13px] font-semibold text-pmuted transition-colors hover:text-pfg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pprimary"
        >
          <Copy size={15} strokeWidth={1.75} />
          {tt('graphCopyTable')}
        </button>

        <div className="max-h-[55dvh] overflow-y-auto rounded-2xl bg-psurface">
          <table className="w-full border-collapse font-mono text-[12px]">
            <thead>
              <tr className="text-psubtle">
                <th className="bg-psurface px-3 py-2 text-left font-semibold">{xVar}</th>
                {columns.map((c) => (
                  <th key={c.id} className="bg-psurface px-3 py-2 text-right font-semibold">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="size-2 rounded-full" style={{ background: c.color }} />
                      {c.label}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-t border-pline">
                  <td className="px-3 py-1.5 text-left tabular-nums text-pmuted">{fmt(r.x)}</td>
                  {r.values.map((v, j) => (
                    <td key={j} className="px-3 py-1.5 text-right tabular-nums text-pfg">{fmt(v)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SheetBody>
    </Sheet>
  )
}
