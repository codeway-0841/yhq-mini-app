import { useEffect, useRef, useState } from 'react'
import { Download, Share2, Copy, Check, X, Award, Send, ExternalLink, Lightbulb } from 'lucide-react'
import { useAppStore } from '../../shared/store/useAppStore'
import { useSubjectStore } from '../../shared/store/useSubjectStore'
import { useT } from '../../shared/i18n'
import { shareUrl, openTelegramLink } from '../../platform/telegram'
import { haptics } from '../../platform/haptics'
import { playSound } from '../../shared/lib/sounds'
import { api } from '../../shared/api'
import { SUBJECT_BASES } from '../../../shared/subjects'
import DialogOverlay from '../../shared/components/DialogOverlay'
import { Button } from '../../shared/components/ui/button'
import { drawCertificate } from './certificate-canvas'

interface CertificateModalProps {
  score: number
  total: number
  percent: number
  /** true — Profil'dagi ko'rgazmali namuna: yuborish/ulashish o'chiq, "Namuna" badge */
  sample?: boolean
  onClose: () => void
}

function dataUrlToBlob(dataUrl: string): Blob {
  const parts = dataUrl.split(',')
  const mime = parts[0].match(/:(.*?);/)?.[1] || 'image/png'
  const bstr = atob(parts[1])
  let n = bstr.length
  const u8arr = new Uint8Array(n)
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n)
  }
  return new Blob([u8arr], { type: mime })
}

