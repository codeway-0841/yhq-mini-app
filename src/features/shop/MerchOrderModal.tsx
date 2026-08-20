/**
 * Merch buyurtma modali (#40 Faza 3) — ism/telefon/izoh kiritish va
 * buyurtmani yuborish. Telefon user.phone'dan prefill (agar bo'lsa).
 */
import { useState } from 'react'
import { Coins, Loader2, Package } from 'lucide-react'
import { useAppStore } from '../../shared/store/useAppStore'
import { api, ApiError } from '../../shared/api'
import type { MerchItem } from '../../../shared/merch-items'
import { newId } from '../../shared/lib/outbox'
import { playSound } from '../../shared/lib/sounds'
import { useT } from '../../shared/i18n'
import DialogOverlay from '../../shared/components/DialogOverlay'

export default function MerchOrderModal({ item, onClose, onOrdered }: {
  item: MerchItem
  onClose: () => void
  onOrdered: (orderId: number | null, balance: number) => void
}) {
  const lang = useAppStore((s) => s.settings.language)
  const tt = useT(lang)
  const user = useAppStore((s) => s.user)
  const [fullName, setFullName] = useState(
    [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim(),
  )
  const [phone, setPhone] = useState(user?.phone ?? '+998')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    if (busy) return
    if (fullName.trim().length < 2) { setError(tt('merchErrorName')); playSound('error'); return }
    if (!/^\+?[0-9][0-9\s()-]{6,19}$/.test(phone)) { setError(tt('merchErrorPhone')); playSound('error'); return }
    setBusy(true)
    setError(null)
    try {
      const res = await api.buyMerch({
        itemId: item.id,
        purchaseId: newId(),
        fullName: fullName.trim(),
        phone: phone.trim(),
        note: note.trim() || null,
      })
      onOrdered(res.orderId, res.balance)
    } catch (err) {
      const code = err instanceof ApiError ? err.code : undefined
      setError(
        code === 'COINS_INSUFFICIENT' ? tt('shopInsufficient') :
        code === 'MERCH_SOLD_OUT' ? tt('merchSoldOut') :
        code === 'MERCH_ALREADY_OWNED' ? tt('merchOwned') :
        tt('shopError'),
      )
      playSound('error')
      setBusy(false)
    }
  }

  return (
    <DialogOverlay onClose={busy ? () => {} : onClose} zIndex={60} position="center" labelId="merch-order-title">
      <div className="w-full max-w-sm bg-pcard rounded-3xl border border-pline p-5">
        <p id="merch-order-title" className="text-[15px] font-black text-center flex items-center justify-center gap-2">
          <Package size={17} className="text-pgold" /> {tt('merchFormTitle')}
        </p>
        {/* Buyum sarlavhasi */}
        <div className="mt-3 flex items-center gap-3 rounded-2xl bg-psurface border border-pline p-3">
          <span className="text-3xl">{item.emoji}</span>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-bold truncate">{item.label[lang]}</p>
            <p className="text-[11px] text-pgold font-black flex items-center gap-1 mt-0.5">
              <Coins size={11} fill="currentColor" /> {item.price.toLocaleString('ru-RU')}
            </p>
          </div>
        </div>

        <div className="mt-3 flex flex-col gap-2.5">
          <input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder={tt('merchFormName')}
            maxLength={80}
            className="w-full bg-psurface border border-pline rounded-xl px-3.5 py-2.5 text-[13px] font-semibold outline-none focus:border-pprimary/60 transition-colors"
          />
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder={tt('merchFormPhone')}
            inputMode="tel"
            maxLength={20}
            className="w-full bg-psurface border border-pline rounded-xl px-3.5 py-2.5 text-[13px] font-semibold outline-none focus:border-pprimary/60 transition-colors"
          />
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={tt('merchFormNote')}
            maxLength={200}
            className="w-full bg-psurface border border-pline rounded-xl px-3.5 py-2.5 text-[13px] font-semibold outline-none focus:border-pprimary/60 transition-colors"
          />
        </div>

        {error && (
          <p className="mt-2.5 text-center text-[11.5px] font-bold text-pwarning animate-fadeIn">{error}</p>
        )}

        <div className="mt-4 flex gap-2">
          <button
            onClick={onClose}
            disabled={busy}
            className="flex-1 py-2.5 rounded-xl text-[13px] font-bold text-pmuted bg-psurface border border-pline active:scale-[0.97] transition-transform disabled:opacity-50">
            {tt('merchFormCancel')}
          </button>
          <button
            onClick={submit}
            disabled={busy}
            className="btn-premium-gold flex-[2] py-2.5 rounded-xl text-[13px] font-black flex items-center justify-center gap-1.5 active:scale-[0.97] transition-transform disabled:opacity-60">
            {busy ? <Loader2 size={15} className="animate-spin" /> : <Coins size={14} />}
            {tt('merchFormSubmit')}
          </button>
        </div>
      </div>
    </DialogOverlay>
  )
}
