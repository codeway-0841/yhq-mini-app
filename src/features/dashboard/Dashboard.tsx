import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Play, Swords, GraduationCap,
  Bookmark, Hash, Signpost,
  Ticket, ShieldAlert,
  Sparkles, Bot, BookOpen, ClipboardList, HeartCrack, Crown, Coins, NotebookText,
} from 'lucide-react'
import { useAppStore } from '../../shared/store/useAppStore'
import { useSubjectStore } from '../../shared/store/useSubjectStore'
import { useQuestionsStore } from '../../shared/store/useQuestionsStore'
import { useDailyStore } from '../../shared/store/useDailyStore'
import { useT } from '../../shared/i18n'
import { track } from '../../shared/lib/analytics'
import { usePullToRefresh } from '../../shared/hooks/usePullToRefresh'
import SettingsModal from '../../shared/components/SettingsModal'
import SubjectSheet from '../../shared/components/SubjectSheet'
import { TopBar } from './components/TopBar'
import { Carousel } from './components/Carousel'
import { ProgressCard } from './components/ProgressCard'
import { GridCard, MockGridCard } from './components/GridCards'
import { LeaguePreview } from './components/LeaguePreview'
import { PromoBanner, SHOW_PROMO } from './components/PromoBanner'
import { SubjectSwitcher, SubjectEmpty } from './components/SubjectSwitcher'
import { MilestoneScene, LevelUpScene } from './components/Celebrations'
import { useCelebrations } from './hooks/useCelebrations'
import { useDashboardSync, useContinueInfo, useSubjectBadges } from './hooks/useDashboardData'
import { todayStr } from '../../shared/store/useDailyStore'

