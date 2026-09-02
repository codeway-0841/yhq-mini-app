import { useCallback, useEffect, useState } from 'react'
import { Loader2, Receipt, X } from 'lucide-react'
import DialogOverlay from '../../../shared/components/DialogOverlay'
import { api, type PaymentHistoryRow } from '../../../shared/api'
import { useAppStore } from '../../../shared/store/useAppStore'
import { useT } from '../../../shared/i18n'
import { getPlan, formatUzs } from '../../../../shared/premium-plans'

type PayStatus = PaymentHistoryRow['status']

/** Holat chip'i — semantik rang FAQAT shu yerda (dizayn qoidasi 8) */
function statusView(status: PayStatus, tt: ReturnType<typeof useT>) {
  const label =
    status === 'completed' ? tt('payStatusCompleted') :
    status === 'pending'   ? tt('payStatusPending') :
    status === 'cancelled' ? tt('payStatusCancelled') :
                             tt('payStatusFailed')
  const rgb =
    status === 'completed' ? 'var(--p-success-rgb)' :
    status === 'pending'   ? 'var(--p-warning-rgb)' :
                             'var(--p-danger-rgb)'
  return { label, rgb }
}

// ── Bottom sheet — to'lovlar tarixi (Click/Payme buyurtmalari) ──────────
export function PaymentHistorySheet({ onClose }: { onClose: () => void }) {
  const lang = useAppStore((s) => s.settings.language)
  const tt = useT(lang)
  const [rows, setRows] = useState<PaymentHistoryRow[] | null>(null)
  const [failed, setFailed] = useState(false)

  const load = useCallback(() => {
    setRows(null)
    setFailed(false)
    api.getPaymentHistory()
      .then((r) => setRows(r.rows))
      .catch(() => setFailed(true))
  }, [])

  useEffect(() => { load() }, [load])

  return (
    <DialogOverlay onClose={onClose} backdropClassName="bg-black/60" labelId="pay-history-title">
      <div className="relative flex max-h-[80vh] w-full flex-col rounded-t-sheet border-t border-pline bg-psurface px-5 pt-3 pb-[calc(1.75rem+var(--safe-bottom,0px))]">
        <div className="mx-auto mb-4 h-1 w-10 flex-none rounded-full bg-plineStrong" />

        {/* Header — sarlavha + yopish */}
        <div className="flex flex-none items-start justify-between gap-3">
          <div className="min-w-0">
            <p id="pay-history-title" className="text-[17px] font-bold text-pfg">{tt('payHistory')}</p>
            <p className="mt-0.5 text-[12.5px] text-pmuted">{tt('payHistorySubtitle')}</p>
          </div>
          <button
            onClick={onClose}
            aria-label={tt('cancel')}
            className="grid size-8 flex-none place-items-center rounded-full text-psubtle transition-colors hover:bg-pcard hover:text-pfg"
          >
            <X size={18} strokeWidth={1.75} />
          </button>
        </div>

        {failed ? (
          /* Xato — qayta urinish */
          <div className="flex flex-col items-center py-14 text-center">
            <p className="text-[13px] text-pmuted">{tt('payHistoryError')}</p>
            <button
              onClick={load}
              className="mt-4 rounded-xl bg-pcard px-4 py-2.5 text-[12.5px] font-semibold text-pfg shadow-xs transition-transform active:scale-[0.97]"
            >
              {tt('payHistoryRetry')}
            </button>
          </div>
        ) : rows === null ? (
          /* Yuklanmoqda */
          <div className="grid place-items-center py-16">
            <Loader2 size={26} className="animate-spin text-psubtle" />
          </div>
        ) : rows.length === 0 ? (
          /* Bo'sh holat */
          <div className="flex flex-col items-center py-14 text-center">
            <div className="grid size-20 place-items-center rounded-full bg-pcard shadow-xs">
              <Receipt size={36} strokeWidth={1.5} className="text-psubtle" />
            </div>
            <p className="mt-5 text-[15px] font-bold text-pfg">{tt('payHistoryEmptyTitle')}</p>
          </div>
        ) : (
          /* Buyurtmalar ro'yxati */
          <div className="mt-4 -mx-5 overflow-y-auto px-5">
            <div className="rounded-2xl border border-pline bg-pcard divide-y divide-pline shadow-xs overflow-hidden">
              {rows.map((r) => {
                const s = statusView(r.status, tt)
                const plan = getPlan(r.plan)
                return (
                  <div key={r.orderId} className="flex items-center gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13.5px] font-semibold text-pfg">
                        {plan ? (lang === 'ru' ? plan.titleRu : plan.titleUz) : r.plan}
                        <span className="font-normal text-psubtle"> · {r.provider === 'click' ? 'Click' : 'Payme'}</span>
                      </p>
                      <p className="mt-0.5 text-[10.5px] text-psubtle">
                        {new Date(r.createdAt).toLocaleDateString(lang === 'ru' ? 'ru-RU' : 'uz-UZ',
                          { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    <div className="flex-none text-right">
                      <p className="text-[13px] font-semibold tabular-nums text-pfg">{formatUzs(r.amountUzs, lang)}</p>
                      <span
                        className="mt-1 inline-block rounded-full px-2.5 py-0.5 text-[10px] font-semibold shadow-2xs"
                        style={{
                          color: `rgb(${s.rgb})`,
                          background: `rgb(${s.rgb} / 0.15)`,
                        }}
                      >
                        {s.label}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </DialogOverlay>
  )
}
