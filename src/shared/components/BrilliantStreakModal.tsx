import { memo, useEffect, useMemo, useState } from 'react'
import { Button } from './ui/button'
import { BrilliantEndstateRive } from './BrilliantEndstateRive'
import { BrilliantStreakIcon } from './BrilliantStreakIcon'
import { playSound } from '../lib/sounds'
import { haptics } from '../../platform/haptics'
import { useAppStore } from '../store/useAppStore'

export interface BrilliantStreakModalProps {
  streak: number
  onClose: () => void
  isOpen?: boolean
  /** 'charge' — "Streak Charge" (batareya) ekrani */
  initialView?: 'streak' | 'charge'
}

const SHORT_DAYS_UZ = ['Ya', 'Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh']
const SHORT_DAYS_RU = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб']
const LIME = '#A8D31D'

/**
 * Brilliant "streak endstate" ekrani (video kadrlari bo'yicha):
 *  1. Oq ekranda Koji tanga ushlab chiqadi → nurli shar (son "0") → 3D chaqmoq.
 *  2. Yuqorida laym gradient paydo bo'ladi, "0" → seriya soniga o'tadi.
 *  3. Sarlavha, 3 kunlik doira (bugun — chaqmoqli) va pastda qora "Davom etish".
 * Chaqmoq/Koji/shar — `endstates.*.riv` ichidagi `MAIN_streak-endstate` artboard'ining o'zi.
 */
export const BrilliantStreakModal = memo(function BrilliantStreakModal({
  streak,
  onClose,
  isOpen = true,
  initialView = 'streak',
}: BrilliantStreakModalProps) {
  const language = useAppStore((s) => s.settings.language)
  const isRu = language === 'ru'
  const dark = typeof document !== 'undefined' && document.body.dataset.theme === 'dark'
  const [view] = useState(initialView)
  // 0 — faqat animatsiya, 1 — son + gradient, 2 — sarlavha, 3 — kalendar
  const [stage, setStage] = useState(0)

  useEffect(() => {
    if (!isOpen) return
    playSound('win')
    haptics.impact('heavy')
    const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (reduce) { setStage(4); return }
    const timers = [
      window.setTimeout(() => setStage(1), 900),
      window.setTimeout(() => setStage(2), 3000),
      window.setTimeout(() => setStage(3), 3400),
      window.setTimeout(() => setStage(4), 3900),
    ]
    return () => timers.forEach(window.clearTimeout)
  }, [isOpen])

  const days = useMemo(() => {
    const names = isRu ? SHORT_DAYS_RU : SHORT_DAYS_UZ
    const today = new Date().getDay()
    return [0, 1, 2].map((offset) => ({ name: names[(today + offset) % 7], active: offset === 0 }))
  }, [isRu])

  if (!isOpen) return null

  const title = streak <= 1
    ? (isRu ? 'Вы начали новую серию!' : 'Yangi seriyani boshladingiz!')
    : (isRu ? `Серия ${streak} дн.!` : `${streak} kunlik seriya!`)
  const fade = (on: boolean) => ({
    opacity: on ? 1 : 0,
    transform: on ? 'translateY(0)' : 'translateY(12px)',
    transition: 'opacity 450ms ease-out, transform 450ms cubic-bezier(0.16,1,0.3,1)',
  })
  const gradient = dark
    ? 'linear-gradient(180deg, rgba(120,150,20,0.45) 0%, rgba(120,150,20,0.14) 38%, rgba(20,20,20,0) 62%)'
    : 'linear-gradient(180deg, rgba(190,216,48,0.62) 0%, rgba(190,216,48,0.22) 38%, rgba(255,255,255,0) 62%)'

  const handleContinue = () => {
    haptics.impact('light')
    onClose()
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="streak-celebration-title"
      className="fixed inset-0 z-[100] flex flex-col bg-pcanvas text-pfg select-none overflow-hidden"
    >
      {view === 'streak' && (
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-[70%]"
          style={{ background: gradient, opacity: stage >= 2 ? 1 : 0, transition: 'opacity 900ms ease-out' }}
          aria-hidden="true"
        />
      )}

      <div className="relative z-10 flex flex-1 flex-col items-center px-6 pt-[calc(var(--safe-top,0px)+1rem)] min-h-0">
        {view === 'streak' ? (
          <>
            <BrilliantEndstateRive
              kind="streak"
              variant={0}
              dark={dark}
              label="Brilliant Streak Celebration"
              className="mt-[6vh] aspect-square w-full max-w-[340px] shrink-0"
              fallback={<BrilliantStreakIcon size={96} />}
            />

            <h1
              id="streak-celebration-title"
              className="mt-2 font-display text-[64px] font-black leading-none tabular-nums"
              style={{
                color: stage >= 2 ? undefined : LIME,
                transform: stage >= 2 ? 'scale(1)' : 'scale(0.85)',
                opacity: stage >= 1 ? 1 : 0,
                transition: 'transform 500ms cubic-bezier(0.34,1.56,0.64,1), color 300ms',
              }}
            >
              {stage >= 2 ? streak : 0}
            </h1>

            <p className="mt-2 text-[17px] font-extrabold tracking-tight text-center" style={fade(stage >= 3)}>
              {title}
            </p>

            <div className="mt-6 flex items-start justify-center gap-6" style={fade(stage >= 4)}>
              {days.map((d) => (
                <div key={d.name} className="flex flex-col items-center gap-1.5">
                  <div
                    className={`grid size-10 place-items-center rounded-full ${
                      d.active ? '' : 'border-2 border-pline bg-pcard'
                    }`}
                    style={d.active ? { background: LIME } : undefined}
                  >
                    {d.active && <BrilliantStreakIcon size={18} className="text-black" />}
                  </div>
                  <span className={`text-[12px] font-bold ${d.active ? 'text-pfg' : 'text-pmuted'}`}>{d.name}</span>
                </div>
              ))}
            </div>
          </>
        ) : (
          <>
            <BrilliantEndstateRive
              kind="charge"
              dark={dark}
              label="Brilliant Streak Charge"
              className="mt-[10vh] aspect-square w-full max-w-[300px] shrink-0"
              fallback={<BrilliantStreakIcon size={96} />}
            />
            <h1 id="streak-celebration-title" className="mt-2 font-display text-[24px] font-black leading-tight text-center">
              {isRu ? 'Вы получили 1 заряд серии!' : '1 ta seriya zaryadini oldingiz!'}
            </h1>
            <p className="mt-2 max-w-[320px] text-center text-[14px] font-medium leading-relaxed text-pmuted">
              {isRu
                ? 'С зарядом серии можно пропустить день, не потеряв серию.'
                : 'Seriya zaryadi bilan bir kunni o‘tkazib yuborsangiz ham seriyangiz saqlanadi.'}
            </p>
          </>
        )}
      </div>

      <div className="relative z-10 w-full max-w-[420px] mx-auto px-5 pt-3 pb-[calc(1rem+var(--safe-bottom,0px))]">
        <Button variant="secondary" size="lg" block onClick={handleContinue} className="rounded-full font-extrabold">
          {isRu ? 'Продолжить' : 'Davom etish'}
        </Button>
      </div>
    </div>
  )
})

export default BrilliantStreakModal
