import { useEffect, useState } from 'react'
import { BookOpen, GraduationCap, Ticket, Brain, CheckCircle2 } from 'lucide-react'
import { remainingSeconds, testDurationSeconds } from '../../../shared/lib/test-session'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../../../shared/store/useAppStore'
import { useSubjectStore } from '../../../shared/store/useSubjectStore'
import { useTestSessionStore } from '../../../shared/store/useTestSessionStore'
import { config } from '../../../shared/config'
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
  // v2: mavzu kartalari metadata'dan, ochilish server topic session orqali
  // (full-bank mapping YO'Q; bajarilish foizi keyin — hozircha false).
  const isV2 = config.testSessionsV2Enabled
  const topicChoices = subject.id === 'yhq'
    ? modules.map((m) => ({
      id: m.id, title: lang === 'ru' ? m.titleRu : m.title,
      state: { moduleId: m.id }, path: '/darslik',
      complete: Array.from({ length: m.lessonCount }, (_, i) => i).every((i) => done?.[m.id]?.includes(i)),
    }))
    : isV2 && loadedSubject === subject.id
      ? topics.map((t) => ({
        id: t.id, title: lang === 'ru' ? t.nameRu : t.nameUz,
        state: {
          mode: 'topic' as const,
          serverSelector: { type: 'topic' as const, topicId: t.id },
          title: lang === 'ru' ? t.nameRu : t.nameUz,
        },
        path: '/test/1', complete: false,
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
  const currentTopic = topicChoices.find((t) => !t.complete)
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
  const contextLabel = expired ? null : resume ? tt('guidePendingTest') : currentTopic
    ? tt(hasContinue ? 'guideCurrentTopic' : 'guideNextTopic') : null
  const actionLabel = expired ? tt('guideViewResults') : resume ? tt('guideContinueTest')
    : allComplete ? tt('guideReviewTopics') : currentTopic
      ? subject.id === 'yhq'
        ? tt(hasContinue ? 'guideContinueLesson' : 'guideStartLesson')
        : tt(hasContinue ? 'guideContinueTest' : 'guideStartTest')
      : mistakesCount > 0 ? tt('guideReviewAction') : tt('allTests')
  const interactive = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pprimary focus-visible:ring-offset-2 focus-visible:ring-offset-pcanvas'

  return (
    <div className="home-learning-guide px-4 pb-3">
      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4 lg:gap-4">
        <button onClick={() => navigate(learnPath)} className={`home-learning-shortcut ${interactive}`}>
          <div className="grid size-9 place-items-center rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
            <BookOpen size={19} strokeWidth={2} />
          </div>
          <span className="mt-2 block text-[14px] font-bold text-pfg">{tt('dashboardLearn')}</span>
          <span className="mt-0.5 block text-[11px] leading-snug text-pmuted">{tt(subject.id === 'yhq' ? 'guideLessonsShort' : 'guideTopicsShort')}</span>
        </button>
        <button
          type="button"
          onClick={() => navigate('/darslik')}
          aria-label={tt('lessons')}
          className={`home-learning-shortcut ${interactive}`}
        >
          <div className="grid size-9 place-items-center rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
            <GraduationCap size={19} strokeWidth={2} />
          </div>
          <span className="mt-2 block text-[14px] font-bold text-pfg">{tt('lessons')}</span>
          <span className="mt-0.5 block text-[11px] leading-snug text-pmuted">{tt('guideLessonsShort')}</span>
        </button>
        <button type="button" onClick={() => navigate('/biletlar')} className={`home-learning-shortcut ${interactive}`}>
          <div className="grid size-9 place-items-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <Ticket size={19} strokeWidth={2} />
          </div>
          <span className="mt-2 block text-[14px] font-bold text-pfg">{tt('tickets')}</span>
          <span className="mt-0.5 block text-[11px] leading-snug text-pmuted">{tt('guideTicketsShort')}</span>
        </button>
        <button
          type="button"
          onClick={() => navigate('/adaptive')}
          aria-label={tt('adaptiveTitle')}
          className={`home-learning-shortcut ${interactive}`}
        >
          <div className="grid size-9 place-items-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
            <Brain size={19} strokeWidth={2} />
          </div>
          <span className="mt-2 block text-[14px] font-bold text-pfg">{tt('adaptiveTitle')}</span>
          <span className="mt-0.5 block text-[11px] leading-snug text-pmuted">{tt('guideAdaptiveShort')}</span>
        </button>
      </div>

      <section className="home-learning-hero mt-4">
        <div className="home-learning-step">
          <div className="home-learning-path-row">
            <span className="home-learning-token" aria-hidden="true"><LessonToken done={allComplete && !resume} current={!allComplete || !!resume} /></span>
            <div className="min-w-0 flex-1">
              {contextLabel && <p className="text-[11.5px] leading-relaxed text-pmuted">{contextLabel}</p>}
              <h2 className="text-[16px] font-bold leading-snug text-pfg">{title}</h2>
              {description && <p className="mt-0.5 text-[11.5px] leading-relaxed text-pmuted">{description}</p>}
            </div>
            {allComplete && !resume && <CheckCircle2 size={19} className="shrink-0 text-psuccess" aria-label={tt('pathDone')} />}
          </div>
          <Button block size="lg" className="mt-2.5 whitespace-normal" onClick={start}>
            {actionLabel}
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
    </div>
  )
}
