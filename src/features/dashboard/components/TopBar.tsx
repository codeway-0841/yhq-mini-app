import { memo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronDown, Settings, Coins } from 'lucide-react'
import { useAppStore, type ApiUser } from '../../../shared/store/useAppStore'
import { useSubjectStore } from '../../../shared/store/useSubjectStore'
import { useT } from '../../../shared/i18n'
import SubjectSheet from '../../../shared/components/SubjectSheet'
import { getAvatarFrame } from '../../../shared/config/avatar-frames'

// ── Avatar ──────────────────────────────────────────────────────────────────
const Avatar = memo(function Avatar({ name, photoUrl }: { name: string; photoUrl?: string }) {
  const customAvatar = useAppStore((s) => s.customAvatar)
  const avatarFrame  = useAppStore((s) => s.avatarFrame)
  const frameClass = getAvatarFrame(avatarFrame)?.cssClass ?? null
  const src = customAvatar ?? photoUrl
  const letter = name?.[0]?.toUpperCase() || 'F'
  const inner = src ? (
    <img src={src} alt={name} className="w-11 h-11 rounded-full object-cover border border-pline dashboard-avatar-ring" />
  ) : (
    <div className="w-11 h-11 rounded-full bg-gradient-to-br from-pblue to-ppurple flex items-center justify-center text-white font-bold text-lg dashboard-avatar-ring">
      {letter}
    </div>
  )
  return (
    <div className="relative flex-shrink-0">
      {/* #40: sotib olingan avatar ramkasi (CSS-only, avatar-frames config) */}
      {frameClass ? (
        <span className={`avatar-frame ${frameClass}`}>{inner}</span>
      ) : inner}
      <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-psuccess rounded-full border-[2.5px] border-pcanvas" />
    </div>
  )
})

// ── Top Bar / Greeting Header (v2 KIWI Premium) ─────────────────────────────
export const TopBar = memo(function TopBar({ user, displayName, level, onSettings, onProfile }: {
  user: ApiUser | null
  displayName: string | null
  level: number
  onSettings: () => void
  onProfile: () => void
}) {
  const lang = useAppStore((s) => s.settings.language)
  const tt = useT(lang)
  const coins = useAppStore((s) => s.coins)
  const navigate = useNavigate()
  const name = displayName ?? user?.firstName ?? tt('guestName')
  const subject = useSubjectStore((s) => s.subject)
  const [showSubjects, setShowSubjects] = useState(false)

  return (
    <>
      <div className="flex items-center justify-between px-5 pt-6 pb-4">
        <button onClick={onProfile} className="flex items-center gap-3 active:opacity-70 transition-opacity min-w-0">
          <Avatar name={name} photoUrl={user?.photoUrl} />
          <div className="text-left min-w-0">
            <p className="text-[12px] font-medium text-psubtle dashboard-topbar-subtle">{tt('greeting')},</p>
            <p className="text-[19px] font-bold leading-tight text-pfg dashboard-topbar-title tracking-tight truncate">{name}</p>
          </div>
        </button>
        <div className="flex items-center gap-2">
          {/* Fan pill — TopBar kompakt (Dashboard kartasi o'rniga) */}
          <button onClick={() => setShowSubjects(true)}
            className="dashboard-topbar-btn flex items-center gap-1.5 pl-2 pr-2.5 py-1.5 rounded-full text-[11px] font-semibold active:scale-95 transition-transform"
            style={{
              background: `${subject.color}18`,
              border: `1px solid ${subject.color}40`,
              color: subject.color,
            }}
            aria-label={tt('subjectSelect')}>
            <subject.icon size={12} />
            <span className="hidden xs:inline max-w-[72px] truncate">{subject.id.toUpperCase()}</span>
            <ChevronDown size={11} className="opacity-70" />
          </button>
          {/* Level */}
          <span className="dashboard-topbar-level flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[11px] font-semibold text-ppurple"
            style={{
              background: 'rgb(var(--p-purple-rgb) / 0.12)',
              border: '1px solid rgb(var(--p-purple-rgb) / 0.30)',
            }}>
            ✦ {level}
          </span>
          {/* Coins chip — do'konga olib boradi (#40) */}
          <button onClick={() => navigate('/shop')} aria-label={tt('shopAria')}
            className="dashboard-topbar-btn flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[11px] font-bold active:scale-95 transition-transform"
            style={{
              background: 'rgb(var(--p-gold-rgb) / 0.12)',
              border: '1px solid rgb(var(--p-gold-rgb) / 0.35)',
              color: 'var(--p-gold)',
            }}>
            <Coins size={12} fill="currentColor" />
            {coins >= 1000 ? `${(coins / 1000).toFixed(1).replace('.', ',')}k` : coins}
          </button>
          <button onClick={onSettings} aria-label="Sozlamalar"
            className="dashboard-topbar-settings w-9 h-9 sm:w-11 sm:h-11 rounded-2xl card-premium flex items-center justify-center text-pmuted hover:text-pfg transition-colors active:scale-95">
            <Settings size={18} />
          </button>
        </div>
      </div>
      {showSubjects && <SubjectSheet onClose={() => setShowSubjects(false)} />}
    </>
  )
})
