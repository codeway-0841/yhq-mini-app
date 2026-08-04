import { useState, useEffect, useCallback, useMemo, memo } from 'react'
import React from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Settings,
  Play, Swords, ListChecks, GraduationCap,
  Bookmark, Hash, Signpost,
  Ticket, LayoutGrid, ClipboardCheck, ShieldAlert,
  Heart, ChevronDown, Sparkles,
} from 'lucide-react'
import { useAppStore, type ApiUser } from '../../shared/store/useAppStore'
import { api } from '../../shared/api'
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

// ── Top Bar / Greeting Header (v1.1 Neon Navy) ─────────────────────────────
// "Salom, {ism} 👋" + Level badge. O'lik Search tugmasi olib tashlandi.
const TopBar = memo(function TopBar({ user, displayName, level, onSettings, onProfile }: {
  user: ApiUser | null
  displayName: string | null
  level: number
  onSettings: () => void
  onProfile: () => void
}) {
  const lang = useAppStore((s) => s.settings.language)
  const tt = useT(lang)
  const name = displayName ?? user?.firstName ?? tt('guestName')

  return (
    <div className="flex items-center justify-between px-4 pt-5 pb-3.5">
      <button onClick={onProfile} className="flex items-center gap-3 active:opacity-70 transition-opacity min-w-0">
        <Avatar name={name} photoUrl={user?.photoUrl} />
        <div className="text-left min-w-0">
          <p className="text-[12px] font-semibold text-subtle">{tt('greeting')},</p>
          <p className="text-[18px] font-black leading-tight text-fg truncate">{name} 👋</p>
        </div>
      </button>
      <div className="flex items-center gap-3">
        <span className="glow-purple flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-neon-purple/40 bg-neon-purple/10 text-neon-violet text-[11px] font-black">
          🔮 {tt('level')} {level}
        </span>
        <button onClick={onSettings} aria-label="Sozlamalar"
          className="w-10 h-10 rounded-2xl card-neon flex items-center justify-center text-subtle hover:text-fg transition-colors active:scale-90">
          <Settings size={18} />
        </button>
      </div>
    </div>
  )
})

// ── Progress Card (v1.1 Neon Navy: ring chart + neon chiziq + stat qator) ───
const ProgressCard = memo(function ProgressCard({ totalCorrect, totalAnswered, streak, totalPool, lang }: {
  totalCorrect: number; totalWrong: number; totalAnswered: number; streak: number
  totalPool: number
  lang: 'uz' | 'ru'
}) {
  const tt = useT(lang)
  const total    = totalPool > 0 ? totalPool : 0
  const accuracy = totalAnswered > 0 ? Math.min(100, Math.round((totalCorrect / totalAnswered) * 100)) : 0
  const coverage = total > 0 ? Math.min(100, Math.round((totalAnswered / total) * 100)) : 0
  const xp       = totalCorrect * 10
  const league   = totalCorrect >= 1000 ? 'Platinum' : totalCorrect >= 500 ? 'Gold' : totalCorrect >= 100 ? 'Silver' : 'Bronze'

  // Ring chart geometriyasi (SVG)
  const R = 34, C = 2 * Math.PI * R
  const ringOffset = C * (1 - coverage / 100)

  return (
    <div className="card-neon mx-4 p-4 mb-3 relative overflow-hidden">
      <div className="flex items-center justify-between gap-3">
        {/* Chap: card + progress */}
        <div className="flex-1 min-w-0">
          <p className="text-[12px] font-bold text-subtle mb-1">{tt('overallProgress')}</p>
          <p className="text-[34px] font-black text-fg leading-none mb-1">{accuracy}%</p>
          <p className="text-[11px] text-subtle mb-2.5">{totalAnswered} / {total || '…'} {tt('question').toLowerCase()}</p>
          <div className="progress-neon">
            <div className="fill" style={{ width: `${Math.max(coverage, totalAnswered > 0 ? 3 : 0)}%` }} />
          </div>
        </div>
        {/* O'ng: neon ring chart */}
        {total > 0 && (
          <svg width="92" height="92" viewBox="0 0 92 92" className="flex-shrink-0 ring-glow">
            <circle cx="46" cy="46" r={R} fill="none" stroke="#1c2d4a" strokeWidth="8" />
            <circle cx="46" cy="46" r={R} fill="none" stroke="#8b5cf6" strokeWidth="8"
              strokeLinecap="round" strokeDasharray={C} strokeDashoffset={ringOffset}
              transform="rotate(-90 46 46)"
              style={{ transition: 'stroke-dashoffset 700ms ease-out' }} />
            <text x="46" y="51" textAnchor="middle" fill="#f2f7ff" fontSize="16" fontWeight="900">{coverage}%</text>
          </svg>
        )}
      </div>
      {/* Pastki: streak / XP / Liga */}
      <div className="flex items-center justify-around mt-3.5 pt-3 border-t border-line/60">
        <div className="flex flex-col items-center">
          <span className="text-base">🔥</span>
          <span className="text-sm font-black text-fg">{streak}</span>
          <span className="text-[10px] text-subtle">{tt('streakConsec')}</span>
        </div>
        <div className="flex flex-col items-center">
          <span className="text-base">⭐</span>
          <span className="text-sm font-black text-fg">{xp}</span>
          <span className="text-[10px] text-subtle">XP</span>
        </div>
        <div className="flex flex-col items-center">
          <span className="text-base">🏆</span>
          <span className="text-sm font-black text-fg">{league}</span>
          <span className="text-[10px] text-subtle">{tt('league')}</span>
        </div>
      </div>
    </div>
  )
})

