/**
 * Merch buyurtma modali (#40 Faza 3) — ism/telefon/izoh kiritish va
 * buyurtmani yuborish. Telefon user.phone'dan prefill (agar bo'lsa).
 */
import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { CoinIcon } from '../../shared/components/CoinIcon'
import { useAppStore } from '../../shared/store/useAppStore'
import { api, ApiError } from '../../shared/api'
import type { MerchItem } from '../../../shared/merch-items'
import { newId } from '../../shared/lib/outbox'
import { playSound } from '../../shared/lib/sounds'
import { useT } from '../../shared/i18n'
import { getMerchIcon } from './merch-icons'
import DialogOverlay from '../../shared/components/DialogOverlay'
import ModalMathGrid from '../../shared/components/ModalMathGrid'
import ModalCloseButton from '../../shared/components/ModalCloseButton'

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
    <DialogOverlay onClose={busy ? () => {} : onClose} zIndex={60} position="center" labelId="merch-order-title" backdropClassName="bg-black/60">
      <div className="relative w-full max-w-sm bg-psurface rounded-3xl px-5 pt-3 pb-5 shadow-2xl motion-safe:animate-premiumIn overflow-hidden">
        <ModalMathGrid glowColor="theme" height={280} />
        <ModalCloseButton onClick={busy ? () => {} : onClose} label={tt('close')} />
        <div className="relative z-10">
          {/* Minimalist Centered Header (ilova tiliday) */}
          <div className="text-center mb-3 pt-0.5 px-12">
            <h2 id="merch-order-title" className="text-[17px] font-bold text-pfg tracking-tight">
              {tt('merchFormTitle')}
            </h2>
          </div>

          {/* Buyum sarlavhasi (Oq taktil karta) */}
          <div className="mt-3.5 flex items-center gap-3 rounded-2xl bg-pcard p-3.5 shadow-2xs">
            {(() => { const Icon = getMerchIcon(item.id); return <Icon size={26} strokeWidth={1.75} className="shrink-0 text-pprimary" /> })()}
            <div className="flex-1 min-w-0">
              <p className="text-[13.5px] font-semibold text-pfg truncate">{item.label[lang]}</p>
              <p className="text-[11.5px] text-pgold font-semibold flex items-center gap-1 mt-0.5">
                <CoinIcon size={13} /> {item.price.toLocaleString('ru-RU')}
              </p>
            </div>
          </div>

          {/* Forma (Oq taktil inputlar) */}
          <div className="mt-4 space-y-2.5">
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder={tt('merchFormName')}
              maxLength={80}
              className="w-full bg-pcard text-pfg placeholder:text-psubtle rounded-2xl px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-pprimary transition-all shadow-2xs"
            />
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder={tt('merchFormPhone')}
              inputMode="tel"
              maxLength={20}
              className="w-full bg-pcard text-pfg placeholder:text-psubtle rounded-2xl px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-pprimary transition-all shadow-2xs"
            />
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={tt('merchFormNote')}
              maxLength={200}
              className="w-full bg-pcard text-pfg placeholder:text-psubtle rounded-2xl px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-pprimary transition-all shadow-2xs"
            />
          </div>

          {error && (
            <p className="mt-2.5 text-center text-[11.5px] font-semibold text-pwarning animate-fadeIn">{error}</p>
          )}

          <div className="mt-4 flex gap-2.5">
            <button
              onClick={onClose}
              disabled={busy}
              className="flex-1 min-h-11 py-2.5 rounded-2xl text-[13px] font-semibold text-pmuted bg-pcard active:scale-[0.97] transition-transform disabled:opacity-50 shadow-2xs hover:text-pfg">
              {tt('merchFormCancel')}
            </button>
            <button
              onClick={submit}
              disabled={busy}
              className="flex-[2] min-h-11 py-2.5 rounded-2xl text-[13px] font-bold text-ponprimary bg-pprimary hover:brightness-[1.06] active:scale-[0.97] transition-transform disabled:opacity-60 flex items-center justify-center gap-1.5 shadow-xs">
              {busy ? <Loader2 size={16} className="animate-spin" /> : <CoinIcon size={16} />}
              {tt('merchFormSubmit')}
            </button>
          </div>
        </div>
      </div>
    </DialogOverlay>
  )
}
