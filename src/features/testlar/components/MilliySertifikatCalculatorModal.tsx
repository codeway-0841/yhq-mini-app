import { useState, useId } from 'react'
import { RotateCcw, ShieldCheck, Landmark } from 'lucide-react'
import { useAppStore } from '../../../shared/store/useAppStore'
import { haptics } from '../../../platform/haptics'
import DialogOverlay from '../../../shared/components/DialogOverlay'
import ModalMathGrid from '../../../shared/components/ModalMathGrid'
import ModalHeaderRow from '../../../shared/components/ModalHeaderRow'
import { Button } from '../../../shared/components/ui/button'
import {
  calculateDtmBenefit,
  MILLIY_SERTIFIKAT_MAX_SCORE,
  MAJOR_1_MAX_SCORE,
  MAJOR_2_MAX_SCORE,
} from '../../../../shared/milliy-sertifikat'

interface MilliySertifikatCalculatorModalProps {
  onClose: () => void
  onStartExam?: () => void
}

const PRESET_QUICK_SCORES = [
  { label: 'C', score: 46 },
  { label: 'C+', score: 50 },
  { label: 'B', score: 55 },
  { label: 'B+', score: 60 },
  { label: 'A', score: 65 },
  { label: 'A+', score: 70 },
]

export default function MilliySertifikatCalculatorModal({
  onClose,
  onStartExam,
}: MilliySertifikatCalculatorModalProps) {
  const [scoreInput, setScoreInput] = useState<string>('60')
  const lang = useAppStore((s) => s.settings.language)
  const isRu = lang === 'ru'
  const sliderId = useId()

  const rawScore = parseFloat(scoreInput.replace(',', '.'))
  const validScore = !isNaN(rawScore) && rawScore >= 0 && rawScore <= MILLIY_SERTIFIKAT_MAX_SCORE
    ? rawScore
    : 0

  const benefit = calculateDtmBenefit(validScore)

  const handleQuickSelect = (score: number) => {
    haptics.selection()
    setScoreInput(String(score))
  }

  const handleReset = () => {
    haptics.impact('light')
    setScoreInput('0')
  }

  return (
    <DialogOverlay onClose={onClose} labelId="calc-modal-title" swipeToDismiss>
      <div
        className="relative w-full max-w-lg bg-psurface rounded-t-sheet px-5 pt-3 pb-[calc(1.75rem+var(--safe-bottom,0px))] max-h-[90vh] overflow-y-auto no-scrollbar shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <ModalMathGrid glow={false} height={380} />

        {/* Drag handle */}
        <div
          data-drag-handle
          className="w-10 h-1 bg-gray-300 dark:bg-white/20 rounded-full mx-auto mb-2 cursor-grab active:cursor-grabbing touch-none select-none relative z-10"
        />

        {/* Header */}
        <ModalHeaderRow onClose={onClose} label={isRu ? 'Закрыть' : 'Yopish'}>
          <h2 id="calc-modal-title" className="text-[17px] font-bold text-pfg tracking-tight">
            {isRu ? 'Калькулятор баллов' : 'Ball kalkulyatori'}
          </h2>
        </ModalHeaderRow>

        {/* Input & Slider Card */}
        <div className="bg-pcard rounded-2xl p-4 mb-3.5 shadow-2xs relative z-10">
          <div className="flex items-center justify-between mb-2">
            <label htmlFor={sliderId} className="text-xs font-bold text-pfg uppercase tracking-wider">
              {isRu ? 'Балл сертификата' : 'Sertifikat bali'}
            </label>
            <button
              type="button"
              onClick={handleReset}
              className="text-[11.5px] text-pmuted hover:text-pfg flex items-center gap-1 font-medium cursor-pointer"
            >
              <RotateCcw size={12} />
              {isRu ? 'Сброс' : 'Tozalash'}
            </button>
          </div>

          <div className="flex items-center gap-3 mb-3">
            <input
              type="number"
              min="0"
              max="75"
              step="0.5"
              value={scoreInput}
              onChange={(e) => setScoreInput(e.target.value)}
              className="w-28 text-center text-2xl font-black tabular-nums py-2.5 rounded-xl bg-psurface text-pfg outline-none ring-1 ring-[rgb(var(--p-line-rgb)/0.2)] focus:ring-pprimary transition-all"
              placeholder="0"
            />
            <div className="flex-1">
              <input
                id={sliderId}
                type="range"
                min="0"
                max="75"
                step="0.5"
                value={validScore}
                onChange={(e) => setScoreInput(e.target.value)}
                className="w-full accent-pprimary cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-psubtle mt-1 font-semibold">
                <span>0</span>
                <span className="text-amber-500 font-bold">46 (C)</span>
                <span>65 (A)</span>
                <span>75</span>
              </div>
            </div>
          </div>

          {/* Quick Preset Buttons */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-1">
            <span className="text-[11px] font-semibold text-pmuted shrink-0 mr-1">
              {isRu ? 'Уровень:' : 'Daraja:'}
            </span>
            {PRESET_QUICK_SCORES.map((preset) => {
              const active = Math.round(validScore) === preset.score
              return (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => handleQuickSelect(preset.score)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all active:scale-95 cursor-pointer shrink-0 ${
                    active
                      ? 'bg-pprimary text-ponprimary shadow-xs'
                      : 'bg-psurface text-pmuted hover:text-pfg'
                  }`}
                >
                  {preset.label} ({preset.score})
                </button>
              )
            })}
          </div>
        </div>

        {/* Real-time Calculation Result Banner */}
        <div
          className="rounded-2xl p-4 mb-3.5 shadow-2xs relative z-10 transition-all duration-300"
          style={{
            backgroundColor: benefit.gradeMeta?.bg ?? 'rgba(239, 68, 68, 0.08)',
          }}
        >
          <div className="flex items-start justify-between">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-pmuted">
                {isRu ? 'Уровень' : 'Rasmiy daraja'}
              </span>
              <div
                className="text-3xl font-black tracking-tight mt-0.5"
                style={{ color: benefit.gradeMeta?.color ?? 'var(--p-danger)' }}
              >
                {benefit.grade ? `${benefit.grade} daraja` : (isRu ? 'Сертификат не выдается' : 'Sertifikat berilmaydi')}
              </div>
              <p className="text-xs font-semibold text-pfg opacity-90 mt-1">
                {isRu ? benefit.summaryRu : benefit.summaryUz}
              </p>
            </div>

            <div className="text-right shrink-0">
              <span className="text-[10.5px] font-bold uppercase tracking-wider text-pmuted">
                {isRu ? 'Балл' : 'Ball'}
              </span>
              <div className="text-2xl font-black tabular-nums text-pfg">
                {benefit.rashScore}
                <span className="text-sm font-semibold text-pmuted">/75</span>
              </div>
              <div className="text-[11px] font-semibold text-pmuted">
                {benefit.isPassed ? `${benefit.percentOfMax}%` : '< 46'}
              </div>
            </div>
          </div>
        </div>

        {/* DTM Imtiyozlari Taqsimoti */}
        <div className="bg-pcard rounded-2xl p-4 mb-3.5 shadow-2xs relative z-10">
          <div className="flex items-center gap-2 mb-3">
            <Landmark size={16} className="text-pprimary shrink-0" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-pfg">
              {isRu ? 'Льготы DTM' : 'DTM kirish imtiyozi'}
            </h3>
          </div>

          <div className="grid grid-cols-2 gap-2.5 mb-3">
            <div className="bg-psurface rounded-xl p-3">
              <p className="text-[11px] font-semibold text-pmuted mb-1">
                {isRu ? '1-й предмет' : '1-mutaxassislik'}
              </p>
              <p className="text-lg font-black text-pfg tabular-nums leading-none">
                {benefit.isPassed ? benefit.major1Score : 0}
                <span className="text-xs font-semibold text-pmuted ml-1">/ {MAJOR_1_MAX_SCORE} ball</span>
              </p>
              <p className="text-[10.5px] font-semibold text-psuccess mt-1">
                {benefit.isPassed ? (benefit.percentOfMax === 100 ? (isRu ? '100% максимум' : '100% maksimal') : `${benefit.percentOfMax}%`) : (isRu ? '0 баллов' : '0 ball')}
              </p>
            </div>

            <div className="bg-psurface rounded-xl p-3">
              <p className="text-[11px] font-semibold text-pmuted mb-1">
                {isRu ? '2-й предмет' : '2-mutaxassislik'}
              </p>
              <p className="text-lg font-black text-pfg tabular-nums leading-none">
                {benefit.isPassed ? benefit.major2Score : 0}
                <span className="text-xs font-semibold text-pmuted ml-1">/ {MAJOR_2_MAX_SCORE} ball</span>
              </p>
              <p className="text-[10.5px] font-semibold text-psuccess mt-1">
                {benefit.isPassed ? (benefit.percentOfMax === 100 ? (isRu ? '100% максимум' : '100% maksimal') : `${benefit.percentOfMax}%`) : (isRu ? '0 баллов' : '0 ball')}
              </p>
            </div>
          </div>

          <div className="bg-psurface rounded-xl p-3 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-pfg">
                {isRu ? 'Обязательный блок (3 предмета)' : 'Majburiy blok (3 ta fan)'}
              </p>
              <p className="text-[11px] text-pmuted">
                {isRu ? 'Родной язык, математика, история' : 'Ona tili, matematika, tarix'}
              </p>
            </div>
            <span className={`text-xs font-black px-2.5 py-1 rounded-full ${
              benefit.isPassed
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                : 'bg-rose-500/10 text-rose-500'
            }`}>
              {benefit.isPassed ? (isRu ? '100% максимум' : '100% maksimal ball') : (isRu ? '0 ball' : '0 ball')}
            </span>
          </div>
        </div>

        {/* Qisqa Ma'lumotnoma */}
        <div className="bg-pcard rounded-2xl p-3.5 mb-4 shadow-2xs relative z-10 text-[11.5px] text-pmuted leading-relaxed">
          <p className="font-semibold text-pfg mb-1 flex items-center gap-1.5">
            <ShieldCheck size={14} className="text-pprimary" />
            {isRu ? 'Основные правила (№ 646):' : 'Muhim qoidalar (646-son qaror):'}
          </p>
          <ul className="list-disc pl-4 space-y-0.5">
            <li>{isRu ? 'Срок действия — 3 года.' : 'Amal qilish muddati — 3 yil.'}</li>
            <li>{isRu ? 'A+, A: 100% максимальный балл по профилю.' : 'A+, A: Mutaxassislik fandan 100% maksimal ball.'}</li>
            <li>{isRu ? 'Обязательный блок: 100% баллов с уровня C.' : 'Majburiy blok: C darajadan boshlab 100% ball.'}</li>
          </ul>
        </div>

        {/* CTA Button */}
        {onStartExam && (
          <Button
            variant="default"
            block
            size="lg"
            className="h-12 font-bold rounded-2xl active:scale-[0.98] relative z-10 shadow-xs cursor-pointer flex items-center justify-center"
            onClick={() => {
              onClose()
              onStartExam()
            }}
          >
            {isRu ? 'Начать экзамен' : 'Sinov testini boshlash'}
          </Button>
        )}
      </div>
    </DialogOverlay>
  )
}