// ── Quick Action Buttons (Barcha testlar / Xatolarni tuzatish) ──────────────
const QuickActions = memo(function QuickActions({ mistakesCount, lang, onAllTests, onFixMistakes }: {
  mistakesCount: number; lang: 'uz' | 'ru'; onAllTests: () => void; onFixMistakes: () => void
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
        {mistakesCount > 0 && (
          <span className="absolute -top-2 -right-1 bg-duo-red text-white text-[10px] font-bold min-w-[20px] h-5 px-1.5 rounded-full flex items-center justify-center shadow-lg shadow-red-500/30">
            {mistakesCount}
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
        <p className="text-xs font-semibold text-white/85 mt-1 leading-snug line-clamp-2">{subtitle}</p>
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
      <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: iconColor + '26', boxShadow: `0 0 16px ${iconColor}59` }}>
        <Icon size={17} strokeWidth={2.2} style={{ color: iconColor }} />
      </div>
      <span className="text-[12px] font-extrabold text-fg text-left leading-tight">{label}</span>
    </button>
  )
})

// ── Continue Card (v1.1: "Davom etish" — joriy fan + progress + play) ───────
const ContinueCard = memo(function ContinueCard({ subjectName, subjectIcon: SubjectIcon, answeredPercent, lang, onContinue, onSeeAll }: {
  subjectName: string; subjectIcon: React.ElementType; answeredPercent: number
  lang: 'uz' | 'ru'; onContinue: () => void; onSeeAll: () => void
}) {
  const tt = useT(lang)
  return (
    <div className="px-4 mb-3">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-[15px] font-black text-fg">{tt('continueLearn')}</h3>
        <button onClick={onSeeAll} className="text-[12px] font-bold text-neon-green flex items-center gap-0.5 active:opacity-70">
          {tt('seeAll')} <ChevronDown size={14} className="-rotate-90" />
        </button>
      </div>
      <button onClick={onContinue} className="card-neon w-full flex items-center gap-3 p-3.5 active:scale-[0.99] transition-transform">
        <div className="glow-green w-12 h-12 rounded-2xl bg-gradient-to-br from-neon-purple/25 to-neon-blue/15 border border-neon-purple/30 flex items-center justify-center">
          <SubjectIcon size={24} className="text-neon-violet" strokeWidth={2.2} />
        </div>
        <div className="flex-1 min-w-0 text-left">
          <p className="text-[14px] font-black text-fg truncate">{subjectName}</p>
          <div className="progress-neon mt-2">
            <div className="fill" style={{ width: `${Math.max(answeredPercent, 2)}%` }} />
          </div>
        </div>
        <div className="glow-green w-10 h-10 rounded-full bg-neon-green flex items-center justify-center flex-shrink-0">
          <Play size={16} fill="#0b2003" color="#0b2003" />
        </div>
      </button>
    </div>
  )
})

