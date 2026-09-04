import { useEffect, useId, useRef, type CSSProperties } from 'react'
import DialogOverlay from '../../shared/components/DialogOverlay'
import { useT, type Lang } from '../../shared/i18n'
import { PathMascot } from './LessonToken'

export const LESSON_LAUNCH_REVEAL_MS = 1600
export const LESSON_LAUNCH_MS = 1800
export type LaunchOrigin = { x: number; y: number; size: number; sink: number }

export function lessonLaunchOrigin(node: HTMLElement | null): LaunchOrigin {
  const mascot = node?.querySelector<HTMLElement>('.learning-mascot')
  const tile = node?.querySelector('.learning-tile')?.getBoundingClientRect()
  const bounds = mascot?.getBoundingClientRect()
  const size = mascot?.offsetWidth || 44
  const x = bounds ? bounds.left + bounds.width / 2 : tile ? tile.left + tile.width / 2 : window.innerWidth / 2
  const y = bounds ? bounds.top + bounds.height / 2 : tile ? tile.top + tile.height * .3 : window.innerHeight * .4
  const sink = tile ? Math.max(12, tile.top + tile.height * (87 / 130) - y) : 36
  return { x, y, size, sink }
}

/** Departure → full-screen beam → settled mascot → reader reveal. */
export default function LessonLaunch({ origin, lang, onReveal, onFinish, onCancel }: {
  origin: LaunchOrigin; lang: Lang
  onReveal: () => void; onFinish: () => void; onCancel: () => void
}) {
  const titleId = useId()
  const tt = useT(lang)
  const callbacks = useRef({ onReveal, onFinish })
  callbacks.current = { onReveal, onFinish }
  useEffect(() => {
    // Mount the reader behind the opaque scene before the final fade.
    const reveal = window.setTimeout(() => callbacks.current.onReveal(), LESSON_LAUNCH_REVEAL_MS)
    const finish = window.setTimeout(() => callbacks.current.onFinish(), LESSON_LAUNCH_MS)
    return () => { window.clearTimeout(reveal); window.clearTimeout(finish) }
  }, [])
  const style = {
    '--launch-x': origin.x + 'px', '--launch-y': origin.y + 'px',
    '--launch-size': origin.size + 'px', '--launch-sink': origin.sink + 'px',
    '--launch-duration': LESSON_LAUNCH_MS + 'ms',
  } as CSSProperties
  return <DialogOverlay onClose={onCancel} position="center" zIndex={60} labelId={titleId}
    backdropClassName="bg-transparent" className="lesson-launch-overlay">
    <div className="lesson-launch-scene" style={style} tabIndex={0}>
      <span id={titleId} className="sr-only">{tt('pathLaunching')}</span>
      <div className="lesson-launch-departure" aria-hidden="true"><PathMascot /></div>
      <div className="lesson-launch-canvas" aria-hidden="true">
        <div className="lesson-launch-flight"><PathMascot /></div>
      </div>
    </div>
  </DialogOverlay>
}
