import { useState, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Camera, ArrowRight } from 'lucide-react'
import { PremiumIcon } from '../../shared/components/PremiumIcon'
import { levelFromXp } from '../../../shared/xp'
import { useAppStore } from '../../shared/store/useAppStore'
import { useSubjectStore } from '../../shared/store/useSubjectStore'
import { useQuestionsStore } from '../../shared/store/useQuestionsStore'
import { useDailyStore } from '../../shared/store/useDailyStore'
import { useT } from '../../shared/i18n'
import { Button } from '../../shared/components/ui/button'
import { Alert, AlertDescription } from '../../shared/components/ui/alert'
import { track } from '../../shared/lib/analytics'
import { usePullToRefresh } from '../../shared/hooks/usePullToRefresh'
import SubjectSheet from '../../shared/components/SubjectSheet'
import SettingsModal from '../../shared/components/SettingsModal'
import { TopBar } from './components/TopBar'
import DynamicIsland from './components/DynamicIsland'
import { ProgressCard } from './components/ProgressCard'
import { LearningGuide } from './components/LearningGuide'
import { LeaguePreview } from './components/LeaguePreview'
import { PromoBanner, SHOW_PROMO } from './components/PromoBanner'
import { SubjectEmpty } from './components/SubjectSwitcher'
import { MilestoneScene, LevelUpScene } from './components/Celebrations'
import { DailyTasksCard } from '../shop'
import { BossCard } from '../boss'
import { useCelebrations } from './hooks/useCelebrations'
import { useDashboardSync, useSubjectBadges, useDashboardQuestionCount } from './hooks/useDashboardData'
import { todayStr } from '../../shared/store/useDailyStore'

