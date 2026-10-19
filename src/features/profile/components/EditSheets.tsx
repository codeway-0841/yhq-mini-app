import { useState } from 'react'
import { ImagePlus, Trash2, X, Send, MessageSquare } from 'lucide-react'
import ModalShell from '../../../shared/components/ModalShell'
import { SpecCard } from '../../../shared/components/ui/spec'
import { Button } from '../../../shared/components/ui/button'
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
    <ModalShell
      title={tt('photoEditTitle')}
      onClose={onClose}
      labelId="photo-edit-title"
      closeLabel={tt('cancel')}
      backdropClassName="bg-black/60"
    >
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
    </ModalShell>
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
  const language = useAppStore((s) => s.settings.language)
  const tt = useT(language)
  const phone = usePhoneInput()
  // Change rejimida avval tasdiqlash; add rejimida to'g'ridan-to'g'ri usul
  const [step, setStep] = useState<'confirm' | 'method' | 'sms'>(currentPhone ? 'confirm' : 'method')
  const isDirty = (step === 'sms' && phone.digits.length > 0) || busy

  const title =
    step === 'confirm'
      ? tt('phoneChangeTitle')
      : step === 'method'
        ? tt('phoneMethodTitle')
        : tt('viaSms')

  const subtitle =
    step === 'confirm'
      ? tt('phoneChangeHint')
      : tt('phoneMethodHint')

  return (
    <ModalShell
      title={title}
      subtitle={subtitle}
      onClose={isDirty ? () => {} : onClose}
      backdropClassName="bg-black/60"
      closeOnBackdrop={!isDirty}
      canDismiss={() => !isDirty}
    >
      {step === 'confirm' && currentPhone && (
        <div className="relative z-10 space-y-4">
          <SpecCard className="p-4 text-center">
            <span className="text-[12px] font-medium text-pmuted">
              {language === 'ru' ? 'Текущий номер' : 'Joriy raqam'}
            </span>
            <p className="mt-1 font-mono text-[18px] font-bold tracking-wider text-pprimary">
              {formatPhoneDisplay(currentPhone)}
            </p>
          </SpecCard>
          <div className="flex gap-3">
            <Button block variant="outline" onClick={onClose}>{tt('cancel')}</Button>
            <Button block onClick={() => setStep('method')}>{tt('continueAction')}</Button>
          </div>
        </div>
      )}

      {step === 'method' && (
        <div className="relative z-10 flex flex-col gap-2.5">
          <Button block size="lg" loading={busy} className="font-semibold shadow-xs" onClick={onTelegram}>
            <Send size={16} />
            {tt('viaTelegram')}
          </Button>
          <Button block size="lg" variant="outline" disabled={busy} className="font-semibold" onClick={() => setStep('sms')}>
            <MessageSquare size={16} />
            {tt('viaSms')}
          </Button>
          {currentPhone && (
            <Button block variant="ghost" disabled={busy} onClick={() => setStep('confirm')}>
              {tt('backWord')}
            </Button>
          )}
        </div>
      )}

      {step === 'sms' && (
        <div className="relative z-10 space-y-4">
          <div className="flex items-center gap-2 rounded-2xl bg-pcard px-4 focus-within:ring-2 focus-within:ring-pprimary shadow-xs">
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
              className="flex-1 min-w-0 bg-transparent py-3.5 text-base text-pfg placeholder:text-pmuted tracking-widest outline-none"
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
    </ModalShell>
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
    <ModalShell
      title={tt('nameEditTitle')}
      onClose={onClose}
      labelId="name-edit-title"
      closeLabel={tt('cancel')}
      backdropClassName="bg-black/60"
    >
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
    </ModalShell>
  )
}
