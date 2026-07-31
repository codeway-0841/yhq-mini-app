import { useState, useEffect } from 'react'
import React from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Trophy, Settings,
  Play, Sword, LayoutGrid,
  Ticket, ListChecks, GraduationCap,
  AlertTriangle, Bookmark, Hash, Signpost,
} from 'lucide-react'
import { useAppStore, type ApiUser } from '../../shared/store/useAppStore'
import SettingsModal from '../../shared/components/SettingsModal'

// ── Avatar ──────────────────────────────────────────────────────────────────
function Avatar({ name }: { name: string }) {
  const letter = name?.[0]?.toUpperCase() || 'F'
  return (
    <div className="relative">
      <div className="w-9 h-9 rounded-full bg-green-600 flex items-center justify-center text-white font-bold text-base">
        {letter}
      </div>
      <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-400 rounded-full border-2 border-[#0d1117]" />
    </div>
  )
}

// ── Top Bar ─────────────────────────────────────────────────────────────────
function TopBar({ user, onSettings, onProfile, onLeaderboard }: {
  user: ApiUser | null
  onSettings: () => void
  onProfile: () => void
  onLeaderboard: () => void
}) {
  const name = user ? `${user.firstName} ${user.lastName || ''}`.trim() : 'Foydalanuvchi'
  return (
    <div className="flex items-center justify-between px-4 pt-4 pb-2">
      <button onClick={onProfile} className="flex items-center gap-2.5 active:opacity-70 transition-opacity">
        <Avatar name={name} />
        <div className="text-left">
          <p className="text-sm font-bold leading-tight text-white">{name}</p>
          <span className="text-[10px] font-bold text-green-400">
            ⚡ YO'LOVCHI ›
          </span>
        </div>
      </button>
      <div className="flex items-center gap-3.5">
        <button onClick={onLeaderboard} aria-label="Reyting"
          className="text-[#f59e0b] hover:opacity-80 transition-opacity">
          <Trophy size={20} fill="currentColor" />
        </button>
        <button onClick={onSettings} aria-label="Sozlamalar"
          className="text-[#8b949e] hover:text-white transition-colors">
          <Settings size={20} />
        </button>
      </div>
    </div>
  )
}

// ── Progress Card ───────────────────────────────────────────────────────────
function ProgressCard({ totalCorrect, totalWrong, totalAnswered, streak }: {
  totalCorrect: number; totalWrong: number; totalAnswered: number; streak: number
}) {
  const total     = totalAnswered || 1
  const percent   = Math.min(100, Math.round((totalCorrect / total) * 100)) || 0
  const remaining = Math.max(0, 20 - totalAnswered)

  return (
    <div className="mx-4 rounded-2xl bg-gradient-to-br from-[#1a7f3c] to-[#0f5a28] p-4 mb-3">
      <div className="flex items-start justify-between mb-2">
        <span className="text-xs text-green-300/60">
          Sanani o'zgartirish ✏️
        </span>
        <div className="flex items-center gap-1 text-orange-400 font-bold text-sm">
          ⚡ {streak} kun
        </div>
      </div>

      <div className="flex items-center justify-between mb-3">
        <span className="text-5xl font-black text-white">{percent}%</span>
        <div className="text-right text-sm text-green-200 space-y-0.5">
          <div className="flex items-center gap-1 justify-end">
            <span className="text-green-400">✓</span>
            <span>{totalCorrect} to'g'ri</span>
          </div>
          <div className="flex items-center gap-1 justify-end">
            <span className="text-red-400">✗</span>
            <span>{totalWrong} xato</span>
          </div>
          <div className="text-green-300">{remaining} qolgan</div>
        </div>
      </div>

      <div className="w-full bg-green-900/50 rounded-full h-2">
        <div
          className="bg-green-400 h-2 rounded-full transition-all duration-500"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  )
}

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

function PromoBanner() {
  const countdown = useCountdown()
  return (
    <div className="mx-4 mb-3 rounded-2xl bg-gradient-to-r from-[#ec4899] to-[#ef4444] p-4 relative overflow-hidden active:scale-[0.98] transition-transform">
      {/* Decorative flame */}
      <div className="absolute right-3 top-1/2 -translate-y-1/2 opacity-15 text-white">
        <svg width="64" height="64" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 23a7 7 0 0 1-7-7c0-3 2-5 3.5-7.5S12 3 12 1c0 0 4 3 6.5 7.5S22 13 22 16a7 7 0 0 1-7 7h-3z" />
        </svg>
      </div>
      <p className="text-white text-sm font-bold leading-snug mb-1.5 pr-16">
        1 oylik Qora Jentra tarifiga 25% chegirma. Faqat bugun!
      </p>
      <p className="text-white text-3xl font-black tracking-wider">{countdown}</p>
    </div>
  )
}

// ── Horizontal Grid Card ────────────────────────────────────────────────────
function GridCard({ icon: Icon, label, badge, iconColor = '#8b949e', onClick }: {
  icon: React.ElementType
  label: string
  badge?: number | null
  iconColor?: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="relative flex items-center gap-3 rounded-2xl border border-[#30363d] bg-[#161b22] px-4 py-3.5 active:scale-[0.96] transition-transform w-full"
    >
      {badge != null && (
        <span className="absolute top-2 right-2 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
          {badge}
        </span>
      )}
      <Icon size={22} strokeWidth={1.8} style={{ color: iconColor }} className="flex-none" />
      <span className="text-sm font-semibold text-white text-left leading-tight">{label}</span>
    </button>
  )
}

// ── Feature Card (Test yechish / Oktagon) ───────────────────────────────────
function FeatureCard({ icon: Icon, label, subtitle, bgColor, onClick }: {
  icon: React.ElementType
  label: string
  subtitle: string
  bgColor: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-start gap-1.5 rounded-2xl p-4 min-h-[130px] active:scale-[0.96] transition-transform w-full"
      style={{ background: bgColor }}
    >
      <div className="w-11 h-11 rounded-xl bg-white/20 flex items-center justify-center mb-1">
        <Icon size={24} className="text-white" strokeWidth={2} />
      </div>
      <span className="text-base font-bold text-white">{label}</span>
      <span className="text-xs text-white/60">{subtitle}</span>
    </button>
  )
}

// ── Main Dashboard ──────────────────────────────────────────────────────────
export default function Dashboard() {
  const navigate = useNavigate()
  const [showSettings, setShowSettings] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const { user, totalCorrect, totalWrong, totalAnswered, streak, savedQuestions } = useAppStore()

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  const goTest     = () => navigate('/test/1')
  const goMistakes = () => navigate('/mavzular')
  const goTopics   = () => navigate('/mavzular')
  const goAdaptive = () => navigate('/adaptive')
  const goOctagon  = () => navigate('/octagon')
  const goProfile  = () => navigate('/profil')
  /** Real test modes — TestPage builds the question set based on `mode` */
  const goMode = (mode: 'random50' | 'exam' | 'tricky' | 'numeric', title: string) => () =>
    navigate('/test/1', { state: { mode, title } })
  const goSaved = () => {
    if (savedQuestions.length === 0) {
      showToast("Hali saqlangan savollar yo'q — testda 📌 tugmasini bosing")
      return
    }
    navigate('/test/1', { state: { questionIds: savedQuestions, title: 'Saqlanganlar' } })
  }

  return (
    <div className="pb-4">
      <TopBar user={user} onSettings={() => setShowSettings(true)} onProfile={goProfile}
        onLeaderboard={() => navigate('/reyting')} />

      <ProgressCard
        totalCorrect={totalCorrect}
        totalWrong={totalWrong}
        totalAnswered={totalAnswered}
        streak={streak}
      />

      {/* Barcha testlar + Xatolarni tuzatish */}
      <div className="grid grid-cols-2 gap-3 px-4 mb-3">
        <GridCard icon={ListChecks}    label="Barcha testlar"     iconColor="#60a5fa" onClick={goTest} />
        <GridCard icon={AlertTriangle} label="Xatolarni tuzatish" iconColor="#f472b6" badge={totalWrong || null} onClick={goMistakes} />
      </div>

      {/* Promo banner */}
      <PromoBanner />

      {/* Darslik */}
      <div className="px-4 mb-3">
        <button
          onClick={() => navigate('/darslik')}
          className="flex items-center justify-between rounded-2xl bg-gradient-to-r from-[#0ea5e9] to-[#38bdf8] p-4 w-full active:scale-[0.98] transition-transform"
        >
          <div className="text-left">
            <p className="text-base font-bold text-white">Darslik</p>
            <p className="text-xs text-white/70">Noldan imtihondan o'tguncha bo'lgan...</p>
          </div>
          <GraduationCap size={32} className="text-white/80 flex-none" />
        </button>
      </div>

      {/* Test yechish + Oktagon */}
      <div className="grid grid-cols-2 gap-3 px-4 mb-3">
        <FeatureCard icon={Play}  label="Test yechish" subtitle="Sizga mos savollar" bgColor="#22c55e" onClick={goAdaptive} />
        <FeatureCard icon={Sword} label="Oktagon"      subtitle="Birga bir jang"     bgColor="#374151" onClick={goOctagon} />
      </div>

      {/* Grid cards */}
      <div className="grid grid-cols-2 gap-3 px-4 mb-3">
        <GridCard icon={LayoutGrid} label="Mavzular" iconColor="#818cf8" onClick={goTopics} />
        <GridCard icon={Ticket}     label="Biletlar" iconColor="#2dd4bf" onClick={() => navigate('/biletlar')} />
      </div>

      <div className="grid grid-cols-2 gap-3 px-4 mb-3">
        <GridCard icon={ListChecks}    label="50 talik"     iconColor="#60a5fa" onClick={goMode('random50', '50 talik test')} />
        <GridCard icon={GraduationCap} label="Real imtihon" iconColor="#4ade80" onClick={goMode('exam', 'Real imtihon — 40 savol / 30 daqiqa')} />
      </div>

      <div className="grid grid-cols-2 gap-3 px-4 mb-3">
        <GridCard icon={AlertTriangle} label="Chalg'ituvchi" iconColor="#f472b6" onClick={goMode('tricky', "Chalg'ituvchi savollar — 30 ta tasodifiy")} />
        <GridCard icon={Bookmark}      label="Saqlanganlar"  iconColor="#fbbf24" badge={savedQuestions.length || null} onClick={goSaved} />
      </div>

      <div className="grid grid-cols-2 gap-3 px-4">
        <GridCard icon={Signpost}      label="Yo'l belgilari"   iconColor="#fbbf24" onClick={() => navigate('/belgilar')} />
        <GridCard icon={Hash}          label="Raqamli savollar" iconColor="#a78bfa" onClick={goMode('numeric', 'Raqamli savollar')} />
      </div>

      {toast && (
        <div className="fixed bottom-20 left-4 right-4 bg-orange-900/90 border border-orange-500/50 text-orange-100 text-xs font-semibold px-4 py-3 rounded-xl text-center z-40">
          ⚠️ {toast}
        </div>
      )}

      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
    </div>
  )
}
