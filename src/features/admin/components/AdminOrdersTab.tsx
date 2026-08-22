/**
 * Admin — Merch buyurtmalar tab (#40 Faza 3).
 * Ro'yxat + status boshqaruvi: new → contacted → delivered | cancelled.
 * Cancel → atomik coin refund (server coin_transactions 'merch_refund').
 */
import { useCallback, useEffect, useState } from 'react'
import { Package, Loader2, Phone, Check, Truck, XCircle, RefreshCw, User, Coins } from 'lucide-react'
import { api, type AdminMerchOrderRow } from '../../../shared/api'
import { getMerchItem } from '../../../../shared/merch-items'
import { getMerchIcon } from '../../shop'
import { playSound } from '../../../shared/lib/sounds'
import { useT } from '../../../shared/i18n'
import { useAppStore } from '../../../shared/store/useAppStore'

const STATUSES = ['new', 'contacted', 'delivered', 'cancelled'] as const
type OrderStatus = typeof STATUSES[number]

export default function AdminOrdersTab() {
  const lang = useAppStore((s) => s.settings.language)
  const tt = useT(lang)
  const [rows, setRows] = useState<AdminMerchOrderRow[] | null>(null)
  const [filter, setFilter] = useState<OrderStatus | ''>('new')
  const [busy, setBusy] = useState<number | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000) }

  const load = useCallback(async () => {
    try {
      const res = await api.getAdminMerchOrders(filter || undefined)
      setRows(res.rows)
    } catch {
      showToast(tt('shopError'))
    }
  }, [filter]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load() }, [load])

  const setStatus = async (id: number, status: 'contacted' | 'delivered') => {
    if (busy) return
    setBusy(id)
    try {
      await api.setMerchOrderStatus(id, status)
      playSound('toggle')
      showToast(`#${id} → ${tt(status === 'contacted' ? 'orderStatusContacted' : 'orderStatusDelivered')}`)
      load()
    } catch {
      showToast(tt('shopError'))
    } finally {
      setBusy(null)
    }
  }

  const cancel = async (id: number) => {
    if (busy || !window.confirm(tt('orderConfirmCancel'))) return
    setBusy(id)
    try {
      await api.cancelMerchOrder(id)
      playSound('click')
      showToast(`#${id} ${tt('orderStatusCancelled')} + refund`)
      load()
    } catch {
      showToast(tt('shopError'))
    } finally {
      setBusy(null)
    }
  }

  const statusBadge = (status: string) => {
    const map: Record<string, { label: string; color: string; bg: string }> = {
      new:       { label: tt('orderStatusNew'),       color: 'var(--p-warning)', bg: 'rgb(var(--p-warning-rgb) / 0.12)' },
      contacted: { label: tt('orderStatusContacted'), color: 'var(--p-blue)',    bg: 'rgb(59 130 246 / 0.12)' },
      delivered: { label: tt('orderStatusDelivered'), color: 'var(--p-success)', bg: 'rgb(var(--p-success-rgb) / 0.12)' },
      cancelled: { label: tt('orderStatusCancelled'), color: 'var(--p-danger)',  bg: 'rgb(239 68 68 / 0.10)' },
    }
    const s = map[status] ?? map.new
    return (
      <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold" style={{ color: s.color, background: s.bg }}>
        {s.label}
      </span>
    )
  }

  return (
    <div className="p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[14px] font-semibold flex items-center gap-1.5">
          <Package size={16} className="text-pgold" /> {tt('ordersTitle')}
        </p>
        <div className="flex items-center gap-1.5">
          {(['', ...STATUSES] as const).map((s) => (
            <button
              key={s || 'all'}
              onClick={() => setFilter(s)}
              className={`px-2 py-1 rounded-lg text-[10px] font-semibold transition-all ${
                filter === s ? 'bg-ppurple text-ponprimary' : 'bg-psurface text-pmuted'
              }`}>
              {s === '' ? '∞' : tt(s === 'new' ? 'orderStatusNew' : s === 'contacted' ? 'orderStatusContacted' : s === 'delivered' ? 'orderStatusDelivered' : 'orderStatusCancelled')}
            </button>
          ))}
          <button onClick={load} className="p-1.5 rounded-lg bg-psurface text-pmuted active:scale-95" aria-label="Refresh">
            <RefreshCw size={13} />
          </button>
        </div>
      </div>

      {toast && (
        <div className="rounded-control px-3 py-2 text-[12px] font-semibold text-pfg bg-psurface border border-pline animate-fadeIn">
          {toast}
        </div>
      )}

      {rows === null ? (
        <div className="flex justify-center py-10"><Loader2 className="motion-safe:animate-spin text-pmuted" /></div>
      ) : rows.length === 0 ? (
        <p className="text-center text-[12px] text-pmuted py-8">{tt('orderNoOrders')}</p>
      ) : (
        rows.map((o) => {
          const merch = getMerchItem(o.item_id)
          const MerchIcon = getMerchIcon(o.item_id)
          return (
            <div key={o.id} className="rounded-container border border-pline bg-pcard p-3.5">
              <div className="flex items-center justify-between gap-2">
                <p className="flex items-center gap-1.5 text-[13px] font-semibold">
                  #{o.id} <MerchIcon size={13} strokeWidth={1.75} className="text-pgold" /> {merch?.label[lang] ?? o.item_id}
                </p>
                {statusBadge(o.status)}
              </div>
              <div className="mt-1.5 text-[11.5px] text-pmuted leading-relaxed">
                <p className="flex items-center gap-1">
                  <User size={10} strokeWidth={1.75} /> {o.full_name} <span className="opacity-60">({o.first_name} · {o.user_id})</span>
                </p>
                <p className="flex items-center gap-1"><Phone size={10} strokeWidth={1.75} /> {o.phone} {o.note ? <span className="italic">· {o.note}</span> : null}</p>
                <p className="flex items-center gap-1 opacity-70">
                  <Coins size={10} strokeWidth={1.75} /> {o.price_paid.toLocaleString('ru-RU')} · {new Date(o.created_at).toLocaleDateString(lang === 'ru' ? 'ru-RU' : 'uz-UZ', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
              {(o.status === 'new' || o.status === 'contacted') && (
                <div className="mt-2.5 flex gap-1.5">
                  {o.status === 'new' && (
                    <button
                      onClick={() => setStatus(o.id, 'contacted')}
                      disabled={busy !== null}
                      className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-[11px] font-semibold text-pblue bg-pblue/10 border border-pblue/30 active:scale-[0.97] transition-transform disabled:opacity-50">
                      {busy === o.id ? <Loader2 size={12} className="motion-safe:animate-spin" /> : <Check size={12} />}
                      {tt('orderStatusContacted')}
                    </button>
                  )}
                  <button
                    onClick={() => setStatus(o.id, 'delivered')}
                    disabled={busy !== null}
                    className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-[11px] font-semibold text-psuccess bg-psuccess/10 border border-psuccess/30 active:scale-[0.97] transition-transform disabled:opacity-50">
                    <Truck size={12} /> {tt('orderStatusDelivered')}
                  </button>
                  <button
                    onClick={() => cancel(o.id)}
                    className="flex-none flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold text-pdanger bg-pdanger/10 border border-pdanger/30 active:scale-[0.97] transition-transform"
                    title={tt('orderCancelRefund')}>
                    <XCircle size={12} />
                  </button>
                </div>
              )}
            </div>
          )
        })
      )}
    </div>
  )
}
