import { useState, useEffect, useCallback, useMemo, memo } from 'react'
import React from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Settings,
  Play, Swords, GraduationCap,
  Bookmark, Hash, Signpost,
  Ticket, ShieldAlert,
  ChevronDown, Sparkles, Bot, BookOpen, ClipboardList, HeartCrack, Crown,
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

// ── Bugungi progress karta (mock dizayn: yashil gradient + segment chiziq + ring) ──
const ProgressCard = memo(function ProgressCard({ totalCorrect, totalAnswered, streak, totalPool, lang }: {
  totalCorrect: number; totalWrong: number; totalAnswered: number; streak: number
  totalPool: number
  lang: 'uz' | 'ru'
}) {
  const tt = useT(lang)
  const total    = totalPool > 0 ? totalPool : 0
  const accuracy = totalAnswered > 0 ? Math.min(100, Math.round((totalCorrect / totalAnswered) * 100)) : 0
  const xp       = totalCorrect * 10
  const league   = totalCorrect >= 1000 ? 'Platinum' : totalCorrect >= 500 ? 'Gold' : totalCorrect >= 100 ? 'Silver' : 'Bronze'

  // Ring chart geometriyasi (SVG)
  const R = 34, C = 2 * Math.PI * R
  const ringOffset = C * (1 - accuracy / 100)

  // Segmentli chiziq (mock'dagi nuqtali progress)
  const SEGMENTS = 10
  const filledSegs = Math.round((accuracy / 100) * SEGMENTS)

  return (
    <div className="mx-4 mb-3 rounded-3xl p-4 relative overflow-hidden border border-duo-green/50"
      style={{
        background: 'linear-gradient(135deg, #46a302 0%, #58cc02 45%, #2f8f05 100%)',
        boxShadow: '0 0 30px rgba(88, 204, 2, 0.30), 0 18px 40px rgba(2, 8, 23, 0.45), inset 0 1px 0 rgba(255,255,255,0.20)',
      }}>
      <div className="flex items-center justify-between gap-3">
        {/* Chap: foiz + segment chiziq */}
        <div className="flex-1 min-w-0">
          <p className="text-[12px] font-bold text-white/75 mb-1">{tt('todayProgress')}</p>
          <p className="text-[34px] font-black text-white leading-none drop-shadow-sm">{accuracy}%</p>
          <p className="text-[11px] font-semibold text-white/70 mt-1 mb-2.5">
            {totalAnswered} / {total || '…'} {tt('question').toLowerCase()}
          </p>
          <div className="flex gap-1">
            {Array.from({ length: SEGMENTS }).map((_, i) => (
              <span key={i} className="h-2 flex-1 rounded-full"
                style={{
                  background: i < filledSegs ? '#b6ff4f' : 'rgba(10, 48, 0, 0.30)',
                  boxShadow: i < filledSegs ? '0 0 8px rgba(182, 255, 79, 0.6)' : undefined,
                }} />
            ))}
          </div>
        </div>
        {/* O'ng: ring chart */}
        {total > 0 && (
          <svg width="92" height="92" viewBox="0 0 92 92" className="flex-shrink-0"
            style={{ filter: 'drop-shadow(0 0 10px rgba(182, 255, 79, 0.5))' }}>
            <circle cx="46" cy="46" r={R} fill="none" stroke="rgba(10, 48, 0, 0.30)" strokeWidth="8" />
            <circle cx="46" cy="46" r={R} fill="none" stroke="#b6ff4f" strokeWidth="8"
              strokeLinecap="round" strokeDasharray={C} strokeDashoffset={ringOffset}
              transform="rotate(-90 46 46)"
              style={{ transition: 'stroke-dashoffset 700ms ease-out' }} />
            <text x="46" y="51" textAnchor="middle" fill="#ffffff" fontSize="16" fontWeight="900">{accuracy}%</text>
          </svg>
        )}
      </div>
      {/* Pastki statistika: Seriya / XP / Reyting */}
      <div className="flex items-center justify-around mt-3.5 pt-3 border-t border-white/15">
        <div className="flex items-center gap-1.5">
          <span className="text-base">🔥</span>
          <div className="text-left">
            <p className="text-sm font-black text-white leading-none">{streak} {tt('daysWord')}</p>
            <p className="text-[10px] font-semibold text-white/70">{tt('streakDays')}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-base">⭐</span>
          <div className="text-left">
            <p className="text-sm font-black text-white leading-none">{xp} XP</p>
            <p className="text-[10px] font-semibold text-white/70">{tt('totalXp')}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-base">🏆</span>
          <div className="text-left">
            <p className="text-sm font-black text-white leading-none">{league}</p>
            <p className="text-[10px] font-semibold text-white/70">{tt('ratingWord')}</p>
          </div>
        </div>
      </div>
    </div>
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

// ── Mock Grid Card (v1.1: glow icon + label + subtitle, mock usilobi) ───────
const MockGridCard = memo(function MockGridCard({ icon: Icon, label, subtitle, iconColor, badge, comingSoon, onClick }: {
  icon: React.ElementType
  label: string
  subtitle: string
  iconColor: string
  badge?: number | null
  comingSoon?: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`card-neon relative flex flex-col items-center justify-center text-center gap-2 p-3 min-h-[96px] active:scale-[0.97] transition-transform ${comingSoon ? 'opacity-70' : ''}`}
    >
      {badge != null && (
        <span className="absolute -top-2 -right-1 bg-duo-red text-white text-[10px] font-bold px-1.5 min-w-[20px] h-5 rounded-full flex items-center justify-center shadow-lg shadow-red-500/30">
          {badge}
        </span>
      )}
      <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: iconColor + '26', boxShadow: `0 0 18px ${iconColor}66`, border: `1px solid ${iconColor}55` }}>
        <Icon size={19} strokeWidth={2.2} style={{ color: iconColor }} />
      </div>
      <div className="text-center">
        <p className="text-[13px] font-black text-fg leading-tight">{label}</p>
        <p className={`text-[10.5px] font-semibold mt-0.5 ${comingSoon ? 'text-neon-violet' : 'text-subtle'}`}>{subtitle}</p>
      </div>
    </button>
  )
})

