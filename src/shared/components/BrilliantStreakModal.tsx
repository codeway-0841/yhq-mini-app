import { memo, useEffect, useState, useMemo } from 'react'
import { Check } from 'lucide-react'
import { Button } from './ui/button'
import { RiveCanvas } from '../../features/mascot-studio/RiveCanvas'
import { playSound } from '../lib/sounds'
import { haptics } from '../../platform/haptics'
import { useAppStore } from '../store/useAppStore'

export interface BrilliantStreakModalProps {
  streak: number
  onClose: () => void
  isOpen?: boolean
  showCharge?: boolean
}

const SHORT_DAYS_UZ = ['Ya', 'Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh']
const SHORT_DAYS_RU = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб']

/**
 * Brilliant.org 1:1 Streak Endstate & Charge Fullscreen Modal.
 *
 * Video 1 (02_brilliant-koji-mascot-gained-new-streak-animation.mp4):
 * - Soft lime ambient radial glow
 * - 3D lightning bolt mascot animation (`MAIN_streak-endstate` in `endstates.e233a7c3.riv`)
 * - Large streak count & "You sparked a new streak!" title
 * - 3-day active streak dots (Yesterday, Today with checkmark, Tomorrow)
 * - Full-width pill "Continue" CTA
 *
 * Video 2 (08_brilliant-streak-charge-animation.mp4):
 * - Streak Charge battery animation (`Streaks Forgive` in `endstates.e233a7c3.riv`)
 * - "You earned 1 Streak Charge!" title & explanation
 */
