import { useEffect, useId, useRef, useState } from 'react'
import DialogOverlay from '../../shared/components/DialogOverlay'
import { useT, type Lang } from '../../shared/i18n'
import BrilliantEndstateRive from '../../shared/components/BrilliantEndstateRive'
import { resolveBrilliantRiveColor } from './lesson-transition'

export const LESSON_LAUNCH_REVEAL_MS = 950
export const LESSON_LAUNCH_MS = 1200
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
  origin,
  lang,
  onReveal,
  onFinish,
  onCancel,
  accent,
  colorVariant,
  isLevel = false,
  isReady = true,
  zIndex = 65,
}: {
  origin: LaunchOrigin
  lang: Lang
  accent?: string
  colorVariant?: number
  isLevel?: boolean
  isReady?: boolean
  zIndex?: number
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

  const resolvedColor = resolveBrilliantRiveColor(accent, colorVariant)

  const dark =
    typeof document !== 'undefined' &&
    (document.body.dataset.theme === 'dark' || document.documentElement.classList.contains('dark'))

  useEffect(() => {
    const minTimer = window.setTimeout(() => setMinTimeElapsed(true), LESSON_LAUNCH_REVEAL_MS)
    return () => window.clearTimeout(minTimer)
  }, [])

  useEffect(() => {
    if (!minTimeElapsed || !isReady || fading) return
    setFading(true)
    callbacks.current.onReveal()
  }, [minTimeElapsed, isReady, fading])

  useEffect(() => {
    if (!fading) return
    const finishTimer = window.setTimeout(() => {
      callbacks.current.onFinish()
    }, Math.max(0, LESSON_LAUNCH_MS - LESSON_LAUNCH_REVEAL_MS))
    return () => window.clearTimeout(finishTimer)
  }, [fading])

  return (
    <DialogOverlay
      onClose={() => callbacks.current.onCancel()}
      position="center"
      zIndex={zIndex}
      labelId={titleId}
      backdropClassName="bg-pcanvas transition-opacity [transition-duration:240ms]"
      className="lesson-launch-overlay !p-0"
    >
      <div
        className={`fixed inset-0 flex flex-col items-center justify-center bg-pcanvas text-pfg select-none transition-opacity [transition-duration:240ms] ease-out motion-safe:animate-in motion-safe:fade-in duration-75 ${
          fading ? 'opacity-0 pointer-events-none' : 'opacity-100'
        }`}
        style={{
          paddingTop: 'max(env(safe-area-inset-top, 0px), var(--safe-top, 0px))',
          paddingBottom: 'max(env(safe-area-inset-bottom, 0px), var(--safe-bottom, 0px))',
        }}
      >
        <span id={titleId} className="sr-only">
          {tt('pathLaunching')}
        </span>

        {/* Center: Rive Koji Lesson Loader (Native 393x852 mobil artboard, to'liq ekran, yozuvsiz) */}
        <main
          className="absolute inset-0 flex items-center justify-center overflow-hidden pointer-events-none"
          aria-labelledby={titleId}
          style={{
            transformOrigin: `${Math.round(origin.x)}px ${Math.round(origin.y)}px`,
          }}
        >
          <div className="relative size-full max-w-[520px] flex items-center justify-center">
            <BrilliantEndstateRive
              kind="lesson-loader"
              fit="cover"
              variant={resolvedColor}
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
