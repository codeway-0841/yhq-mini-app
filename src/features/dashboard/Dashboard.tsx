import { useState, useEffect, useCallback, memo } from 'react'
import React from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Trophy, Settings, Search,
  Play, Swords, ListChecks, GraduationCap,
  Bookmark, Hash, Signpost,
  Ticket, LayoutGrid, ClipboardCheck, ShieldAlert,
  Heart,
} from 'lucide-react'
import { useAppStore, type ApiUser } from '../../shared/store/useAppStore'
import { useT } from '../../shared/i18n'
import SettingsModal from '../../shared/components/SettingsModal'

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
          <p className="text-[15px] font-bold leading-tight text-white truncate">{name}</p>
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
          className="text-muted hover:text-white transition-colors active:scale-90">
          <Search size={21} />
        </button>
        <button onClick={onSettings} aria-label="Sozlamalar"
          className="text-muted hover:text-white transition-colors active:scale-90">
          <Settings size={21} />
        </button>
      </div>
    </div>
  )
})

// ── Progress Card ───────────────────────────────────────────────────────────
const ProgressCard = memo(function ProgressCard({ totalCorrect, totalWrong, totalAnswered, streak, lang }: {
  totalCorrect: number; totalWrong: number; totalAnswered: number; streak: number
  lang: 'uz' | 'ru'
}) {
  const tt = useT(lang)
  const total     = 1237 // total questions in database
  const percent   = totalAnswered > 0 ? Math.min(100, Math.round((totalCorrect / totalAnswered) * 100)) : 0
  const remaining = Math.max(0, total - totalAnswered)

  return (
    <div className="mx-4 rounded-2xl p-4 mb-3 relative overflow-hidden"
      style={{ background: 'linear-gradient(135deg, #58cc02, #46a302)' }}>

      <div className="relative z-10">
        {/* Top row: Change date + Streak */}
        <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] text-white/80 flex items-center gap-1">
          {tt('changeDate')} <span className="text-[10px]">✏️</span>
        </span>
        <div className="flex items-center gap-1">
          <span className="text-white text-xs">⚡</span>
          <span className="text-white font-bold text-xs">{streak} {tt('daysWord')}</span>
        </div>
      </div>

      {/* Middle row: Percentage + compact stats */}
      <div className="flex items-center justify-between mb-2.5">
        <span className="text-[42px] font-black text-white leading-none">{percent}%</span>
        <div className="flex items-center gap-2 text-[13px]">
          <span className="text-white font-semibold">✓ {totalCorrect}</span>
          <span className="text-white/95 font-semibold">✗ {totalWrong}</span>
          <span className="text-white/60 font-medium">— {remaining}</span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-black/20 rounded-full h-[5px] overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700 ease-out bg-white"
          style={{ width: `${Math.max(1, Math.round((totalAnswered / total) * 100))}%` }}
        />
        </div>
      </div>
    </div>
  )
})

