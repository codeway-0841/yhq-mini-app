import { useState, useEffect, useCallback, useMemo, memo } from 'react'
import React from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Settings,
  Play, Swords, GraduationCap,
  Bookmark, Hash, Signpost,
  Ticket, ShieldAlert,
  ChevronDown, Sparkles, Bot, BookOpen, ClipboardList, HeartCrack, Crown,
  Flame, Star, Trophy,
} from 'lucide-react'
import { useAppStore, type ApiUser } from '../../shared/store/useAppStore'
import { api } from '../../shared/api'
import { modules } from '../../data/modules'
import { useLessonsStore } from '../../store/useLessonsStore'
import { track } from '../../lib/analytics'
import { useSubjectStore } from '../../store/useSubjectStore'
import { useQuestionsStore } from '../../store/useQuestionsStore'
import { useT } from '../../shared/i18n'
import SettingsModal from '../../shared/components/SettingsModal'
import SubjectSheet from '../../components/SubjectSheet'
import { useDailyStore, todayStr } from '../../store/useDailyStore'

// ── Avatar ──────────────────────────────────────────────────────────────────
const Avatar = memo(function Avatar({ name, photoUrl }: { name: string; photoUrl?: string }) {
  const customAvatar = useAppStore((s) => s.customAvatar)
  const src = customAvatar ?? photoUrl
  const letter = name?.[0]?.toUpperCase() || 'F'
  return (
    <div className="relative flex-shrink-0">
      {src ? (
        <img src={src} alt={name} className="w-11 h-11 rounded-full object-cover border border-pline" />
      ) : (
        <div className="w-11 h-11 rounded-full bg-gradient-to-br from-pblue to-ppurple flex items-center justify-center text-white font-bold text-lg">
          {letter}
        </div>
      )}
      <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-psuccess rounded-full border-[2.5px] border-pcanvas" />
    </div>
  )
})

// ── Top Bar / Greeting Header (v2 KIWI Premium) ─────────────────────────────
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
    <div className="flex items-center justify-between px-5 pt-6 pb-4">
      <button onClick={onProfile} className="flex items-center gap-3 active:opacity-70 transition-opacity min-w-0">
        <Avatar name={name} photoUrl={user?.photoUrl} />
        <div className="text-left min-w-0">
          <p className="text-[12px] font-medium text-psubtle">{tt('greeting')},</p>
          <p className="text-[19px] font-bold leading-tight text-pfg tracking-tight truncate">{name}</p>
        </div>
      </button>
      <div className="flex items-center gap-2.5">
        {/* Level — AI purple glass pill (neon glow) */}
        <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold text-ppurple"
          style={{
            background: 'rgba(139, 92, 246, 0.12)',
            border: '1px solid rgba(139, 92, 246, 0.30)',
            boxShadow: '0 0 18px rgba(139, 92, 246, 0.35)',
          }}>
          ✦ {tt('level')} {level}
        </span>
        <button onClick={onSettings} aria-label="Sozlamalar"
          className="w-11 h-11 rounded-2xl card-premium flex items-center justify-center text-pmuted hover:text-pfg transition-colors active:scale-95">
          <Settings size={18} />
        </button>
      </div>
    </div>
  )
})