export default function CertificateModal({ score, total, percent, sample = false, onClose }: CertificateModalProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [copied, setCopied] = useState(false)
  const [sendingBot, setSendingBot] = useState(false)
  const [botSentSuccess, setBotSentSuccess] = useState(false)
  const [downloading, setDownloading] = useState(false)

  const user = useAppStore((s) => s.user)
  const lang = useAppStore((s) => s.settings.language)
  const subjectId = useSubjectStore((s) => s.subjectId)
  const tt = useT(lang)

  const subject = SUBJECT_BASES.find((s) => s.id === subjectId)
  const subjectName = lang === 'ru' ? (subject?.nameRu ?? 'ПДД') : (subject?.name ?? 'Yo‘l Harakati Qoidalari')

  const certIdRef = useRef(`KIWI-${(user?.id ?? 'GUEST').slice(-5).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`)
  const certId = sample ? 'NAMUNA' : certIdRef.current

  const formattedDate = new Intl.DateTimeFormat(lang === 'ru' ? 'ru-RU' : 'uz-UZ', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(new Date())

  const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || (lang === 'ru' ? 'Студент KIWI' : 'KIWI Tinglovchisi')

  useEffect(() => {
    if (!canvasRef.current) return
    drawCertificate(canvasRef.current, {
      userName: fullName,
      subjectName,
      score,
      total,
      percent,
      date: formattedDate,
      certId,
      lang,
    })
  }, [fullName, subjectName, score, total, percent, formattedDate, certId, lang])

  /** 1. Telegram Bot orqali to'g'ridan-to'g'ri jo'natish (100% kafolatlangan Telegram usuli) */
  const handleSendToTelegramBot = async () => {
    if (!canvasRef.current || sendingBot) return
    haptics.impact('medium')
    setSendingBot(true)

    try {
      const dataUrl = canvasRef.current.toDataURL('image/png')
      const res = await api.sendCertificate({
        imageBase64: dataUrl,
        certId,
        subjectName,
        score,
        total,
        percent,
      })

      if (res.sentToTelegram) {
        playSound('win')
        haptics.notify('success')
        setBotSentSuccess(true)
      } else {
        // Fallback: brauzer orqali yuklash
        handleDownload()
      }
    } catch (err) {
      console.warn('[Send to bot failed, triggering download fallback]', err)
      handleDownload()
    } finally {
      setSendingBot(false)
    }
  }

  /** 2. Qurilmaga saqlash (Web Share / Blob download) */
  const handleDownload = async () => {
    if (!canvasRef.current) return
    haptics.impact('light')
    setDownloading(true)

    try {
      const dataUrl = canvasRef.current.toDataURL('image/png')
      const fileName = `kiwi-certificate-${certId}.png`
      const blob = dataUrlToBlob(dataUrl)
      const file = new File([blob], fileName, { type: 'image/png' })

      // Web Share API
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({
            files: [file],
            title: tt('certOfficialTitle'),
            text: `KIWI · ${subjectName} (${certId})`,
          })
          setDownloading(false)
          return
        } catch (shareErr) {
          if ((shareErr as Error).name === 'AbortError') {
            setDownloading(false)
            return
          }
        }
      }

      // Standart Blob URL
      const blobUrl = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.download = fileName
      link.href = blobUrl
      link.style.display = 'none'
      document.body.appendChild(link)
      link.click()
      setTimeout(() => {
        document.body.removeChild(link)
        URL.revokeObjectURL(blobUrl)
      }, 1000)
    } catch (err) {
      console.warn('[Certificate download fallback]', err)
    } finally {
      setDownloading(false)
    }
  }

  const handleShare = () => {
    haptics.impact('light')
    const uid = user?.id ?? '0'
    const emoji = '🏆'
    const shareText = lang === 'ru'
      ? `${emoji} Я успешно сдал(а) экзамен по ${subjectName} в KIWI с результатом ${percent}%!\nСертификат № ${certId}\nПроверь свои знания:`
      : `${emoji} Men KIWI'da ${subjectName} bo‘yicha imtihonni ${percent}% bilan topshirdim!\nSertifikat № ${certId}\nO‘z bilimingni sinab ko‘r:`
    shareUrl(`https://t.me/kiwi_uz_bot?start=ref_${uid}`, shareText)
  }

  const handleCopyId = async () => {
    haptics.impact('light')
    try {
      await navigator.clipboard.writeText(certId)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // no-op
    }
  }

  return (
    <DialogOverlay onClose={onClose} position="center" labelId="certificate-title" className="animate-fadeIn" backdropClassName="bg-black/80 backdrop-blur-md">
      <div className="relative w-full max-w-lg rounded-container border border-plineStrong bg-pcard p-5 max-h-[92vh] overflow-y-auto flex flex-col items-center">
        {/* Close Button */}
        <button
          onClick={onClose}
          aria-label={tt('close')}
          className="absolute top-4 right-4 w-9 h-9 rounded-full bg-psurface border border-pline flex items-center justify-center text-pmuted hover:text-pfg transition-colors z-10"
        >
          <X size={18} />
        </button>

        {/* Title */}
        <div className="flex items-center gap-2 mb-3 mt-1">
          <Award className="text-pgold" size={24} />
          <h3 id="certificate-title" className="text-base font-semibold text-pfg">{tt('certOfficialTitle')}</h3>
          {sample && (
            <span className="rounded-full border border-[rgb(var(--p-gold-rgb)/0.35)] bg-[rgb(var(--p-gold-rgb)/0.12)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-pgold">
              {tt('certSampleBadge')}
            </span>
          )}
        </div>

        {/* Direct High-Resolution Canvas Display */}
        <div className="w-full rounded-container overflow-hidden shadow-2xl border border-pline mb-3 bg-black/40">
          <canvas
            ref={canvasRef}
            className="w-full h-auto block object-contain select-none"
            style={{ aspectRatio: '1200/850' }}
          />
        </div>

        {/* Certificate Metadata Pill — namunada yashirin */}
        {!sample && (
        <div className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-container bg-psurface border border-pline mb-3 text-xs font-semibold text-pmuted">
          <span className="truncate">ID: <span className="font-mono text-pfg">{certId}</span></span>
          <button
            onClick={handleCopyId}
            className="flex items-center gap-1 text-pblue hover:underline ml-2 flex-shrink-0"
          >
            {copied ? <Check size={14} className="text-pprimary" /> : <Copy size={14} />}
            <span>{copied ? tt('copied') : tt('copy')}</span>
          </button>
        </div>
        )}

        {/* Bot Sent Success Alert */}
        {botSentSuccess && (
          <div className="w-full bg-pprimary/15 border border-pprimary/40 rounded-container p-3.5 mb-3 flex flex-col items-center text-center animate-fadeIn">
            <p className="text-xs font-semibold text-pprimary mb-1">
              {tt('certSentSuccess')}
            </p>
            <button
              onClick={() => openTelegramLink('https://t.me/kiwi_uz_bot')}
              className="mt-1 text-[11.5px] font-semibold text-pfg underline flex items-center gap-1 hover:text-pprimary"
            >
              <span>{lang === 'ru' ? 'Открыть чат с ботом' : 'Bot chatini ochish'}</span>
              <ExternalLink size={12} />
            </button>
          </div>
        )}

        {/* Action Buttons — namunada soxta sertifikat tarqalmasligi uchun o'chiq */}
        {sample ? (
          <p className="flex items-start justify-center gap-1.5 px-2 text-center text-[11px] leading-snug text-pmuted">
            <Lightbulb size={12} strokeWidth={1.75} className="mt-px flex-none text-psubtle" aria-hidden="true" />
            {tt('certSampleHint')}
          </p>
        ) : (
          <>
            <div className="w-full flex flex-col gap-2 mb-2">
              {/* Primary CTA: Telegram Botga jo'natish (Rasmni saqlash) */}
              <Button
                variant="gold"
                size="lg"
                block
                loading={sendingBot}
                onClick={handleSendToTelegramBot}
              >
                <Send size={18} />
                {sendingBot ? tt('certSending') : tt('sendToTelegram')}
              </Button>

              {/* Secondary CTA: Qurilmaga to'g'ridan-to'g'ri yuklash */}
              <Button
                variant="secondary"
                block
                loading={downloading}
                onClick={handleDownload}
              >
                <Download size={16} />
                {downloading ? tt('downloading') : tt('downloadCertificate')}
              </Button>

              {/* Share CTA */}
              <Button
                variant="secondary"
                block
                onClick={handleShare}
              >
                <Share2 size={15} className="text-pblue" />
                {tt('shareCertificate')}
              </Button>
            </div>

            {/* Mobile helper hint */}
            <p className="flex items-start justify-center gap-1.5 px-2 text-center text-[11px] leading-snug text-pmuted">
              <Lightbulb size={12} strokeWidth={1.75} className="mt-px flex-none text-psubtle" aria-hidden="true" />
              {lang === 'ru'
                ? 'Сертификат отправляется прямо в ваш диалог с ботом в высоком качестве.'
                : 'Sertifikat botingiz bilan bo‘lgan shaxsiy chatga original yuqori sifatda yuboriladi.'}
            </p>
          </>
        )}
      </div>
    </DialogOverlay>
  )
}
