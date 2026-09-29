import { useState } from 'react'
import { Camera, ImagePlus, Trash2, X, Pencil, Send, MessageSquare } from 'lucide-react'
import DialogOverlay from '../../../shared/components/DialogOverlay'
import ModalMathGrid from '../../../shared/components/ModalMathGrid'
import ModalHeaderRow from '../../../shared/components/ModalHeaderRow'
import { Button } from '../../../shared/components/ui/button'
import { Sheet, SheetBody, SheetDescription, SheetHeader, SheetTitle } from '../../../shared/components/ui/sheet'
import { useAppStore } from '../../../shared/store/useAppStore'
import { useT } from '../../../shared/i18n'
import { usePhoneInput } from '../../auth'

// ── Bottom sheet — profil rasmini tahrirlash ────────────────────────────
export function PhotoEditSheet({ hasCustom, busy, onClose, onPick, onRemove }: {
  hasCustom: boolean
  busy: boolean
  onClose: () => void
  onPick: () => void
  onRemove: () => void
}) {
  const tt = useT(useAppStore((s) => s.settings.language))
  return (
    <DialogOverlay onClose={onClose} backdropClassName="bg-black/60" labelId="photo-edit-title" swipeToDismiss>
      <div className="relative w-full bg-psurface rounded-t-sheet px-5 pt-5 pb-[calc(1.75rem+var(--safe-bottom,0px))] shadow-2xl overflow-hidden">
        <ModalMathGrid glow={false} height={300} />
        <div data-drag-handle className="w-9 h-1 bg-gray-300 dark:bg-white/20 rounded-full mx-auto mb-2 cursor-grab active:cursor-grabbing touch-none relative z-10" />
        <ModalHeaderRow onClose={onClose} label={tt('cancel')}>
          <p id="photo-edit-title" data-drag-handle className="text-sm font-semibold flex items-center justify-center gap-2 text-pfg select-none">
            <Camera size={14} className="text-pprimary" />
            {tt('photoEditTitle')}
          </p>
        </ModalHeaderRow>
        <div className="flex flex-col gap-2.5">
          <Button block loading={busy} onClick={onPick}>
            <ImagePlus size={16} />
            {busy ? tt('uploadingPhoto') : tt('pickFromGallery')}
          </Button>
          {hasCustom && (
            <Button block variant="destructive" disabled={busy} onClick={onRemove}>
              <Trash2 size={16} />
              {tt('removePhoto')}
            </Button>
          )}
          <Button block variant="ghost" onClick={onClose}>
            <X size={16} />
            {tt('cancel')}
          </Button>
        </div>
      </div>
    </DialogOverlay>
  )
}

// ── Bottom sheet — telefon qo'shish/o'zgartirish ─────────────────────────
// Zanjir: (change'da) TASDIQ ("Raqamni o'zgartirasizmi?") → USUL tanlash
// (Telegram orqali = requestContact fast-path, SMS'siz / SMS orqali = qo'lda
// raqam + kod) → (SMS'da) RAQAM INPUT. OTP kodi Profil'dagi umumiy blokda
// kiritiladi (sheet yopilgach ko'rinadi).

/** +998909080724 → "+998 90 908 07 24" (o'qish oson — faqat ko'rsatish uchun) */
function formatPhoneDisplay(p: string): string {
  const m = /^\+998(\d{2})(\d{3})(\d{2})(\d{2})$/.exec(p)
  return m ? `+998 ${m[1]} ${m[2]} ${m[3]} ${m[4]}` : p
}