// ── Hero: bugungi progress (ring + minimal statistika) ──────────────────────
const ProgressCard = memo(function ProgressCard({ totalCorrect, totalAnswered, streak, totalPool, lang }: {
  totalCorrect: number; totalWrong: number; totalAnswered: number; streak: number
  totalPool: number
  lang: 'uz' | 'ru'
}) {
  const tt = useT(lang)
  const navigate = useNavigate()
  const total    = totalPool > 0 ? totalPool : 0
  const accuracy = totalAnswered > 0 ? Math.min(100, Math.round((totalCorrect / totalAnswered) * 100)) : 0
  const xp       = totalCorrect * 10
  const league   = totalCorrect >= 1000 ? 'Platinum' : totalCorrect >= 500 ? 'Gold' : totalCorrect >= 100 ? 'Silver' : 'Bronze'

  // Ring chart geometriyasi (SVG)
  const R = 36, C = 2 * Math.PI * R
  const ringOffset = C * (1 - accuracy / 100)

  return (
    <div className="mx-5 mb-4 card-premium rounded-[28px] p-5 relative overflow-hidden"
      style={{ boxShadow: '0 0 44px -12px var(--p-glow), inset 0 1px 0 rgba(255,255,255,0.03), 0 10px 28px rgba(2,6,16,0.30)' }}>
      <div className="flex items-center justify-between gap-4">
        {/* Chap: foiz + ma'lumot */}
        <div className="flex-1 min-w-0">
          <p className="text-[12px] font-medium text-psubtle mb-1.5">{tt('todayProgress')}</p>
          <p className="text-[36px] font-bold text-pfg leading-none tracking-tight tabular-nums">{accuracy}%</p>
          <p className="text-[12px] font-medium text-pmuted mt-2">
            {totalAnswered} / {total || '…'} {tt('question').toLowerCase()}
          </p>
        </div>
        {/* O'ng: ring chart (aksent rang) */}
        <svg width="96" height="96" viewBox="0 0 96 96" className="flex-shrink-0"
          style={{ filter: 'drop-shadow(0 0 12px var(--p-glow))' }}>
          <circle cx="48" cy="48" r={R} fill="none" stroke="var(--p-line)" strokeWidth="8" />
          <circle cx="48" cy="48" r={R} fill="none" stroke="var(--p-primary)" strokeWidth="8"
            strokeLinecap="round" strokeDasharray={C} strokeDashoffset={ringOffset}
            transform="rotate(-90 48 48)"
            style={{ transition: 'stroke-dashoffset 700ms ease-out' }} />
          <text x="48" y="53" textAnchor="middle" fill="var(--p-fg)" fontSize="17" fontWeight="700">{accuracy}%</text>
        </svg>
      </div>
      {/* Pastki statistika: Seriya / XP / Reyting */}
      <div className="flex items-center justify-around mt-5 pt-4 border-t border-pline">
        {/* Streak — bosilsa "Intizom" sahifasi ochiladi */}
        <button onClick={() => navigate('/streak')} aria-label={tt('intizomTitle')}
          className="flex items-center gap-2 active:scale-95 transition-transform">
          <Flame size={16} className="text-pwarning" fill="currentColor" />
          <div className="text-left">
            <p className="text-[13px] font-semibold text-pfg leading-none tabular-nums">{streak} {tt('daysWord')}</p>
            <p className="text-[10px] font-medium text-psubtle mt-0.5">{tt('streakDays')}</p>
          </div>
        </button>
        <div className="flex items-center gap-2">
          <Star size={16} className="text-pgold" fill="currentColor" />
          <div className="text-left">
            <p className="text-[13px] font-semibold text-pfg leading-none tabular-nums">{xp} XP</p>
            <p className="text-[10px] font-medium text-psubtle mt-0.5">{tt('totalXp')}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Trophy size={16} className="text-psubtle" />
          <div className="text-left">
            <p className="text-[13px] font-semibold text-pfg leading-none">{league}</p>
            <p className="text-[10px] font-medium text-psubtle mt-0.5">{tt('ratingWord')}</p>
          </div>
        </div>
      </div>
    </div>
  )
})

// ── Grid Card (rejimlar) ────────────────────────────────────────────────────
/* Rang intizomi (v2.1): default ikonlar NEYTRAL kulrang — faqat AI/Premium binafsha,
   badge'lar esa semantik (qizil = xato soni). */
const GridCard = memo(function GridCard({ icon: Icon, label, badge, iconColor = '#94a3b8', onClick }: {
  icon: React.ElementType
  label: string
  badge?: number | null
  iconColor?: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="btn-premium-secondary relative flex items-center gap-2.5 rounded-2xl px-3.5 py-3 w-full"
    >
      {badge != null && (
        <span className="absolute -top-2 -right-1 text-white text-[10px] font-bold px-1.5 min-w-[20px] h-5 rounded-full flex items-center justify-center shadow-lg"
          style={{ background: 'var(--p-danger)' }}>
          {badge}
        </span>
      )}
      <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: iconColor + '1A', border: `1px solid ${iconColor}2E`, boxShadow: `0 0 16px ${iconColor}33` }}>
        <Icon size={17} strokeWidth={2.2} style={{ color: iconColor }} />
      </div>
      <span className="text-[12px] font-semibold text-pfg text-left leading-tight">{label}</span>
    </button>
  )
})

