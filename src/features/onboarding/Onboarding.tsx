import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Check, Send, Sparkles, BookOpen, Zap, Trophy } from 'lucide-react'
import { SUBJECTS } from '../../shared/config/subjects'
import { useSubjectStore } from '../../shared/store/useSubjectStore'
import { useAppStore } from '../../shared/store/useAppStore'
import { useT, type Keys } from '../../shared/i18n'
import { getTelegramUser } from '../../platform/telegram'
import { TelegramLoginPanel } from '../auth'
import { SegmentedProgressPill } from './components/SegmentedProgressPill'
import { FeatureBenefitCard } from './components/FeatureBenefitCard'
import { SyncScreen } from './components/SyncScreen'
import { OnboardingBackground } from './components/OnboardingBackground'

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ONBOARDING — IMG_0928.MOV bilan 1:1 (kadrma-kadr o'lchangan taymline)
 *
 * Video (384×832 kadr, 91.6s) — animatsiya taymline'i:
 *   9.55  welcome paydo bo'ladi — elementlar navbat bilan blur-in
 *         logo 9.70 · sarlavha 10.00 · izoh 10.10 · qatorlar 10.25/10.40/
 *         10.50/10.65 · tugma 10.95
 *   12.15–12.45  butun kontent blurlanib so'nadi
 *   13.0  loading: spinner + "Looking for your data..." (18.5 gacha turadi)
 *   18.6–19.1  keyingi ekran blur-in bilan kiradi
 *
 * BOSQICHLAR TARTIBI (2026-10): welcome → fan → Telegram kirish → LOADING →
 * ilova. Ya'ni video'dagi loading ekrani oxiriga ko'chirildi: ma'lumotlar
 * login'dan keyin yuklanadi va shundan keyingina ilova ochiladi.
 *
 * Har bir vaqt CSS (index.css: .ob-reveal / .ob-hide) va shu fayldagi
 * OB_TIMING orqali boshqariladi — ikkalasi birga o'zgartirilishi kerak.
 * ═══════════════════════════════════════════════════════════════════════════
 */
export const OB_TIMING = {
  /** Bitta elementning blur-in davomiyligi (CSS .ob-reveal bilan bir xil) */
  reveal: 460,
  /** Blur-out davomiyligi (CSS .ob-hide bilan bir xil) */
  exit: 300,
  /** Yakuniy LOADING ekrani ushlab turiladigan vaqt (video: 13.0 → 18.6) */
  syncHold: 5400,
  /** Yakuniy CTA bosilgach chiqish animatsiyasi boshlanishigacha (press feedback) */
  finish: 120,
  welcome: {
    logo: 0,
    title: 260,
    sub: 360,
    cardFirst: 500,
    cardStep: 120,
    button: 1160,
  },
  picker: {
    title: 0,
    sub: 60,
    card: 130,
    /** Birlamchi CTA */
    cta: 270,
  },
} as const

type Stage = 'welcome' | 'sync' | 'subject' | 'telegram'
type Phase = 'enter' | 'exit'

const isUnitTest =
  typeof process !== 'undefined' &&
  Boolean(process.env?.VITEST || process.env?.NODE_ENV === 'test') &&
  typeof window !== 'undefined' &&
  Boolean(window.navigator?.userAgent?.includes('jsdom'))

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}

/** CSS maxsus xususiyat bilan reveal kechikishi */
function reveal(delayMs: number): CSSProperties {
  return { '--ob-delay': `${delayMs}ms` } as CSSProperties
}

const FEATURES: ReadonlyArray<{ key: Keys; icon: LucideIcon; color: string }> = [
  { key: 'obFeatAiTitle', icon: Sparkles, color: 'text-[#FFB74D]' },
  { key: 'obFeatBankTitle', icon: BookOpen, color: 'text-[#7CC8FF]' },
  { key: 'obFeatOfflineTitle', icon: Zap, color: 'text-[#CDA6FF]' },
  { key: 'obFeatCommunityTitle', icon: Trophy, color: 'text-[#FF9AAE]' },
]