export const BrilliantStreakModal = memo(function BrilliantStreakModal({
  streak,
  onClose,
  isOpen = true,
  showCharge = false,
}: BrilliantStreakModalProps) {
  const language = useAppStore((s) => s.settings.language)
  const isRu = language === 'ru'
  const [view, setView] = useState<'streak' | 'charge'>('streak')

  useEffect(() => {
    if (!isOpen) return
    playSound('win')
    haptics.impact('heavy')
  }, [isOpen])

  // Bugungi, kechagi va ertangi kunlar hisobi
  const daysInfo = useMemo(() => {
    const d = new Date()
    const todayIndex = d.getDay() // 0 = Ya, 1 = Du...
    const yesterdayIndex = (todayIndex + 6) % 7
    const tomorrowIndex = (todayIndex + 1) % 7
    const names = isRu ? SHORT_DAYS_RU : SHORT_DAYS_UZ

    return [
      { name: names[yesterdayIndex], status: 'done' },
      { name: names[todayIndex], status: 'today' },
      { name: names[tomorrowIndex], status: 'future' },
    ]
  }, [isRu])

  if (!isOpen) return null

  const handleContinue = () => {
    haptics.impact('light')
    if (showCharge && view === 'streak') {
      setView('charge')
      return
    }
    onClose()
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="streak-celebration-title"
      className="fixed inset-0 z-[100] flex flex-col justify-between bg-pcanvas text-pfg select-none overflow-y-auto px-5 py-6 sm:py-8 motion-safe:animate-fadeIn"
    >
      {/* Orqa fondagi mayin ohakrang (lime) ambient gradient nuri */}
      <div
        className="pointer-events-none fixed inset-0 flex items-center justify-center opacity-70 dark:opacity-40"
        aria-hidden="true"
      >
        <div
          className="size-[480px] sm:size-[560px] rounded-full blur-3xl"
          style={{
            background: 'radial-gradient(circle, rgba(168,211,29,0.35) 0%, rgba(168,211,29,0.12) 40%, transparent 70%)',
          }}
        />
      </div>

      {/* Yuqori qism / Bo'sh safe-area */}
      <div className="w-full flex justify-end">
        <button
          type="button"
          onClick={onClose}
          className="relative z-10 grid size-10 place-items-center rounded-full bg-psurface/60 text-pmuted hover:text-pfg transition-colors"
          aria-label={isRu ? 'Закрыть' : 'Yopish'}
        >
          ✕
        </button>
      </div>

      {/* Asosiy markaziy qism */}
      <div className="relative z-10 flex flex-1 flex-col items-center justify-center text-center my-auto w-full max-w-[420px] mx-auto">
        {view === 'streak' ? (
          <>
            {/* 3D Chaqmoq va Koji maskoti Rive animatsiyasi (Brilliant Video 1) */}
            <div className="relative mx-auto w-full max-w-[320px] sm:max-w-[360px] aspect-square flex items-center justify-center">
              <RiveCanvas
                file="endstates.e233a7c3.riv"
                artboard="MAIN_streak-endstate"
                stateMachine="StreakEndstate"
                animation="streak-animation"
                label="Brilliant Streak Celebration"
                className="is-transparent size-full"
                fit="contain"
              />
            </div>

            {/* Raqam va Matn */}
            <div className="mt-3 sm:mt-4">
              <h1
                id="streak-celebration-title"
                className="font-display text-[56px] sm:text-[64px] font-black leading-none tracking-tight tabular-nums text-pfg"
              >
                {streak}
              </h1>

              <p className="mt-2 text-[18px] sm:text-[20px] font-extrabold tracking-tight text-pfg">
                {streak === 1
                  ? isRu
                    ? 'Вы начали новую серию!'
                    : 'Yangi seriyani boshladingiz!'
                  : isRu
                  ? `${streak}-дневная серия!`
                  : `${streak} kunlik seriya!`}
              </p>
            </div>

            {/* 3 kunlik Brilliant faollik nuqtalari (Yesterday, Today, Tomorrow) */}
            <div className="mt-6 flex items-center justify-center gap-7 sm:gap-9">
              {daysInfo.map((day, idx) => {
                const isToday = day.status === 'today'
                const isDone = day.status === 'done'
                return (
                  <div key={idx} className="flex flex-col items-center gap-1.5">
                    <div
                      className={`grid size-9 sm:size-10 place-items-center rounded-full transition-all ${
                        isToday
                          ? 'bg-[#A8D31D] text-black shadow-[0_0_16px_rgba(168,211,29,0.55)] scale-110'
                          : isDone
                          ? 'border-2 border-[#A8D31D] text-[#A8D31D] bg-[#A8D31D]/10'
                          : 'border-2 border-pline text-psubtle bg-psurface/40'
                      }`}
                    >
                      {isToday || isDone ? (
                        <Check size={18} strokeWidth={3} className={isToday ? 'text-black' : 'text-[#A8D31D]'} />
                      ) : null}
                    </div>
                    <span
                      className={`text-[12px] font-bold ${
                        isToday ? 'text-[#85a812] dark:text-[#A8D31D] font-extrabold' : 'text-pmuted'
                      }`}
                    >
                      {day.name}
                    </span>
                  </div>
                )
              })}
            </div>
          </>
        ) : (
          <>
            {/* Streak Charge Batareya animatsiyasi (Brilliant Video 2) */}
            <div className="relative mx-auto w-full max-w-[280px] sm:max-w-[320px] aspect-square flex items-center justify-center">
              <RiveCanvas
                file="endstates.e233a7c3.riv"
                artboard="Streaks Forgive"
                stateMachine="StreaksForgiveVM"
                label="Brilliant Streak Charge"
                className="is-transparent size-full"
                fit="contain"
              />
            </div>

            <div className="mt-4 max-w-[320px]">
              <h1
                id="streak-celebration-title"
                className="font-display text-[26px] sm:text-[28px] font-black leading-tight text-pfg"
              >
                {isRu ? 'Вы получили 1 заряд серии!' : '1 ta Seriya himoyasiga ega bo‘ldingiz!'}
              </h1>

              <p className="mt-2.5 text-[14px] sm:text-[15px] font-medium leading-relaxed text-pmuted">
                {isRu
                  ? 'С зарядом серии вы можете пропустить один день обучения без потери вашей серии.'
                  : 'Seriya himoyasi bilan dars o‘tkazib yuborsangiz ham seriyangiz bekor bo‘lmaydi.'}
              </p>
            </div>
          </>
        )}
      </div>

      {/* Pastki CTA Tugma (Brilliant 1:1 Inverted 3D / Primary Pill Tugmasi) */}
      <div className="relative z-10 w-full max-w-[380px] mx-auto pb-2">
        <Button
          variant="secondary"
          size="lg"
          block
          onClick={handleContinue}
          className="h-13 rounded-full text-base font-extrabold shadow-sm active:scale-[0.98] transition-transform"
        >
          {isRu ? 'Продолжить' : 'Davom etish'}
        </Button>
      </div>
    </div>
  )
})

export default BrilliantStreakModal