// ── Asosiy grid kartasi (Testlar / Mavzular / AI Tutor ...) ────────────────
const MockGridCard = memo(function MockGridCard({ icon: Icon, label, subtitle, iconColor = '#94a3b8', badge, comingSoon, onClick }: {
  icon: React.ElementType
  label: string
  subtitle: string
  iconColor?: string
  badge?: number | null
  comingSoon?: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`card-premium relative flex flex-col items-center justify-center text-center gap-2.5 p-3.5 min-h-[104px] active:scale-[0.97] transition-transform ${comingSoon ? 'opacity-70' : ''}`}
    >
      {badge != null && (
        <span className="absolute -top-2 -right-1 text-white text-[10px] font-bold px-1.5 min-w-[20px] h-5 rounded-full flex items-center justify-center shadow-lg"
          style={{ background: 'var(--p-danger)' }}>
          {badge}
        </span>
      )}
      <div className="w-11 h-11 rounded-[14px] flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: iconColor + '1A', border: `1px solid ${iconColor}2E`, boxShadow: `0 0 18px ${iconColor}40` }}>
        <Icon size={20} strokeWidth={2} style={{ color: iconColor }} />
      </div>
      <div className="text-center">
        <p className="text-[13px] font-semibold text-pfg leading-tight">{label}</p>
        <p className={`text-[10.5px] font-medium mt-0.5 ${comingSoon ? 'text-ppurple' : 'text-psubtle'}`}>{subtitle}</p>
      </div>
    </button>
  )
})

// ── Davom etayotgan mavzu kartasi ───────────────────────────────────────────
// Background rasm: faylni `public/continue-mavzu.webp` ga tashlasangiz kifoya —
// karta unga avtomatik ulanadi (fayl bo'lmasa hech narsa buzilmaydi).
const CONTINUE_BG_URL = '/continue-mavzu.webp'

const ContinueCard = memo(function ContinueCard({ modTitle, lessonLabel, progressPct, allDone, lang, onContinue }: {
  modTitle: string
  lessonLabel: string;         // masalan: "3/7 dars"
  progressPct: number          // shu modul'dagi tayyorlik foizi
  allDone: boolean
  lang: 'uz' | 'ru'; onContinue: () => void
}) {
  const tt = useT(lang)
  const [bgOk, setBgOk] = useState(true)
  return (
    <div className="px-5 mb-4">
      <button onClick={onContinue}
        className="card-premium w-full relative overflow-hidden p-5 text-left active:scale-[0.98] transition-transform">
        {/* Background PNG (o'ng tomonda) — fayl yo'q bo'lsa yashirinadi */}
        {bgOk && (
          <img src={CONTINUE_BG_URL} alt="" aria-hidden
            onError={() => setBgOk(false)}
            style={{ mixBlendMode: 'screen' }}
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-full max-w-full object-contain pointer-events-none select-none" />
        )}
        <div className="relative">
          {/* Sarlavha */}
          <p className="text-[12px] font-medium text-psubtle">{tt('currentTopic')}</p>
          {/* Mavzu nomi — to'liq qatorda, kesilmaydi */}
          <p className="text-[18px] font-bold text-pfg tracking-tight whitespace-normal break-words leading-snug mt-1 pr-16">
            {modTitle}
          </p>
          <p className="text-[12px] font-medium text-pmuted mt-1.5">
            {allDone ? tt('allDoneWord') : lessonLabel}
          </p>
          {/* Progress bar + "Davom etish" — bir qatorda */}
          <div className="flex items-center gap-3 mt-3.5">
            <div className="progress-premium flex-1">
              <div className="fill" style={{ width: `${Math.max(progressPct, 2)}%` }} />
            </div>
            <span className="btn-premium btn-premium-sm flex-shrink-0">
              {tt('continueLearn')}
              <ChevronDown size={15} className="-rotate-90" />
            </span>
          </div>
        </div>
      </button>
    </div>
  )
})

