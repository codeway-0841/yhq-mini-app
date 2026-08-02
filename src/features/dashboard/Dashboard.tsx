import { useState, useEffect, useCallback, memo } from 'react'
import React from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Trophy, Settings, Search,
  Play, Swords, ListChecks, GraduationCap,
  Bookmark, Hash, Signpost,
  Ticket, LayoutGrid, ClipboardCheck, ShieldAlert,
  Heart, ChevronDown, Sparkles,
} from 'lucide-react'
import { useAppStore, type ApiUser } from '../../shared/store/useAppStore'
import { useSubjectStore } from '../../store/useSubjectStore'
import { useQuestionsStore } from '../../store/useQuestionsStore'
import { useT } from '../../shared/i18n'
import SettingsModal from '../../shared/components/SettingsModal'
import SubjectSheet from '../../components/SubjectSheet'

// ── Avatar ──────────────────────────────────────────────────────────────────
const Avatar = memo(function Avatar({ name, photoUrl }: { name: string; photoUrl?: string }) {
  const letter = name?.[0]?.toUpperCase() || 'F'
  return (
    <div className="relative flex-shrink-0">
      {photoUrl ? (
        <img src={photoUrl} alt={name} className="w-11 h-11 rounded-full object-cover border-2 border-line" />
      ) : (
        <div className="w-11 h-11 rounded-full bg-gradient-to-br from-duo-blue to-duo-purple flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-blue-500/20">
          {letter}
        </div>
      )}
      <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-duo-green rounded-full border-[2.5px] border-canvas animate-pulse" />
    </div>
  )
})

// ── Top Bar ─────────────────────────────────────────────────────────────────
const TopBar = memo(function TopBar({ user, displayName, onSettings, onProfile, onLeaderboard }: {
  user: ApiUser | null
  displayName: string | null
  onSettings: () => void
  onProfile: () => void
  onLeaderboard: () => void
}) {
  const lang = useAppStore((s) => s.settings.language)
  const tt = useT(lang)
  const name = displayName
    ?? (user ? `${user.firstName} ${user.lastName || ''}`.trim() : tt('guestName'))
  const riderLabel = tt('riderLabel')

  return (
    <div className="flex items-center justify-between px-4 pt-5 pb-3">
      <button onClick={onProfile} className="flex items-center gap-3 active:opacity-70 transition-opacity min-w-0">
        <Avatar name={name} photoUrl={user?.photoUrl} />
        <div className="text-left min-w-0">
          <p className="text-[15px] font-extrabold leading-tight text-fg truncate">{name}</p>
          <span className="text-[11px] font-bold text-duo-green tracking-wide flex items-center gap-1">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-duo-green" />
            {riderLabel}
          </span>
        </div>
      </button>
      <div className="flex items-center gap-4">
        <button onClick={onLeaderboard} aria-label="Reyting"
          className="relative text-duo-yellow hover:text-duo-orange transition-colors active:scale-90">
          <Trophy size={22} fill="currentColor" />
          <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center text-[9px] font-bold text-white">
            !
          </span>
        </button>
        <button aria-label="Qidirish"
          className="text-muted hover:text-fg transition-colors active:scale-90">
          <Search size={21} />
        </button>
        <button onClick={onSettings} aria-label="Sozlamalar"
          className="text-muted hover:text-fg transition-colors active:scale-90">
          <Settings size={21} />
        </button>
      </div>
    </div>
  )
})

