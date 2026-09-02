import { useEffect, useState } from 'react'
import { RotateCcw, Share2, X, BookOpen, Award, ImageDown, Check, Minus } from 'lucide-react'
import { useAppStore } from '../../shared/store/useAppStore'
import { useSubjectStore } from '../../shared/store/useSubjectStore'
import { useT } from '../../shared/i18n'
import { api } from '../../shared/api'
import { shareUrl } from '../../platform/telegram'
import { haptics } from '../../platform/haptics'
import { playSound } from '../../shared/lib/sounds'
import { SUBJECT_BASES } from '../../../shared/subjects'
import Confetti from '../../shared/components/Confetti'
import DialogOverlay from '../../shared/components/DialogOverlay'
import DonutChart from './DonutChart'
import CertificateModal from './CertificateModal'
import { drawResultCard, buildResultShareText } from './result-canvas'
import type { TopicBreakdownItem } from './topic-diagnosis'

export type QuestionResult = { questionId: number; status: 'correct' | 'incorrect' | 'unanswered' | 'pending' }

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
  const [imageSentToBot, setImageSentToBot] = useState(false)
  const tt           = useT(useAppStore((s) => s.settings.language))
  const total      = results.length
  const correct    = results.filter((r) => r.status === 'correct').length
  const wrong      = results.filter((r) => r.status === 'incorrect').length
  const pending    = results.filter((r) => r.status === 'pending').length
  const unanswered = results.filter((r) => r.status === 'unanswered' || r.status === 'pending').length
  const percent    = total > 0 ? Math.round((correct / total) * 100) : 0
  const passed     = percent >= threshold && !disqualifiedByCheat

  /** #48 — natijani RASM qilib ulashish. Muhimlilik tartibi:
   *  1) Web Share (files) — brauzer/tashqi WebView'da ishlaydi
   *  2) BOT orqali chatga — Telegram WebView'da navigator.share YO'Q va
   *     `<a download>` blob jimgina ishlamaydi → bu YAGONA kafolatli yo'l
   *  3) shareUrl (matn) — oxirgi fallback */
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
      const file = blob ? new File([blob], `kivvi-result-${percent}pct.png`, { type: 'image/png' }) : null

      // 1) Haqiqiy Web Share (brauzer va ba'zi WebView'larda)
      if (file && navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: 'KIVVI', text: `${shareText}\n${link}` })
          return
        } catch (err) {
          if ((err as Error).name === 'AbortError') return // user bekor qildi
          // boshqa xato — keyingi yo'lga tushamiz
        }
      }

      // 2) Bot orqali shaxsiy chatga (Telegram WebView'da kafolatli)
      try {
        const res = await api.sendShareImage({
          imageBase64: canvas.toDataURL('image/png'),
          caption:     `${shareText}\n${link}`,
          fileName:    `kivvi-result-${percent}pct.png`,
        })
        if (res.sentToTelegram) {
          playSound('win')
          haptics.notify('success')
          setImageSentToBot(true)
          return
        }
      } catch (err) {
        console.warn('[share-image bot send]', err)
      }

      // 3) Oxirgi fallback — matn-share
      shareUrl(link, shareText)
    } catch (err) {
      console.warn('[share-image]', err)
    } finally {
      setSharingImage(false)
    }
  }

  // Natija ochildi — g'alaba fanfarasi + tangalar yomg'iri yoki xato tovush
  useEffect(() => {
    if (disqualifiedByCheat) {
      playSound('error')
      haptics.notify('error')
    } else if (passed) {
      playSound('win')
      haptics.notify('success')
    } else {
      playSound('click')
    }
  }, [disqualifiedByCheat, passed])

  return (
    <DialogOverlay onClose={onFinish} labelId="results-title">
      {passed && !hideVerdict && !disqualifiedByCheat && <Confetti />}
      <div className="relative w-full rounded-container border border-pline bg-pcard rounded-t-sheet border-t border-plineStrong p-5 pb-8 max-h-[88vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <button onClick={onFinish} aria-label={tt('closeResults')} className="absolute top-5 right-5 size-8 rounded-full bg-psurface shadow-xs flex items-center justify-center text-pmuted hover:text-pfg transition-colors">
          <X size={16} />
        </button>
        <div className="w-10 h-1 bg-plineStrong rounded-full mx-auto mb-4" />
        <h2 id="results-title" className="text-center text-lg font-semibold mb-1">{tt('results')}</h2>

        {disqualifiedByCheat && (
          <div className="mb-4 bg-pdanger/15 rounded-2xl p-4 text-center shadow-xs">
            <p className="text-sm font-semibold text-pdanger mb-1">
              {tt('antiCheatDisqualifiedTitle')}
            </p>
            <p className="text-xs text-psubtle">
              {tt('antiCheatDisqualifiedDesc')}
            </p>
          </div>
        )}

        {pending > 0 && (
          <div className="mb-4 bg-pblue/15 rounded-2xl p-3 flex items-center gap-2.5 shadow-xs">
            <div className="w-2 h-2 rounded-full bg-pblue animate-ping flex-shrink-0" />
            <p className="text-xs text-pfg font-medium">
              {pending} {tt('pendingSyncNotice') || `${pending} ta javob oflayn saqlandi (internet ulanganda natija yangilanadi)`}
            </p>
          </div>
        )}

        <DonutChart correct={correct} total={total} threshold={threshold} hideVerdict={hideVerdict || disqualifiedByCheat}
          passedLabel={tt('passed')} failedLabel={tt('failed')} />

        <div className="grid grid-cols-3 gap-2 mb-5 animate-scorePop">
          <div className="rounded-2xl bg-pwash p-3 text-center shadow-xs">
            <Check size={16} strokeWidth={2} className="mx-auto text-pprimary" aria-hidden="true" />
            <p className="mt-1.5 font-display text-[28px] font-semibold tabular-nums leading-none text-pfg">{correct}</p>
            <p className="mt-1.5 text-[11px] font-medium text-pmuted">{tt('correct')}</p>
          </div>
          <div className="rounded-2xl bg-[rgb(var(--p-danger-rgb)/0.10)] p-3 text-center shadow-xs">
            <X size={16} strokeWidth={2} className="mx-auto text-pdanger" aria-hidden="true" />
            <p className="mt-1.5 font-display text-[28px] font-semibold tabular-nums leading-none text-pfg">{wrong}</p>
            <p className="mt-1.5 text-[11px] font-medium text-pmuted">{tt('wrong')}</p>
          </div>
          <div className="rounded-2xl bg-psurface p-3 text-center shadow-xs">
            <Minus size={16} strokeWidth={2} className="mx-auto text-psubtle" aria-hidden="true" />
            <p className="mt-1.5 font-display text-[28px] font-semibold tabular-nums leading-none text-pfg">{unanswered}</p>
            <p className="mt-1.5 text-[11px] font-medium text-psubtle">{tt('unanswered')}</p>
          </div>
        </div>

        {/* Mavzular kesimida diagnostika — rasmiy imtihon presetlarida.
            Eng zaif mavzu yuqorida: nima takrorlash kerak darhol ko'rinadi. */}
        {topicBreakdown && topicBreakdown.length > 0 && (
          <div className="mb-5">
            <p className="text-sm font-semibold mb-2">{tt('topicBreakdownTitle')}</p>
            <div className="flex flex-col gap-2">
              {topicBreakdown.map((t) => {
                const color = t.pct >= 70 ? 'var(--p-success)' : t.pct >= 40 ? 'var(--p-warning)' : 'var(--p-danger)'
                return (
                  <div key={t.topicId ?? -1}>
                    <div className="flex items-baseline justify-between gap-2 mb-1">
                      <p className="text-[12.5px] font-semibold text-pfg truncate">{t.name}</p>
                      <p className="text-[11px] font-semibold text-pmuted flex-shrink-0 tabular-nums">
                        {t.correct}/{t.total} · {t.pct}%
                      </p>
                    </div>
                    <div className="h-1.5 rounded-full bg-psurface overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${t.pct}%`, background: color }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        <p className="text-sm font-semibold mb-3">{tt('question')}</p>
        <div className="grid grid-cols-8 gap-1.5 mb-6">
          {results.map((r, i) => (
            <button key={r.questionId} onClick={() => onGoToQuestion(i)}
              aria-label={`${tt('question')} ${i + 1}, ${r.status === 'correct' ? tt('correct') : r.status === 'incorrect' ? tt('wrong') : r.status === 'pending' ? 'pending' : tt('unanswered')}`}
              className={`aspect-square rounded-full flex items-center justify-center text-[11px] font-semibold transition-all active:scale-90 ${
                r.status === 'correct'   ? 'bg-pprimary text-ponprimary' :
                r.status === 'incorrect' ? 'bg-pdanger text-white'   :
                r.status === 'pending'   ? 'bg-pblue/20 text-pblue ring-1 ring-pblue/50' :
                                           'bg-psurface text-pmuted'
              }`}>
              {i + 1}
            </button>
          ))}
        </div>

        {/* Sertifikat tugmasi (imtihon topshirilganda yoki yuqori natijada) */}
        {passed && !disqualifiedByCheat && (
          <button
            type="button"
            onClick={() => setShowCertificate(true)}
            className="bg-pgold text-pongold font-semibold hover:brightness-[1.06] active:scale-[0.98] transition-[transform,filter] duration-[120ms] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pprimary focus-visible:ring-offset-2 rounded-control mb-3 flex h-11 w-full items-center justify-center gap-2 text-sm font-semibold"
          >
            <Award size={17} strokeWidth={1.75} />
            {tt('viewCertificate')}
          </button>
        )}

        {onOpenReview && (
          <button
            type="button"
            onClick={onOpenReview}
            className="bg-pprimary text-ponprimary font-semibold hover:brightness-[1.06] active:scale-[0.98] disabled:opacity-[0.42] disabled:pointer-events-none transition-[transform,filter] duration-[120ms] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pprimary focus-visible:ring-offset-2 rounded-control mb-3 flex h-11 w-full items-center justify-center gap-2 text-sm font-semibold"
          >
            <BookOpen size={16} strokeWidth={1.75} />
            {tt('examReviewBtn')}
          </button>
        )}

        <div className="flex gap-3">
          <button onClick={onRetry}
            aria-label={tt('retry')}
            className="bg-psurface text-pfg active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none transition-all duration-[120ms] rounded-2xl flex h-11 flex-1 items-center justify-center gap-2 font-semibold shadow-xs hover:bg-psurface/80">
            <RotateCcw size={16} strokeWidth={1.75} aria-hidden="true" />
            {tt('retry')}
          </button>
          <button onClick={onFinish}
            className="bg-pprimary text-ponprimary font-semibold hover:brightness-[1.06] active:scale-[0.98] transition-all duration-[120ms] rounded-2xl h-11 flex-[2] font-semibold shadow-xs">
            {tt('finish')}
          </button>
        </div>

        {/* Natijani RASM qilib ulashish (#48) — Web Share → bot chat → matn fallback */}
        <button
          onClick={handleShareImage}
          disabled={sharingImage}
          className="bg-psurface text-pfg active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none transition-all duration-[120ms] rounded-2xl mt-3 flex h-11 w-full items-center justify-center gap-2 text-[13px] font-semibold text-pblue shadow-xs hover:bg-psurface/80">
          <ImageDown size={15} strokeWidth={1.75} />
          {sharingImage ? '...' : tt('shareResultImage')}
        </button>
        {imageSentToBot && (
          <p className="mt-2 text-center text-[11.5px] font-semibold text-pprimary animate-fadeIn">
            {tt('shareResultImageSent')}
          </p>
        )}

        {/* Matn + referal link bilan ulashish */}
        <button
          onClick={() => {
            const uid  = useAppStore.getState().user?.id
            const lang = useAppStore.getState().settings.language
            const streak = useAppStore.getState().streak
            const text = buildResultShareText({ correct, total, percent, passed, streak, lang })
            shareUrl(`https://t.me/kiwi_uz_bot?start=ref_${uid ?? '0'}`, text)
          }}
          className="bg-psurface text-pfg active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none transition-all duration-[120ms] rounded-2xl mt-3 flex h-11 w-full items-center justify-center gap-2 text-[13px] font-semibold text-pblue shadow-xs hover:bg-psurface/80">
          <Share2 size={15} strokeWidth={1.75} />
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
    </DialogOverlay>
  )
}
