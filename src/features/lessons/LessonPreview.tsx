import { useEffect, useRef } from 'react'
import { ChevronDown, ChevronUp, Dumbbell, Crown } from 'lucide-react'
import { Button } from '../../shared/components/ui/button'
import { registerModal } from '../../shared/lib/navigation'
import { useT, type Lang } from '../../shared/i18n'

// Keep the shortcut ready for a later release; lesson-reader practice stays available.
const SHOW_PATH_PRACTICE = false

/** Browsing stays available while the dock follows the scroll-selected lesson. */
export default function LessonPreview({ title, selectionKey, check, current, done, premiumRequired, lang, collapsed, onJump, jumpDirection, onClose, onStart, onPractice }: {
  title: string; selectionKey: string; check: boolean; current: boolean; done: boolean; lang: Lang; collapsed: boolean
  premiumRequired: boolean
  onJump?: () => void; jumpDirection: 'up' | 'down'; onClose: () => void; onStart: () => void; onPractice: () => void
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
    {!collapsed && <section id="lesson-preview" className="lesson-preview rounded-3xl bg-pcard shadow-2xl" aria-labelledby="lesson-preview-title">
      <div key={selectionKey} className="lesson-preview-copy">
        <h2 id="lesson-preview-title">{title}</h2>
      </div>
      {premiumRequired && <p className="mb-4 text-center text-xs text-pmuted">{tt('pathPremiumHint')}</p>}
      <Button size="lg" block className="lesson-preview-start" data-jump={jump || premiumRequired} onClick={onStart}>
        {premiumRequired && <Crown aria-hidden="true" />}
        {premiumRequired ? tt('pathPremiumOpen') : check ? tt('pathCheckStart') : done ? tt('pathReview') : current ? tt('pathStart') : tt('pathJumpAhead')}
      </Button>
    </section>}
  </div>
}