// ── Davom etayotgan mavzu kartasi (mock dizayn: navy karta + yashil CTA) ────
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
    <div className="px-4 mb-3">
      <button onClick={onContinue}
        className="card-neon w-full relative overflow-hidden p-4 text-left active:scale-[0.99] transition-transform">
        {/* Background PNG (o'ng tomonda) — fayl yo'q bo'lsa yashirinadi */}
        {bgOk && (
          <img src={CONTINUE_BG_URL} alt="" aria-hidden
            onError={() => setBgOk(false)}
            style={{ mixBlendMode: 'screen' }}
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-full max-w-full object-contain pointer-events-none select-none" />
        )}
        <div className="relative">
          {/* Sarlavha */}
          <p className="text-[12px] font-semibold text-subtle">{tt('currentTopic')}</p>
          {/* Mavzu nomi — to'liq qatorda, kesilmaydi */}
          <p className="text-[18px] font-black text-fg whitespace-normal break-words leading-snug mt-0.5 pr-16">
            {modTitle}
          </p>
          <p className="text-[11px] font-semibold text-subtle mt-1.5">
            {allDone ? tt('allDoneWord') : lessonLabel}
          </p>
          {/* Progress bar + "Davom etish" — bir qatorda, taglari tekis */}
          <div className="flex items-end gap-3 mt-2">
            <div className="progress-neon flex-1 mb-[13px]">
              <div className="fill" style={{ width: `${Math.max(progressPct, 2)}%` }} />
            </div>
            <span className="btn-neon flex items-center gap-1.5 px-4 py-3 rounded-2xl text-[13px] flex-shrink-0">
              {tt('continueLearn')}
              <ChevronDown size={14} className="-rotate-90" />
            </span>
          </div>
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