export function PhoneEditSheet({ currentPhone, busy, onClose, onTelegram, onSms }: {
  currentPhone: string | null
  busy: boolean
  onClose: () => void
  onTelegram: () => void
  onSms: (phone: string) => void
}) {
  const tt = useT(useAppStore((s) => s.settings.language))
  const phone = usePhoneInput()
  // Change rejimida avval tasdiqlash; add rejimida to'g'ridan-to'g'ri usul
  const [step, setStep] = useState<'confirm' | 'method' | 'sms'>(currentPhone ? 'confirm' : 'method')
  const isDirty = (step === 'sms' && phone.digits.length > 0) || busy

  return (
    <Sheet
      onClose={onClose}
      backdropClassName="bg-black/60"
      closeOnBackdrop={!isDirty}
      canDismiss={() => !isDirty}
    >
        <SheetHeader onClose={isDirty ? () => {} : onClose} closeLabel={tt('cancel')}>
          <SheetTitle className="text-[19px]">
            {step === 'confirm' ? tt('phoneChangeTitle') : step === 'method' ? tt('phoneMethodTitle') : tt('viaSms')}
          </SheetTitle>
          {step === 'method' && (
            <SheetDescription className="mt-1.5 text-[13px] max-w-xs mx-auto leading-relaxed">
              {tt('phoneMethodHint')}
            </SheetDescription>
          )}
          {step === 'sms' && (
            <SheetDescription className="mt-1 text-[13px] leading-relaxed max-w-xs mx-auto">
              {tt('phoneMethodHint')}
            </SheetDescription>
          )}
        </SheetHeader>

        <SheetBody className="pb-7 pt-1">
        {step === 'confirm' && currentPhone && (
          <div className="relative z-10">
            <div className="my-3 py-2 px-4 rounded-xl bg-pcard shadow-2xs w-fit mx-auto text-[16px] font-bold text-pprimary tracking-wide font-mono">
              {formatPhoneDisplay(currentPhone)}
            </div>
            <p className="mt-1 mb-5 text-center text-[13px] text-pmuted max-w-xs mx-auto leading-relaxed">
              {tt('phoneChangeHint')}
            </p>
            <div className="flex gap-3">
              <Button block variant="outline" onClick={onClose}>{tt('cancel')}</Button>
              <Button block onClick={() => setStep('method')}>{tt('continueAction')}</Button>
            </div>
          </div>
        )}

        {step === 'method' && (
          <div className="relative z-10">
            <div className="flex flex-col gap-2.5">
              <Button block size="lg" loading={busy} className="font-semibold shadow-xs" onClick={onTelegram}>
                <Send size={16} />
                {tt('viaTelegram')}
              </Button>
              <Button block size="lg" variant="outline" disabled={busy} className="font-semibold" onClick={() => setStep('sms')}>
                <MessageSquare size={16} />
                {tt('viaSms')}
              </Button>
            </div>
          </div>
        )}

        {step === 'sms' && (
          <div className="relative z-10">
            <div className="mb-4 flex items-center gap-2 rounded-2xl bg-pcard px-4 focus-within:ring-2 focus-within:ring-pprimary shadow-xs">
              <span className="text-pmuted font-semibold select-none">+998</span>
              <input
                value={phone.digits}
                onChange={(e) => phone.setDigits(e.target.value)}
                inputMode="numeric"
                autoComplete="tel-national"
                placeholder="90 123 45 67"
                maxLength={11}
                disabled={busy}
                autoFocus
                className="flex-1 min-w-0 bg-transparent outline-none py-3 text-base text-pfg placeholder:text-pmuted tracking-widest"
              />
            </div>
            <div className="flex flex-col gap-2.5">
              <Button block size="lg" loading={busy} disabled={!phone.isValid} className="font-bold shadow-xs" onClick={() => onSms(phone.value)}>
                {tt('sendSmsCode')}
              </Button>
              <Button block variant="ghost" disabled={busy} onClick={() => setStep('method')}>
                {tt('backWord')}
              </Button>
            </div>
          </div>
        )}
        </SheetBody>
    </Sheet>
  )
}

// ── Bottom sheet — ismni tahrirlash ─────────────────────────────────────
export function NameEditSheet({ current, onClose, onSave }: {
  current: string
  onClose: () => void
  onSave: (name: string) => void
}) {
  const tt = useT(useAppStore((s) => s.settings.language))
  const [name, setName] = useState(current)
  return (
    <DialogOverlay onClose={onClose} backdropClassName="bg-black/60" labelId="name-edit-title">
      <div className="relative w-full bg-psurface rounded-t-sheet p-5 pb-8 shadow-2xl overflow-hidden">
        <ModalMathGrid glow={false} height={280} />
        <div className="w-9 h-1 bg-gray-300 dark:bg-white/20 rounded-full mx-auto mb-2 relative z-10" />
        <ModalHeaderRow onClose={onClose} label={tt('cancel')}>
          <p id="name-edit-title" className="text-sm font-semibold flex items-center justify-center gap-2 text-pfg">
            <Pencil size={14} className="text-pblue" />
            {tt('nameEditTitle')}
          </p>
        </ModalHeaderRow>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={32}
          placeholder={tt('yourNamePlaceholder')}
          autoFocus
          className="relative z-10 w-full bg-pcard rounded-2xl px-4 py-3.5 text-base text-pfg outline-none mb-4 focus:ring-2 focus:ring-pprimary shadow-xs"
        />
        <div className="relative z-10">
          <Button block onClick={() => { onSave(name); onClose() }}>
            {tt('saveBtn')}
          </Button>
        </div>
      </div>
    </DialogOverlay>
  )
}
