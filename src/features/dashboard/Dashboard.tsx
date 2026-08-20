import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Play, Swords, GraduationCap,
  Bookmark, Hash, Signpost,
  Ticket, ShieldAlert,
  Sparkles, Bot, BookOpen, ClipboardList, HeartCrack, Crown, NotebookText, Search,
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
import { ServiceCard, MockGridCard } from './components/GridCards'
import { LeaguePreview } from './components/LeaguePreview'
import { PromoBanner, SHOW_PROMO } from './components/PromoBanner'
import { SubjectEmpty } from './components/SubjectSwitcher'
import { MilestoneScene, LevelUpScene } from './components/Celebrations'
import { useCelebrations } from './hooks/useCelebrations'
import { useDashboardSync, useContinueInfo, useSubjectBadges } from './hooks/useDashboardData'
import { todayStr } from '../../shared/store/useDailyStore'

// ── Auto-scroll Rejimlar carousel ───────────────────────────────────────────
function RejimlarCarousel({ title, items, lang }: {
  title: string
  items: { icon: React.ElementType; label: string; onClick: () => void }[]
  lang: 'uz' | 'ru'
}) {
  const ref = useRef<HTMLDivElement>(null)
  const paused = useRef(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    let timer: ReturnType<typeof setInterval> | null = null
    let resumeTimer: ReturnType<typeof setTimeout> | null = null
    const step = () => {
      if (paused.current || !el) return
      const max = el.scrollWidth - el.clientWidth
      if (max <= 0) return
      const next = el.scrollLeft + 112 // ~1 kvadrat karta + gap
      if (next >= max - 4) {
        el.scrollTo({ left: 0, behavior: 'smooth' })
      } else {
        el.scrollBy({ left: 112, behavior: 'smooth' })
      }
    }
    timer = setInterval(step, 2800)
    const pause = () => {
      paused.current = true
      if (resumeTimer) clearTimeout(resumeTimer)
      resumeTimer = setTimeout(() => { paused.current = false }, 3500)
    }
    const onEnter = () => { paused.current = true; if (resumeTimer) clearTimeout(resumeTimer) }
    const onLeave = () => { paused.current = false }
    const onScroll = () => pause() // qo'lda surilganda auto pauza
    el.addEventListener('mouseenter', onEnter)
    el.addEventListener('mouseleave', onLeave)
    el.addEventListener('touchstart', pause, { passive: true })
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      if (timer) clearInterval(timer)
      if (resumeTimer) clearTimeout(resumeTimer)
      el.removeEventListener('mouseenter', onEnter)
      el.removeEventListener('mouseleave', onLeave)
      el.removeEventListener('touchstart', pause)
      el.removeEventListener('scroll', onScroll)
    }
  }, [])

  const onYana = () => {
    ref.current?.scrollBy({ left: 224, behavior: 'smooth' })
  }

  return (
    <div>
      <div className="flex items-center justify-between px-5 mb-2.5">
        <p className="text-[17px] font-bold text-pfg tracking-tight">{title}</p>
        <button onClick={onYana} className="text-[14px] font-semibold active:opacity-70 text-pprimary">
          {lang === 'ru' ? 'Ещё' : 'Yana'}
        </button>
      </div>
      <div
        ref={ref}
        className="flex gap-3 overflow-x-auto snap-x snap-mandatory scroll-px-5 px-5 pb-3 mb-2 touch-pan-x select-none"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' as const, WebkitOverflowScrolling: 'touch' as const, touchAction: 'pan-x' }}
      >
        {items.map((it) => (
          <ServiceCard key={it.label} icon={it.icon} label={it.label} onClick={it.onClick} />
        ))}
      </div>
    </div>
  )
}