// ── Main Dashboard ──────────────────────────────────────────────────────────
export default function Dashboard() {
  const navigate = useNavigate()
  const [showSettings, setShowSettings] = useState(false)
  const [showSubjects, setShowSubjects] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  // Selector'li obuna — whole-store EMAS (har counter o'zgarishida re-render bo'lmasligi uchun)
  const user           = useAppStore((s) => s.user)
  const displayName    = useAppStore((s) => s.displayName)
  const settings       = useAppStore((s) => s.settings)
  const totalCorrect   = useAppStore((s) => s.totalCorrect)
  const totalWrong     = useAppStore((s) => s.totalWrong)
  const totalAnswered  = useAppStore((s) => s.totalAnswered)
  const savedQuestions = useAppStore((s) => s.savedQuestions)
  const subject  = useSubjectStore((s) => s.subject)
  // Progress kartasidagi 🔥 — joriy FANGA tegishli kunlik seriya (Intizom)
  const dailyStreak = useDailyStore((s) => s.streaks[subject.id] ?? 0)
  const questionsCount = useQuestionsStore((s) => s.questions.length)

  useDashboardSync(user?.id, subject.id, settings.language)

  // ⬆️ Level-Up + Streak milestone nishonlashlari
  const level = Math.floor(totalCorrect / 50) + 1
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
    await useQuestionsStore.getState().load(settings.language, subject.id)
  })
  const tt = useT(settings.language)

  const continueInfo = useContinueInfo(user?.id, settings.language, tt)
  const { mistakesCount, savedCountForSubject } = useSubjectBadges(subject.id)

  const showToast = useCallback((msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }, [])

  const goMistakes = useCallback(() => navigate('/xatolar'), [navigate])
  const goTopics   = useCallback(() => navigate('/mavzular'), [navigate])
  const goAdaptive = useCallback(() => navigate('/adaptive'), [navigate])
  const goOctagon  = useCallback(() => navigate('/octagon'), [navigate])
  const goProfile  = useCallback(() => navigate('/profil'), [navigate])
  const goDarslik  = useCallback(() => navigate('/darslik'), [navigate])

  /** Real test modes — TestPage builds the question set based on `mode` */
  const goMode = useCallback((mode: 'tricky' | 'numeric', title: string) => () =>
    navigate('/test/1', { state: { mode, title } }), [navigate])

  const goSaved = useCallback(() => {
    // Composite kalitlardan FAQAT joriy fanga oid savol id'larini ajratamiz
    const prefix = `${subject.id}:`
    const ids = savedQuestions
      .filter((k) => k.startsWith(prefix))
      .map((k) => Number(k.slice(prefix.length)))
      .filter((n) => Number.isInteger(n) && n > 0)
    if (ids.length === 0) {
      showToast(settings.language === 'ru'
        ? "Нет сохранённых вопросов — используйте 📌 в тесте"
        : "Hali saqlangan savollar yo'q — testda 📌 tugmasini bosing")
      return
    }
    navigate('/test/1', { state: { questionIds: ids, title: tt('saved') } })
  }, [savedQuestions, subject.id, settings.language, navigate, tt, showToast])

  return (
    <div className="font-display min-h-screen bg-pcanvas pb-6 safe-bottom">
      {/* Pull-to-refresh indikator — pastga tortganda aksent spinner */}
      {ptr.state !== 'idle' && (
        <div className="fixed top-3 left-1/2 -translate-x-1/2 z-50 flex items-center justify-center">
          <div className="w-10 h-10 rounded-full card-premium flex items-center justify-center transition-transform"
            style={{ transform: `scale(${Math.min(1, ptr.dist / ptr.threshold)})` }}>
            <span className="block w-5 h-5 rounded-full border-2 border-pline animate-spin"
              style={{ borderTopColor: 'var(--p-primary)' }} />
          </div>
        </div>
      )}

      {/* Top bar / Greeting Header */}
      <TopBar user={user} displayName={displayName}
        level={level}
        onSettings={() => setShowSettings(true)} onProfile={goProfile} />

      {/* Universal subject switcher */}
      <SubjectSwitcher onOpen={() => setShowSubjects(true)} />

      {/* Fan mavjud bo'lmasa — empty state; mavjud bo'lsa — to'liq dashboard.
          key=subjectId: fan almashganda smooth fade transition, reload yo'q */}
      {subject.available ? (
        <div key={subject.id} className="animate-premiumIn space-y-0">
          {/* Demo ma'lumotlar badge */}
          {subject.demoData && (
            <div className="mx-5 mb-3 rounded-2xl px-4 py-3 flex items-center gap-2"
              style={{ background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.3)' }}>
              <Sparkles size={15} className="text-pwarning flex-shrink-0" />
              <span className="text-[12px] font-semibold text-pwarning">
                {settings.language === 'ru'
                  ? 'Временные демо-данные — база этого предмета скоро будет подключена'
                  : "Vaqtinchalik demo ma'lumotlar — bu fanning bazasi tez orada ulanadi"}
              </span>
            </div>
          )}

          {/* 1. Carousel — navigatsiya bannerlari (scroll-snap) */}
          <Carousel
            lang={settings.language}
            progressPct={continueInfo.pct}
            lessonLabel={continueInfo.lessonLabel}
            onContinue={continueInfo.go}
          />

          {/* 2. Today's Progress */}
          <ProgressCard
            totalCorrect={totalCorrect}
            totalWrong={totalWrong}
            totalAnswered={totalAnswered}
            streak={dailyStreak}
            totalPool={questionsCount}
            lang={settings.language}
            onStreakPreview={() => previewMilestone(Math.max(dailyStreak, 7))}
          />

          {/* 4. Quick Actions (main grid) */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 px-5 mb-4">
            <MockGridCard icon={ClipboardList} label={tt('testlarTitle')}
              subtitle={`${questionsCount || '300'}+ ${tt('question').toLowerCase()}`}
              onClick={() => navigate('/testlar')} />
            <MockGridCard icon={BookOpen} label={tt('topics')} subtitle={tt('allTopicsDesc')}
              onClick={goTopics} />
            <MockGridCard icon={Bot} label={tt('aiTutor')} subtitle={tt('comingSoonD')}
              iconColor="#8b5cf6" comingSoon onClick={() => showToast(tt('comingSoonD'))} />
            <MockGridCard icon={HeartCrack} label={tt('mistakes')} subtitle={tt('mistakeFixDesc')}
              badge={mistakesCount || null} onClick={goMistakes} />
            <MockGridCard icon={Ticket} label={tt('tickets')} subtitle={tt('officialTickets')}
              onClick={() => navigate('/biletlar')} />
            <MockGridCard icon={Swords} label={tt('duelTitle')} subtitle={tt('duelDesc')}
              onClick={goOctagon} />
          </div>

          {/* 5. Modes */}
          <div className="px-5 mb-2">
            <p className="text-[10px] font-semibold text-psubtle uppercase tracking-[0.14em]">{tt('modesTitle')}</p>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 px-5 mb-4">
            <GridCard icon={ShieldAlert}   label={tt('distracting')} onClick={goMode('tricky', tt('distracting'))} />
            <GridCard icon={GraduationCap} label={tt('lessons')}     onClick={goDarslik} />
            <GridCard icon={Bookmark}      label={tt('saved')}       badge={savedCountForSubject || null} onClick={goSaved} />
            <GridCard icon={Signpost}      label={tt('roadSigns')}   onClick={() => navigate('/belgilar')} />
            <GridCard icon={Hash}          label={tt('numeric')}     onClick={goMode('numeric', tt('numeric'))} />
            <GridCard icon={Play}          label={tt('adaptive')}    onClick={goAdaptive} />
            <GridCard icon={NotebookText}  label={tt('cheatsheets')} onClick={() => navigate('/shpargalkalar')} />
          </div>

          {/* 6. Leaderboard */}
          <LeaguePreview
            lang={settings.language}
            userId={user?.id}
            onSeeAll={() => navigate('/reyting')}
          />

          {/* 7. Premium Banner */}
          <div className="mx-5 mb-4 card-premium p-4 flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-[14px] flex items-center justify-center flex-shrink-0"
              style={{ background: 'rgb(var(--p-primary-rgb) / 0.12)', border: '1px solid rgb(var(--p-primary-rgb) / 0.30)' }}>
              <Crown size={19} className="text-pprimary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-bold text-pfg">Premium</p>
              <p className="text-[11px] font-medium text-psubtle mt-0.5">{tt('premiumTagline')}</p>
            </div>
            <button onClick={() => { track('premium_click'); navigate('/premium') }}
              className="btn-premium-gold px-4 py-2.5 rounded-xl text-[12px]">
              {tt('tryWord')}
            </button>
          </div>

          {/* 8. Token Shop Banner */}
          <div className="mx-5 mb-4 card-premium p-4 flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-[14px] flex items-center justify-center flex-shrink-0"
              style={{ background: 'rgba(250,204,21,0.12)', border: '1px solid rgba(250,204,21,0.30)' }}>
              <Coins size={19} className="text-pgold" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-bold text-pfg">{tt('shopTitle')}</p>
              <p className="text-[11px] font-medium text-psubtle mt-0.5">{tt('shopTagline')}</p>
            </div>
            <button onClick={() => navigate('/shop')}
              className="btn-premium-gold px-4 py-2.5 rounded-xl text-[12px]">
              {tt('seeAll')}
            </button>
          </div>

          {/* Promo banner */}
          {SHOW_PROMO && <PromoBanner text={tt('promoText')} />}
        </div>
      ) : (
        <SubjectEmpty onSwitch={() => setShowSubjects(true)} />
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-20 left-5 right-5 card-premium text-pfg text-xs font-semibold px-4 py-3 rounded-2xl text-center z-40 animate-premiumIn">
          {toast}
        </div>
      )}

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
