import { BookOpen, Play, ChevronRight, Circle } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../../../shared/store/useAppStore'
import { useSubjectStore } from '../../../shared/store/useSubjectStore'
import { useTestSessionStore } from '../../../shared/store/useTestSessionStore'
import { useLessonsStore } from '../../../shared/store/useLessonsStore'
import { useT } from '../../../shared/i18n'
import { modules } from '../../../content/modules'
import { resumeRouteState } from '../next-step'
import { SubjectIllustration } from './SubjectIllustration'
import { LessonToken } from '../../lessons'
import './learning-guide.css'

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
  const title = resume ? tt('guideResumeTest') : nextModule
    ? (lang === 'ru' ? nextModule.titleRu : nextModule.title)
    : mistakesCount > 0 ? tt('guideReviewTitle') : tt('guideExploreTitle')
  const description = resume ? tt('guideResumeHint') : nextModule ? tt('guideLessonHint')
    : mistakesCount > 0 ? tt('guideReviewGentle') : tt('guideExploreHint')
  const start = () => {
    if (resume) navigate('/test/1', { state: resume })
    else if (nextModule) navigate('/darslik', { state: { moduleId: nextModule.id } })
    else navigate(mistakesCount > 0 ? '/xatolar' : '/testlar')
  }
  const learnPath = subject.id === 'yhq' ? '/darslik' : '/mavzular'
  const interactive = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pprimary focus-visible:ring-offset-2 focus-visible:ring-offset-pcanvas'

  return (
    <div className="home-learning-guide px-4 pb-6">
      <section aria-labelledby="home-learning-subject" className="home-learning-hero">
        <div className="home-learning-hero-heading">
          <h1 id="home-learning-subject" className="font-display text-[32px] font-extrabold leading-[1.15] tracking-[-0.025em] text-pfg">
            {lang === 'ru' ? subject.nameRu : subject.name}
          </h1>
          <p className="mt-4 text-[12px] font-extrabold uppercase tracking-[0.1em] text-pprimary">{tt(hasContinue ? 'guideContinueLabel' : 'guideToday')}</p>
        </div>
        <SubjectIllustration key={subject.id} subject={subject} />
        <div className="home-learning-step">
          <div className="home-learning-path-row">
            <span className="home-learning-token" aria-hidden="true"><LessonToken done={false} current /></span>
            <div className="min-w-0 flex-1">
              <h2 className="text-[17px] font-bold leading-snug text-pfg">{title}</h2>
              <p className="mt-1 text-[12px] leading-relaxed text-pmuted">{description}</p>
            </div>
          </div>
          <button onClick={() => navigate(learnPath)} className={`home-learning-path-row home-learning-path-next ${interactive}`}>
            <span className="home-learning-token" aria-hidden="true"><LessonToken done={false} current={false} /></span>
            <span className="flex-1 text-left"><span className="block text-[11px] text-pmuted">{tt('guideAlsoExplore')}</span><span className="text-[15px] font-semibold text-pmuted">{tt(subject.id === 'yhq' ? 'guideLessonsShort' : 'guideTopicsShort')}</span></span>
            <Circle size={15} className="text-psubtle" aria-hidden="true" />
          </button>
          <button className={`home-learning-start ${interactive}`} onClick={start}>
            {hasContinue ? tt('continueLearn') : tt('pathStart')}
          </button>
        </div>
      </section>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <button onClick={() => navigate(learnPath)} className={`home-learning-shortcut ${interactive}`}>
          <BookOpen size={23} strokeWidth={1.75} className="text-pmuted" />
          <span className="mt-3 block text-[16px] font-bold text-pfg">{tt('dashboardLearn')}</span>
          <span className="mt-1 block text-[12px] leading-relaxed text-pmuted">{tt(subject.id === 'yhq' ? 'guideLessonsShort' : 'guideTopicsShort')}</span>
        </button>
        <button onClick={() => navigate('/testlar')} className={`home-learning-shortcut ${interactive}`}>
          <Play size={23} strokeWidth={1.75} className="text-pmuted" />
          <span className="mt-3 block text-[16px] font-bold text-pfg">{tt('dashboardPractice')}</span>
          <span className="mt-1 block text-[12px] leading-relaxed text-pmuted">{tt('guidePracticeShort')}</span>
        </button>
      </div>
      <button onClick={() => navigate('/rejimlar')} className={`mt-2 flex min-h-11 w-full items-center justify-center gap-1 rounded-xl text-[13px] font-semibold text-pmuted ${interactive}`}>
        {tt('guideAllModes')} <ChevronRight size={15} />
      </button>
    </div>
  )
}
