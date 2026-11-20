import { useEffect, useId, useState } from 'react'
import {
  BookOpen, GraduationCap, Ticket, HeartCrack, CheckCircle2, ChevronRight,

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
import { BrilliantHeroIllustration, PathMascot, getBrilliantTheme } from '../../lessons'
import type { LearningSummary } from '../../../shared/api'
import { track } from '../../../shared/lib/analytics'
import { haptics } from '../../../platform/haptics'
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
  const dueReviews = 0
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

  const openShortcut = (path: string) => {
    haptics.impact('light')
    navigate(path)
  }

  const badgeTone =
    expired || plan.kind === 'mistakes'
      ? 'is-danger'
      : plan.kind === 'completed'
        ? 'is-success'
        : 'is-primary'

  const isRu = lang === 'ru'
  const heroModuleId = typeof currentTopic?.id === 'number' ? ((currentTopic.id - 1) % 8) + 1 : 1
  const darslikArtId = ((heroModuleId % 8) + 1)

  return (
    <div className="home-learning-guide px-4 lg:px-0 pb-1">
      {/* 1. Markaziy Obsidian Orbital Theater + Royal Blue 3D Action Dock */}
      <section className="home-learning-hero">
        <div className="kivvi-theater-shell">
          <div className="kivvi-theater-stage">
            {/* Orbital konsentrik halqalar (sof vektor geometriya) */}
            <svg viewBox="0 0 220 220" fill="none" className="kivvi-orbit-rings" aria-hidden="true">
              <circle cx="110" cy="110" r="98" stroke="white" strokeWidth="1.2" strokeDasharray="6 8" />
              <circle cx="110" cy="110" r="72" stroke="white" strokeWidth="1" strokeDasharray="3 6" />
              <circle cx="110" cy="110" r="46" stroke="white" strokeWidth="1" />
              <circle cx="110" cy="12" r="4" fill="#A8D31D" />
              <circle cx="182" cy="110" r="3" fill="#6e8cff" />
            </svg>

            <div className="kivvi-theater-top">
              <span className={`kivvi-live-tag ${badgeTone}`}>
                <span className="kivvi-live-dot" aria-hidden="true" />
                {contextLabel ?? (isRu ? 'План на сегодня' : 'Bugungi reja')}
              </span>
              {!expired && plan.estimatedMinutes > 0 && (
                <span className="kivvi-time-chip">
                  ~{plan.estimatedMinutes} {isRu ? 'мин' : 'daq'}
                </span>
              )}
            </div>

            <div className="kivvi-theater-body">
              <div className="kivvi-theater-copy">
                <h2 className="kivvi-theater-title">{title}</h2>
                {description && <p className="kivvi-theater-desc">{description}</p>}
              </div>

              <div className="kivvi-theater-visual" aria-hidden="true">
                <BrilliantHeroIllustration moduleId={heroModuleId} className="kivvi-theater-art" />
                {!allComplete || resume ? (
                  <span className="kivvi-theater-koji">
                    <PathMascot animation="idle" variant="tile" />
                  </span>
                ) : (
                  <span className="kivvi-theater-koji text-[#4ade80]">
                    <CheckCircle2 size={18} strokeWidth={2.5} />
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="kivvi-theater-dock">
            <button
              type="button"
              data-testid="brilliant-start-button"
              onClick={() => { haptics.impact('light'); start() }}
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



            {completedTopics.length > 0 && <details className="mt-3 border-t border-pline pt-2.5">
              <summary className="cursor-pointer text-[12.5px] font-bold text-pmuted">{tt('guideCompletedTopics')} · {completedTopics.length}</summary>
              <div className="mt-2">
                {completedTopics.map((topic) => <button key={topic.id} onClick={() => navigate(topic.path, {state: topic.state})} className={`flex min-h-10 w-full items-center gap-3 rounded-xl px-2 py-1.5 text-left text-[13.5px] text-pfg ${interactive}`}>
                  <CheckCircle2 size={16} className="shrink-0 text-psuccess" aria-label={tt('pathDone')} />{topic.title}
                </button>)}
              </div>
            </details>}
          </div>
        </div>
      </section>

      {/* 2. Asymmetric Swiss Bento Dock (Row 1: 7+5 Featured, Row 2: 6+6 Compact; Desktop: 4-col) */}
      <div className="mt-2.5 grid grid-cols-12 gap-2 lg:grid-cols-4 lg:gap-3">
        {/* Darslik — 7 ustun, jonli Brilliant illyustratsiyasi bilan */}
        <button
          type="button"
          onClick={() => openShortcut(darslikPath)}
          aria-label={tt('lessons')}
          className={`kivvi-bento-feature col-span-7 lg:col-span-1 ${interactive}`}
        >
          <span className="inline-flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-[0.08em] text-[#16a34a] dark:text-[#4ade80]">
            <GraduationCap size={13} strokeWidth={2.4} aria-hidden="true" />
            {isRu ? 'Интерактив' : 'Interaktiv'}
          </span>
          <div className="pr-14">
            <span className="block text-[16px] font-extrabold tracking-[-0.02em] text-pfg leading-tight">
              {tt('lessons')}
            </span>
            <span className="mt-0.5 block text-[11px] font-semibold text-pmuted">
              {isRu ? 'Пошаговый курс' : 'Bosqichma-bosqich'}
            </span>
          </div>
          <BrilliantHeroIllustration moduleId={darslikArtId} className="kivvi-darslik-peek" />
        </button>

        {/* Xatolar — 5 ustun, katta arxitektura raqamli alert karta */}
        <button
          type="button"
          onClick={() => openShortcut('/xatolar')}
          aria-label={tt('mistakes')}
          className={`kivvi-bento-feature col-span-5 lg:col-span-1 ${openMistakes > 0 ? 'is-mistakes-alert' : ''} ${interactive}`}
        >
          <div className="flex items-center justify-between gap-1">
            <span className="inline-flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-[0.08em] text-[#e11d48] dark:text-[#fb7185]">
              <HeartCrack size={13} strokeWidth={2.4} aria-hidden="true" />
              {tt('mistakes')}
            </span>
            <ChevronRight size={14} className="text-pmuted opacity-55" aria-hidden="true" />
          </div>
          <div className="flex items-baseline justify-between gap-1">
            {openMistakes > 0 ? (
              <span className="kivvi-mistake-big">{openMistakes > 99 ? '99+' : openMistakes}</span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[15px] font-extrabold text-[#16a34a] dark:text-[#4ade80]">
                <CheckCircle2 size={17} strokeWidth={2.5} />
                {isRu ? 'Чисто' : 'Toza'}
              </span>
            )}
            {openMistakes > 0 && (
              <span className="text-[10.5px] font-bold text-pmuted">
                {isRu ? 'откр.' : 'ochiq'}
              </span>
            )}
          </div>
        </button>

        {/* O'rganish — 6 ustun ixcham pill karta */}
        <button
          type="button"
          onClick={() => openShortcut(learnPath)}
          className={`kivvi-bento-pill col-span-6 lg:col-span-1 ${interactive}`}
        >
          <span className="kivvi-pill-icon is-learn">
            <BookOpen size={17} strokeWidth={2.2} />
          </span>
          <span className="min-w-0 flex-1 truncate text-[14px] font-extrabold tracking-[-0.015em] text-pfg">
            {tt('dashboardLearn')}
          </span>
          <ChevronRight size={15} className="shrink-0 text-pmuted opacity-55" aria-hidden="true" />
        </button>

        {/* Biletlar — 6 ustun ixcham pill karta */}
        <button
          type="button"
          onClick={() => openShortcut('/biletlar')}
          className={`kivvi-bento-pill col-span-6 lg:col-span-1 ${interactive}`}
        >
          <span className="kivvi-pill-icon is-tickets">
            <Ticket size={17} strokeWidth={2.2} />
          </span>
          <span className="min-w-0 flex-1 truncate text-[14px] font-extrabold tracking-[-0.015em] text-pfg">
            {tt('tickets')}
          </span>
          <ChevronRight size={15} className="shrink-0 text-pmuted opacity-55" aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}
