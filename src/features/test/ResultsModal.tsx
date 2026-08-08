import { useEffect } from 'react'
import { RotateCcw, Share2 } from 'lucide-react'
import { useAppStore } from '../../shared/store/useAppStore'
import { useT } from '../../shared/i18n'
import { shareUrl } from '../../platform/telegram'
import { playSound } from '../../shared/lib/sounds'
import Confetti from '../../shared/components/Confetti'
import DonutChart from './DonutChart'
import type { TopicBreakdownItem } from './topic-diagnosis'

export type QuestionResult = { questionId: number; status: 'correct' | 'incorrect' | 'unanswered' }

export default function ResultsModal({ results, onRetry, onFinish, onGoToQuestion, threshold = 90, hideVerdict = false, topicBreakdown }: {
  results: QuestionResult[]
  onRetry: () => void
  onFinish: () => void
  onGoToQuestion: (i: number) => void
  /** o'tish foizi — exam rejimida 90 (haqiqiy imtihon), qolganida 80 */
  threshold?: number
  /** Rasmiy preset (milliy-sertifikat/attestatsiya): o'tdi/o'tmadi mezonsiz — faqat natija */
  hideVerdict?: boolean
  /** Yakunda mavzular kesimida diagnostika (rasmiy imtihon presetlarida) */
  topicBreakdown?: TopicBreakdownItem[]
}) {
  const tt           = useT(useAppStore((s) => s.settings.language))
  const total      = results.length
  const correct    = results.filter((r) => r.status === 'correct').length
  const wrong      = results.filter((r) => r.status === 'incorrect').length
  const unanswered = results.filter((r) => r.status === 'unanswered').length
  const percent    = total > 0 ? Math.round((correct / total) * 100) : 0
  const passed     = percent >= threshold

  // Natija ochildi — qisqa g'alaba fanfarasi (tema-mos chastota)
  useEffect(() => { playSound('win') }, [])

  return (
    <div className="fixed inset-0 z-50 flex items-end">
      {passed && !hideVerdict && <Confetti />}
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" />
      <div className="relative w-full card-neon rounded-t-3xl border-t border-lineStrong p-5 pb-8 max-h-[88vh] overflow-y-auto">
        <div className="w-10 h-1 bg-line rounded-full mx-auto mb-4" />
        <h2 className="text-center text-lg font-black mb-1">{tt('results')}</h2>
        <DonutChart correct={correct} total={total} threshold={threshold} hideVerdict={hideVerdict}
          passedLabel={tt('passed')} failedLabel={tt('failed')} />

        <div className="grid grid-cols-3 gap-2 mb-5">
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
              className={`aspect-square rounded-full flex items-center justify-center text-[11px] font-bold transition-all active:scale-90 ${
                r.status === 'correct'   ? 'bg-duo-green text-ponprimary' :
                r.status === 'incorrect' ? 'bg-duo-red text-white'   :
                                           'bg-elevated text-muted'
              }`}>
              {i + 1}
            </button>
          ))}
        </div>

        <div className="flex gap-3">
          <button onClick={onRetry}
            className="btn-3d-ghost flex-1 py-3.5 rounded-2xl font-extrabold flex items-center justify-center gap-2">
            <RotateCcw size={16} />
            {tt('retry')}
          </button>
          <button onClick={onFinish}
            className="btn-neon flex-[2] py-3.5 rounded-2xl font-black text-base">
            {tt('finish')}
          </button>
        </div>

        {/* 🖼 Natijani ulashish — matn + referal link (virusli o'sish) */}
        <button
          onClick={() => {
            const uid  = useAppStore.getState().user?.id
            const lang = useAppStore.getState().settings.language
            const streak = useAppStore.getState().streak
            const emoji = passed ? '🏆' : '💪'
            const text = lang === 'ru'
              ? `${emoji} Мой результат в KIWI: ${percent}% (правильно ${correct}/${total})` +
                (streak > 1 ? `\n🔥 Серия: ${streak} дн. подряд!` : '') +
                `\nПопробуй и ты:`
              : `${emoji} KIWI'dagi natijam: ${percent}% (to'g'ri ${correct}/${total})` +
                (streak > 1 ? `\n🔥 Seriya: ${streak} kun ketma-ket!` : '') +
                `\nSan ham sinab ko'r:`
            shareUrl(`https://t.me/kiwi_uz_bot?start=ref_${uid ?? '0'}`, text)
          }}
          className="btn-3d-ghost w-full mt-3 py-3 rounded-2xl font-bold text-[13px] flex items-center justify-center gap-2 text-duo-blue">
          <Share2 size={15} />
          {tt('shareResult')}
        </button>
      </div>
    </div>
  )
}
