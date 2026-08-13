import { memo, useState } from 'react'
import { ChevronDown, Settings } from 'lucide-react'
import { useAppStore, type ApiUser } from '../../../shared/store/useAppStore'
import { useSubjectStore } from '../../../shared/store/useSubjectStore'
import { useT } from '../../../shared/i18n'
import SubjectSheet from '../../../shared/components/SubjectSheet'

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
export const TopBar = memo(function TopBar({ user, displayName, level, onSettings, onProfile }: {
  user: ApiUser | null
  displayName: string | null
  level: number
  onSettings: () => void
  onProfile: () => void
}) {
  const lang = useAppStore((s) => s.settings.language)
  const tt = useT(lang)
  const name = displayName ?? user?.firstName ?? tt('guestName')
  const subject = useSubjectStore((s) => s.subject)
  const [showSubjects, setShowSubjects] = useState(false)

  return (
    <>
      <div className="flex items-center justify-between px-5 pt-6 pb-4">
        <button onClick={onProfile} className="flex items-center gap-3 active:opacity-70 transition-opacity min-w-0">
          <Avatar name={name} photoUrl={user?.photoUrl} />
          <div className="text-left min-w-0">
            <p className="text-[12px] font-medium text-psubtle">{tt('greeting')},</p>
            <p className="text-[19px] font-bold leading-tight text-pfg tracking-tight truncate">{name}</p>
          </div>
        </button>
        <div className="flex items-center gap-2">
          {/* Fan pill — TopBar kompakt (Dashboard kartasi o'rniga) */}
          <button onClick={() => setShowSubjects(true)}
            className="flex items-center gap-1.5 pl-2 pr-2.5 py-1.5 rounded-full text-[11px] font-semibold active:scale-95 transition-transform"
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
          <span className="flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[11px] font-semibold text-ppurple"
            style={{
              background: 'rgb(var(--p-purple-rgb) / 0.12)',
              border: '1px solid rgb(var(--p-purple-rgb) / 0.30)',
            }}>
            ✦ {level}
          </span>
          <button onClick={onSettings} aria-label="Sozlamalar"
            className="w-9 h-9 sm:w-11 sm:h-11 rounded-2xl card-premium flex items-center justify-center text-pmuted hover:text-pfg transition-colors active:scale-95">
            <Settings size={18} />
          </button>
        </div>
      </div>
      {showSubjects && <SubjectSheet onClose={() => setShowSubjects(false)} />}
    </>
  )
})
