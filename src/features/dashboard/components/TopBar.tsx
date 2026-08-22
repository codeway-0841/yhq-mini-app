import { memo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronDown, Settings, Coins } from 'lucide-react'
import { useAppStore, type ApiUser } from '../../../shared/store/useAppStore'
import { useSubjectStore } from '../../../shared/store/useSubjectStore'
import { useT } from '../../../shared/i18n'
import SubjectSheet from '../../../shared/components/SubjectSheet'
import { getAvatarFrame } from '../../../shared/config/avatar-frames'
import { Button } from '../../../shared/components/ui/button'
import { cn } from '../../../shared/lib/cn'

// ── Avatar ──────────────────────────────────────────────────────────────────
// DIQQAT: bu avatar DOIRA bo'lib qoladi (ui/Avatar squircle emas) — sotib
// olinadigan ramka kosmetikasi (avatar-frames) doira halqa uchun chizilgan.
const Avatar = memo(function Avatar({ name, photoUrl }: { name: string; photoUrl?: string }) {
  const customAvatar = useAppStore((s) => s.customAvatar)
  const avatarFrame  = useAppStore((s) => s.avatarFrame)
  const frameClass = getAvatarFrame(avatarFrame)?.cssClass ?? null
  const src = customAvatar ?? photoUrl
  const letter = name?.[0]?.toUpperCase() || 'F'
  const inner = src ? (
    <img src={src} alt="" className="size-11 rounded-full border border-pline object-cover" />
  ) : (
    <div className="flex size-11 items-center justify-center rounded-full border border-pline bg-pwash text-lg font-bold text-pprimary">
      {letter}
    </div>
  )
  return (
    <div className="relative flex-shrink-0">
      {/* #40: sotib olingan avatar ramkasi (CSS-only, avatar-frames config) */}
      {frameClass ? (
        <span className={`avatar-frame ${frameClass}`}>{inner}</span>
      ) : inner}
      <span className="absolute -bottom-0.5 -right-0.5 size-3.5 rounded-full border-[2.5px] border-pcanvas bg-psuccess" />
    </div>
  )
})

/** Kichik chip — TopBar'dagi status/hisob ko'rsatkichlari uchun yagona shakl. */
const chipStyles = cn(
  'inline-flex h-8 items-center gap-1.5 rounded-control border px-2.5 text-[12px] font-semibold',
  'transition-[background-color,border-color,transform] duration-[120ms] ease-out',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pprimary focus-visible:ring-offset-2 focus-visible:ring-offset-pcanvas',
)

// ── Top Bar (v3 KIWI) ───────────────────────────────────────────────────────
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
      <div className="flex items-center justify-between gap-3 px-5 pb-4 pt-6">
        <button
          onClick={onProfile}
          className="flex min-w-0 items-center gap-3 rounded-control transition-opacity active:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pprimary focus-visible:ring-offset-2 focus-visible:ring-offset-pcanvas"
        >
          <Avatar name={name} photoUrl={user?.photoUrl} />
          <div className="min-w-0 text-left">
            <p className="text-[12px] font-medium text-psubtle">{tt('greeting')},</p>
            <p className="truncate font-display text-[19px] font-semibold leading-tight tracking-[-0.015em] text-pfg">
              {name}
            </p>
          </div>
        </button>

        <div className="flex flex-shrink-0 items-center gap-1.5">
          {/* Fan tanlash — kategoriya rangi ma'lumotdan keladi (subject.color) */}
          <button
            onClick={() => setShowSubjects(true)}
            className={cn(chipStyles, 'active:scale-[0.98]')}
            style={{
              background: `${subject.color}14`,
              borderColor: `${subject.color}38`,
              color: subject.color,
            }}
            aria-label={tt('subjectSelect')}
          >
            <subject.icon size={13} strokeWidth={1.75} />
            <span className="hidden max-w-[72px] truncate xs:inline">{subject.id.toUpperCase()}</span>
            <ChevronDown size={12} strokeWidth={1.75} className="opacity-70" />
          </button>

          {/* Daraja — glif (✦) o'rniga tabular raqam + qisqa yorliq */}
          <span
            className={cn(chipStyles, 'border-plineStrong bg-psurface text-pmuted')}
            aria-label={`${tt('level')} ${level}`}
          >
            <span className="text-[10px] uppercase tracking-[0.08em] text-psubtle">LVL</span>
            <span className="text-pfg">{level}</span>
          </span>

          {/* Tangalar — do'konga olib boradi (#40) */}
          <button
            onClick={() => navigate('/shop')}
            aria-label={tt('shopAria')}
            className={cn(
              chipStyles,
              'border-[rgb(var(--p-gold-rgb)/0.35)] bg-[rgb(var(--p-gold-rgb)/0.12)] text-pgold',
              'active:scale-[0.98]',
            )}
          >
            <Coins size={13} strokeWidth={1.75} />
            {coins >= 1000 ? `${(coins / 1000).toFixed(1).replace('.', ',')}k` : coins}
          </button>

          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onSettings}
            aria-label={tt('settingsTitle')}
            className="size-8"
          >
            <Settings strokeWidth={1.75} />
          </Button>
        </div>
      </div>
      {showSubjects && <SubjectSheet onClose={() => setShowSubjects(false)} />}
    </>
  )
})
