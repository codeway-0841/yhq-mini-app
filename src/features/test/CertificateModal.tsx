import { useEffect, useRef, useState } from 'react'
import { Download, Share2, Copy, Check, X, Award } from 'lucide-react'
import { useAppStore } from '../../shared/store/useAppStore'
import { useSubjectStore } from '../../shared/store/useSubjectStore'
import { useT } from '../../shared/i18n'
import { shareUrl } from '../../platform/telegram'
import { haptics } from '../../platform/haptics'
import { SUBJECT_BASES } from '../../../shared/subjects'
import { drawCertificate } from './certificate-canvas'

interface CertificateModalProps {
  score: number
  total: number
  percent: number
  onClose: () => void
}

export default function CertificateModal({ score, total, percent, onClose }: CertificateModalProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [copied, setCopied] = useState(false)

  const user = useAppStore((s) => s.user)
  const lang = useAppStore((s) => s.settings.language)
  const subjectId = useSubjectStore((s) => s.subjectId)
  const tt = useT(lang)

  const subject = SUBJECT_BASES.find((s) => s.id === subjectId)
  const subjectName = lang === 'ru' ? (subject?.nameRu ?? 'ПДД') : (subject?.name ?? 'Yo‘l Harakati Qoidalari')

  const certIdRef = useRef(`KIWI-${(user?.id ?? 'GUEST').slice(-5).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`)
  const certId = certIdRef.current

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

  const handleDownload = () => {
    if (!canvasRef.current) return
    haptics.impact('light')
    const dataUrl = canvasRef.current.toDataURL('image/png')
    const link = document.createElement('a')
    link.download = `kiwi-certificate-${certId}.png`
    link.href = dataUrl
    link.click()
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-lg card-neon rounded-3xl p-5 border border-lineStrong max-h-[92vh] overflow-y-auto flex flex-col items-center">
        {/* Close Button */}
        <button
          onClick={onClose}
          aria-label={tt('backWord')}
          className="absolute top-4 right-4 w-9 h-9 rounded-full bg-elevated border border-line flex items-center justify-center text-muted hover:text-fg transition-colors z-10"
        >
          <X size={18} />
        </button>

        {/* Title */}
        <div className="flex items-center gap-2 mb-3 mt-1">
          <Award className="text-pgold" size={24} />
          <h3 className="text-base font-black text-fg">{tt('certOfficialTitle')}</h3>
        </div>

        {/* Canvas Certificate Preview */}
        <div className="w-full rounded-2xl overflow-hidden shadow-2xl border border-line mb-4 bg-black/40">
          <canvas
            ref={canvasRef}
            className="w-full h-auto block object-contain"
            style={{ aspectRatio: '1200/850' }}
          />
        </div>

        {/* Certificate Metadata Pill */}
        <div className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl bg-elevated border border-line mb-4 text-xs font-bold text-muted">
          <span className="truncate">ID: <span className="font-mono text-fg">{certId}</span></span>
          <button
            onClick={handleCopyId}
            className="flex items-center gap-1 text-duo-blue hover:underline ml-2 flex-shrink-0"
          >
            {copied ? <Check size={14} className="text-duo-green" /> : <Copy size={14} />}
            <span>{copied ? tt('copied') : tt('copy')}</span>
          </button>
        </div>

        {/* Action Buttons */}
        <div className="w-full flex flex-col gap-2.5">
          <button
            onClick={handleDownload}
            className="btn-premium w-full py-3.5 rounded-2xl font-black text-sm flex items-center justify-center gap-2 shadow-lg"
          >
            <Download size={18} />
            {tt('downloadCertificate')}
          </button>

          <button
            onClick={handleShare}
            className="btn-3d-ghost w-full py-3 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 text-duo-blue"
          >
            <Share2 size={16} />
            {tt('shareCertificate')}
          </button>
        </div>
      </div>
    </div>
  )
}