// ── Progress Card (Oson Prava uslubi: to'q yashil, minimal) ─────────────────
const ProgressCard = memo(function ProgressCard({ totalCorrect, totalWrong, totalAnswered, streak, totalPool, lang }: {
  totalCorrect: number; totalWrong: number; totalAnswered: number; streak: number
  totalPool: number
  lang: 'uz' | 'ru'
}) {
  const tt = useT(lang)
  const total     = totalPool > 0 ? totalPool : 1237 // serverdan kelgan savollar soni (dinamik)
  const percent   = totalAnswered > 0 ? Math.min(100, Math.round((totalCorrect / totalAnswered) * 100)) : 0
  const remaining = Math.max(0, total - totalAnswered)

  return (
    <div className="mx-4 rounded-3xl p-4 mb-2.5 relative overflow-hidden"
      style={{ background: 'linear-gradient(135deg, #2d5742, #14301e)' }}>
      {/* Yuqori qator: sana + streak */}
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[12px] font-semibold text-white/80 flex items-center gap-1">
          {tt('changeDate')} <span className="text-[10px]">✏️</span>
        </span>
        <div className="flex items-center gap-1">
          <span className="text-duo-yellow text-xs">⚡</span>
          <span className="text-white font-extrabold text-xs">{streak} {tt('daysWord')}</span>
        </div>
      </div>
      {/* O'rta: % + statistikalar */}
      <div className="flex items-end justify-between mb-2.5">
        <span className="text-[36px] font-black text-white leading-none">{percent}%</span>
        <div className="flex items-center gap-2.5 text-[12px] font-extrabold">
          <span className="text-duo-green">✓ {totalCorrect}</span>
          <span className="text-duo-red">✗ {totalWrong}</span>
          <span className="text-white/60">— {remaining}</span>
        </div>
      </div>
      {/* Progress bar */}
      <div className="w-full bg-black/25 rounded-full h-[6px] overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700 ease-out bg-duo-green"
          style={{ width: `${Math.max(1, Math.round((totalAnswered / total) * 100))}%` }}
        />
      </div>
    </div>
  )
})

// ── Quick Action Buttons (Barcha testlar / Xatolarni tuzatish) ──────────────
const QuickActions = memo(function QuickActions({ totalWrong, lang, onAllTests, onFixMistakes }: {
  totalWrong: number; lang: 'uz' | 'ru'; onAllTests: () => void; onFixMistakes: () => void
}) {
  const tt = useT(lang)
  return (
    <div className="grid grid-cols-2 gap-2.5 px-4 mb-2.5">
      <button onClick={onAllTests}
        className="btn-3d-ghost flex items-center gap-2.5 rounded-2xl px-3 py-2.5">
        <span className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: '#1cb0f626' }}>
          <ListChecks size={19} className="text-duo-blue" strokeWidth={2.2} />
        </span>
        <span className="text-[13px] font-extrabold text-fg">{tt('allTests')}</span>
      </button>
      <button onClick={onFixMistakes}
        className="btn-3d-ghost relative flex items-center gap-2.5 rounded-2xl px-3 py-2.5">
        <span className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: '#ff4b4b26' }}>
          <Heart size={19} className="text-duo-red" strokeWidth={2.2} />
        </span>
        <span className="text-[13px] font-extrabold text-fg">{tt('fixMistakes')}</span>
        {totalWrong > 0 && (
          <span className="absolute -top-2 -right-1 bg-duo-red text-white text-[10px] font-bold min-w-[20px] h-5 px-1.5 rounded-full flex items-center justify-center shadow-lg shadow-red-500/30">
            {totalWrong}
          </span>
        )}
      </button>
    </div>
  )
})

// ── Feature Card (Darslik / Test yechish / Oktagon) ─────────────────────────
// wide (Darslik): har doim gorizontal — matn chap, oq doira-ikonka o'ngda.
// narrow (Test/Oktagon): mobil vertikal (ikonka yuqori-chap), lg gorizontal.
const FeatureCard = memo(function FeatureCard({ icon: Icon, label, subtitle, bgColor, shadowColor, iconColor, wide, onClick }: {
  icon: React.ElementType
  label: string
  subtitle: string
  bgColor: string
  shadowColor: string
  iconColor: string
  wide?: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`btn-3d relative overflow-hidden rounded-3xl w-full ${
        wide
          ? 'flex flex-row items-center justify-between gap-3 p-3.5 min-h-[84px] text-left'
          : 'flex flex-col items-start gap-0.5 p-3 min-h-[128px] text-left lg:flex-row lg:items-center lg:justify-between lg:gap-2 lg:min-h-[112px]'
      }`}
      style={{ background: bgColor, '--btn-3d-shadow': shadowColor } as React.CSSProperties}
    >
      <div className={`w-10 h-10 lg:w-11 lg:h-11 rounded-full bg-white flex items-center justify-center flex-shrink-0 relative z-10 ${
        wide ? 'order-2' : 'lg:order-2 mb-1.5'
      }`}>
        <Icon size={21} style={{ color: iconColor }} strokeWidth={2.4} />
      </div>
      <div className={`relative z-10 min-w-0 ${wide ? 'order-1' : 'lg:order-1'}`}>
        <p className="text-[14px] lg:text-[15px] font-black text-white leading-tight">{label}</p>
        <p className="text-[10.5px] font-semibold text-white/80 mt-1 leading-snug line-clamp-2">{subtitle}</p>
      </div>
    </button>
  )
})

