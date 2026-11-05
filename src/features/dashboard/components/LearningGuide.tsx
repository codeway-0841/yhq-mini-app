import { useEffect, useId, useState } from 'react'
import {
  BookOpen, GraduationCap, Ticket, Brain, CheckCircle2, ChevronRight,

} from 'lucide-react'
import { remainingSeconds, testDurationSeconds } from '../../../shared/lib/test-session'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../../../shared/store/useAppStore'
import { useSubjectStore } from '../../../shared/store/useSubjectStore'
import { useTestSessionStore } from '../../../shared/store/useTestSessionStore'
import { config } from '../../../shared/config'
import { useLessonsStore } from '../../../shared/store/useLessonsStore'
import { useQuestionsStore } from '../../../shared/store/useQuestionsStore'

import { useT } from '../../../shared/i18n'
import { modules } from '../../../content/modules'
import { resumeRouteState, selectDailyPlan } from '../next-step'
import { PathMascot, getBrilliantTheme } from '../../lessons'
import type { LearningSummary } from '../../../shared/api'
import { track } from '../../../shared/lib/analytics'
import './learning-guide.css'

export function LearningGuide({ summary, mistakesCount = 0 }: {
  summary?: LearningSummary
  /** Eski embed/testlar uchun fallback; Dashboard server xulosasini beradi. */
  mistakesCount?: number
}) {
  const navigate = useNavigate()
  const lang = useAppStore((s) => s.settings.language)
  const solvedQuestions = useAppStore((s) => s.solvedQuestions)
  const answered = new Set(solvedQuestions ?? [])
  const userId = useAppStore((s) => s.user?.id)
  const subject = useSubjectStore((s) => s.subject)
  const session = useTestSessionStore((s) => s.session)
  const done = useLessonsStore((s) => userId ? s.byUser[userId] : undefined)
  const tt = useT(lang)
  const sheenId1 = useId()
  const sheenId2 = useId()
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


  const openMistakes = summary?.unresolvedMistakes ?? mistakesCount
  const dueReviews = summary?.dueNow ?? 0
  const remainingSessionItems = resume && session
    ? Math.max(1, session.answers.filter((answer) => answer === null).length)
    : 0
  const plan = selectDailyPlan({
    remainingSessionItems,
    unresolvedMistakes: openMistakes,
    dueReviews,
    hasCurrentTopic: !!currentTopic,
    allTopicsComplete: allComplete,
  })
  const topicTheme = typeof currentTopic?.id === 'number' ? getBrilliantTheme((((currentTopic.id - 1) % 8) + 1)) : getBrilliantTheme(1)
  const theme = plan.kind === 'topic' ? topicTheme : getBrilliantTheme(1)
  const hasContinue = !!resume || (!allComplete && completedTopics.length > 0) || (subject.id !== 'yhq' && !!currentTopic && 'questionIds' in currentTopic.state && currentTopic.state.questionIds.some((id) => answered.has(`${subject.id}:${id}`))) || (subject.id === 'yhq' && !!currentTopic && (done?.[currentTopic.id]?.length ?? 0) > 0)
  const title = expired ? tt('guideExpiredTest')
    : plan.kind === 'resume' ? (session?.title || tt('guideResumeTest'))
    : plan.kind === 'mistakes' ? tt('guideReviewTitle')
    : plan.kind === 'review' ? tt('dailyReviewTitle')
    : plan.kind === 'completed' ? tt('guideTopicsDone')
    : plan.kind === 'topic' ? currentTopic?.title ?? tt('topics')
    : tt('guideStartTitle')
  const description = expired ? tt('guideExpiredHint')
    : plan.kind === 'resume' ? tt('guideResumeHint')
    : plan.kind === 'mistakes' ? tt('dailyMistakesHint').replace('{count}', String(openMistakes))
    : plan.kind === 'review' ? tt('dailyReviewHint').replace('{count}', String(dueReviews))
    : plan.kind === 'completed' ? tt('guideTopicsDoneHint')
    : plan.kind === 'topic' ? tt('dailyTopicHint')
    : tt('guideStartHint')
  const start = () => {
    track('daily_plan_start', {
      subject_id: subject.id,
      kind: plan.kind,
      item_count: plan.itemCount,
      readiness: summary?.readinessPercent ?? null,
    })
    if (resume) navigate('/test/1', { state: resume })
    else if (plan.kind === 'mistakes') {
      if (config.testSessionsV2Enabled) {
        navigate('/test/1', {
          state: { mode: 'mistakes', serverSelector: 'mistakes', title: tt('fixMistakes') },
        })
      } else {
        navigate('/xatolar')
      }
    }
    else if (plan.kind === 'review') navigate('/adaptive')
    else if (plan.kind === 'topic' && currentTopic) navigate(currentTopic.path, { state: currentTopic.state })
    else if (plan.kind === 'completed' && topicChoices[0]) navigate(topicChoices[0].path, {state: topicChoices[0].state})
    else navigate('/testlar')
  }
  const learnPath = subject.id === 'yhq' ? '/darslik' : '/mavzular'
  // Rus tili va rus adabiyoti uchun alohida darsliklar mavjud.
  const darslikPath = subject.id === 'rustili' ? '/darslik/rus-tili' : subject.id === 'rusadabiyot' ? '/darslik/rus-adabiyot' : '/darslik'
  const contextLabel = expired ? null : plan.kind === 'resume' ? tt('guidePendingTest')
    : plan.kind === 'mistakes' ? tt('dailyPriorityMistakes')
    : plan.kind === 'review' ? tt('dailyPriorityMemory')
    : plan.kind === 'topic' ? tt(hasContinue ? 'guideCurrentTopic' : 'guideNextTopic')
    : null
  const actionLabel = expired ? tt('guideViewResults') : plan.kind === 'resume' ? tt('guideContinueTest')
    : plan.kind === 'mistakes' ? tt('dailyStartPlan')
    : plan.kind === 'review' ? tt('dailyStartReview')
    : plan.kind === 'completed' ? tt('guideReviewTopics') : plan.kind === 'topic' && currentTopic
      ? subject.id === 'yhq'
        ? tt(hasContinue ? 'guideContinueLesson' : 'guideStartLesson')
        : tt(hasContinue ? 'guideContinueTest' : 'guideStartTest')
      : tt('allTests')
  const interactive = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pprimary focus-visible:ring-offset-2 focus-visible:ring-offset-pcanvas'

  return (
    <div className="home-learning-guide px-4 lg:px-0 pb-3">
      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4 lg:gap-4">
        <button type="button" onClick={() => navigate(learnPath)} className={`home-learning-shortcut app-card-interactive ${interactive}`}>
          <div className="home-learning-shortcut-icon">
            <BookOpen size={19} strokeWidth={2} />
          </div>
          <span className="min-w-0 flex-1 text-[14px] xs:text-[15px] font-bold leading-tight text-pfg truncate xs:text-clip">{tt('dashboardLearn')}</span>
          <ChevronRight className="home-learning-shortcut-chevron" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => navigate(darslikPath)}
          aria-label={tt('lessons')}
          className={`home-learning-shortcut app-card-interactive ${interactive}`}
        >
          <div className="home-learning-shortcut-icon">
            <GraduationCap size={19} strokeWidth={2} />
          </div>
          <span className="min-w-0 flex-1 text-[14px] xs:text-[15px] font-bold leading-tight text-pfg truncate xs:text-clip">{tt('lessons')}</span>
          <ChevronRight className="home-learning-shortcut-chevron" aria-hidden="true" />
        </button>
        <button type="button" onClick={() => navigate('/biletlar')} className={`home-learning-shortcut app-card-interactive ${interactive}`}>
          <div className="home-learning-shortcut-icon">
            <Ticket size={19} strokeWidth={2} />
          </div>
          <span className="min-w-0 flex-1 text-[14px] xs:text-[15px] font-bold leading-tight text-pfg truncate xs:text-clip">{tt('tickets')}</span>
          <ChevronRight className="home-learning-shortcut-chevron" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => navigate('/adaptive')}
          aria-label={tt('adaptiveTitle')}
          className={`home-learning-shortcut app-card-interactive ${interactive}`}
        >
          <div className="home-learning-shortcut-icon">
            <Brain size={19} strokeWidth={2} />
          </div>
          <span className="min-w-0 flex-1 text-[14px] xs:text-[15px] font-bold leading-tight text-pfg truncate xs:text-clip">{tt('dashboardReviewShort')}</span>
          <ChevronRight className="home-learning-shortcut-chevron" aria-hidden="true" />
        </button>
      </div>

      <section className="home-learning-hero mt-4">
        <div className="home-learning-step">
          <div className="home-learning-path-row">
            <span className="home-learning-token" aria-hidden="true">
              {allComplete && !resume ? (
                <img src="/darslik-map/node-completed.svg" alt="" width={64} height={67} className="home-learning-disk" />
              ) : (
                <span className="home-learning-disk-wrap">
                  <img src="/darslik-map/node-active-base.png" alt="" width={64} height={67} className="home-learning-disk" />
                  <span className="home-learning-mascot">
                    <PathMascot animation="idle" variant="tile" />
                  </span>
                </span>
              )}
            </span>
            <div className="min-w-0 flex-1">
              {contextLabel && <p className="text-[11.5px] leading-normal text-pmuted">{contextLabel}</p>}
              <h2 className={`text-[16px] font-bold leading-snug text-pfg ${contextLabel ? 'mt-0.5' : ''}`}>{title}</h2>
              {description && <p className="mt-0.5 text-[11.5px] leading-relaxed text-pmuted">{description}</p>}
            </div>
            {plan.kind === 'completed' && <CheckCircle2 size={19} className="shrink-0 text-psuccess" aria-label={tt('pathDone')} />}
          </div>
          <button
            type="button"
            data-testid="brilliant-start-button"
            onClick={start}
            className="home-learning-start select-none"
            style={{
              backgroundColor: theme.buttonBg,
              color: theme.buttonText,
              boxShadow: `inset 0 -4px 0 ${theme.buttonShadow}`,
            }}
          >
            <span aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit] select-none z-0">
              <span className="absolute top-0 left-0 w-[150px] h-full animate-brilliant-sheen">
                <svg viewBox="0 0 150 56" width="150" height="56" fill="none" className="h-full w-[150px]" aria-hidden="true">
                  <defs>
                    <linearGradient id={sheenId1} x1="100.5" y1="-58.6328" x2="100.5" y2="91.3672" gradientUnits="userSpaceOnUse">
                      <stop offset="0.27" stopColor="#F5EFFF" />
                      <stop offset="0.71" stopColor="white" stopOpacity="0" />
                    </linearGradient>
                    <linearGradient id={sheenId2} x1="140.826" y1="-28.1328" x2="140.826" y2="121.867" gradientUnits="userSpaceOnUse">
                      <stop offset="0.081302" stopColor="#F5EFFF" />
                      <stop offset="0.570844" stopColor="white" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <rect opacity="0.4" x="75" y="-58.6328" width="51" height="150" transform="rotate(30 75 -58.6328)" fill={`url(#${sheenId1})`} />
                  <rect opacity="0.4" x="127.826" y="-28.1328" width="26" height="150" transform="rotate(30 127.826 -28.1328)" fill={`url(#${sheenId2})`} />
                </svg>
              </span>
            </span>
            <span className="relative z-10">{actionLabel}</span>
          </button>



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
