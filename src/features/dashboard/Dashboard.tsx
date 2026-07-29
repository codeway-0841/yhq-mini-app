import { useState } from 'react'
import React from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Download, Trophy, Search, Settings,
  BookOpen, Play, Sword, LayoutGrid,
  Ticket, ListChecks, GraduationCap,
  AlertTriangle, Bookmark, Hash,
} from 'lucide-react'
import { useAppStore, type ApiUser } from '../../shared/store/useAppStore'
import SettingsModal from '../../shared/components/SettingsModal'

function Avatar({ name }: { name: string }) {
  const letter = name?.[0]?.toUpperCase() || 'F'
  return (
    <div className="w-9 h-9 rounded-full bg-[#1f6feb] flex items-center justify-center text-white font-bold text-base">
      {letter}
    </div>
  )
}

function TopBar({ user, onSettings }: { user: ApiUser | null; onSettings: () => void }) {
  const name = user ? `${user.firstName} ${user.lastName || ''}`.trim() : 'Foydalanuvchi'
  return (
    <div className="flex items-center justify-between px-4 pt-4 pb-2">
      <div className="flex items-center gap-2">
        <Avatar name={name} />
        <div>
          <p className="text-sm font-semibold leading-tight">{name}</p>
          <span className="text-[10px] font-bold text-[#f59e0b] bg-[#f59e0b]/10 px-2 py-0.5 rounded-full">
            YO'LOVCHI
          </span>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <button disabled className="text-[#8b949e] opacity-40 cursor-not-allowed">
          <Download size={20} />
        </button>
        <button disabled className="relative text-[#8b949e] opacity-40 cursor-not-allowed">
          <Trophy size={20} />
          <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-[#0d1117]" />
        </button>
        <button disabled className="text-[#8b949e] opacity-40 cursor-not-allowed">
          <Search size={20} />
        </button>
        <button onClick={onSettings} className="text-[#8b949e] hover:text-white transition-colors">
          <Settings size={20} />
        </button>
      </div>
    </div>
  )
}

function ProgressCard({ totalCorrect, totalWrong, totalAnswered, streak }: {
  totalCorrect: number
  totalWrong: number
  totalAnswered: number
  streak: number
}) {
  const total     = totalAnswered || 1
  const percent   = Math.min(100, Math.round((totalCorrect / total) * 100)) || 0
  const remaining = Math.max(0, 20 - totalAnswered)

  return (
    <div className="mx-4 rounded-2xl bg-gradient-to-br from-[#1a7f3c] to-[#0f5a28] p-4 mb-3">
      <div className="flex items-start justify-between mb-2">
        <button disabled className="text-xs text-green-300/40 cursor-not-allowed">
          Sanani o'zgartirish
        </button>
        <div className="flex items-center gap-1 text-orange-400 font-bold text-sm">
          🔥 {streak} kun
        </div>
      </div>

      <div className="flex items-center justify-between mb-3">
        <span className="text-5xl font-black text-white">{percent}%</span>
        <div className="text-right text-sm text-green-200 space-y-0.5">
          <div className="flex items-center gap-1">
            <span className="text-green-400">✓</span>
            <span>{totalCorrect} to'g'ri</span>
          </div>
          <div className="flex items-center gap-1">
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

function GridCard({ icon: Icon, label, badge, color = '#1f2937', onClick, className = '' }: {
  icon: React.ElementType
  label: string
  badge?: number | null
  color?: string
  onClick: () => void
  className?: string
}) {
  return (
    <button
      onClick={onClick}
      className={`relative flex flex-col items-center justify-center gap-2 rounded-2xl border border-[#30363d] p-4 min-h-[90px] active:scale-95 transition-transform ${className}`}
      style={{ background: color }}
    >
      {badge != null && (
        <span className="absolute top-2 right-2 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
          {badge}
        </span>
      )}
      <Icon size={26} strokeWidth={1.6} className="text-white" />
      <span className="text-xs font-semibold text-center leading-tight text-white">{label}</span>
    </button>
  )
}

function BannerCard({ icon: Icon, label, color, onClick }: {
  icon: React.ElementType
  label: string
  color: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-3 rounded-2xl border border-[#30363d] p-4 w-full active:scale-[0.98] transition-transform"
      style={{ background: color }}
    >
      <Icon size={28} strokeWidth={1.6} className="text-white" />
      <span className="text-base font-bold text-white">{label}</span>
    </button>
  )
}

export default function Dashboard() {
  const navigate  = useNavigate()
  const [showSettings, setShowSettings] = useState(false)
  const { user, totalCorrect, totalWrong, totalAnswered, streak } = useAppStore()

  const goTest        = () => navigate('/test/1')
  const goMistakes    = () => navigate('/mavzular')
  const goTopics      = () => navigate('/mavzular')
  const goAdaptive    = () => navigate('/adaptive')
  const goOctagon     = () => navigate('/octagon')

  return (
    <div className="pb-4">
      <TopBar user={user} onSettings={() => setShowSettings(true)} />
      <ProgressCard
        totalCorrect={totalCorrect}
        totalWrong={totalWrong}
        totalAnswered={totalAnswered}
        streak={streak}
      />

      <div className="grid grid-cols-2 gap-3 px-4 mb-3">
        <GridCard icon={ListChecks}    label="Barcha testlar"     color="#1c2a3a" onClick={goTest} />
        <GridCard icon={AlertTriangle} label="Xatolarni tuzatish"
          badge={totalWrong || null}   color="#2a1c1c" onClick={goMistakes} />
      </div>

      <div className="px-4 mb-3">
        <BannerCard icon={GraduationCap} label="Darslik" color="#1a2a4a"
          onClick={() => navigate('/darslik')} />
      </div>

      <div className="grid grid-cols-2 gap-3 px-4 mb-3">
        <GridCard icon={Play}  label="Smart test" color="#1a3a1a" onClick={goAdaptive} />
        <GridCard icon={Sword} label="Oktagon"    color="#2a1a3a" onClick={goOctagon} />
      </div>

      <div className="grid grid-cols-2 gap-3 px-4 mb-3">
        <GridCard icon={LayoutGrid}    label="Mavzular"     color="#1c2a3a" onClick={goTopics} />
        <GridCard icon={Ticket}        label="Biletlar"     color="#1c2a3a" onClick={() => navigate('/biletlar')} />
        <GridCard icon={ListChecks}    label="50/100 talik" color="#1c2a3a" onClick={goTest} />
        <GridCard icon={GraduationCap} label="Real imtihon" color="#1c2a3a" onClick={goTest} />
      </div>

      <div className="grid grid-cols-2 gap-3 px-4">
        <GridCard icon={AlertTriangle} label="Chalg'ituvchi"    color="#2a221a" onClick={goTest} />
        <GridCard icon={Bookmark}      label="Saqlanganlar"     color="#1c2a3a" onClick={goTest} />
        <GridCard icon={BookOpen}      label="Yo'l belgilari"   color="#1a1c2a" onClick={() => navigate('/belgilar')} />
        <GridCard icon={Hash}          label="Raqamli savollar" color="#1c2a2a" onClick={goTest} />
      </div>

      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
    </div>
  )
}