// ── Grid Card ───────────────────────────────────────────────────────────────
const GridCard = memo(function GridCard({ icon: Icon, label, badge, iconColor = 'var(--theme-fg-subtle)', onClick }: {
  icon: React.ElementType
  label: string
  badge?: number | null
  iconColor?: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="btn-3d-ghost relative flex items-center gap-2.5 rounded-2xl px-3 py-2.5 w-full"
    >
      {badge != null && (
        <span className="absolute -top-2 -right-1 bg-duo-red text-white text-[10px] font-bold px-1.5 min-w-[20px] h-5 rounded-full flex items-center justify-center shadow-lg shadow-red-500/30">
          {badge}
        </span>
      )}
      <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: iconColor + '26' }}>
        <Icon size={17} strokeWidth={2.2} style={{ color: iconColor }} />
      </div>
      <span className="text-[12px] font-extrabold text-fg text-left leading-tight">{label}</span>
    </button>
  )
})

// ── Promo banner — VAQTINCHA O'CHIQ. Qayta yoqish: SHOW_PROMO = true ────────
const SHOW_PROMO = false

// ── Promo Countdown ─────────────────────────────────────────────────────────
function useCountdown() {
  const [seconds, setSeconds] = useState(() => {
    const now = new Date()
    const end = new Date(now)
    end.setHours(23, 59, 59, 999)
    return Math.floor((end.getTime() - now.getTime()) / 1000)
  })

  useEffect(() => {
    const id = setInterval(() => setSeconds((s) => Math.max(0, s - 1)), 1000)
    return () => clearInterval(id)
  }, [])

  const h = String(Math.floor(seconds / 3600)).padStart(2, '0')
  const m = String(Math.floor((seconds % 3600) / 60)).padStart(2, '0')
  const s = String(seconds % 60).padStart(2, '0')
  return `${h}:${m}:${s}`
}

const PromoBanner = memo(function PromoBanner({ text }: { text: string }) {
  const countdown = useCountdown()
  return (
    <div className="mx-4 mb-3 rounded-2xl relative overflow-hidden active:scale-[0.98] transition-transform cursor-pointer"
      style={{ background: 'linear-gradient(135deg, #ff4b4b, #d93f3f)' }}>
      <div className="absolute right-2 top-1/2 -translate-y-1/2 opacity-[0.12]">
        <svg width="80" height="80" viewBox="0 0 24 24" fill="white">
          <path d="M12 23a7 7 0 0 1-7-7c0-3 2-5 3.5-7.5S12 3 12 1c0 0 4 3 6.5 7.5S22 13 22 16a7 7 0 0 1-7 7h-3z" />
        </svg>
      </div>
      <div className="relative z-10 p-4 flex items-center justify-between">
        <p className="text-white text-[13px] font-bold leading-snug max-w-[55%]">
          {text}
        </p>
        <span className="text-white text-[28px] font-black tracking-wider tabular-nums"
          style={{ fontVariantNumeric: 'tabular-nums' }}>
          {countdown}
        </span>
      </div>
    </div>
  )
})

// ── Subject Switcher chip — dashboard yuqorisidagi universal fan tanlagich ──
const SubjectSwitcher = memo(function SubjectSwitcher({ onOpen }: { onOpen: () => void }) {
  const subject = useSubjectStore((s) => s.subject)
  const lang    = useAppStore((s) => s.settings.language)
  const Icon    = subject.icon
  return (
    <div className="px-4 mb-2.5">
      <button onClick={onOpen}
        className="btn-3d-ghost w-full flex items-center gap-3 rounded-2xl px-3 py-2.5"
        aria-label="Fan tanlash">
        <span className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: `${subject.color}26`, color: subject.color }}>
          <Icon size={19} strokeWidth={2.2} />
        </span>
        <span className="flex-1 text-left text-[14px] font-extrabold text-fg min-w-0 truncate">
          {lang === 'ru' ? subject.nameRu : subject.name}
        </span>
        <ChevronDown size={18} className="text-subtle flex-shrink-0" />
      </button>
    </div>
  )
})