// ══════════════════════ 1. WELCOME (video 9.55 – 12.15) ══════════════════════
function WelcomeStep({ onNext, instant }: { onNext: () => void; instant: boolean }) {
  const lang = useAppStore((s) => s.settings.language)
  const tt = useT(lang)
  const T = OB_TIMING.welcome
  const d = (ms: number) => reveal(instant ? 0 : ms)

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Qadam indikatori — video: y≈70px, 67×21 kapsula */}
      <header className="mt-3 flex h-11 shrink-0 items-center">
        <SegmentedProgressPill active={0} />
      </header>

      {/* Video: kapsula→logo oralig'i 88px. Ortiqcha bo'shliq FAQAT shu yerda
          to'planadi — qatorlar va CTA orasidagi masofa hech qachon o'zgarmaydi
          (video bilan bir xil 34px). */}
      <div className="min-h-0 flex-1" aria-hidden="true" />

      {/* Brend belgisi — oq monogramma 46px, MUZLATILGAN (video: suzmaydi) +
          ochilishdagi "KIVVI" yozuvi (video 9.2-9.9s: yozuv so'nib ketadi) */}
      <div className="ob-reveal relative flex shrink-0 flex-col items-center lg:hidden" style={d(T.logo)}>
        <picture className="flex items-center justify-center">
          <source srcSet="/images/splash-mark.webp" type="image/webp" />
          <img
            src="/images/splash-mark.png"
            alt="KIVVI"
            width={46}
            height={46}
            decoding="async"
            className="size-[46px] object-contain drop-shadow-[0_6px_18px_rgba(10,132,255,0.4)]"
          />
        </picture>
        <span className="brand-wordmark select-none" aria-hidden="true">
          KIVVI
        </span>
      </div>

      {/* Sarlavha — 2 qator, 40px/42px, markazda (video: y≈288–372) */}
      <h1
        className="ob-reveal mt-[clamp(16px,6.4vh,51px)] shrink-0 text-center text-[clamp(26px,10.25vw,42px)] font-bold leading-[1.05] tracking-[-0.022em] text-white"
        style={d(T.title)}
      >
        {tt('obWelcomeA')} {tt('obWelcomeB')}
        <br />
        {tt('obHeroLine2')}
      </h1>

      <p
        className="ob-reveal mt-[clamp(10px,3.5vh,28px)] shrink-0 text-center text-[16px] leading-[22px] text-white/70"
        style={d(T.sub)}
      >
        {tt('obWelcomeSub')}
      </p>

      {/* 4 ta afzallik qatori — har biri alohida blur-in (video 10.25–10.75) */}
      <div className="mt-[clamp(12px,3.8vh,30px)] grid shrink-0 grid-cols-1 gap-[9px] lg:grid-cols-1">
        {FEATURES.map((f, i) => (
          <div key={f.key} className="ob-reveal" style={d(T.cardFirst + i * T.cardStep)}>
            <FeatureBenefitCard
              icon={f.icon}
              iconColor={f.color}
              title={tt(f.key)}
            />
          </div>
        ))}
      </div>

      {/* Video: qatorlar→CTA oralig'i QAT'IY 34px */}
      <div
        className="ob-reveal shrink-0 pt-[34px] pb-[calc(25px+var(--safe-bottom,0px))]"
        style={d(T.button)}
      >
        <button
          type="button"
          onClick={onNext}
          className="flex h-[54px] w-full items-center justify-center rounded-full bg-white px-5 text-[17px] font-semibold text-black transition-transform duration-150 active:scale-[0.97] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
        >
          {tt('obStart')}
        </button>
      </div>
    </div>
  )
}