// ── Subject Switcher — mock dizayn: navy karta + fan ikoni + testlar soni ──
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
    <div className="px-4 mb-2.5">
      <div className="card-neon relative overflow-hidden p-4">
        {/* O'ng taraf: fan rasmi (masalan, Matematika Σ) — karta ichida to'liq sig'adi */}
        {imgOk && (
          <img src={imgUrl} alt="" aria-hidden
            onError={() => setImgOk(false)}
            className="absolute right-1 top-1/2 -translate-y-1/2 h-[92%] max-w-[45%] object-contain pointer-events-none select-none" />
        )}
        {/* Rasm bo'lmasa: dekorativ watermark ikon */}
        {!imgOk && (
          <Icon size={110} strokeWidth={1.2} aria-hidden
            className="absolute -right-4 -bottom-6 opacity-[0.08] pointer-events-none"
            style={{ color: subject.color }} />
        )}
        <div className="relative">
          <p className="text-[20px] font-black text-fg leading-tight truncate pr-24">
            {lang === 'ru' ? subject.nameRu : subject.name}
          </p>
          <p className="text-[12px] font-semibold text-subtle mt-0.5">
            {count > 0 ? count.toLocaleString('en-US') : '…'} {tt('testsWord')}
          </p>
          <button onClick={onOpen}
            className="mt-2.5 flex items-center gap-1 rounded-full border border-line bg-elevated px-3.5 py-1.5 text-[12px] font-bold text-fg active:scale-95 transition-transform"
            aria-label={tt('switchSubject')}>
            {tt('switchSubject')}
            <ChevronDown size={14} className="-rotate-90 text-subtle" />
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

  const goMistakes = useCallback(() => navigate('/mavzular'), [navigate])
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

      {/* Premium fake-door (1 haftalik sinov: premium_click KPI o'lchanadi) */}
      <div className="mx-4 mb-3 card-neon p-3.5 flex items-center gap-3">
        <div className="glow-purple w-10 h-10 rounded-xl bg-neon-purple/15 border border-neon-purple/40 flex items-center justify-center flex-shrink-0">
          <Crown size={19} className="text-neon-violet" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-black text-fg">Premium ✨</p>
          <p className="text-[11px] text-subtle">{tt('premiumTagline')}</p>
        </div>
        <button onClick={() => { track('premium_click'); showToast(tt('comingSoonD')) }}
          className="btn-neon px-4 py-2 rounded-xl text-[12px]">
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

      {/* v1.1 MOCK GRID (Testlar / Mavzular / AI Tutor · Xatolar / Biletlar / Duel) */}
      <div className="grid grid-cols-3 gap-2.5 px-4 mb-3">
        <MockGridCard icon={ClipboardList} label={tt('testlarTitle')}
          subtitle={`${questionsCount || '300'}+ ${tt('question').toLowerCase()}`}
          iconColor="#58cc02" onClick={() => navigate('/testlar')} />
        <MockGridCard icon={BookOpen} label={tt('topics')} subtitle={tt('allTopicsDesc')}
          iconColor="#38bdf8" onClick={goTopics} />
        <MockGridCard icon={Bot} label={tt('aiTutor')} subtitle={tt('comingSoonD')}
          iconColor="#8b5cf6" comingSoon onClick={() => showToast(tt('comingSoonD'))} />
        <MockGridCard icon={HeartCrack} label={tt('mistakes')} subtitle={tt('mistakeFixDesc')}
          iconColor="#ff4b4b" badge={mistakesCount || null} onClick={goMistakes} />
        <MockGridCard icon={Ticket} label={tt('tickets')} subtitle={tt('officialTickets')}
          iconColor="#ffc800" onClick={() => navigate('/biletlar')} />
        <MockGridCard icon={Swords} label={tt('duelTitle')} subtitle={tt('duelDesc')}
          iconColor="#38bdf8" onClick={goOctagon} />
      </div>

      {/* Rejimlar (funksiyalar saqlangan) */}
      <div className="px-4 mb-1.5">
        <p className="text-[10px] font-bold text-subtle uppercase tracking-[0.12em]">{tt('modesTitle')}</p>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-2.5 px-4 mb-3">
        <GridCard icon={ShieldAlert}   label={tt('distracting')} iconColor="#ff4b4b" onClick={goMode('tricky', tt('distracting'))} />
        <GridCard icon={GraduationCap} label={tt('lessons')}     iconColor="#1cb0f6" onClick={goDarslik} />
        <GridCard icon={Bookmark}      label={tt('saved')}       iconColor="#ffc800" badge={savedQuestions.length || null} onClick={goSaved} />
        <GridCard icon={Signpost}      label={tt('roadSigns')}   iconColor="#38bdf8" onClick={() => navigate('/belgilar')} />
        <GridCard icon={Hash}          label={tt('numeric')}     iconColor="#ce82ff" onClick={goMode('numeric', tt('numeric'))} />
        <GridCard icon={Play}          label={tt('adaptive')}    iconColor="#a78bfa" onClick={goAdaptive} />
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