// ── Empty State — "tez kunda" fanlar uchun ─────────────────────────────────
const SubjectEmpty = memo(function SubjectEmpty({ onSwitch }: { onSwitch: () => void }) {
  const subject = useSubjectStore((s) => s.subject)
  const lang    = useAppStore((s) => s.settings.language)
  const Icon    = subject.icon
  return (
    <div className="mx-4 mt-6 rounded-3xl border-2 border-dashed border-line p-8 flex flex-col items-center text-center">
      <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
        style={{ background: `${subject.color}26`, color: subject.color }}>
        <Icon size={32} />
      </div>
      <h3 className="text-[17px] font-black text-fg">
        {lang === 'ru' ? subject.nameRu : subject.name}
      </h3>
      <p className="text-[13px] font-semibold text-muted mt-1.5 max-w-[240px]">
        {lang === 'ru'
          ? 'Этот предмет скоро будет доступен. Следите за обновлениями!'
          : "Bu fan tez kunda qo'shiladi. Yangilanishlarni kuzatib boring!"}
      </p>
      <button onClick={onSwitch}
        className="btn-3d-green mt-5 px-6 py-3 rounded-2xl text-[14px] font-extrabold flex items-center gap-2">
        <Sparkles size={17} />
        {lang === 'ru' ? 'Выбрать другой предмет' : 'Boshqa fan tanlash'}
      </button>
    </div>
  )
})

