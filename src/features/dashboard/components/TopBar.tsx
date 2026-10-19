import { memo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Sun, Moon, ChevronDown, ChevronRight, ChartNoAxesColumn } from 'lucide-react'
import { useAppStore, type ApiUser } from '../../../shared/store/useAppStore'
import { avatarSrcFor } from '../../../shared/api'
import { useSubjectStore } from '../../../shared/store/useSubjectStore'
import { useT } from '../../../shared/i18n'
import { getAvatarFrame } from '../../../shared/config/avatar-frames'
import { transitionTheme } from '../../../shared/lib/theme-transition'
import { playSound } from '../../../shared/lib/sounds'
import { haptics } from '../../../platform/haptics'
import { useUpdateStore } from '../../../platform/version-check'
import UpdateSheet from '../../../shared/components/UpdateSheet'

// ── Person glifi ────────────────────────────────────────────────────────────
// IMG_0928.MOV (Expensa "Personal" qatori) dagi TO'LDIRILGAN odam ikonkasi.
// lucide `User` stroke-based — video ko'rinishi bilan mos kelmaydi, shuning
// uchun 24×24 to'ldirilgan profil qo'lda chizildi (bosh doira + yelka yoyi).
export const PersonGlyph = memo(function PersonGlyph({ size = 17 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
      <circle cx="12" cy="7.4" r="4.4" />
      <path d="M12 13.7c-4.3 0-7.7 2.7-7.7 6 0 .5.4.9.9.9h13.6c.5 0 .9-.4.9-.9 0-3.3-3.4-6-7.7-6Z" />
    </svg>
  )
})

// ── Avatar ──────────────────────────────────────────────────────────────────
// DIQQAT: avatar DOIRA bo'lib qoladi (ui/Avatar squircle emas) — sotib
// olinadigan ramka kosmetikasi (avatar-frames) doira halqa uchun chizilgan.
// O'lcham video bilan 1:1: 30px doira (qator balandligi 42).
const Avatar = memo(function Avatar({ photoUrl }: { photoUrl?: string }) {
  const customAvatar = useAppStore((s) => s.customAvatar)
  const avatarFrame  = useAppStore((s) => s.avatarFrame)
  const frameClass = getAvatarFrame(avatarFrame)?.cssClass ?? null
  const src = customAvatar ?? photoUrl
  const inner = (
    <span className="dash-top-avatar">
      {src ? <img src={src} alt="" className="size-full object-cover" /> : <PersonGlyph />}
    </span>
  )
  return (
    <span className="relative flex flex-shrink-0">
      {frameClass ? <span className={`avatar-frame ${frameClass}`}>{inner}</span> : inner}
    </span>
  )
})

