import { ArrowRight, BookOpen, Play } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../../../shared/store/useAppStore'
import { useSubjectStore } from '../../../shared/store/useSubjectStore'
import { useTestSessionStore } from '../../../shared/store/useTestSessionStore'
import { useLessonsStore } from '../../../shared/store/useLessonsStore'
import { useT } from '../../../shared/i18n'
import { Button } from '../../../shared/components/ui/button'
import { modules } from '../../../content/modules'
import { resumeRouteState } from '../next-step'

export function LearningGuide({ mistakesCount }: { mistakesCount: number }) {
  const navigate = useNavigate()
  const lang = useAppStore((s) => s.settings.language)
  const userId = useAppStore((s) => s.user?.id)
  const subject = useSubjectStore((s) => s.subject)
  const session = useTestSessionStore((s) => s.session)
  const done = useLessonsStore((s) => userId ? s.byUser[userId] : undefined)
  const tt = useT(lang)
  const resume = resumeRouteState(session, subject.id)
  const nextModule = subject.id === 'yhq' && modules.some((m) => (done?.[m.id]?.length ?? 0) > 0)
    ? modules.find((m) => Array.from({ length: m.lessonCount }, (_, i) => i).some((i) => !done?.[m.id]?.includes(i)))
    : undefined
  const hasContinue = !!resume || !!nextModule
  const learnPath = subject.id === 'yhq' ? '/darslik' : '/mavzular'
  const interactive = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pprimary focus-visible:ring-offset-2 focus-visible:ring-offset-pcanvas'

  return (
    <div className="px-4 pb-6">
      {hasContinue && (
        <section aria-labelledby="continue-heading" className="mb-4 rounded-2xl bg-pwash p-4">
          <p className="text-[12px] font-semibold text-pprimary">{tt('guideContinueLabel')}</p>
          <h1 id="continue-heading" className="mt-1 font-display text-[22px] font-bold leading-tight text-pfg">{resume ? tt('guideResumeTest') : tt('guideResumeLesson')}</h1>
          <p className="mt-2 text-[14px] leading-relaxed text-pmuted">
            {resume ? tt('guideResumeHint') : (lang === 'ru' ? nextModule?.titleRu : nextModule?.title)}
          </p>
          <Button block size="lg" className="mt-4" onClick={() => resume
            ? navigate('/test/1', { state: resume })
            : navigate('/darslik', { state: { moduleId: nextModule?.id } })}>
            <Play size={18} /> {tt('continueLearn')}
          </Button>
        </section>
      )}

      <section aria-labelledby="recommendation-heading" className="mb-5 rounded-2xl border border-pline bg-pcard p-4">
        <p className="text-[12px] font-semibold text-pprimary">{tt('guideToday')}</p>
        <h2 id="recommendation-heading" className="mt-1 font-display text-[20px] font-bold leading-snug text-pfg">{mistakesCount > 0 ? tt('guideReviewTitle') : tt('guideStartTitle')}</h2>
        <p className="mt-2 text-[14px] leading-relaxed text-pmuted">
          {mistakesCount > 0 ? tt('guideReviewHint').replace('{count}', String(mistakesCount)) : tt('guideStartHint')}
        </p>
        <Button block size="lg" variant={hasContinue ? 'secondary' : 'default'} className="mt-4"
          onClick={() => navigate(mistakesCount > 0 ? '/xatolar' : '/testlar')}>
          {mistakesCount > 0 ? tt('guideReviewAction') : tt('startTestBtn')} <ArrowRight size={18} />
        </Button>
      </section>

      <div className="grid gap-3 sm:grid-cols-2">
        <button onClick={() => navigate(learnPath)} className={`flex items-start gap-3 rounded-2xl bg-pcard p-4 text-left hover:bg-psurface ${interactive}`}>
          <BookOpen size={22} className="mt-0.5 shrink-0 text-pprimary" />
          <span><span className="block text-[16px] font-bold text-pfg">{tt('dashboardLearn')}</span><span className="mt-1 block text-[13px] leading-relaxed text-pmuted">{tt(subject.id === 'yhq' ? 'guideLearnHint' : 'guideTopicsHint')}</span></span>
        </button>
        <button onClick={() => navigate('/testlar')} className={`flex items-start gap-3 rounded-2xl bg-pcard p-4 text-left hover:bg-psurface ${interactive}`}>
          <Play size={22} className="mt-0.5 shrink-0 text-pprimary" />
          <span><span className="block text-[16px] font-bold text-pfg">{tt('dashboardPractice')}</span><span className="mt-1 block text-[13px] leading-relaxed text-pmuted">{tt('guidePracticeHint')}</span></span>
        </button>
      </div>
      <button onClick={() => navigate('/rejimlar')} className={`mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl text-[14px] font-semibold text-pprimary ${interactive}`}>
        {tt('guideAllModes')} <ArrowRight size={16} />
      </button>
    </div>
  )
}
