import { useRef, useState } from 'react'
import {
  Award,
  Download,
  Share2,
  X,
  CheckCircle2,
  Sparkles,
  ShieldCheck,
  Calendar,
  Layers,
} from 'lucide-react'
import { haptics } from '../../../platform/haptics'
import { useAppStore } from '../../../shared/store/useAppStore'
import type { WonderCourse } from '../types'

interface WonderCertificateModalProps {
  course: WonderCourse
  totalLessons: number
  onClose: () => void
}

export default function WonderCertificateModal({
  course,
  totalLessons,
  onClose,
}: WonderCertificateModalProps) {
  const appUser = useAppStore((s) => s.user)
  const appDisplayName = useAppStore((s) => s.displayName)
  const [copied, setCopied] = useState(false)
  const certificateRef = useRef<HTMLDivElement>(null)

  const studentName =
    appDisplayName ||
    appUser?.firstName ||
    (appUser?.username ? `@${appUser.username}` : "Kivvi O'quvchisi")

  const completionDate = new Date().toLocaleDateString('uz-UZ', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  // Deterministic certificate hash code
  const certId = `KIVVI-WND-${course.id
    .replace(/[^a-zA-Z0-9]/g, '')
    .slice(0, 6)
    .toUpperCase()}-${Math.abs(
    course.title.split('').reduce((acc, char) => ((acc << 5) - acc) + char.charCodeAt(0), 0),
  )
    .toString(36)
    .toUpperCase()}`

  const handleShare = () => {
    haptics.selection()
    const text = `Men Kivvi Wonder Studio'da "${course.title}" kursini 100% muvaffaqiyatli tamomladim! 🎓 Sertifikat ID: ${certId}`
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    }
  }

  const handlePrint = () => {
    haptics.selection()
    window.print()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-stone-950/80 backdrop-blur-md animate-in fade-in duration-200 overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-stone-900 border border-stone-800 rounded-3xl shadow-2xl overflow-hidden my-auto animate-in zoom-in-95 duration-200">
        {/* Header Close button */}
        <div className="flex items-center justify-between p-4 border-b border-stone-800/80 bg-stone-900/60">
          <div className="flex items-center gap-2">
            <Award className="size-5 text-amber-400" />
            <span className="font-mono text-xs font-bold uppercase tracking-wider text-amber-300">
              Rasmiy Sertifikat
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl border border-stone-700 bg-stone-800 text-stone-300 hover:text-white transition-colors cursor-pointer"
            aria-label="Yopish"
          >
            <X size={18} />
          </button>
        </div>

        {/* Certificate Card Content */}
        <div className="p-4 sm:p-8">
          <div
            ref={certificateRef}
            className="relative bg-gradient-to-br from-[#FAF8F2] via-[#FFFDF8] to-[#F5EFE0] dark:from-[#1C1411] dark:via-[#221915] dark:to-[#17100D] border-4 border-double border-amber-600/40 dark:border-amber-500/40 rounded-2xl p-6 sm:p-10 text-center shadow-inner overflow-hidden select-none"
          >
            {/* Background luxury watermark */}
            <div className="absolute inset-0 opacity-[0.03] dark:opacity-[0.05] pointer-events-none flex items-center justify-center">
              <Award className="size-96 text-stone-900 dark:text-white" />
            </div>

            {/* Corner Decorative Ornaments */}
            <div className="absolute top-2 left-2 size-6 border-t-2 border-l-2 border-amber-600/60 dark:border-amber-500/60 rounded-tl" />
            <div className="absolute top-2 right-2 size-6 border-t-2 border-r-2 border-amber-600/60 dark:border-amber-500/60 rounded-tr" />
            <div className="absolute bottom-2 left-2 size-6 border-b-2 border-l-2 border-amber-600/60 dark:border-amber-500/60 rounded-bl" />
            <div className="absolute bottom-2 right-2 size-6 border-b-2 border-r-2 border-amber-600/60 dark:border-amber-500/60 rounded-br" />

            {/* Academy Top Header */}
            <div className="space-y-1 mb-6">
              <div className="flex items-center justify-center gap-2 text-amber-700 dark:text-amber-400 font-mono text-xs uppercase tracking-widest font-black">
                <Sparkles size={14} />
                <span>KIVVI &bull; WONDERING ACADEMY</span>
                <Sparkles size={14} />
              </div>
              <h2 className="text-2xl sm:text-4xl font-serif font-black tracking-wider text-stone-900 dark:text-stone-100 uppercase">
                Tamomlanganlik Sertifikati
              </h2>
              <p className="text-xs text-stone-500 dark:text-stone-400 font-sans tracking-wide">
                Certificate of Mastered Achievement
              </p>
            </div>

            {/* Recipient Details */}
            <div className="my-6 space-y-2">
              <p className="text-xs sm:text-sm text-stone-600 dark:text-stone-400 font-medium">
                Ushbu sertifikat tasdiqlaydiki:
              </p>
              <h3 className="text-2xl sm:text-3xl font-serif font-black text-amber-900 dark:text-amber-300 tracking-tight pb-1 border-b-2 border-amber-500/30 max-w-md mx-auto">
                {studentName}
              </h3>
            </div>

            {/* Course Title */}
            <div className="my-6 space-y-2">
              <p className="text-xs sm:text-sm text-stone-600 dark:text-stone-400 font-medium">
                quyidagi kursni to&apos;liq va a&apos;lo natija bilan o&apos;zlashtirdi:
              </p>
              <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 inline-block max-w-lg">
                <h4 className="text-lg sm:text-xl font-sans font-black text-stone-900 dark:text-stone-100">
                  {course.title}
                </h4>
                {course.description && (
                  <p className="text-xs text-stone-600 dark:text-stone-400 line-clamp-2 mt-1">
                    {course.description}
                  </p>
                )}
              </div>
            </div>

            {/* Metrics Breakdown */}
            <div className="grid grid-cols-3 gap-3 max-w-md mx-auto my-6 p-3 rounded-xl bg-black/5 dark:bg-white/5 border border-stone-300/40 dark:border-stone-800 text-xs">
              <div className="space-y-0.5">
                <div className="flex items-center justify-center gap-1 text-stone-500 dark:text-stone-400">
                  <Layers size={13} />
                  <span>Darslar</span>
                </div>
                <div className="font-bold text-stone-900 dark:text-stone-100 text-sm">
                  {totalLessons} ta dars
                </div>
              </div>

              <div className="space-y-0.5">
                <div className="flex items-center justify-center gap-1 text-stone-500 dark:text-stone-400">
                  <CheckCircle2 size={13} className="text-emerald-500" />
                  <span>Natija</span>
                </div>
                <div className="font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                  100% Mastery
                </div>
              </div>

              <div className="space-y-0.5">
                <div className="flex items-center justify-center gap-1 text-stone-500 dark:text-stone-400">
                  <Calendar size={13} />
                  <span>Sana</span>
                </div>
                <div className="font-bold text-stone-900 dark:text-stone-100 text-xs truncate">
                  {completionDate}
                </div>
              </div>
            </div>

            {/* Seal & Verification Signature */}
            <div className="pt-4 border-t border-stone-300/60 dark:border-stone-800 flex items-center justify-between gap-4 text-left">
              <div className="flex items-center gap-2">
                <div className="size-10 rounded-full bg-gradient-to-tr from-amber-600 to-yellow-400 flex items-center justify-center text-stone-950 shadow-md">
                  <ShieldCheck size={22} strokeWidth={2.2} />
                </div>
                <div>
                  <div className="text-[10px] uppercase font-mono tracking-wider text-stone-400">
                    Tasdiqlangan
                  </div>
                  <div className="text-xs font-mono font-bold text-stone-800 dark:text-stone-200">
                    {certId}
                  </div>
                </div>
              </div>

              <div className="text-right">
                <div className="font-serif italic text-sm font-bold text-stone-800 dark:text-stone-200">
                  Kivvi Studio
                </div>
                <div className="text-[10px] text-stone-400 uppercase tracking-widest font-mono">
                  Verified Academic Seal
                </div>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap items-center justify-center gap-3 mt-6">
            <button
              type="button"
              onClick={handleShare}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-stone-700 bg-stone-800 hover:bg-stone-700 text-stone-100 font-medium text-xs transition-colors cursor-pointer"
            >
              <Share2 size={15} />
              <span>{copied ? 'Nusxa olindi!' : 'Ulashish'}</span>
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs transition-colors cursor-pointer shadow-md"
            >
              <Download size={15} />
              <span>Sertifikatni saqlash / Chop etish</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