// ── Leaderboard Preview ─────────────────────────────────────────────────────
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
    <div className="px-5 mb-4">
      <div className="flex items-center justify-between mb-2.5">
        <h3 className="text-[15px] font-bold text-pfg tracking-tight">{tt('leaderboard')}</h3>
        <button onClick={onSeeAll} className="text-[12px] font-semibold text-pprimary flex items-center gap-0.5 active:opacity-70">
          {tt('seeAll')} <ChevronDown size={14} className="-rotate-90" />
        </button>
      </div>
      <div className="card-premium divide-y divide-pline">
        {entries.map((e) => (
          <div key={e.rank}
            className={`flex items-center gap-3 px-4 py-3 ${e.isYou ? 'bg-[color-mix(in_srgb,var(--p-primary)_6%,transparent)]' : ''}`}>
            <span className="w-5 text-center text-sm">
              {e.rank === 1 ? '🥇' : e.rank === 2 ? '🥈' : '🥉'}
            </span>
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold text-pblue"
              style={{ background: 'rgba(59, 130, 246, 0.12)', border: '1px solid rgba(59, 130, 246, 0.25)' }}>
              {e.name[0]?.toUpperCase() ?? '?'}
            </div>
            <span className={`flex-1 min-w-0 truncate text-[13px] font-semibold ${e.isYou ? 'text-pprimary' : 'text-pfg'}`}>
              {e.isYou ? `${e.name} (${lang === 'ru' ? 'Вы' : 'Siz'})` : e.name}
            </span>
            <span className="text-[13px] font-bold text-pfg tabular-nums">{e.score}</span>
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
    <div className="mx-5 mb-4 card-premium rounded-[24px] relative overflow-hidden active:scale-[0.98] transition-transform cursor-pointer"
      style={{ borderColor: 'rgba(239, 68, 68, 0.4)' }}>
      <div className="relative z-10 p-4 flex items-center justify-between">
        <p className="text-pfg text-[13px] font-semibold leading-snug max-w-[55%]">
          {text}
        </p>
        <span className="text-pdanger text-[28px] font-bold tracking-wider tabular-nums"
          style={{ fontVariantNumeric: 'tabular-nums' }}>
          {countdown}
        </span>
      </div>
    </div>
  )
})

// ── Subject Switcher — fan nomi + testlar soni + almashtirish ──────────────
// Fan rasmlari: `public/fan-{subjectId}.webp` (masalan, fan-matematika.webp) —
// fayl mavjud bo'lsa o'ng tomonda ko'rinadi, bo'lmasa watermark ikon qoladi.
const SubjectSwitcher = memo(function SubjectSwitcher({ onOpen }: { onOpen: () => void }) {
  const subject = useSubjectStore((s) => s.subject)
  const lang    = useAppStore((s) => s.settings.language)
  const count   = useQuestionsStore((s) => s.questions.length)
  const tt      = useT(lang)
  const Icon    = subject.icon
  const [imgOk, setImgOk] = useState(true)
  useEffect(() => setImgOk(true), [subject.id]) // fan almashganda qayta urinib ko'rish
  const imgUrl = `/fan-${subject.id}.webp`
  return (
    <div className="px-5 mb-3">
      <div className="card-premium relative overflow-hidden p-5">
        {/* O'ng taraf: fan rasmi (masalan, Matematika Σ) — karta ichida to'liq sig'adi */}
        {imgOk && (
          <img src={imgUrl} alt="" aria-hidden
            onError={() => setImgOk(false)}
            className="absolute right-1 top-1/2 -translate-y-1/2 h-[92%] max-w-[45%] object-contain pointer-events-none select-none" />
        )}
        {/* Rasm bo'lmasa: dekorativ watermark ikon */}
        {!imgOk && (
          <Icon size={110} strokeWidth={1} aria-hidden
            className="absolute -right-4 -bottom-6 opacity-[0.07] pointer-events-none"
            style={{ color: subject.color }} />
        )}
        <div className="relative">
          <p className="text-[21px] font-bold text-pfg tracking-tight leading-tight truncate pr-24">
            {lang === 'ru' ? subject.nameRu : subject.name}
          </p>
          <p className="text-[12px] font-medium text-psubtle mt-1">
            {count > 0 ? count.toLocaleString('en-US') : '…'} {tt('testsWord')}
          </p>
          <button onClick={onOpen}
            className="btn-premium-secondary mt-3.5 rounded-full px-4 py-2 text-[12px]"
            aria-label={tt('switchSubject')}>
            {tt('switchSubject')}
            <ChevronDown size={14} className="-rotate-90 text-psubtle" />
          </button>
        </div>
      </div>
    </div>
  )
})

