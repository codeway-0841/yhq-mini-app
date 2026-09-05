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
      <div className="app-modal relative max-h-[calc(100dvh-2rem)] w-full max-w-[400px] overflow-y-auto p-5 motion-safe:animate-premiumIn sm:p-6">
        <button
          type="button"
          onClick={onClose}
          aria-label={tt('close')}
          className="absolute right-3 top-3 flex size-11 cursor-pointer items-center justify-center rounded-full bg-psurface text-pmuted shadow-xs transition-colors hover:text-pfg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pprimary"
        >
          <X size={16} strokeWidth={2.5} />
        </button>

        <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-psurface">
          <QrCode size={26} strokeWidth={1.75} className="text-pmuted" />
        </div>

        <h2 id="tg-qr-title" className="text-[19px] font-semibold text-pfg text-center mt-4">
          {tt('authQrTitle')}
        </h2>
        <p className="text-[13px] text-pmuted text-center mt-1.5 leading-relaxed">
          {tt('authQrDesc')}
        </p>

        <div className="mt-5 mx-auto w-fit bg-white rounded-2xl p-3 shadow-[0_8px_30px_rgb(0_0_0/0.25)]">
          {qrSrc ? (
            <img src={qrSrc} alt={tt('authQrTitle')} className="aspect-square w-[min(52vw,13rem)]" draggable={false} />
          ) : (
            <div className="aspect-square w-[min(52vw,13rem)] rounded-xl bg-psurface motion-safe:animate-pulse" />
          )}
        </div>

        <ol className="mt-5 flex flex-col gap-3">
          {steps.map((text, i) => (
            <li key={i} className="flex items-center gap-3">
              <span className="flex size-7 flex-none items-center justify-center rounded-full bg-psurface text-[13px] font-semibold text-pmuted">
                {i + 1}
              </span>
              <span className="text-[13px] text-pfg">{text}</span>
            </li>
          ))}
        </ol>

        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-5 flex min-h-[52px] w-full cursor-pointer items-center justify-center gap-2.5 rounded-2xl bg-pprimary px-4 py-3 text-ponprimary shadow-md transition-[transform,filter] duration-150 hover:brightness-[1.06] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pprimary focus-visible:ring-offset-2 focus-visible:ring-offset-pcard"
        >
          <svg aria-hidden="true" className="w-5 h-5 fill-white" viewBox="0 0 24 24">
            <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.479.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
          </svg>
          <span className="text-[15px] font-semibold text-white">{tt('authQrOpenBot')}</span>
        </a>

        <div className="mt-4 flex items-center justify-center gap-2 text-pmuted">
          <span className="size-4 rounded-full border-2 border-pprimary/35 border-t-pprimary motion-safe:animate-spin" />
          <span className="text-[12px]">{tt('authQrWaiting')}</span>
        </div>
      </div>
    </DialogOverlay>
  )
}