// ── Top Bar (v4 — "Personal qatori", IMG_0928.MOV bilan 1:1) ────────────────
// Qator 4 elementdan iborat (video bilan bir xil tartib):
//   1) shaxs pill   — [ko'k avatar doirasi] + ism      → Profil
//   2) qiymat pill  — [nuqta] + fan nomi               → Fan tanlash
//   3) doira        — ustunli grafik (analytics)       → Statistika
//   4) doira        — quyosh/oy                        → Tema almashtirish
// Statistika ataylab tanga o'rnida: u ilovada eng chuqur yashiringan
// ekran edi (faqat Profil orqali, Dynamic Island o'chirilgan), tanga/do'kon
// esa Profil'dan ochiladi va kundalik o'quv loop'iga kirmaydi.
// O'lchovlar: balandlik 42 · avatar 30 · doira ichidagi ikonka 18–19 ·
// chekka padding 16 · o'ng guruh oralig'i 14 (index.css: .dash-top-*).
export const TopBar = memo(function TopBar({ user, displayName, onSettings: _onSettings, onProfile, onSubjects }: {
  user: ApiUser | null
  displayName: string | null
  onSubjects: () => void
  onSettings?: () => void
  onProfile: () => void
}) {
  const navigate = useNavigate()
  const lang = useAppStore((s) => s.settings.language)
  const tt = useT(lang)
  const subject = useSubjectStore((s) => s.subject)
  const theme = useAppStore((s) => s.settings.theme)
  const name = displayName ?? user?.firstName ?? tt('guestName')
  const subjectName = lang === 'ru' ? subject.nameRu : subject.name

  // Dark / Light rejimini bir bosishda silliq aylanma ochilish (circular reveal) bilan almashtirish
  const toggleTheme = (e: React.MouseEvent<HTMLButtonElement>) => {
    playSound('toggle')
    haptics.impact('light')
    const rect = e.currentTarget?.getBoundingClientRect()
    const coords = rect
      ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
      : { x: e.clientX, y: e.clientY }
    // Focus halqasi bosgandan keyin yopishib qolmasligi uchun (videodagi ko'k border)
    e.currentTarget?.blur?.()
    // Hozirgi ekrandagi haqiqiy holatdan kelib chiqib aniq almashtirish
    const currentIsDark = typeof document !== 'undefined'
      ? document.body.dataset.theme !== 'light'
      : theme !== 'light'
    const next = currentIsDark ? 'light' : 'dark'
    void transitionTheme(next, coords)
  }

  const isDark = theme === 'light' ? false : (theme === 'dark' ? true : (typeof document !== 'undefined' ? document.body.dataset.theme !== 'light' : true))

  // Soft update holati (agar yangilanish bo'lsa, fan pill'i o'rnida chiqadi)
  const [showUpdateSheet, setShowUpdateSheet] = useState(false)
  const updateStatus = useUpdateStore((s) => s.status)
  const updateInfo = useUpdateStore((s) => s.info)
  const updateDismissed = useUpdateStore((s) => s.dismissed)
  const dismissUpdate = useUpdateStore((s) => s.dismiss)

  const hasSoftUpdate = updateStatus === 'soft' && !updateDismissed && Boolean(updateInfo)

  return (
    <header className="sticky top-0 z-30 -mt-[var(--safe-top-body,0px)] pt-[var(--safe-top,0px)] page-header mb-3 lg:static lg:mt-0 lg:pt-3 lg:bg-transparent lg:backdrop-blur-none lg:[-webkit-backdrop-filter:none] lg:border-none lg:shadow-none">
      <div className="flex items-center gap-2.5 px-4 py-2">
        {/* 1 — Shaxs pill: ko'k avatar doirasi + ism (video: odam ikonkasi + "Personal") */}
        <button
          type="button"
          onClick={onProfile}
          aria-label={`${tt('profile')}: ${name}`}
          className="dash-top-pill dash-top-press max-w-[112px] shrink-0 gap-2.5 overflow-hidden xs:max-w-[136px] pr-3.5 pl-1.5 lg:hidden"
        >
          <Avatar photoUrl={avatarSrcFor(user) ?? undefined} />
          <span className="min-w-0 truncate text-[15px] font-semibold leading-none tracking-[-0.01em] text-pfg">
            {name}
          </span>
        </button>

        {/* 2 — Qiymat pill: fan (video: bayroq + balans) yoki yangilanish */}
        {hasSoftUpdate && updateInfo ? (
          <button
            type="button"
            onClick={() => {
              playSound('click')
              haptics.impact('light')
              setShowUpdateSheet(true)
            }}
            className="dash-top-pill dash-top-press min-w-0 flex-1 gap-2 px-3.5 lg:max-w-[320px]"
          >
            <span className="relative flex size-2.5 shrink-0">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-500 opacity-75" />
              <span className="relative inline-flex size-2.5 rounded-full bg-blue-500" />
            </span>
            <span className="truncate text-[14px] font-semibold leading-none tracking-[-0.01em] text-pfg">
              {lang === 'ru' ? 'Доступно обновление' : 'Yangi versiya mavjud'}
            </span>
            <ChevronRight size={15} className="shrink-0 text-pmuted" aria-hidden="true" />
          </button>
        ) : (
          <button
            type="button"
            onClick={onSubjects}
            aria-label={`${tt('subjectSelect')}: ${subjectName}`}
            className="dash-top-pill dash-top-press min-w-0 flex-1 gap-2 pr-2.5 pl-3.5 lg:max-w-[320px]"
          >
            <span
              aria-hidden="true"
              className="size-2.5 shrink-0 rounded-full shadow-2xs"
              style={{ backgroundImage: `linear-gradient(135deg, ${subject.color}, ${subject.colorDark})` }}
            />
            <span className="truncate text-[14px] font-semibold leading-none tracking-[-0.01em] text-pfg">
              {subjectName}
            </span>
            <ChevronDown size={15} className="shrink-0 text-pmuted" aria-hidden="true" />
          </button>
        )}

        {/* 3–4 — O'ng guruh: ikkita shisha doira (video bilan bir xil o'lcham) */}
        <div className="ml-auto flex shrink-0 items-center gap-3.5">
          {/* 3 — Analitika (video: bars ikonkasi) → Statistika */}
          <button
            type="button"
            onClick={() => { playSound('click'); haptics.impact('light'); navigate('/statistika') }}
            aria-label={tt('statsTitle')}
            className="dash-top-circle dash-top-press"
          >
            <ChartNoAxesColumn size={19} strokeWidth={2.2} />
          </button>

          <button
            type="button"
            onClick={toggleTheme}
            aria-label={isDark ? 'Light mode' : 'Dark mode'}
            className="dash-top-circle dash-top-press"
          >
            {isDark ? <Moon size={19} strokeWidth={2} /> : <Sun size={19} strokeWidth={2} />}
          </button>
        </div>
      </div>

      {showUpdateSheet && updateInfo && (
        <UpdateSheet
          isOpen={showUpdateSheet}
          info={updateInfo}
          lang={lang}
          onClose={() => setShowUpdateSheet(false)}
          onDismiss={() => {
            dismissUpdate()
            setShowUpdateSheet(false)
          }}
        />
      )}
    </header>
  )
})