// ── Quick Action Buttons (Barcha testlar / Xatolarni tuzatish) ──────────
const QuickActions = memo(function QuickActions({ totalWrong, lang, onAllTests, onFixMistakes }: {
  totalWrong: number; lang: 'uz' | 'ru'; onAllTests: () => void; onFixMistakes: () => void
}) {
  const tt = useT(lang)
  return (
    <div className="grid grid-cols-2 gap-3 px-4 mb-3">
      <button onClick={onAllTests}
        className="btn-3d-ghost flex items-center gap-2.5 rounded-2xl px-3.5 py-3.5">
        <ListChecks size={20} className="text-duo-blue flex-shrink-0" strokeWidth={2} />
        <span className="text-[13px] font-extrabold text-fg">{tt('allTests')}</span>
      </button>
      <button onClick={onFixMistakes}
        className="btn-3d-ghost relative flex items-center gap-2.5 rounded-2xl px-3.5 py-3.5">
        <Heart size={20} className="text-duo-red flex-shrink-0" strokeWidth={2} />
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
      {/* Decorative flame SVG */}
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

// ── Darslik Banner ──────────────────────────────────────────────────────────
const DarslikBanner = memo(function DarslikBanner({ lang, onClick }: { lang: 'uz' | 'ru'; onClick: () => void }) {
  const tt = useT(lang)
  return (
    <div className="px-4 mb-3">
      <button
        onClick={onClick}
        className="flex items-center justify-between rounded-2xl w-full active:scale-[0.98] transition-transform relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #1cb0f6, #1899d6)' }}
      >
        {/* Subtle shimmer */}
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-shimmer pointer-events-none" />
        <div className="relative z-10 p-4 text-left">
          <p className="text-[16px] font-extrabold text-white">{tt('lessons')}</p>
          <p className="text-[12px] text-white/70 mt-0.5">{tt('darslikDesc')}</p>
        </div>
        <div className="relative z-10 pr-4">
          <div className="w-12 h-12 rounded-xl bg-white/15 flex items-center justify-center backdrop-blur-sm">
            <GraduationCap size={28} className="text-white" strokeWidth={1.8} />
          </div>
        </div>
      </button>
    </div>
  )
})

// ── Feature Card (Test yechish / Oktagon) ───────────────────────────────────
const FeatureCard = memo(function FeatureCard({ icon: Icon, label, subtitle, bgColor, hoverGlow, onClick }: {
  icon: React.ElementType
  label: string
  subtitle: string
  bgColor: string
  hoverGlow: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-start gap-2 rounded-2xl p-4 min-h-[130px] active:scale-[0.96] transition-all w-full relative overflow-hidden group"
      style={{ background: bgColor }}
    >
      {/* Hover glow */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
        style={{ background: `radial-gradient(ellipse at center, ${hoverGlow}, transparent 70%)` }} />

      <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center mb-1 backdrop-blur-sm relative z-10">
        <Icon size={26} className="text-white" strokeWidth={1.8} />
      </div>
      <span className="text-[15px] font-bold text-white relative z-10">{label}</span>
      <span className="text-[11px] text-white/55 relative z-10">{subtitle}</span>
    </button>
  )
})

// ── Grid Card ───────────────────────────────────────────────────────────────
const GridCard = memo(function GridCard({ icon: Icon, label, badge, iconColor = 'var(--theme-fg-muted)', onClick }: {
  icon: React.ElementType
  label: string
  badge?: number | null
  iconColor?: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="btn-3d-ghost relative flex items-center gap-3 rounded-2xl px-4 py-3.5 w-full"
    >
      {badge != null && (
        <span className="absolute -top-2 -right-1 bg-duo-red text-white text-[10px] font-bold px-1.5 min-w-[20px] h-5 rounded-full flex items-center justify-center shadow-lg shadow-red-500/30">
          {badge}
        </span>
      )}
      <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: iconColor + '18' }}>
        <Icon size={18} strokeWidth={2} style={{ color: iconColor }} />
      </div>
      <span className="text-[13px] font-extrabold text-fg text-left leading-tight">{label}</span>
    </button>
  )
})

// ── Main Dashboard ──────────────────────────────────────────────────────────
export default function Dashboard() {
  const navigate = useNavigate()
  const [showSettings, setShowSettings] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const { user, displayName, settings, totalCorrect, totalWrong, totalAnswered, streak, savedQuestions } = useAppStore()
  const tt = useT(settings.language)

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

      {/* Progress card */}
      <ProgressCard
        totalCorrect={totalCorrect}
        totalWrong={totalWrong}
        totalAnswered={totalAnswered}
        streak={streak}
        lang={settings.language}
      />

      {/* Barcha testlar + Xatolarni tuzatish */}
      <QuickActions
        totalWrong={totalWrong}
        lang={settings.language}
        onAllTests={goTest}
        onFixMistakes={goMistakes}
      />

      {/* Promo banner with countdown */}
      <PromoBanner text={tt('promoText')} />

      {/* Darslik banner */}
      <DarslikBanner lang={settings.language} onClick={goDarslik} />

      {/* Test yechish + Oktagon */}
      <div className="grid grid-cols-2 gap-3 px-4 mb-3">
        <FeatureCard
          icon={Play}
          label={tt('adaptive')}
          subtitle={tt('adaptiveDesc')}
          bgColor="linear-gradient(135deg, #58cc02, #46a302)"
          hoverGlow="rgba(88, 204, 2, 0.18)"
          onClick={goAdaptive}
        />
        <FeatureCard
          icon={Swords}
          label={tt('octagon')}
          subtitle={tt('octagonTitle')}
          bgColor="linear-gradient(135deg, #ce82ff, #a85ed4)"
          hoverGlow="rgba(206, 130, 255, 0.18)"
          onClick={goOctagon}
        />
      </div>

      {/* Feature grid — 2 columns */}
      <div className="grid grid-cols-2 gap-3 px-4 mb-3">
        <GridCard icon={LayoutGrid}    label={tt('topics')}   iconColor="#ce82ff" onClick={goTopics} />
        <GridCard icon={Ticket}        label={tt('tickets')}  iconColor="#1cb0f6" onClick={() => navigate('/biletlar')} />
      </div>

      <div className="grid grid-cols-2 gap-3 px-4 mb-3">
        <GridCard icon={ListChecks}    label={tt('fifty')}    iconColor="#1cb0f6" onClick={goMode('random50', `${tt('fifty')} ${tt('question')}`)} />
        <GridCard icon={ClipboardCheck} label={tt('realExam')} iconColor="#58cc02" onClick={goMode('exam', tt('realExam'))} />
      </div>

      <div className="grid grid-cols-2 gap-3 px-4 mb-3">
        <GridCard icon={ShieldAlert}   label={tt('distracting')} iconColor="#ff4b4b" onClick={goMode('tricky', tt('distracting'))} />
        <GridCard icon={Bookmark}      label={tt('saved')}       iconColor="#ffc800" badge={savedQuestions.length || null} onClick={goSaved} />
      </div>

      <div className="grid grid-cols-2 gap-3 px-4">
        <GridCard icon={Signpost}      label={tt('roadSigns')} iconColor="#ff9600" onClick={() => navigate('/belgilar')} />
        <GridCard icon={Hash}          label={tt('numeric')}   iconColor="#ce82ff" onClick={goMode('numeric', tt('numeric'))} />
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-20 left-4 right-4 bg-elevated border-2 border-line text-fg text-xs font-bold px-4 py-3 rounded-2xl text-center z-40 shadow-xl animate-fadeIn">
          ⚠️ {toast}
        </div>
      )}

      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
    </div>
  )
}