// ── Main Dashboard ──────────────────────────────────────────────────────────
export default function Dashboard() {
  const navigate = useNavigate()
  const [showSubjects, setShowSubjects] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  // Selector'li obuna — whole-store EMAS (har counter o'zgarishida re-render bo'lmasligi uchun)
  const user            = useAppStore((s) => s.user)
  const displayName     = useAppStore((s) => s.displayName)
  const settings        = useAppStore((s) => s.settings)
  const xp              = useAppStore((s) => s.xp)
  const totalWrong      = useAppStore((s) => s.totalWrong)
  const solvedQuestions = useAppStore((s) => s.solvedQuestions ?? [])
  const subject         = useSubjectStore((s) => s.subject)
  // Progress kartasidagi 🔥 — joriy FANGA tegishli kunlik seriya (Intizom)
  const dailyStreak     = useDailyStore((s) => s.streaks[subject.id] ?? 0)
  // Savollar hali yuklanmagan bo'lsa oxirgi ma'lum SONdan foydalanamiz —
  // aks holda birinchi kadrda "0%" chizilib, keyin haqiqiy foizga sakrardi.
  const questionsCount = useDashboardQuestionCount(subject.id)

  // Joriy fan bo'yicha UNIQUE yechilgan savollar soni (1 ta savolni 10 marta yechsa ham 1 ta hisoblanadi)
  const uniqueSolvedCount = useMemo(() => {
    const prefix = `${subject.id}:`
    return solvedQuestions.filter((k) => k.startsWith(prefix)).length
  }, [solvedQuestions, subject.id])

  useDashboardSync(user?.id, subject.id, settings.language)

  // ⬆️ Level-Up + Streak milestone nishonlashlari
  // Level SERVER XP'sidan (shared/xp.ts) — avval totalCorrect/50 edi, ya'ni
  // bilgan savolni qayta bosish ham level berardi
  const level = levelFromXp(xp)
  const { milestone, levelUp, closeMilestone, closeLevelUp, previewMilestone } =
    useCelebrations(level, dailyStreak, subject.id)

  // Pull-to-refresh — pastga tortganda barcha ma'lumotlar yangilanadi
  const ptr = usePullToRefresh(async () => {
    const uid = user?.id
    if (uid) {
      await Promise.allSettled([
        useDailyStore.getState().sync(uid, todayStr(), subject.id),
        useAppStore.getState().syncFromServer(uid),
      ])
    }
    // Foydalanuvchi yangilayapti: failedKey guardidan chiqib, aynan tanlangan fanga qayta urinish.
    await useQuestionsStore.getState().retry(settings.language, subject.id)
  })
  const tt = useT(settings.language)

  const { mistakesCount } = useSubjectBadges(subject.id)

  const goProfile = useCallback(() => navigate('/profil'), [navigate])

  return (
    <div className="dashboard-page bg-pcanvas pb-[calc(6.5rem+var(--safe-bottom,0px))]">
      {/* Pull-to-refresh indikator — pastga tortganda aksent spinner */}
      {ptr.state !== 'idle' && (
        <div className="fixed top-[calc(0.75rem+var(--safe-top,0px))] left-1/2 -translate-x-1/2 z-50 flex items-center justify-center">
          <div className="flex size-10 items-center justify-center rounded-full bg-pcard shadow-md transition-transform"
            style={{ transform: `scale(${Math.min(1, ptr.dist / ptr.threshold)})` }}>
            <span className="block size-5 rounded-full border-2 border-pline motion-safe:animate-spin"
              style={{ borderTopColor: 'var(--p-primary)' }} />
          </div>
        </div>
      )}

      {/* Top bar / Greeting Header */}
      <TopBar user={user} displayName={displayName}
        onSubjects={() => setShowSubjects(true)}
        onSettings={() => setShowSettings(true)} onProfile={goProfile} />

      {/* Fan mavjud bo'lmasa — empty state; mavjud bo'lsa — to'liq dashboard.
          key=subjectId: fan almashganda smooth fade transition, reload yo'q */}
      {subject.available ? (
        <div key={subject.id} className="animate-premiumIn">
          {/* Demo ma'lumotlar badge */}
          {subject.demoData && (
            <Alert variant="warning" className="mx-4 mb-4">
              <AlertDescription>
                {settings.language === 'ru'
                  ? 'Временные демо-данные — база этого предмета скоро будет подключена'
                  : "Vaqtinchalik demo ma'lumotlar — bu fanning bazasi tez orada ulanadi"}
              </AlertDescription>
            </Alert>
          )}

          {/* 1. Fan bo‘yicha umumiy progress */}
          <ProgressCard
            totalWrong={totalWrong}
            totalAnswered={uniqueSolvedCount}
            streak={dailyStreak}
            totalPool={questionsCount}
            lang={settings.language}
            onStreakPreview={() => previewMilestone(Math.max(dailyStreak, 7))}
          />

          {/* AI Suratdan yechish (Snap & Solve) */}
          <div
            onClick={() => navigate('/ai-tutor')}
            className="mx-4 mb-4 p-4 rounded-3xl bg-linear-to-r from-pprimary/10 via-purple-500/10 to-indigo-500/10 border border-pprimary/25 hover:border-pprimary/50 cursor-pointer transition-all flex items-center justify-between gap-3.5 shadow-xs group active:scale-[0.99]"
          >
            <div className="size-11 rounded-2xl bg-pprimary text-white grid place-items-center shrink-0 shadow-sm group-hover:scale-105 transition-transform">
              <Camera size={22} strokeWidth={2} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-bold text-pfg">{tt('snapSolveTitle')}</span>
                <span className="px-1.5 py-0.5 rounded-md bg-pprimary/15 text-pprimary text-[10px] font-bold">
                  AI Vision
                </span>
              </div>
              <p className="text-xs text-pmuted truncate mt-0.5">
                {tt('snapSolveSubtitle')}
              </p>
            </div>
            <div className="size-8 rounded-xl bg-psurface text-pmuted group-hover:text-pfg group-hover:bg-pline grid place-items-center shrink-0 transition-colors">
              <ArrowRight size={16} />
            </div>
          </div>

          <LearningGuide mistakesCount={mistakesCount} />

          <details className="mb-5 group">
            <summary className="mx-4 mb-3 cursor-pointer rounded-xl px-1 py-3 text-[14px] font-semibold text-pmuted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pprimary">{tt('guideMotivation')}</summary>
            <DailyTasksCard />
          {/* 6b. Haftalik BOSS BATTLE — jamoaviy jang kartasi */}
          <BossCard />

          {/* 7. Leaderboard */}
          <div>
            <LeaguePreview
              lang={settings.language}
              userId={user?.id}
              onSeeAll={() => navigate('/reyting')}
            />
          </div>

          </details>

          {/* 8. Premium Banner */}
          <div className="mx-4 mb-4 mt-4 flex items-center gap-3.5 rounded-2xl bg-pcard p-4 shadow-xs">
            <PremiumIcon size={22} className="shrink-0 text-pmuted" />
            <div className="min-w-0 flex-1">
              <p className="text-[13.5px] font-semibold text-pfg">Premium</p>
              <p className="mt-0.5 text-[13px] leading-relaxed text-pmuted">{tt('premiumTagline')}</p>
            </div>
            <Button size="sm" onClick={() => { track('premium_click'); navigate('/premium') }}>
              {tt('tryWord')}
            </Button>
          </div>

          {/* Promo banner */}
          {SHOW_PROMO && <PromoBanner text={tt('promoText')} />}
        </div>
      ) : (
        <SubjectEmpty onSwitch={() => setShowSubjects(true)} />
      )}

      <DynamicIsland />
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
      {showSubjects && <SubjectSheet onClose={() => setShowSubjects(false)} />}
      {milestone !== null && (
        <MilestoneScene streak={milestone} lang={settings.language} onClose={closeMilestone} />
      )}
      {levelUp !== null && (
        <LevelUpScene level={levelUp} lang={settings.language} onClose={closeLevelUp} />
      )}
    </div>
  )
}