// ── Main Dashboard ──────────────────────────────────────────────────────────
export default function Dashboard() {
  const navigate = useNavigate()
  const [showSettings, setShowSettings] = useState(false)
  const [showSubjects, setShowSubjects] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  // Selector'li obuna — whole-store EMAS (har counter o'zgarishida re-render bo'lmasligi uchun)
  const user            = useAppStore((s) => s.user)
  const displayName     = useAppStore((s) => s.displayName)
  const settings        = useAppStore((s) => s.settings)
  const totalCorrect    = useAppStore((s) => s.totalCorrect)
  const totalWrong      = useAppStore((s) => s.totalWrong)
  const savedQuestions  = useAppStore((s) => s.savedQuestions)
  const solvedQuestions = useAppStore((s) => s.solvedQuestions ?? [])
  const subject         = useSubjectStore((s) => s.subject)
  // Progress kartasidagi 🔥 — joriy FANGA tegishli kunlik seriya (Intizom)
  const dailyStreak     = useDailyStore((s) => s.streaks[subject.id] ?? 0)
  const questionsCount  = useQuestionsStore((s) => s.questions.length)

  // Joriy fan bo'yicha UNIQUE yechilgan savollar soni (1 ta savolni 10 marta yechsa ham 1 ta hisoblanadi)
  const uniqueSolvedCount = useMemo(() => {
    const prefix = `${subject.id}:`
    return solvedQuestions.filter((k) => k.startsWith(prefix)).length
  }, [solvedQuestions, subject.id])

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
  const { mistakesCount } = useSubjectBadges(subject.id)

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
    <div className="dashboard-page font-display min-h-screen bg-pcanvas pb-6 safe-bottom">
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

      {/* Fan mavjud bo'lmasa — empty state; mavjud bo'lsa — to'liq dashboard.
          key=subjectId: fan almashganda smooth fade transition, reload yo'q */}
      {subject.available ? (
        <div key={subject.id} className="animate-premiumIn">
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

          {/* 1. Carousel */}
          <Carousel
            lang={settings.language}
            progressPct={continueInfo.pct}
            lessonLabel={continueInfo.lessonLabel}
            onContinue={continueInfo.go}
          />

          {/* Qidiruvga kirish (#45) — fake input, haqiqiy sahifa /qidiruv */}
          <button
            onClick={() => navigate('/qidiruv')}
            className="mx-5 mb-4 -mt-1 flex items-center gap-2.5 rounded-2xl border border-line bg-surface px-4 py-3 text-left active:scale-[0.99] transition-transform"
          >
            <Search size={16} className="text-muted flex-shrink-0" />
            <span className="text-sm text-muted">{tt('searchPlaceholder')}</span>
          </button>

          {/* 2. Today's Progress */}
          <ProgressCard
            totalCorrect={totalCorrect}
            totalWrong={totalWrong}
            totalAnswered={uniqueSolvedCount}
            streak={dailyStreak}
            totalPool={questionsCount}
            lang={settings.language}
            onStreakPreview={() => previewMilestone(Math.max(dailyStreak, 7))}
          />

          {/* 4. Quick Actions (main grid) — 3x2 (6ta) */}
          <div className="grid grid-cols-3 gap-2.5 sm:gap-3.5 px-5 mb-5">
            <MockGridCard icon={ClipboardList} label={tt('testlarTitle')}
              subtitle={`${questionsCount > 0 ? `${questionsCount}+ ` : ''}${tt('question').toLowerCase()}`}
              onClick={() => navigate('/testlar')} />
            <MockGridCard icon={BookOpen} label={tt('topics')} subtitle={tt('allTopicsDesc')}
              onClick={goTopics} />
            <MockGridCard icon={Bot} label={tt('aiTutor')} subtitle={tt('comingSoonD')}
              iconColor="var(--p-purple)" comingSoon onClick={() => showToast(tt('comingSoonD'))} />
            <MockGridCard icon={HeartCrack} label={tt('mistakes')} subtitle={tt('mistakeFixDesc')}
              badge={mistakesCount || null} onClick={goMistakes} />
            <MockGridCard icon={Ticket} label={tt('tickets')} subtitle={tt('officialTickets')}
              onClick={() => navigate('/biletlar')} />
            <MockGridCard icon={Swords} label={tt('duelTitle')} subtitle={tt('duelDesc')}
              onClick={goOctagon} />
          </div>

          {/* 5. Modes — auto carousel */}
          <div className="mb-5">
            <RejimlarCarousel
              title={tt('modesTitle')}
              lang={settings.language}
              items={[
                { icon: ShieldAlert,  label: tt('distracting'), onClick: goMode('tricky', tt('distracting')) },
                { icon: GraduationCap, label: tt('lessons'),     onClick: goDarslik },
                { icon: Bookmark,      label: tt('saved'),       onClick: goSaved },
                { icon: Signpost,      label: tt('roadSigns'),   onClick: () => navigate('/belgilar') },
                { icon: Hash,          label: tt('numeric'),     onClick: goMode('numeric', tt('numeric')) },
                { icon: Play,          label: tt('adaptive'),    onClick: goAdaptive },
                { icon: NotebookText,  label: tt('cheatsheets'), onClick: () => navigate('/shpargalkalar') },
              ]}
            />
          </div>

          {/* 6. Leaderboard */}
          <div className="mt-4 min-h-[12px]">
            <LeaguePreview
              lang={settings.language}
              userId={user?.id}
              onSeeAll={() => navigate('/reyting')}
            />
          </div>

          {/* 7. Premium Banner — Shpargalkadan ajralishi uchun katta oraliq */}
          <div className="mx-5 mt-12 mb-4 card-premium p-4 flex items-center gap-3.5">
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
