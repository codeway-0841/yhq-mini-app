import { useEffect, useState } from 'react'
import { RotateCcw, Share2, X, BookOpen, Award, ImageDown } from 'lucide-react'
import { useAppStore } from '../../shared/store/useAppStore'
import { useSubjectStore } from '../../shared/store/useSubjectStore'
import { useT } from '../../shared/i18n'
import { shareUrl } from '../../platform/telegram'
import { haptics } from '../../platform/haptics'
import { playSound } from '../../shared/lib/sounds'
import { SUBJECT_BASES } from '../../../shared/subjects'
import Confetti from '../../shared/components/Confetti'
import DonutChart from './DonutChart'
import CertificateModal from './CertificateModal'
import { drawResultCard, buildResultShareText } from './result-canvas'
import type { TopicBreakdownItem } from './topic-diagnosis'

export type QuestionResult = { questionId: number; status: 'correct' | 'incorrect' | 'unanswered' }

export default function ResultsModal({
  results,
  onRetry,
  onFinish,
  onGoToQuestion,
  onOpenReview,
  threshold = 90,
  hideVerdict = false,
  topicBreakdown,
  disqualifiedByCheat = false,
}: {
  results: QuestionResult[]
  onRetry: () => void
  onFinish: () => void
  onGoToQuestion: (i: number) => void
  onOpenReview?: () => void
  /** o'tish foizi — exam rejimida 90 (haqiqiy imtihon), qolganida 80 */
  threshold?: number
  /** Rasmiy preset (milliy-sertifikat/attestatsiya): o'tdi/o'tmadi mezonsiz — faqat natija */
  hideVerdict?: boolean
  /** Yakunda mavzular kesimida diagnostika (rasmiy imtihon presetlarida) */
  topicBreakdown?: TopicBreakdownItem[]
  /** Anti-Cheat qoidabuzarlik tufayli to'xtatilganmi */
  disqualifiedByCheat?: boolean
}) {
  const [showCertificate, setShowCertificate] = useState(false)
  const [sharingImage, setSharingImage] = useState(false)
  const tt           = useT(useAppStore((s) => s.settings.language))
  const total      = results.length
  const correct    = results.filter((r) => r.status === 'correct').length
  const wrong      = results.filter((r) => r.status === 'incorrect').length
  const unanswered = results.filter((r) => r.status === 'unanswered').length
  const percent    = total > 0 ? Math.round((correct / total) * 100) : 0
  const passed     = percent >= threshold && !disqualifiedByCheat

  /** #48 — natijani RASM qilib ulashish: canvas karta → Web Share (fayl) → fallback shareUrl + yuklab olish. */
  const handleShareImage = async () => {
    if (sharingImage) return
    haptics.impact('light')
    setSharingImage(true)
    try {
      const state = useAppStore.getState()
      const lang = state.settings.language
      const uid = state.user?.id ?? '0'
      const fullName = [state.user?.firstName, state.user?.lastName].filter(Boolean).join(' ')
      const subjectId = useSubjectStore.getState().subjectId
      const subject = SUBJECT_BASES.find((s) => s.id === subjectId)
      const subjectName = lang === 'ru' ? (subject?.nameRu ?? 'ПДД') : (subject?.name ?? 'YHQ')
      const shareText = buildResultShareText({ correct, total, percent, passed, streak: state.streak, lang })
      const link = `https://t.me/kiwi_uz_bot?start=ref_${uid}`

      const canvas = document.createElement('canvas')
      drawResultCard(canvas, {
        userName: fullName,
        subjectName,
        correct, wrong, unanswered, total, percent, passed,
        streak: state.streak,
        date: new Intl.DateTimeFormat(lang === 'ru' ? 'ru-RU' : 'uz-UZ', { day: '2-digit', month: 'long', year: 'numeric' }).format(new Date()),
        lang,
      })

      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
      const file = blob ? new File([blob], `kiwi-result-${percent}pct.png`, { type: 'image/png' }) : null

      if (file && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: 'KIWI', text: `${shareText}\n${link}` })
        return
      }
      // Fallback: Telegram matn-share + rasmni qurilmaga yuklab olish (qo'lda yuboriladi)
      shareUrl(link, shareText)
      if (blob) {
        const a = document.createElement('a')
        a.href = URL.createObjectURL(blob)
        a.download = `kiwi-result-${percent}pct.png`
        a.click()
        setTimeout(() => URL.revokeObjectURL(a.href), 1000)
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') console.warn('[share-image]', err)
    } finally {
      setSharingImage(false)
    }
  }

  // Natija ochildi — qisqa g'alaba fanfarasi yoki xato tovush
  useEffect(() => {
    playSound(disqualifiedByCheat ? 'error' : 'win')
  }, [disqualifiedByCheat])

  return (
    <div className="fixed inset-0 z-50 flex items-end">
      {passed && !hideVerdict && !disqualifiedByCheat && <Confetti />}
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={onFinish} />
      <div className="relative w-full card-neon rounded-t-3xl border-t border-lineStrong p-5 pb-8 max-h-[88vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <button onClick={onFinish} aria-label={tt('closeResults')} className="absolute top-5 right-5 w-8 h-8 rounded-full bg-elevated border border-line flex items-center justify-center text-muted hover:text-fg transition-colors">
          <X size={16} />
        </button>
        <div className="w-10 h-1 bg-line rounded-full mx-auto mb-4" />
        <h2 className="text-center text-lg font-black mb-1">{tt('results')}</h2>

        {disqualifiedByCheat && (
          <div className="mb-4 bg-duo-red/15 border-2 border-duo-red/60 rounded-2xl p-4 text-center">
            <p className="text-sm font-black text-duo-red mb-1">
              {tt('antiCheatDisqualifiedTitle')}
            </p>
            <p className="text-xs text-subtle">
              {tt('antiCheatDisqualifiedDesc')}
            </p>
          </div>
        )}

        <DonutChart correct={correct} total={total} threshold={threshold} hideVerdict={hideVerdict || disqualifiedByCheat}
          passedLabel={tt('passed')} failedLabel={tt('failed')} />

        <div className="grid grid-cols-3 gap-2 mb-5 animate-scorePop">
          <div className="rounded-2xl p-3 text-center border" style={{ background: 'rgb(var(--p-primary-rgb) / 0.12)', borderColor: 'rgb(var(--p-primary-rgb) / 0.30)' }}>
            <p className="text-base font-black text-duo-green leading-none">✓</p>
            <p className="text-3xl font-black text-fg mt-1">{correct}</p>
            <p className="text-[11px] font-bold text-muted mt-1">{tt('correct')}</p>
          </div>
          <div className="rounded-2xl p-3 text-center border" style={{ background: 'rgba(239, 68, 68, 0.10)', borderColor: 'rgba(239, 68, 68, 0.30)' }}>
            <p className="text-base font-black text-duo-red leading-none">✗</p>
            <p className="text-3xl font-black text-fg mt-1">{wrong}</p>
            <p className="text-[11px] font-bold text-muted mt-1">{tt('wrong')}</p>
          </div>
          <div className="rounded-2xl bg-elevated border border-line p-3 text-center">
            <p className="text-base font-black text-subtle leading-none">—</p>
            <p className="text-3xl font-black text-fg mt-1">{unanswered}</p>
            <p className="text-[11px] font-bold text-subtle mt-1">{tt('unanswered')}</p>
          </div>
        </div>

        {/* Mavzular kesimida diagnostika — rasmiy imtihon presetlarida.
            Eng zaif mavzu yuqorida: nima takrorlash kerak darhol ko'rinadi. */}
        {topicBreakdown && topicBreakdown.length > 0 && (
          <div className="mb-5">
            <p className="text-sm font-bold mb-2">{tt('topicBreakdownTitle')}</p>
            <div className="flex flex-col gap-2">
              {topicBreakdown.map((t) => {
                const color = t.pct >= 70 ? 'var(--p-success)' : t.pct >= 40 ? 'var(--p-warning)' : 'var(--p-danger)'
                return (
                  <div key={t.topicId ?? -1}>
                    <div className="flex items-baseline justify-between gap-2 mb-1">
                      <p className="text-[12.5px] font-bold text-fg truncate">{t.name}</p>
                      <p className="text-[11px] font-bold text-muted flex-shrink-0 tabular-nums">
                        {t.correct}/{t.total} · {t.pct}%
                      </p>
                    </div>
                    <div className="h-1.5 rounded-full bg-elevated overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${t.pct}%`, background: color }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        <p className="text-sm font-bold mb-3">{tt('question')}</p>
        <div className="grid grid-cols-8 gap-1.5 mb-6">
          {results.map((r, i) => (
            <button key={r.questionId} onClick={() => onGoToQuestion(i)}
              aria-label={`${tt('question')} ${i + 1}, ${r.status === 'correct' ? tt('correct') : r.status === 'incorrect' ? tt('wrong') : tt('unanswered')}`}
              className={`aspect-square rounded-full flex items-center justify-center text-[11px] font-bold transition-all active:scale-90 ${
                r.status === 'correct'   ? 'bg-duo-green text-ponprimary' :
                r.status === 'incorrect' ? 'bg-duo-red text-white'   :
                                           'bg-elevated text-muted'
              }`}>
              {i + 1}
            </button>
          ))}
        </div>

        {/* 🏆 Sertifikat tugmasi (imtihon topshirilganda yoki yuqori natijada) */}
        {passed && !disqualifiedByCheat && (
          <button
            type="button"
            onClick={() => setShowCertificate(true)}
            className="btn-premium w-full mb-3 py-3.5 rounded-2xl font-black text-sm flex items-center justify-center gap-2 shadow-lg bg-gradient-to-r from-amber-500 to-yellow-500 text-black"
          >
            <Award size={18} className="text-black" />
            {tt('viewCertificate')}
          </button>
        )}

        {onOpenReview && (
          <button
            type="button"
            onClick={onOpenReview}
            className="btn-premium w-full mb-3 py-3.5 rounded-2xl font-black text-sm flex items-center justify-center gap-2 shadow-lg"
          >
            <BookOpen size={16} />
            {tt('examReviewBtn')}
          </button>
        )}

        <div className="flex gap-3">
          <button onClick={onRetry}
            aria-label={tt('retry')}
            className="btn-3d-ghost flex-1 py-3.5 rounded-2xl font-extrabold flex items-center justify-center gap-2">
            <RotateCcw size={16} aria-hidden="true" />
            {tt('retry')}
          </button>
          <button onClick={onFinish}
            className="btn-neon flex-[2] py-3.5 rounded-2xl font-black text-base">
            {tt('finish')}
          </button>
        </div>

        {/* 🖼 Natijani RASM qilib ulashish (#48) — canvas karta; Web Share bo'lmasa
            matn-share + rasm yuklab olish fallback */}
        <button
          onClick={handleShareImage}
          disabled={sharingImage}
          className="btn-3d-ghost w-full mt-3 py-3 rounded-2xl font-bold text-[13px] flex items-center justify-center gap-2 text-duo-blue">
          <ImageDown size={15} />
          {sharingImage ? '...' : tt('shareResultImage')}
        </button>

        {/* ✉️ Matn + referal link bilan ulashish */}
        <button
          onClick={() => {
            const uid  = useAppStore.getState().user?.id
            const lang = useAppStore.getState().settings.language
            const streak = useAppStore.getState().streak
            const text = buildResultShareText({ correct, total, percent, passed, streak, lang })
            shareUrl(`https://t.me/kiwi_uz_bot?start=ref_${uid ?? '0'}`, text)
          }}
          className="btn-3d-ghost w-full mt-3 py-3 rounded-2xl font-bold text-[13px] flex items-center justify-center gap-2 text-duo-blue">
          <Share2 size={15} />
          {tt('shareResult')}
        </button>

        {showCertificate && (
          <CertificateModal
            score={correct}
            total={total}
            percent={percent}
            onClose={() => setShowCertificate(false)}
          />
        )}
      </div>
    </div>
  )
}
