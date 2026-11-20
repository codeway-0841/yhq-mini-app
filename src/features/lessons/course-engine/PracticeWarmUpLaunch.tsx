import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { Lang } from '../../../shared/i18n'
import BrilliantEndstateRive from '../../../shared/components/BrilliantEndstateRive'
import { registerModal } from '../../../shared/lib/navigation'
import { resolveBrilliantRiveColor } from '../lesson-transition'

export const PRACTICE_WARMUP_REVEAL_MS = 750
export const PRACTICE_WARMUP_MS = 1050

export default function PracticeWarmUpLaunch({
  lang,
  accent,
  colorVariant,
  isReady = true,
  zIndex = 65,
  onReveal,
  onFinish,
  onCancel,
}: {
  lang: Lang
  accent?: string
  colorVariant?: number
  isReady?: boolean
  zIndex?: number
  onReveal: () => void
  onFinish: () => void
  onCancel: () => void
}) {
  const titleId = useId()
  const callbacks = useRef({ onReveal, onFinish, onCancel })
  callbacks.current = { onReveal, onFinish, onCancel }
  const [fading, setFading] = useState(false)
  const [minTimeElapsed, setMinTimeElapsed] = useState(false)

  const resolvedColor = resolveBrilliantRiveColor(accent, colorVariant)

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
  }, [minTimeElapsed, isReady, fading])

  useEffect(() => {
    if (!fading) return
    const timer = window.setTimeout(() => {
      callbacks.current.onFinish()
    }, 320)
    return () => window.clearTimeout(timer)
  }, [fading])

  const label = lang === 'ru' ? 'Загрузка разминки…' : 'Mashq yuklanmoqda…'

  const content = (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className={`fixed inset-0 flex flex-col items-center justify-center bg-pcanvas text-pfg select-none transition-opacity duration-300 ease-out motion-safe:animate-in motion-safe:fade-in duration-75 ${
        fading ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
      style={{
        zIndex,
        paddingTop: 'max(env(safe-area-inset-top, 0px), var(--safe-top, 0px))',
        paddingBottom: 'max(env(safe-area-inset-bottom, 0px), var(--safe-bottom, 0px))',
      }}
    >
      {/* Center: Rive Dumbbell + pastidagi xira yuklanish yozuvi (1:1 Brilliant ko'rinishi) */}
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

        <p id={titleId} className="mt-2 text-center text-[15px] font-medium text-pmuted">
          {label}
        </p>
      </main>
    </div>
  )

  if (typeof document === 'undefined') return null
  return createPortal(content, document.body)
}
