import { useEffect, useRef, useState } from 'react'
import { QrCode } from 'lucide-react'
import { api } from '../../../shared/api'
import { useAppStore } from '../../../shared/store/useAppStore'
import { useT } from '../../../shared/i18n'
import { track } from '../../../shared/lib/analytics'
import { applyAuthSession } from '../apply-auth-session'
import { applyDevGuestSession } from '../dev-guest'
import { authErrorKey } from '../validation'
import TelegramQrSheet from './TelegramQrSheet'

/** Mobil brauzer = Telegram app o'rnatilgan bo'lishi ehtimoli yuqori → to'g'ridan-to'g'ri ochamiz. */
function isMobileBrowser() {
  if (typeof navigator === 'undefined') return false
  return /Android|iPhone|iPad|iPod|Mobile|webOS/i.test(navigator.userAgent)
}

/**
 * Telegram orqali kirish paneli — bot-login (createTelegramLogin) + polling.
 *
 * LoginPage ham, onboarding'ning 3-qadami ham AYNAN shu komponentni ishlatadi:
 * sessiya `applyAuthSession` orqali yagona yo'l bilan o'rnatiladi, muvaffaqiyatda
 * `onAuthed()` chaqiriladi. UI ona ekranning uslubiga moslab joylashtiriladi
 * (bu komponent faqat tugma/spinner/QR qatlamini chizadi).
 */
export function TelegramLoginPanel({ onAuthed }: { onAuthed: () => void }) {
  const language = useAppStore((s) => s.settings.language)
  const tt = useT(language)

  const [busy, setBusy] = useState(false)
  const [url, setUrl] = useState<string | null>(null)
  const [code, setCode] = useState<string | null>(null)
  const [qrOpen, setQrOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const onAuthedRef = useRef(onAuthed)
  onAuthedRef.current = onAuthed

  // Bot sessiya yaratganda avtomatik kirish (LoginPage bilan bir xil 2s poll)
  useEffect(() => {
    if (!code) return
    pollRef.current = setInterval(async () => {
      try {
        const res = await api.checkTelegramLogin(code)
        if (res.status === 'completed' && res.sessionToken) {
          if (pollRef.current) clearInterval(pollRef.current)
          track('login', { provider: 'telegram_bot' })
          applyAuthSession(res)
          onAuthedRef.current()
        } else if (res.status === 'expired') {
          if (pollRef.current) clearInterval(pollRef.current)
          setCode(null)
          setUrl(null)
          setQrOpen(false)
          setError(tt('authCodeExpired'))
        }
      } catch {
        /* polling xatosi — keyingi urinish */
      }
    }, 2000)
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code])

  const start = async () => {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      const res = await api.createTelegramLogin()
      if (!res.url) {
        setError(tt('authTelegramNotConfigured'))
        return
      }
      setUrl(res.url)
      setCode(res.code)
      if (isMobileBrowser()) {
        window.open(res.url, '_blank')
      } else {
        setQrOpen(true)
      }
    } catch (err) {
      if (import.meta.env.DEV) {
        applyDevGuestSession(language)
        onAuthedRef.current()
        return
      }
      setError(tt(authErrorKey(err)))
    } finally {
      setBusy(false)
    }
  }

  if (code && url) {
    return (
      <div className="flex w-full flex-col gap-2.5" role="status" aria-live="polite">
        <div className="flex items-center justify-center gap-2 text-[13px] font-medium text-white/70">
          <span
            aria-hidden="true"
            className="size-4 rounded-full border-2 border-white/30 border-t-white motion-safe:animate-spin"
          />
          {tt('obTgWait')}
        </div>

        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex h-[54px] w-full items-center justify-center gap-2.5 rounded-full bg-white px-5 text-[17px] font-semibold text-black transition-transform duration-150 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
        >
          <TelegramGlyph className="size-[18px] fill-[#229ED9]" />
          {tt('authQrOpenBot')}
        </a>

        {!isMobileBrowser() && (
          <button
            type="button"
            onClick={() => setQrOpen(true)}
            className="flex h-[54px] w-full items-center justify-center gap-2 rounded-full bg-white/[0.16] px-5 text-[17px] font-semibold text-white transition-transform duration-150 active:scale-[0.97] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
          >
            <QrCode size={18} strokeWidth={2.5} />
            {tt('authQrTitle')}
          </button>
        )}

        {qrOpen && url && <TelegramQrSheet url={url} onClose={() => setQrOpen(false)} />}
      </div>
    )
  }

  return (
    <div className="flex w-full flex-col gap-2">
      {error && (
        <p className="text-center text-[12px] font-semibold text-[#FF453A] motion-safe:animate-fadeIn">
          {error}
        </p>
      )}
      <button
        type="button"
        onClick={start}
        disabled={busy}
        aria-busy={busy}
        className="flex h-[54px] w-full items-center justify-center gap-2.5 rounded-full bg-white px-5 text-[17px] font-semibold text-black transition-transform duration-150 active:scale-[0.97] disabled:opacity-60 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
      >
        {busy ? (
          <span
            aria-hidden="true"
            className="size-5 rounded-full border-2 border-black/25 border-t-black motion-safe:animate-spin"
          />
        ) : (
          <TelegramGlyph className="size-[18px] fill-[#229ED9]" />
        )}
        {tt('authTelegramLogin')}
      </button>
    </div>
  )
}

function TelegramGlyph({ className = '' }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={className}>
      <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.479.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
    </svg>
  )
}
