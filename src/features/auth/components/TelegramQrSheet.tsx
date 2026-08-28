import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { QrCode, X } from 'lucide-react'
import DialogOverlay from '../../../shared/components/DialogOverlay'
import { useT } from '../../../shared/i18n'
import { useAppStore } from '../../../shared/store/useAppStore'

/**
 * TelegramQrSheet — desktop brauzer uchun Telegram login QR varianti.
 * Foydalanuvchi QR'ni telefon kamerasi/Telegram ilovasi bilan skanerlaydi →
 * bot ochiladi → "Boshlash" + contact ulashish → LoginPage polling sessiyani oladi.
 * (Telegram Desktop o'rnatilgan bo'lsa "Botni ochish" linki to'g'ridan-to'g'ri ochadi.)
 */
export default function TelegramQrSheet({ url, onClose }: { url: string; onClose: () => void }) {
  const language = useAppStore((s) => s.settings.language)
  const tt = useT(language)
  const [qrSrc, setQrSrc] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    QRCode.toDataURL(url, { width: 480, margin: 1, color: { dark: '#0f172a', light: '#ffffff' } })
      .then((src) => { if (alive) setQrSrc(src) })
      .catch(() => { if (alive) setQrSrc(null) })
    return () => { alive = false }
  }, [url])

  const steps = [tt('authQrStep1'), tt('authQrStep2'), tt('authQrStep3')]

  return (
    <DialogOverlay onClose={onClose} labelId="tg-qr-title" position="center">
      <div className="relative w-full max-w-[400px] max-h-[calc(100dvh-2rem)] overflow-y-auto bg-pcard border border-pline rounded-[1.5rem] p-6 animate-premiumIn">
        <button
          type="button"
          onClick={onClose}
          aria-label={tt('close')}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-psurface border border-pline flex items-center justify-center text-pmuted hover:text-pfg transition-colors"
        >
          <X size={16} strokeWidth={2.5} />
        </button>

        <div className="w-14 h-14 mx-auto rounded-2xl bg-[#0088cc]/15 flex items-center justify-center">
          <QrCode size={28} strokeWidth={2} className="text-[#0088cc]" />
        </div>

        <h2 id="tg-qr-title" className="text-[19px] font-semibold text-pfg text-center mt-4">
          {tt('authQrTitle')}
        </h2>
        <p className="text-[13px] text-pmuted text-center mt-1.5 leading-relaxed">
          {tt('authQrDesc')}
        </p>

        <div className="mt-5 mx-auto w-fit bg-white rounded-2xl p-3 shadow-[0_8px_30px_rgb(0_0_0/0.25)]">
          {qrSrc ? (
            <img src={qrSrc} alt={tt('authQrTitle')} className="w-52 h-52" draggable={false} />
          ) : (
            <div className="w-52 h-52 rounded-xl bg-psurface animate-pulse" />
          )}
        </div>

        <ol className="mt-5 flex flex-col gap-3">
          {steps.map((text, i) => (
            <li key={i} className="flex items-center gap-3">
              <span className="w-7 h-7 flex-none rounded-full bg-[#0088cc]/15 text-[#0088cc] text-[13px] font-bold flex items-center justify-center">
                {i + 1}
              </span>
              <span className="text-[13px] text-pfg">{text}</span>
            </li>
          ))}
        </ol>

        <div className="mt-5 flex items-center justify-center gap-2 text-pmuted">
          <span className="w-4 h-4 border-2 border-[#0088cc]/40 border-t-[#0088cc] rounded-full animate-spin" />
          <span className="text-[12px]">{tt('authQrWaiting')}</span>
        </div>

        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="block mt-3 text-[13px] font-semibold text-[#0088cc] hover:underline text-center"
        >
          {tt('authQrOpenBot')} →
        </a>
      </div>
    </DialogOverlay>
  )
}