// ══════════════════ 2. FAN TANLASH (video 18.6 – 20.8) ═════════════════════
function SubjectStep({
  onNext,
  onBack,
  instant,
}: {
  onNext: () => void
  onBack: () => void
  instant: boolean
}) {
  const lang = useAppStore((s) => s.settings.language)
  const tt = useT(lang)
  const { subjectId, setSubject } = useSubjectStore()
  const [picked, setPicked] = useState(subjectId)
  const T = OB_TIMING.picker
  const d = (ms: number) => reveal(instant ? 0 : ms)

  const handleSelect = (id: string) => {
    setPicked(id)
    setSubject(id)
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="mt-3 flex h-11 shrink-0 items-center">
        <SegmentedProgressPill active={1} onBack={onBack} backLabel={tt('obBack')} />
      </header>

      <h2
        className="ob-reveal mt-[clamp(16px,5.2vh,40px)] shrink-0 text-center text-[19px] font-semibold leading-[23px] tracking-[-0.015em] text-white"
        style={d(T.title)}
      >
        {tt('obSubjectTitle')}
      </h2>

      {/* Fanlar — 2 USTUNLI grid (tile): tanlov shu ekranda, modal YO'Q.
          Izoh matni olib tashlandi (2026-10) — sarlavha o'zi yetarli. */}
      <div
        className="ob-reveal mt-[clamp(16px,3vh,26px)] min-h-0 flex-1"
        style={d(T.card)}
      >
        <div
          role="radiogroup"
          aria-label={tt('obSubjectTitle')}
          className="ob-list-scroll grid h-full grid-cols-2 content-start gap-[8px] overflow-y-auto overscroll-contain px-[7px] pb-3"
        >
          {SUBJECTS.map((s) => {
            const active = picked === s.id
            const name = lang === 'ru' ? s.nameRu : s.name
            return (
              <button
                key={s.id}
                type="button"
                role="radio"
                aria-checked={active}
                aria-label={name}
                disabled={!s.available}
                onClick={() => s.available && handleSelect(s.id)}
                className={`relative flex h-[56px] shrink-0 items-center justify-center rounded-2xl px-3 text-center transition-[background-color,transform] duration-150 ${
                  !s.available
                    ? 'cursor-not-allowed bg-white/[0.05] opacity-40'
                    : active
                      ? 'bg-white/[0.22] cursor-pointer'
                      : 'bg-white/[0.07] cursor-pointer hover:bg-white/[0.12] active:scale-[0.98]'
                }`}
              >
                {/* Ikonka (logo) YO'Q — nom; tanlanganda nom oldida yashil "pitechka".
                    Badge burchakda EMAS: highlight bilan ustma-ust tushmasin. */}
                <span className="flex items-center justify-center gap-1.5">
                  {active && (
                    <Check size={13} strokeWidth={3.4} className="shrink-0 text-[#34C759]" />
                  )}
                  <span className="line-clamp-2 text-[13.5px] font-semibold leading-[17px] tracking-[-0.01em] text-white">
                    {name}
                  </span>
                </span>

                {!s.available && (
                  <span className="absolute bottom-1 text-[10px] font-semibold uppercase tracking-wide text-white/55">
                    {lang === 'ru' ? 'Скоро' : 'Tez kunda'}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      <div className="ob-reveal shrink-0 pt-2 pb-[calc(25px+var(--safe-bottom,0px))]" style={d(T.cta)}>
        <button
          type="button"
          onClick={onNext}
          className="flex h-[54px] w-full items-center justify-center rounded-full bg-white px-5 text-[17px] font-semibold text-black transition-transform duration-150 active:scale-[0.97] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
        >
          {tt('obContinue')}
        </button>
      </div>
    </div>
  )
}

// ═════════════ 3. TELEGRAM ORQALI KIRISH (login bosqichi) ══════════════════
function TelegramStep({
  onBack,
  onDone,
  authed,
  instant,
}: {
  onBack: () => void
  onDone: () => void
  authed: boolean
  instant: boolean
}) {
  const lang = useAppStore((s) => s.settings.language)
  const tt = useT(lang)
  const user = useAppStore((s) => s.user)
  const tgUser = getTelegramUser()
  const T = OB_TIMING.picker
  const d = (ms: number) => reveal(instant ? 0 : ms)

  const displayName =
    [user?.firstName, user?.lastName].filter(Boolean).join(' ') || tgUser?.first_name || ''
  const username = user?.username || tgUser?.username || ''
  const photoUrl = user?.photoUrl || tgUser?.photo_url || ''
  const initial = (displayName || username || 'K').charAt(0).toUpperCase()

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="mt-3 flex h-11 shrink-0 items-center">
        <SegmentedProgressPill active={2} onBack={onBack} backLabel={tt('obBack')} />
      </header>

      <h2
        className="ob-reveal mt-[clamp(16px,5.2vh,40px)] shrink-0 text-center text-[19px] font-semibold leading-[23px] tracking-[-0.015em] text-white"
        style={d(T.title)}
      >
        {tt('obTgTitle')}
      </h2>
      <p
        className="ob-reveal mx-auto mt-1.5 shrink-0 max-w-[290px] text-center text-[13.5px] leading-[18px] text-white/65"
        style={d(T.sub)}
      >
        {tt('obTgSubA')}
        <br />
        {tt('obTgSubB')}
      </p>

      {/* Akkaunt kartasi — video 3-ekran geometriyasi: avatar 74px, ism 17px, kapsula */}
      <div className="flex min-h-0 flex-1 items-center justify-center py-4">
        <div className="ob-reveal w-full" style={d(T.card)}>
          <div className="flex w-full flex-col items-center rounded-2xl bg-white/[0.08] pt-4 pb-[22px]">
            {photoUrl ? (
              <img
                src={photoUrl}
                alt=""
                className="size-[66px] rounded-full object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div
                className={`flex size-[66px] items-center justify-center rounded-full text-[25px] font-semibold leading-none text-white ${
                  authed ? 'bg-[#229ED9]' : 'bg-white/[0.14]'
                }`}
              >
                {authed ? initial : <Send size={26} strokeWidth={2} className="text-white/70" />}
              </div>
            )}

            <p className="mt-4 max-w-[calc(100%-32px)] truncate text-[16px] font-semibold leading-[22px] tracking-[-0.01em] text-white">
              {authed ? displayName || username || tt('obTgAccount') : tt('obTgAccount')}
            </p>
            {username && (
              <p className="max-w-[calc(100%-32px)] truncate text-[13px] leading-[17px] text-white/70">
                @{username}
              </p>
            )}

            <div className="mt-2.5 flex h-[26px] items-center gap-1.5 rounded-full bg-black/25 px-2.5">
              <span
                className={`size-[7px] rounded-full ${authed ? 'bg-[#34C759]' : 'bg-white/40'}`}
              />
              <span className="text-[13px] font-medium leading-none text-white/90">
                {authed ? tt('obTgConnected') : tt('obTgNotConnected')}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div
        className="ob-reveal flex shrink-0 flex-col gap-[9px] pt-2 pb-[calc(25px+var(--safe-bottom,0px))]"
        style={d(T.cta)}
      >
        {authed ? (
          <button
            type="button"
            onClick={onDone}
            className="flex h-[54px] w-full items-center justify-center rounded-full bg-white px-5 text-[17px] font-semibold text-black transition-transform duration-150 active:scale-[0.97] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
          >
            {tt('obStart')}
          </button>
        ) : (
          <>
            <TelegramLoginPanel onAuthed={onDone} />
            <button
              type="button"
              onClick={onDone}
              className="flex h-[54px] w-full items-center justify-center rounded-full bg-white/[0.1] px-5 text-[17px] font-semibold text-white transition-transform duration-150 active:scale-[0.97] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
            >
              {tt('obTgOther')}
            </button>
          </>
        )}
      </div>
    </div>
  )
}

// ══════════════════════ ONBOARDING ORKESTRATORI ═════════════════════════════
export default function Onboarding({ onDone, authed = false }: { onDone: () => void; authed?: boolean }) {
  const lang = useAppStore((s) => s.settings.language)
  const tt = useT(lang)
  const instant = useMemo(() => isUnitTest || prefersReducedMotion(), [])
  const [stage, setStage] = useState<Stage>('welcome')
  const [phase, setPhase] = useState<Phase>('enter')
  const timers = useRef<number[]>([])
  const busy = useRef(false)

  const schedule = useCallback((fn: () => void, delay: number) => {
    if (typeof window === 'undefined') return
    const id = window.setTimeout(fn, delay)
    timers.current.push(id)
  }, [])

  // Unmount'da hamma taymer tozalanadi (onDone chaqirilmaydi)
  useEffect(
    () => () => {
      timers.current.forEach((id) => window.clearTimeout(id))
      timers.current = []
    },
    [],
  )

  /** Blur-out → blur-in ketma-ketligi (video: 300ms chiqish + kirish stagger) */
  const go = useCallback(
    (next: Stage) => {
      if (busy.current) return
      if (instant) {
        setStage(next)
        setPhase('enter')
        return
      }
      busy.current = true
      setPhase('exit')
      schedule(() => {
        setStage(next)
        setPhase('enter')
        busy.current = false
      }, OB_TIMING.exit)
    },
    [instant, schedule],
  )

  const finish = useCallback(() => {
    if (instant) {
      onDone()
      return
    }
    // Chiqish animatsiyasi (blur-out) → app
    schedule(() => {
      setPhase('exit')
      schedule(() => onDone(), OB_TIMING.exit)
    }, OB_TIMING.finish)
  }, [instant, onDone, schedule])

  // Sync endi OXIRGI qadam (login'dan keyin): ma'lumotlar yuklanadi va
  // shundan keyingina ilova ochiladi. Video'da u o'rtada edi (13.0 → 18.6).
  useEffect(() => {
    if (stage !== 'sync') return
    const id = window.setTimeout(() => finish(), instant ? 0 : OB_TIMING.syncHold)
    return () => window.clearTimeout(id)
  }, [stage, instant, finish])

  const handleStart = () => go('subject')

  return (
    <main className="first-launch-screen relative flex select-none flex-col overflow-hidden bg-[#04123F] text-white">
      <OnboardingBackground
        dim={stage === 'sync'}
        grid={stage === 'welcome' || stage === 'sync'}
      />

      <div
        className="ob-stage relative z-10 mx-auto flex h-full w-full flex-col px-5 lg:my-auto lg:grid lg:h-[min(100%,880px)] lg:max-w-[1080px] lg:grid-cols-[minmax(0,1fr)_minmax(0,440px)] lg:gap-16 lg:px-10"
        data-phase={phase}
      >
        {/* Desktop brend paneli — mobil'da YO'Q (faqat lg+).
            Tuzilma: lockup (yuqori) → statement (markaz) → meta (past). */}
        <aside className="hidden flex-col justify-between py-14 lg:flex">
          {/* Lockup — faqat belgi (yozuvsiz, dekorativ) */}
          <img
            src="/images/splash-mark.png"
            alt=""
            aria-hidden="true"
            className="size-[44px] object-contain drop-shadow-[0_6px_20px_rgba(10,132,255,0.4)]"
          />

          <div className="max-w-[400px]">
            <span aria-hidden="true" className="block h-px w-10 bg-white/30" />
            <h2 className="mt-6 text-[clamp(26px,2.2vw,34px)] font-semibold leading-[1.16] tracking-[-0.03em] text-white">
              {tt('obBrandHeadline')}
            </h2>
            <p className="mt-4 text-[14.5px] leading-[22px] text-white/55">
              {tt('obWelcomeSub')}
            </p>
          </div>

          <p className="text-[11px] font-medium tracking-[0.18em] text-white/25">
            {tt('obBrandMeta')}
          </p>
        </aside>

        {/* Qadamlar ustuni — mobil bilan bir xil oqim */}
        <div className="flex min-h-0 w-full flex-1 flex-col">
          {stage === 'welcome' && <WelcomeStep onNext={handleStart} instant={instant} />}
          {stage === 'subject' && (
            <SubjectStep
              onNext={() => go('telegram')}
              onBack={() => go('welcome')}
              instant={instant}
            />
          )}
          {stage === 'telegram' && (
            <TelegramStep
              onBack={() => go('subject')}
              onDone={() => go('sync')}
              authed={authed}
              instant={instant}
            />
          )}
          {/* Loading — OXIRGI qadam: login'dan keyin, ilova ochilishidan oldin */}
          {stage === 'sync' && <SyncScreen instant={instant} />}
        </div>
      </div>
    </main>
  )
}