// ── Leaderboard Preview (v1.1: top-3 + "Barchasi ›") ────────────────────────
const LeaguePreview = memo(function LeaguePreview({ lang, onSeeAll, userId }: {
  lang: 'uz' | 'ru'; onSeeAll: () => void; userId: string | undefined
}) {
  const tt = useT(lang)
  const [entries, setEntries] = useState<{ rank: number; name: string; score: number; isYou: boolean }[]>([])

  useEffect(() => {
    let alive = true
    api.getLeaderboard(3, userId)
      .then((r) => { if (alive) setEntries(r.slice(0, 3).map((e) => ({ rank: e.rank, name: e.name, score: e.score, isYou: e.isYou }))) })
      .catch(() => {})
    return () => { alive = false }
  }, [userId])

  if (entries.length === 0) return null

  return (
    <div className="px-4 mb-3">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-[15px] font-black text-fg">{tt('leaderboard')}</h3>
        <button onClick={onSeeAll} className="text-[12px] font-bold text-neon-green flex items-center gap-0.5 active:opacity-70">
          {tt('seeAll')} <ChevronDown size={14} className="-rotate-90" />
        </button>
      </div>
      <div className="card-neon divide-y divide-line/60">
        {entries.map((e) => (
          <div key={e.rank}
            className={`flex items-center gap-3 px-3.5 py-2.5 ${e.isYou ? 'bg-neon-green/5' : ''}`}>
            <span className="w-5 text-center text-sm">
              {e.rank === 1 ? '🥇' : e.rank === 2 ? '🥈' : '🥉'}
            </span>
            <div className="w-7 h-7 rounded-full bg-duo-blue/20 border border-duo-blue/30 flex items-center justify-center text-[11px] font-black text-duo-blue">
              {e.name[0]?.toUpperCase() ?? '?'}
            </div>
            <span className={`flex-1 min-w-0 truncate text-[13px] font-bold ${e.isYou ? 'text-neon-green' : 'text-fg'}`}>
              {e.isYou ? `${e.name} (${lang === 'ru' ? 'Вы' : 'Siz'})` : e.name}
            </span>
            <span className="text-[13px] font-black text-duo-green">{e.score}</span>
          </div>
        ))}
      </div>
    </div>
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
  const { user, displayName, settings, totalCorrect, totalWrong, totalAnswered, streak, savedQuestions, wrongByTicket } = useAppStore()
  const subject  = useSubjectStore((s) => s.subject)
  const questionsCount = useQuestionsStore((s) => s.questions.length)
  const tt = useT(settings.language)

  // "Xatolarni tuzatish" badge = hozir yechilmagan xato SAVOLLAR soni.
  // (wrongByTicket qiymati esa ketma-ket xato urinishlar soni — ro'yxat savollarni sanaydi,
  //  shuning uchun badge ro'yxat uzunligiga teng bo'lishi kerak: 4 savol = 4, urinishlar 8 emas)
  const mistakesCount = useMemo(
    () => Object.values(wrongByTicket).filter((n) => n > 0).length,
    [wrongByTicket]
  )

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
      {/* Top bar / Greeting Header (v1.1) */}
      <TopBar user={user} displayName={displayName}
        level={Math.floor(totalCorrect / 50) + 1}
        onSettings={() => setShowSettings(true)} onProfile={goProfile} />

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

          {/* Progress card (v1.1 neon ring) */}
          <ProgressCard
            totalCorrect={totalCorrect}
            totalWrong={totalWrong}
            totalAnswered={totalAnswered}
            streak={streak}
            totalPool={questionsCount}
            lang={settings.language}
          />

      {/* Davom etish — joriy fan bilan davom (v1.1) */}
      <ContinueCard
        subjectName={settings.language === 'ru' ? subject.nameRu : subject.name}
        subjectIcon={subject.icon}
        answeredPercent={questionsCount > 0 ? Math.min(100, Math.round((totalAnswered / questionsCount) * 100)) : 0}
        lang={settings.language}
        onContinue={goTest}
        onSeeAll={goTopics}
      />

      {/* Barcha testlar + Xatolarni tuzatish */}
      <QuickActions
        mistakesCount={mistakesCount}
        lang={settings.language}
        onAllTests={goTest}
        onFixMistakes={goMistakes}
      />

      {/* Feature row: HERO = Adaptive (asosiy harakat), ostida Darslik + Oktagon.
          Mobil: hero to'liq kenglik; lg: hero + 2 kichik (1.6fr 1fr 1fr) */}
      <div className="grid grid-cols-2 lg:grid-cols-[1.6fr_1fr_1fr] gap-2.5 px-4 mb-2.5">
        <div className="col-span-2 lg:col-span-1">
          <FeatureCard
            wide
            icon={Play}
            label={tt('adaptive')}
            subtitle={tt('adaptiveDesc')}
            bgColor="linear-gradient(135deg, #58cc02, #46a302)"
            shadowColor="#3f9202"
            iconColor="#58cc02"
            onClick={goAdaptive}
          />
        </div>
        <FeatureCard
          icon={GraduationCap}
          label={tt('lessons')}
          subtitle={tt('darslikDesc')}
          bgColor="linear-gradient(135deg, #1cb0f6, #1899d6)"
          shadowColor="#1589c0"
          iconColor="#1cb0f6"
          onClick={goDarslik}
        />
        <FeatureCard
          icon={Swords}
          label={tt('octagon')}
          subtitle={tt('octagonTitle')}
          bgColor="linear-gradient(135deg, #a78bfa, #8b5cf6)"
          shadowColor="#7c3aed"
          iconColor="#a78bfa"
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

      {/* Reyting top-3 preview (v1.1) */}
      <LeaguePreview
        lang={settings.language}
        userId={user?.id}
        onSeeAll={() => navigate('/reyting')}
      />

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
