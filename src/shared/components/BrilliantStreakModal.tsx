import { memo, useEffect } from 'react'
import { Check } from 'lucide-react'
import DialogOverlay from './DialogOverlay'
import Confetti from './Confetti'
import { Button } from './ui/button'
import { RiveCanvas } from '../../features/mascot-studio/RiveCanvas'
import { BrilliantStreakIcon } from './BrilliantStreakIcon'
import { playSound } from '../lib/sounds'
import { haptics } from '../../platform/haptics'
import { useAppStore } from '../store/useAppStore'
import { useT } from '../i18n'

export interface BrilliantStreakModalProps {
  streak: number
  onClose: () => void
  isOpen?: boolean
}

const WEEK_DAYS_UZ = ['Du', 'Se', 'Cho', 'Pa', 'Ju', 'Sha', 'Ya']
const WEEK_DAYS_RU = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']

export const BrilliantStreakModal = memo(function BrilliantStreakModal({
  streak,
  onClose,
  isOpen = true,
}: BrilliantStreakModalProps) {
  const language = useAppStore((s) => s.settings.language)
  const isRu = language === 'ru'
  const tt = useT(language)

  useEffect(() => {
    if (!isOpen) return
    playSound('win')
    haptics.impact('heavy')
  }, [isOpen])

  if (!isOpen) return null

  // Haftaning qaysi kuni (0 = Dushanba, 6 = Yakshanba)
  const todayIndex = (new Date().getDay() + 6) % 7
  const weekDays = isRu ? WEEK_DAYS_RU : WEEK_DAYS_UZ

  return (
    <DialogOverlay
      onClose={onClose}
      position="center"
      zIndex={70}
      labelId="streak-modal-title"
      backdropClassName="bg-black/75 backdrop-blur-md"
      className="p-4 sm:p-6"
    >
      <Confetti count={50} />
      
      <div className="relative w-full max-w-[360px] overflow-hidden rounded-3xl bg-pcard p-6 sm:p-7 text-center shadow-2xl border-2 border-pline-strong motion-safe:animate-premiumIn">
        {/* Yuqori orqa fondagi mayin yorug'lik */}
        <div
          className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 size-48 rounded-full blur-3xl opacity-30"
          style={{ background: 'var(--p-warning)' }}
          aria-hidden="true"
        />

        {/* Brilliant 1:1 Rive Streak Lightning Bolt */}
        <div className="relative mx-auto -mt-2 size-44 sm:size-48 flex items-center justify-center">
          <RiveCanvas
            file="lightning.6513fd63.riv"
            artboard="In-Lesson Streak Web"
            animation="Lightning"
            label="Lightning Streak Celebration"
            className="is-transparent size-full"
            fit="contain"
          />
        </div>

        {/* Sarlavha va son */}
        <div className="mt-1">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-[#A8D31D]/15 text-[#88b012] dark:text-[#A8D31D] mb-2">
            <BrilliantStreakIcon size={14} className="text-[#A8D31D]" />
            {isRu ? 'Серия активна' : 'Seriya faol'}
          </span>
          
          <h2
            id="streak-modal-title"
            className="font-display text-[38px] sm:text-[44px] font-black leading-none tracking-tight tabular-nums text-pfg"
          >
            {streak}{' '}
            <span className="text-[22px] sm:text-[24px] font-extrabold text-pmuted">
              {tt('daysWord')}
            </span>
          </h2>

          <p className="mt-2 text-[13.5px] sm:text-[14px] font-medium leading-relaxed text-pmuted">
            {isRu
              ? 'Отличная работа! Цель на сегодня выполнена. Не прерывайте серию завтра!'
              : 'Barakalla! Bugungi o‘rganish maqsadi bajarildi. Ertaga ham seriyani davom ettiring!'}
          </p>
        </div>

        {/* 7 kunlik haftalik mini-trek (Brilliant uslubi) */}
        <div className="mt-5 rounded-2xl bg-psurface p-3 border border-pline">
          <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
            {weekDays.map((dayName, idx) => {
              const isPast = idx < todayIndex
              const isToday = idx === todayIndex
              return (
                <div key={dayName} className="flex flex-col items-center gap-1.5">
                  <span className="text-[10px] font-bold text-psubtle uppercase">
                    {dayName}
                  </span>
                  <div
                    className={`size-8 sm:size-9 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                      isToday
                        ? 'bg-pwarning text-white shadow-md scale-105 ring-2 ring-[rgb(var(--p-warning-rgb)/0.5)]'
                        : isPast
                        ? 'bg-[rgb(var(--p-warning-rgb)/0.25)] text-pwarning'
                        : 'bg-pcard text-psubtle border border-pline'
                    }`}
                  >
                    {isToday ? (
                      <BrilliantStreakIcon size={16} className="text-white animate-pulse" />
                    ) : isPast ? (
                      <Check size={15} strokeWidth={2.6} />
                    ) : (
                      <span className="size-1.5 rounded-full bg-psubtle/40" />
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Brilliant 1:1 Inverted 3D / Primary Tugma */}
        <div className="mt-6">
          <Button
            variant="primary"
            size="lg"
            block
            onClick={() => {
              haptics.impact('light')
              onClose()
            }}
            className="h-12 sm:h-13 text-base font-extrabold shadow-md"
          >
            {isRu ? 'Продолжить' : 'Davom etish'}
          </Button>
        </div>
      </div>
    </DialogOverlay>
  )
})

export default BrilliantStreakModal