// ── Main Dashboard ──────────────────────────────────────────────────────────
export default function Dashboard() {
  const navigate = useNavigate()
  const [showSettings, setShowSettings] = useState(false)
  const [showSubjects, setShowSubjects] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const { user, displayName, settings, totalCorrect, totalWrong, totalAnswered, streak, savedQuestions } = useAppStore()
  const subject  = useSubjectStore((s) => s.subject)
  const questionsCount = useQuestionsStore((s) => s.questions.length)
  const tt = useT(settings.language)

  // Fan almashtirilganda savollarni shu fanga qarab qayta yuklash (reload yo'q)
  useEffect(() => {
    const { load, subjectId } = useQuestionsStore.getState()
    if (subjectId !== subject.id || !useQuestionsStore.getState().loaded) {
      void load(settings.language, subject.id)
    }
  }, [subject.id, settings.language])

  const showToast = useCallback((msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }, [])

  const goTest     = useCallback(() => navigate('/test/1'), [navigate])
  const goMistakes = useCallback(() => navigate('/mavzular'), [navigate])
  const goTopics   = useCallback(() => navigate('/mavzular'), [navigate])
  const goAdaptive = useCallback(() => navigate('/adaptive'), [navigate])
  const goOctagon  = useCallback(() => navigate('/octagon'), [navigate])
  const goProfile  = useCallback(() => navigate('/profil'), [navigate])
  const goDarslik  = useCallback(() => navigate('/darslik'), [navigate])

  /** Real test modes — TestPage builds the question set based on `mode` */
  const goMode = useCallback((mode: 'random50' | 'exam' | 'tricky' | 'numeric', title: string) => () =>
    navigate('/test/1', { state: { mode, title } }), [navigate])

  const goSaved = useCallback(() => {
    if (savedQuestions.length === 0) {
      showToast(settings.language === 'ru'
        ? "Нет сохранённых вопросов — используйте 📌 в тесте"
        : "Hali saqlangan savollar yo'q — testda 📌 tugmasini bosing")
      return
    }
    navigate('/test/1', { state: { questionIds: savedQuestions, title: tt('saved') } })
  }, [savedQuestions, settings.language, navigate, tt, showToast])

  return (
    <div className="pb-6 safe-bottom">
      {/* Top bar */}
      <TopBar user={user} displayName={displayName}
        onSettings={() => setShowSettings(true)} onProfile={goProfile}
        onLeaderboard={() => navigate('/reyting')} />

      {/* Universal subject switcher */}
      <SubjectSwitcher onOpen={() => setShowSubjects(true)} />

      {/* Fan mavjud bo'lmasa — empty state; mavjud bo'lsa — to'liq dashboard.
          key=subjectId: fan almashganda smooth fade transition, reload yo'q */}
      {subject.available ? (
        <div key={subject.id} className="animate-fadeIn">
          {/* Demo ma'lumotlar badge — boshqa fanga vaqtincha YHQ bazasi ulangan */}
          {subject.demoData && (
            <div className="mx-4 mb-2.5 rounded-2xl border border-duo-yellow/40 bg-duo-yellow/10 px-3.5 py-2.5 flex items-center gap-2">
              <Sparkles size={15} className="text-duo-yellow flex-shrink-0" />
              <span className="text-[12px] font-bold text-duo-yellow">
                {settings.language === 'ru'
                  ? 'Временные демо-данные — база этого предмета скоро будет подключена'
                  : "Vaqtinchalik demo ma'lumotlar — bu fanning bazasi tez orada ulanadi"}
              </span>
            </div>
          )}

          {/* Progress card — to'q yashil, minimal */}
          <ProgressCard
            totalCorrect={totalCorrect}
            totalWrong={totalWrong}
            totalAnswered={totalAnswered}
            streak={streak}
            totalPool={questionsCount}
            lang={settings.language}
          />

      {/* Barcha testlar + Xatolarni tuzatish */}
      <QuickActions
        totalWrong={totalWrong}
        lang={settings.language}
        onAllTests={goTest}
        onFixMistakes={goMistakes}
      />

      {/* Feature row: mobil — Darslik keng + Test/Oktagon 2 ustun · lg — 3 teng */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-2.5 px-4 mb-2.5">
        <div className="col-span-2 lg:col-span-1">
          <FeatureCard
            wide
            icon={GraduationCap}
            label={tt('lessons')}
            subtitle={tt('darslikDesc')}
            bgColor="linear-gradient(135deg, #1cb0f6, #1899d6)"
            shadowColor="#1589c0"
            iconColor="#1cb0f6"
            onClick={goDarslik}
          />
        </div>
        <FeatureCard
          icon={Play}
          label={tt('adaptive')}
          subtitle={tt('adaptiveDesc')}
          bgColor="linear-gradient(135deg, #58cc02, #46a302)"
          shadowColor="#3f9202"
          iconColor="#58cc02"
          onClick={goAdaptive}
        />
        <FeatureCard
          icon={Swords}
          label={tt('octagon')}
          subtitle={tt('octagonTitle')}
          bgColor="linear-gradient(135deg, #94a3b8, #64748b)"
          shadowColor="#475569"
          iconColor="#64748b"
          onClick={goOctagon}
        />
      </div>

      {/* Feature grid — bitta grid: mobil 2 ustun, lg 3 ustun (bo'sh joy yo'q) */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-2.5 px-4 mb-3">
        <GridCard icon={LayoutGrid}    label={tt('topics')}   iconColor="#ce82ff" onClick={goTopics} />
        <GridCard icon={Ticket}        label={tt('tickets')}  iconColor="#ffc800" onClick={() => navigate('/biletlar')} />
        <GridCard icon={ListChecks}    label={tt('fifty')}    iconColor="#58cc02" onClick={goMode('random50', `${tt('fifty')} ${tt('question')}`)} />
        <GridCard icon={ClipboardCheck} label={tt('realExam')} iconColor="#4ade80" onClick={goMode('exam', tt('realExam'))} />
        <GridCard icon={ShieldAlert}   label={tt('distracting')} iconColor="#ff4b4b" onClick={goMode('tricky', tt('distracting'))} />
        <GridCard icon={Bookmark}      label={tt('saved')}       iconColor="#ffc800" badge={savedQuestions.length || null} onClick={goSaved} />
        <GridCard icon={Signpost}      label={tt('roadSigns')} iconColor="#1cb0f6" onClick={() => navigate('/belgilar')} />
        <GridCard icon={Hash}          label={tt('numeric')}   iconColor="#ce82ff" onClick={goMode('numeric', tt('numeric'))} />
      </div>

      {/* Promo banner — vaqtincha o'chiq (SHOW_PROMO = true qilib qaytariladi) */}
      {SHOW_PROMO && <PromoBanner text={tt('promoText')} />}
        </div>
      ) : (
        <SubjectEmpty onSwitch={() => setShowSubjects(true)} />
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-20 left-4 right-4 bg-elevated border-2 border-line text-fg text-xs font-bold px-4 py-3 rounded-2xl text-center z-40 shadow-xl animate-fadeIn">
          ⚠️ {toast}
        </div>
      )}

      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
      {showSubjects && <SubjectSheet onClose={() => setShowSubjects(false)} />}
    </div>
  )
}
