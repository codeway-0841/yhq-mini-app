import { useEffect, useId, useRef, type CSSProperties } from 'react'
import DialogOverlay from '../../shared/components/DialogOverlay'
import { useT, type Lang } from '../../shared/i18n'
import { PathMascot } from './LessonToken'
import { RiveCanvas } from '../mascot-studio'

export const LESSON_LAUNCH_REVEAL_MS = 4700
export const LESSON_LAUNCH_MS = 5000
export type LaunchOrigin = { x: number; y: number; size: number; sink: number; hasMascot?: boolean }

export function lessonLaunchOrigin(node: HTMLElement | null): LaunchOrigin {
  const mascot = node?.querySelector<HTMLElement>('.learning-mascot')
  const tile = node?.querySelector('.learning-tile')?.getBoundingClientRect()
  const bounds = mascot?.getBoundingClientRect()
  const size = mascot?.offsetWidth || 44
  const x = bounds ? bounds.left + bounds.width / 2 : tile ? tile.left + tile.width / 2 : window.innerWidth / 2
  const y = bounds ? bounds.top + bounds.height / 2 : tile ? tile.top + tile.height * .3 : window.innerHeight * .4
  const sink = tile ? Math.max(12, tile.top + tile.height * (87 / 130) - y) : 36
  return { x, y, size, sink, hasMascot: Boolean(mascot) }
}

/** Departure → full-screen beam → settled mascot → reader reveal. */
export default function LessonLaunch({ origin, lang, onReveal, onFinish, onCancel, accent }: {
  origin: LaunchOrigin; lang: Lang
  accent?: string
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
    '--launch-accent': accent ?? 'var(--p-primary)',
  } as CSSProperties
  return <DialogOverlay onClose={onCancel} position="center" zIndex={60} labelId={titleId}
    backdropClassName="bg-transparent" className="lesson-launch-overlay">
    <div className="lesson-launch-scene" style={style} tabIndex={0}>
      <span id={titleId} className="sr-only">{tt('pathLaunching')}</span>
      {origin.hasMascot && <div className="lesson-launch-departure" aria-hidden="true"><PathMascot /></div>}
      <div className="lesson-launch-canvas" aria-hidden="true">
        <RiveCanvas
          file="lesson_loader_apr_13_26.riv"
          animation="Loop_down_v03_Minimal"
          label={tt('pathLaunching')}
          className="lesson-launch-rive"
          fit="cover"
        />
      </div>
    </div>
  </DialogOverlay>
}
