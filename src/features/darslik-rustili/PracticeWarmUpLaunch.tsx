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

  const heading = lang === 'ru' ? 'Быстрая разминка!' : 'Qizdirish mashqi yuklanmoqda…'
  const sub =
    lang === 'ru'
      ? 'Вспомним ключевые идеи перед новыми задачами'
      : 'Amaliy mashq topshiriqlari saralanmoqda'

  const content = (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className={`fixed inset-0 flex flex-col justify-between bg-pcanvas text-pfg select-none transition-all duration-300 ease-out animate-in fade-in duration-200 ${
        fading ? 'opacity-0 scale-[1.015] pointer-events-none' : 'opacity-100 scale-100'
      }`}
      style={{
        zIndex: 65,
        paddingTop: 'max(env(safe-area-inset-top, 0px), var(--safe-top, 0px))',
        paddingBottom: 'max(env(safe-area-inset-bottom, 0px), var(--safe-bottom, 0px))',
      }}
    >
      {/* Top bar */}
      <header className="flex h-14 w-full items-center justify-between px-4">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[rgb(var(--p-primary-rgb)/0.12)] px-3 py-1 text-[11.5px] font-bold text-pprimary tracking-wide uppercase">
          {lang === 'ru' ? 'Разминка' : 'Warm-Up'}
        </span>
        <button
          type="button"
          onClick={() => callbacks.current.onCancel()}
          aria-label={tt('close')}
          className="flex size-9 items-center justify-center rounded-full text-pmuted hover:bg-psurface hover:text-pfg transition-colors cursor-pointer"
        >
          <X size={20} strokeWidth={2.4} />
        </button>
      </header>

      {/* Center: Rive + Copy */}
      <main
        className="mx-auto flex w-full max-w-[420px] flex-1 flex-col items-center justify-center gap-6 px-4"
        aria-labelledby={titleId}
      >
        <div className="relative size-[260px] md:size-[300px]">
          <BrilliantEndstateRive
            kind="warm-up"
            variant={colorVariant}
            dark={Boolean(dark)}
            label={heading}
            className="size-full"
          />
        </div>

        <div className="flex flex-col items-center gap-2 text-center">
          <h1
            id={titleId}
            className="font-display text-[22px] font-extrabold leading-tight text-pfg sm:text-[24px]"
          >
            {heading}
          </h1>
          <p className="text-[14px] text-pmuted">{sub}</p>
        </div>
      </main>

      {/* Bottom spacer */}
      <div className="h-14 w-full" aria-hidden="true" />
    </div>
  )

  if (typeof document === 'undefined') return null
  return createPortal(content, document.body)
}
