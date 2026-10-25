import { useEffect, useRef } from 'react'
import { ChevronDown, ChevronUp, Dumbbell, Crown, Lock } from 'lucide-react'
import { Button } from '../../shared/components/ui/button'
import ModalHeaderRow from '../../shared/components/ModalHeaderRow'
import { registerModal } from '../../shared/lib/navigation'
import { useT, type Lang } from '../../shared/i18n'

// Keep the shortcut ready for a later release; lesson-reader practice stays available.
const SHOW_PATH_PRACTICE = false

/** Browsing stays available while the dock follows the scroll-selected lesson. */
export default function LessonPreview({ title, selectionKey, check, current, done, premiumRequired, lang, collapsed, onJump, jumpDirection, onClose, onStart, onPractice, locked = false, lockedHint, quizPending = false, onQuiz, eyebrow, description, duration, reward }: {
  title: string; selectionKey: string; check: boolean; current: boolean; done: boolean; lang: Lang; collapsed: boolean
  premiumRequired: boolean
  onJump?: () => void; jumpDirection: 'up' | 'down'; onClose: () => void; onStart: () => void; onPractice: () => void
  /** Ketma-ket ochilish: oldingi mavzu testidan o'tilmagan */
  locked?: boolean
  /** Qulf sababi (tarjima qilingan matn) */
  lockedHint?: string
  /** Mavzu o'qilgan, lekin testdan o'tilmagan */
  quizPending?: boolean
  /** Testni ochish */
  onQuiz?: () => void
  /** Dars konteksti — course-specific preview'lar uchun ixtiyoriy. */
  eyebrow?: string
  description?: string
  duration?: string
  reward?: string
}) {
  const tt = useT(lang)
  const closeRef = useRef(onClose)
  closeRef.current = onClose
  useEffect(() => {
    if (collapsed) return
    const unregister = registerModal(Symbol('lesson-preview'), () => closeRef.current())
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); closeRef.current() }
    }
    document.addEventListener('keydown', escape)
    return () => { unregister(); document.removeEventListener('keydown', escape) }
  }, [collapsed])
  const jump = !current && !done
  return <div className="lesson-preview-wrap" data-collapsed={collapsed}>
    <div className="lesson-preview-tools">
      {onJump ? <Button variant="secondary" size="icon" className="lesson-preview-toggle rounded-full" onClick={onJump}
        aria-label={tt('pathJump')}>
        {jumpDirection === 'up' ? <ChevronUp /> : <ChevronDown />}
      </Button> : <span />}
      {SHOW_PATH_PRACTICE && <button type="button" className="lesson-practice-float" onClick={onPractice} aria-label={tt('pathStartPractice')}>
        <span className="lesson-practice-disc" aria-hidden="true" /><Dumbbell aria-hidden="true" />
      </button>}
    </div>
    {!collapsed && <section id="lesson-preview" className="lesson-preview rounded-3xl bg-pcard shadow-2xl relative" aria-labelledby="lesson-preview-title">
      <ModalHeaderRow onClose={onClose} label={tt('darslikClose')} className="px-1 pb-2">
        <div key={selectionKey} className="lesson-preview-copy">
          {eyebrow && (
            <p className="mb-1 text-[11px] font-extrabold uppercase tracking-[0.10em] text-pprimary">
              {eyebrow}
            </p>
          )}
          <h2 id="lesson-preview-title">{title}</h2>
        </div>
      </ModalHeaderRow>
      {description && <p className="-mt-2 mb-3 text-center text-[12.5px] leading-relaxed text-pmuted">{description}</p>}
      {(duration || reward) && (
        <div className="mb-4 flex items-center justify-center gap-2" aria-label={description}>
          {duration && (
            <span className="inline-flex items-center rounded-xl bg-psurface px-2.5 py-1.5 text-[11px] font-bold text-pmuted shadow-2xs">
              {duration}
            </span>
          )}
          {reward && (
            <span className="inline-flex items-center rounded-xl bg-[rgb(var(--p-primary-rgb)/0.12)] px-2.5 py-1.5 text-[11px] font-extrabold text-pprimary shadow-2xs">
              {reward}
            </span>
          )}
        </div>
      )}
      {premiumRequired && <p className="mb-4 text-center text-xs text-pmuted">{tt('pathPremiumHint')}</p>}
      {locked ? (
        <>
          <p className="mb-4 flex items-start justify-center gap-2 rounded-xl bg-psurface px-3 py-2.5 text-center text-xs font-medium text-pmuted">
            <Lock aria-hidden="true" size={14} strokeWidth={2.25} className="mt-0.5 shrink-0" />
            <span>{lockedHint ?? tt('pathLocked')}</span>
          </p>
          <Button size="lg" block className="lesson-preview-start" disabled>
            <Lock aria-hidden="true" />
            {tt('pathLocked')}
          </Button>
        </>
      ) : quizPending && onQuiz ? (
        <div className="flex flex-col gap-2">
          <Button size="lg" block className="lesson-preview-start" data-jump={jump} onClick={onQuiz}>
            {tt('rusDarslikQuizOpen')}
          </Button>
          <Button size="sm" variant="secondary" block onClick={onStart}>
            {tt('pathReview')}
          </Button>
        </div>
      ) : (
        <Button size="lg" block className="lesson-preview-start" data-jump={jump || premiumRequired} onClick={onStart}>
          {premiumRequired && <Crown aria-hidden="true" />}
          {premiumRequired ? tt('pathPremiumOpen') : check ? tt('pathCheckStart') : done ? tt('pathReview') : current ? tt('pathStart') : tt('pathJumpAhead')}
        </Button>
      )}
    </section>}
  </div>
}
