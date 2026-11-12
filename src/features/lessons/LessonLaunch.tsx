import { useEffect, useId, useRef, useState } from 'react'
import { X } from 'lucide-react'
import DialogOverlay from '../../shared/components/DialogOverlay'
import { useT, type Lang } from '../../shared/i18n'
import BrilliantEndstateRive from '../../shared/components/BrilliantEndstateRive'

export const LESSON_LAUNCH_REVEAL_MS = 2800
export const LESSON_LAUNCH_MS = 3120
export type LaunchOrigin = { x: number; y: number; size: number; sink: number; hasMascot?: boolean }

export function lessonLaunchOrigin(node: HTMLElement | null): LaunchOrigin {
  const mascot = node?.querySelector<HTMLElement>('.learning-mascot')
  const tile = node?.querySelector('.learning-tile')?.getBoundingClientRect()
  const bounds = mascot?.getBoundingClientRect()
  const size = mascot?.offsetWidth || 44
  const x = bounds ? bounds.left + bounds.width / 2 : tile ? tile.left + tile.width / 2 : window.innerWidth / 2
  const y = bounds ? bounds.top + bounds.height / 2 : tile ? tile.top + tile.height * 0.3 : window.innerHeight * 0.4
  const sink = tile ? Math.max(12, tile.top + tile.height * (87 / 130) - y) : 36
  return { x, y, size, sink, hasMascot: Boolean(mascot) }
}

/**
 * Senior-darajadagi dars ochilish yuklagichi (Brilliant LessonLoader):
 * - Koji nurlanib markazga tushadi (MAIN_Lesson Loader / LessonLoaderVM).
 * - Markazda katta va ko'rkam o'lchamda suzadi (matnsiz, minimal).
 * - Silliq 320ms crossfade bilan to'g'ridan-to'g'ri darsga o'tadi.
 */
export default function LessonLaunch({
  origin: _origin,
  lang,
  onReveal,
  onFinish,
  onCancel,
  colorVariant = 1,
  isLevel = false,
}: {
  origin: LaunchOrigin
  lang: Lang
  accent?: string
  colorVariant?: number
  isLevel?: boolean
  onReveal: () => void
  onFinish: () => void
  onCancel: () => void
}) {
  const titleId = useId()
  const tt = useT(lang)
  const callbacks = useRef({ onReveal, onFinish, onCancel })
  callbacks.current = { onReveal, onFinish, onCancel }
  const [fading, setFading] = useState(false)

  const dark =
    typeof document !== 'undefined' &&
    (document.body.dataset.theme === 'dark' || document.documentElement.classList.contains('dark'))

  useEffect(() => {
    const revealTimer = window.setTimeout(() => {
      setFading(true)
      callbacks.current.onReveal()
    }, LESSON_LAUNCH_REVEAL_MS)

    const finishTimer = window.setTimeout(() => {
      callbacks.current.onFinish()
    }, LESSON_LAUNCH_MS)

    return () => {
      window.clearTimeout(revealTimer)
      window.clearTimeout(finishTimer)
    }
  }, [])

  return (
    <DialogOverlay
      onClose={() => callbacks.current.onCancel()}
      position="center"
      zIndex={65}
      labelId={titleId}
      backdropClassName="bg-pcanvas transition-opacity duration-300"
      className="lesson-launch-overlay !p-0"
    >
      <div
        className={`fixed inset-0 flex flex-col items-center justify-center bg-pcanvas text-pfg select-none transition-all duration-300 ease-out animate-in fade-in duration-200 ${
          fading ? 'opacity-0 scale-[1.015] pointer-events-none' : 'opacity-100 scale-100'
        }`}
        style={{
          paddingTop: 'max(env(safe-area-inset-top, 0px), var(--safe-top, 0px))',
          paddingBottom: 'max(env(safe-area-inset-bottom, 0px), var(--safe-bottom, 0px))',
        }}
      >
        <span id={titleId} className="sr-only">
          {tt('pathLaunching')}
        </span>

        {/* Top right subtle close button */}
        <div className="absolute top-3 right-3 sm:top-4 sm:right-4 z-10">
          <button
            type="button"
            onClick={() => callbacks.current.onCancel()}
            aria-label={tt('close')}
            className="flex size-9 items-center justify-center rounded-full text-pmuted/40 hover:text-pfg hover:bg-psurface transition-colors cursor-pointer"
          >
            <X size={18} strokeWidth={2.2} />
          </button>
        </div>

        {/* Center: Rive Koji Lesson Loader (Native 393x852 mobil artboard, to'liq ekran, yozuvsiz) */}
        <main
          className="absolute inset-0 flex items-center justify-center overflow-hidden pointer-events-none"
          aria-labelledby={titleId}
        >
          <div className="relative size-full max-w-[500px] flex items-center justify-center">
            <BrilliantEndstateRive
              kind="lesson-loader"
              fit="cover"
              variant={colorVariant}
              isLevel={isLevel}
              dark={Boolean(dark)}
              label={tt('pathLaunching')}
              className="lesson-launch-rive size-full"
            />
          </div>
        </main>
      </div>
    </DialogOverlay>
  )
}
