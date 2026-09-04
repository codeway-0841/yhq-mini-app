import { useEffect, useState } from 'react'
import { BookOpen, Play, ChevronRight, Circle, CheckCircle2 } from 'lucide-react'
import { remainingSeconds, testDurationSeconds } from '../../../shared/lib/test-session'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../../../shared/store/useAppStore'
import { useSubjectStore } from '../../../shared/store/useSubjectStore'
import { useTestSessionStore } from '../../../shared/store/useTestSessionStore'
import { useLessonsStore } from '../../../shared/store/useLessonsStore'
import { useQuestionsStore } from '../../../shared/store/useQuestionsStore'
import { Button } from '../../../shared/components/ui/button'
import { useT } from '../../../shared/i18n'
import { modules } from '../../../content/modules'
import { resumeRouteState } from '../next-step'
import { LessonToken } from '../../lessons'
import './learning-guide.css'

export function LearningGuide({ mistakesCount }: { mistakesCount: number }) {
  const navigate = useNavigate()
  const lang = useAppStore((s) => s.settings.language)
  const solvedQuestions = useAppStore((s) => s.solvedQuestions)
  const answered = new Set(solvedQuestions ?? [])
  const userId = useAppStore((s) => s.user?.id)
  const subject = useSubjectStore((s) => s.subject)
  const session = useTestSessionStore((s) => s.session)
  const done = useLessonsStore((s) => userId ? s.byUser[userId] : undefined)
  const tt = useT(lang)
  const resume = resumeRouteState(session, subject.id)
  const [now, setNow] = useState(Date.now)
  const deadline = resume && session ? session.startedAt + testDurationSeconds(session.mode) * 1000 : null
  useEffect(() => {
    if (deadline === null) return
    const refresh = () => setNow(Date.now())
    refresh()
    const timeout = window.setTimeout(refresh, Math.max(0, deadline - Date.now()) + 10)
    window.addEventListener('focus', refresh)
    return () => { window.clearTimeout(timeout); window.removeEventListener('focus', refresh) }
  }, [deadline])
  const expired = !!resume && !!session && remainingSeconds(session.startedAt, testDurationSeconds(session.mode), now) === 0
  const questions = useQuestionsStore((s) => s.questions)
  const topics = useQuestionsStore((s) => s.topics)
  const loadedSubject = useQuestionsStore((s) => s.subjectId)
  const loaded = useQuestionsStore((s) => s.loaded)
  const topicChoices = subject.id === 'yhq'
    ? modules.map((m) => ({
      id: m.id, title: lang === 'ru' ? m.titleRu : m.title,
      state: { moduleId: m.id }, path: '/darslik',
      complete: Array.from({ length: m.lessonCount }, (_, i) => i).every((i) => done?.[m.id]?.includes(i)),
    }))
    : loaded && loadedSubject === subject.id
      ? topics.map((t) => ({
        id: t.id, title: lang === 'ru' ? t.nameRu : t.nameUz,
        state: { questionIds: questions.filter((q) => q.topicId === t.id).map((q) => q.id), title: lang === 'ru' ? t.nameRu : t.nameUz },
        path: '/test/1', complete: questions.filter((q) => q.topicId === t.id).every((q) => answered.has(`${subject.id}:${q.id}`)),
      })).filter((t) => t.state.questionIds.length > 0)
      : []
  const completedTopics = topicChoices.filter((t) => t.complete)
  const allComplete = topicChoices.length > 0 && completedTopics.length === topicChoices.length
  const currentIndex = topicChoices.findIndex((t) => !t.complete)
  const currentTopic = topicChoices[currentIndex]
  const followingTopic = currentIndex >= 0 ? topicChoices.slice(currentIndex + 1).find((t) => !t.complete) : undefined
  const hasContinue = !!resume || (!allComplete && completedTopics.length > 0) || (subject.id !== 'yhq' && !!currentTopic && 'questionIds' in currentTopic.state && currentTopic.state.questionIds.some((id) => answered.has(`${subject.id}:${id}`))) || (subject.id === 'yhq' && !!currentTopic && (done?.[currentTopic.id]?.length ?? 0) > 0)
  const title = expired ? tt('guideExpiredTest') : resume ? (session?.title || tt('guideResumeTest')) : allComplete ? tt('guideTopicsDone') : currentTopic?.title
    ?? (mistakesCount > 0 ? tt('guideReviewTitle') : tt('topics'))
  const description = expired ? tt('guideExpiredHint') : resume ? tt('guideResumeHint') : allComplete ? tt('guideTopicsDoneHint') : currentTopic ? null
    : mistakesCount > 0 ? tt('guideReviewGentle') : tt('guideChooseTopic')
  const start = () => {
    if (resume) navigate('/test/1', { state: resume })
    else if (currentTopic) navigate(currentTopic.path, { state: currentTopic.state })
    else if (allComplete) navigate(topicChoices[0].path, {state: topicChoices[0].state})
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
        </div>
        <div className="home-learning-step">
          <div className="home-learning-path-row">
            <span className="home-learning-token" aria-hidden="true"><LessonToken done={allComplete && !resume} current={!allComplete || !!resume} /></span>
            <div className="min-w-0 flex-1">
              <h2 className="text-[17px] font-bold leading-snug text-pfg">{title}</h2>
              {description && <p className="mt-1 text-[12px] leading-relaxed text-pmuted">{description}</p>}
            </div>
            {allComplete && !resume ? <CheckCircle2 size={20} className="shrink-0 text-psuccess" aria-label={tt('pathDone')} /> : <Circle size={18} className="shrink-0 text-psubtle" aria-hidden="true" />}
          </div>
          {followingTopic && <button onClick={() => navigate(followingTopic!.path, { state: followingTopic!.state })} className={`home-learning-path-row home-learning-path-next ${interactive}`}>
            <span className="home-learning-token" aria-hidden="true"><LessonToken done={false} current={false} /></span>
            <span className="flex-1 text-left"><span className="text-[15px] font-semibold text-pmuted">{followingTopic.title}</span></span>
            <Circle size={15} className="text-psubtle" aria-hidden="true" />
          </button>}
          <Button block size="lg" className="mt-3 whitespace-normal" onClick={start}>
            {expired ? tt('guideViewResults') : allComplete && !resume ? tt('guideReviewTopics') : hasContinue ? tt('continueLearn') : currentTopic ? tt('pathStart') : mistakesCount > 0 ? tt('guideReviewAction') : tt('allTests')}
          </Button>
          {completedTopics.length > 0 && <details className="mt-4 border-t border-pline pt-3">
            <summary className="cursor-pointer text-[13px] font-semibold text-pmuted">{tt('guideCompletedTopics')} · {completedTopics.length}</summary>
            <div className="mt-2">
              {completedTopics.map((topic) => <button key={topic.id} onClick={() => navigate(topic.path, {state: topic.state})} className={`flex min-h-11 w-full items-center gap-3 rounded-xl px-2 py-2 text-left text-[14px] text-pfg ${interactive}`}>
                <CheckCircle2 size={18} className="shrink-0 text-psuccess" aria-label={tt('pathDone')} />{topic.title}
              </button>)}
            </div>
          </details>}
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
