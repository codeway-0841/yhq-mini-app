import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { useT, type Lang } from '../../shared/i18n'
import BrilliantEndstateRive from '../../shared/components/BrilliantEndstateRive'
import { registerModal } from '../../shared/lib/navigation'

export const PRACTICE_WARMUP_REVEAL_MS = 3680
export const PRACTICE_WARMUP_MS = 4000

export default function PracticeWarmUpLaunch({
  lang,
  colorVariant = 1,
  isReady = true,
  onReveal,
  onFinish,
  onCancel,
}: {
  lang: Lang
  colorVariant?: number
  isReady?: boolean
  onReveal: () => void
  onFinish: () => void
  onCancel: () => void
}) {
  const titleId = useId()
  const tt = useT(lang)
  const callbacks = useRef({ onReveal, onFinish, onCancel })
  callbacks.current = { onReveal, onFinish, onCancel }
  const [fading, setFading] = useState(false)
  const [minTimeElapsed, setMinTimeElapsed] = useState(false)

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
      className={`fixed inset-0 flex flex-col items-center justify-center bg-pcanvas text-pfg select-none transition-all duration-300 ease-out animate-in fade-in duration-200 ${
        fading ? 'opacity-0 scale-[1.015] pointer-events-none' : 'opacity-100 scale-100'
      }`}
      style={{
        zIndex: 65,
        paddingTop: 'max(env(safe-area-inset-top, 0px), var(--safe-top, 0px))',
        paddingBottom: 'max(env(safe-area-inset-bottom, 0px), var(--safe-bottom, 0px))',
      }}
    >
      {/* Top right subtle close button */}
      <div className="absolute top-3 right-3 sm:top-4 sm:right-4 z-10">
        <button
          type="button"
          onClick={() => callbacks.current.onCancel()}
          aria-label={tt('close')}
          className="flex size-9 items-center justify-center rounded-full text-pmuted/30 hover:text-pfg hover:bg-psurface transition-colors cursor-pointer"
        >
          <X size={18} strokeWidth={2.2} />
        </button>
      </div>

      {/* Center: Rive Dumbbell + Minimal Label */}
      <main
        className="flex flex-col items-center justify-center px-4"
        aria-labelledby={titleId}
      >
        <div className="relative size-[220px] sm:size-[260px]">
          <BrilliantEndstateRive
            kind="warm-up"
            variant={colorVariant}
            dark={Boolean(dark)}
            label={label}
            className="size-full"
          />
        </div>

        <p
          id={titleId}
          className="mt-4 text-[16px] sm:text-[17px] font-medium text-pmuted select-none tracking-normal text-center"
        >
          {label}
        </p>
      </main>
    </div>
  )

  if (typeof document === 'undefined') return null
  return createPortal(content, document.body)
}
