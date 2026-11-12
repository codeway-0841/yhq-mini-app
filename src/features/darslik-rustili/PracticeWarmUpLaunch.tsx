import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { Lang } from '../../shared/i18n'
import BrilliantEndstateRive from '../../shared/components/BrilliantEndstateRive'
import { registerModal } from '../../shared/lib/navigation'

export const PRACTICE_WARMUP_REVEAL_MS = 1200
export const PRACTICE_WARMUP_MS = 1450

export default function PracticeWarmUpLaunch({
  lang,
  accent,
  colorVariant,
  isReady = true,
  onReveal,
  onFinish,
  onCancel,
}: {
  lang: Lang
  accent?: string
  colorVariant?: number
  isReady?: boolean
  onReveal: () => void
  onFinish: () => void
  onCancel: () => void
}) {
  const titleId = useId()
  const callbacks = useRef({ onReveal, onFinish, onCancel })
  callbacks.current = { onReveal, onFinish, onCancel }
  const [fading, setFading] = useState(false)
  const [minTimeElapsed, setMinTimeElapsed] = useState(false)

  // Fan/Bob accent rangiga mos Brilliant Rive rangi (0..5)
  const resolvedColor =
    colorVariant !== undefined
      ? colorVariant
      : accent === '#f6b31f' || accent === 'var(--p-warning)'
      ? 4 // Sariq / Oltin
      : accent === '#8a4cff' || accent === 'var(--p-purple)'
      ? 5 // Binafsha
      : accent === '#22c55e' || accent === 'var(--p-success)'
      ? 0 // Yashil
      : accent === '#ef4444' || accent === 'var(--p-danger)'
      ? 2 // Qizil
      : accent === '#f97316'
      ? 3 // To'q sariq
      : 1 // Moviy / Ko'k (Brilliant Blue)

  const dark =
    typeof document !== 'undefined' &&
    (document.body.dataset.theme === 'dark' || document.documentElement.classList.contains('dark'))

  // Android back button support
  useEffect(() => {
    const id = Symbol('practice-warmup-launch')
    const unregister = registerModal(id, () => callbacks.current.onCancel())
    return unregister
  }, [])

  useEffect(() => {
    const minTimer = window.setTimeout(() => setMinTimeElapsed(true), PRACTICE_WARMUP_REVEAL_MS)
    return () => window.clearTimeout(minTimer)
  }, [])

  useEffect(() => {
    if (!minTimeElapsed || !isReady || fading) return
    setFading(true)
    callbacks.current.onReveal()
    const timer = window.setTimeout(() => {
      callbacks.current.onFinish()
    }, 320)
    return () => window.clearTimeout(timer)
  }, [minTimeElapsed, isReady, fading])

  const label = lang === 'ru' ? 'Загрузка разминки…' : 'Mashq yuklanmoqda…'

  const content = (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className={`fixed inset-0 flex flex-col items-center justify-center bg-pcanvas text-pfg select-none transition-all duration-300 ease-out ${
        fading ? 'opacity-0 scale-[1.015] pointer-events-none' : 'opacity-100 scale-100'
      }`}
      style={{
        zIndex: 65,
        paddingTop: 'max(env(safe-area-inset-top, 0px), var(--safe-top, 0px))',
        paddingBottom: 'max(env(safe-area-inset-bottom, 0px), var(--safe-bottom, 0px))',
      }}
    >
      {/* Center: Rive Dumbbell + Minimal Label */}
      <main
        className="flex flex-col items-center justify-center px-4"
        aria-labelledby={titleId}
      >
        <div className="relative size-[310px] sm:size-[360px] max-w-[88vw] aspect-square flex items-center justify-center">
          <BrilliantEndstateRive
            kind="warm-up"
            variant={resolvedColor}
            dark={Boolean(dark)}
            label={label}
            className="size-full"
          />
        </div>

        <p
          id={titleId}
          className="mt-5 text-[17px] sm:text-[18px] font-medium text-pmuted select-none tracking-normal text-center"
        >
          {label}
        </p>
      </main>
    </div>
  )

  if (typeof document === 'undefined') return null
  return createPortal(content, document.body)
}