// ── Empty State — "tez kunda" fanlar uchun ─────────────────────────────────
const SubjectEmpty = memo(function SubjectEmpty({ onSwitch }: { onSwitch: () => void }) {
  const subject = useSubjectStore((s) => s.subject)
  const lang    = useAppStore((s) => s.settings.language)
  const Icon    = subject.icon
  return (
    <div className="mx-5 mt-6 rounded-[28px] border border-dashed border-pline p-8 flex flex-col items-center text-center">
      <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
        style={{ background: `${subject.color}1A`, border: `1px solid ${subject.color}2E`, color: subject.color }}>
        <Icon size={32} />
      </div>
      <h3 className="text-[17px] font-bold text-pfg tracking-tight">
        {lang === 'ru' ? subject.nameRu : subject.name}
      </h3>
      <p className="text-[13px] font-medium text-psubtle mt-1.5 max-w-[240px]">
        {lang === 'ru'
          ? 'Этот предмет скоро будет доступен. Следите за обновлениями!'
          : "Bu fan tez kunda qo'shiladi. Yangilanishlarni kuzatib boring!"}
      </p>
      <button onClick={onSwitch}
        className="btn-premium btn-premium-sm mt-5">
        <Sparkles size={16} />
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
  const { user, displayName, settings, totalCorrect, totalWrong, totalAnswered, savedQuestions, wrongByTicket } = useAppStore()
  const subject  = useSubjectStore((s) => s.subject)
  // Progress kartasidagi 🔥 — joriy FANGA tegishli kunlik seriya (Intizom)
  const dailyStreak = useDailyStore((s) => s.streaks[subject.id] ?? 0)
  const questionsCount = useQuestionsStore((s) => s.questions.length)

  // Serverdan bugungi holatni tortish (kun yoki fan o'zgarsa qayta)
  const userId = user?.id
  useEffect(() => {
    if (userId) void useDailyStore.getState().sync(userId, todayStr(), subject.id)
  }, [userId, subject.id])
  const tt = useT(settings.language)

  // "Davom etish" — QAYSI darsda qolgan bo'lsa o'sha darslik ma'lumoti
  const continueInfo = useMemo(() => {
    const userId  = user?.id ?? '0'
    const doneMap = useLessonsStore.getState().byUser[userId] ?? {}
    for (const mod of modules) {
      const done = doneMap[mod.id] ?? []
      for (let i = 0; i < mod.lessonCount; i++) {
        if (!done.includes(i)) {
          return {
            mod,
            pct: Math.round((done.length / mod.lessonCount) * 100),
            lessonLabel: `${tt('lessonWord')} ${i + 1}/${mod.lessonCount}`,
            allDone: false,
            go: () => navigate('/darslik', { state: { moduleId: mod.id, lessonIdx: i } }),
          }
        }
      }
    }
    const last = modules[modules.length - 1]
    return {
      mod: last,
      pct: 100,
      lessonLabel: `${tt('lessonWord')} ${last.lessonCount}/${last.lessonCount}`,
      allDone: true,
      go: () => navigate('/darslik'),
    }
  }, [user?.id, settings.language, navigate, tt])

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
    if (savedQuestions.length === 0) {
      showToast(settings.language === 'ru'
        ? "Нет сохранённых вопросов — используйте 📌 в тесте"
        : "Hali saqlangan savollar yo'q — testda 📌 tugmasini bosing")
      return
    }
    navigate('/test/1', { state: { questionIds: savedQuestions, title: tt('saved') } })
  }, [savedQuestions, settings.language, navigate, tt, showToast])

  return (
    <div className="font-display min-h-screen bg-pcanvas pb-6 safe-bottom">
      {/* Top bar / Greeting Header */}
      <TopBar user={user} displayName={displayName}
        level={Math.floor(totalCorrect / 50) + 1}
        onSettings={() => setShowSettings(true)} onProfile={goProfile} />

      {/* Universal subject switcher */}
      <SubjectSwitcher onOpen={() => setShowSubjects(true)} />

      {/* Fan mavjud bo'lmasa — empty state; mavjud bo'lsa — to'liq dashboard.
          key=subjectId: fan almashganda smooth fade transition, reload yo'q */}
      {subject.available ? (
        <div key={subject.id} className="animate-premiumIn">
          {/* Demo ma'lumotlar badge — boshqa fanga vaqtincha YHQ bazasi ulangan */}
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

          {/* Hero: bugungi progress (ring chart) */}
          <ProgressCard
            totalCorrect={totalCorrect}
            totalWrong={totalWrong}
            totalAnswered={totalAnswered}
            streak={dailyStreak}
            totalPool={questionsCount}
            lang={settings.language}
          />

      {/* Kunlik topshiriq kartasi olindi — streak endi HAR QANDAY faollikdan
         (kamida 1 savol yoki dars) yoziladi: ProgressCard → /streak */}

      {/* Premium banner (binafsha = AI/Premium/Magic) — premium_click KPI o'lchanadi */}
      <div className="mx-5 mb-4 card-premium p-4 flex items-center gap-3.5">
        <div className="w-11 h-11 rounded-[14px] flex items-center justify-center flex-shrink-0"
          style={{
            background: 'rgba(139, 92, 246, 0.12)',
            border: '1px solid rgba(139, 92, 246, 0.30)',
            boxShadow: '0 0 20px rgba(139, 92, 246, 0.30)',
          }}>
          <Crown size={19} className="text-ppurple" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-bold text-pfg">Premium</p>
          <p className="text-[11px] font-medium text-psubtle mt-0.5">{tt('premiumTagline')}</p>
        </div>
        <button onClick={() => { track('premium_click'); showToast(tt('comingSoonD')) }}
          className="btn-premium-ai px-4 py-2.5 rounded-xl text-[12px]">
          {tt('tryWord')}
        </button>
      </div>

      {/* Davom etayotgan mavzu — QAYSI darsda qolgan bo'lsa o'sha darslik */}
      <ContinueCard
        modTitle={settings.language === 'ru' ? continueInfo.mod.titleRu : continueInfo.mod.title}
        lessonLabel={continueInfo.lessonLabel}
        progressPct={continueInfo.pct}
        allDone={continueInfo.allDone}
        lang={settings.language}
        onContinue={continueInfo.go}
      />

      {/* ASOSIY GRID (Testlar / Mavzular / AI Tutor · Xatolar / Biletlar / Duel) */}
      <div className="grid grid-cols-3 gap-3 px-5 mb-4">
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

      {/* Rejimlar (funksiyalar saqlangan) */}
      <div className="px-5 mb-2">
        <p className="text-[10px] font-semibold text-psubtle uppercase tracking-[0.14em]">{tt('modesTitle')}</p>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 px-5 mb-4">
        <GridCard icon={ShieldAlert}   label={tt('distracting')} onClick={goMode('tricky', tt('distracting'))} />
        <GridCard icon={GraduationCap} label={tt('lessons')}     onClick={goDarslik} />
        <GridCard icon={Bookmark}      label={tt('saved')}       badge={savedQuestions.length || null} onClick={goSaved} />
        <GridCard icon={Signpost}      label={tt('roadSigns')}   onClick={() => navigate('/belgilar')} />
        <GridCard icon={Hash}          label={tt('numeric')}     onClick={goMode('numeric', tt('numeric'))} />
        <GridCard icon={Play}          label={tt('adaptive')}    onClick={goAdaptive} />
      </div>

      {/* Reyting top-3 preview */}
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
        <div className="fixed bottom-20 left-5 right-5 card-premium text-pfg text-xs font-semibold px-4 py-3 rounded-2xl text-center z-40 animate-premiumIn">
          {toast}
        </div>
      )}

      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
      {showSubjects && <SubjectSheet onClose={() => setShowSubjects(false)} />}
    </div>
  )
}
