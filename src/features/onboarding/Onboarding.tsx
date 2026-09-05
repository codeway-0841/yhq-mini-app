import { useState } from 'react'
import {
  ChevronRight, ChevronLeft, Check, Clock3, Rocket,
} from 'lucide-react'
import { SUBJECTS } from '../../shared/config/subjects'
import { useSubjectStore } from '../../shared/store/useSubjectStore'
import { useAppStore } from '../../shared/store/useAppStore'

// ── Qadam indikatorlari ─────────────────────────────────────────────────────
function Dots({ active }: { active: number }) {
  return (
    <div aria-hidden="true" className="flex h-3 shrink-0 items-center justify-center gap-2">
      {[0, 1, 2].map((i) => (
        <span key={i} className={`rounded-full transition-all duration-300 ${
          i === active ? 'w-6 h-2.5 bg-pprimary' : 'w-2.5 h-2.5 bg-plineStrong'
        }`} />
      ))}
    </div>
  )
}

// ── Umumiy ekran o'rashi ────────────────────────────────────────────────────
function Screen({ children }: { children: React.ReactNode }) {
  return (
    <main className="first-launch-screen flex flex-col overflow-hidden bg-pcanvas"
      style={{ background: 'linear-gradient(180deg, var(--p-canvas) 0%, var(--p-surface) 100%)' }}>
      <div className="mx-auto flex min-h-0 w-full max-w-md flex-1 flex-col px-5 pt-[clamp(1rem,5dvh,3.5rem)] pb-[calc(1rem+var(--safe-bottom,0px))] sm:px-6">
        {children}
      </div>
    </main>
  )
}

function GreenTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-[26px] font-semibold text-pfg text-center leading-tight">{children}</h2>
}
function Sub({ children }: { children: React.ReactNode }) {
  return <p className="text-[13px] font-semibold text-center mt-2" style={{ color: 'var(--p-subtle)' }}>{children}</p>
}
function BigButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-pprimary px-4 py-3 text-base font-semibold text-ponprimary shadow-md transition-[transform,background-color,filter] duration-150 hover:brightness-[1.06] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pprimary focus-visible:ring-offset-2 focus-visible:ring-offset-pcanvas">
      {label}
      <ChevronRight size={20} strokeWidth={3} />
    </button>
  )
}

// ══════════════════════ 1. XUSH KELIBSIZ ════════════════════════════════════
function WelcomeStep({ onNext }: { onNext: () => void }) {
  return (
    <Screen>
      <div className="shrink-0 pt-[clamp(0rem,2dvh,1.5rem)]">
        <GreenTitle>Xush <span className="text-pprimary">kelibsiz!</span></GreenTitle>
        <Sub>Barcha fanlarni bitta ilovada o'rganing va test yeching.</Sub>
      </div>

      {/* Brend illutsiyasi — splash bilan bir xil (glow'siz, toza) */}
      <div className="relative my-3 flex min-h-0 flex-1 items-center justify-center">
        <picture className="flex max-h-full items-center justify-center">
          <source srcSet="/images/splash-brand.webp" type="image/webp" />
          <img
            src="/images/splash-brand.png"
            alt="KIVVI"
            width={290}
            height={290}
            decoding="async"
            className="h-auto w-[min(72vw,260px)] max-h-[min(42dvh,100%)] rounded-3xl object-contain shadow-lg motion-safe:animate-fadeIn"
          />
        </picture>
      </div>

      <div className="shrink-0 pt-2">
        <BigButton label="Boshlash" onClick={onNext} />
        <div className="mt-4"><Dots active={0} /></div>
      </div>
    </Screen>
  )
}

// ══════════════════════ 2. FAN TANLASH ══════════════════════════════════════
function SubjectStep({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
  const lang = useAppStore((s) => s.settings.language)
  const { subjectId, setSubject } = useSubjectStore()
  const [picked, setPicked] = useState<string[]>([subjectId])

  const toggle = (id: string, available: boolean) => {
    if (!available) return // kelajak fanlar — hozircha tanlab bo'lmaydi
    setPicked([id]) // hozircha bitta fan — kelajakda multi-select kengaytiriladi
  }

  return (
    <Screen>
      <button type="button" onClick={onBack} aria-label="Orqaga"
        className="flex size-11 shrink-0 items-center justify-center self-start rounded-xl text-pmuted transition-colors hover:bg-pcard hover:text-pfg active:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pprimary">
        <ChevronLeft size={24} />
      </button>
      <div className="mb-[clamp(0.75rem,3dvh,1.5rem)] mt-1 shrink-0">
        <GreenTitle>Qaysi <span className="text-pprimary">fanni</span><br />o'rganmoqchisiz?</GreenTitle>
        <Sub>{lang === 'ru' ? 'Выберите основной предмет' : 'Bitta asosiy faningizni tanlang'}</Sub>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overscroll-contain pr-1">
        {SUBJECTS.map((s) => {
          const active = picked.includes(s.id)
          const Icon = s.icon
          return (
            <button key={s.id} type="button" onClick={() => toggle(s.id, s.available)}
              disabled={!s.available}
              aria-pressed={active && s.available}
              className={`flex items-center gap-3.5 w-full rounded-2xl p-3.5 text-left transition-all active:scale-[0.98] shadow-xs ${
                !s.available ? 'cursor-not-allowed opacity-55' : ''
              } ${
                active ? 'scale-[1.01]' : 'bg-pcard hover:bg-psurface'
              }`}
              style={active ? {
                backgroundColor: `${s.color}16`,
                boxShadow: `inset 0 0 0 1.5px ${s.color}60, 0 4px 14px ${s.color}20`
              } : undefined}>
              <div
                className="flex size-10 items-center justify-center rounded-xl shrink-0 transition-transform shadow-2xs"
                style={{
                  backgroundColor: active ? s.color : `${s.color}18`,
                  color: active ? '#ffffff' : s.color
                }}
              >
                <Icon size={20} strokeWidth={active ? 2.5 : 2} />
              </div>
              <span
                className={`flex-1 text-[15px] truncate ${active ? 'font-bold' : 'font-semibold text-pfg'}`}
                style={active ? { color: s.color } : undefined}
              >
                {lang === 'ru' ? s.nameRu : s.name}
              </span>
              {!s.available && (
                <span className="text-[10px] font-semibold uppercase tracking-wide text-psubtle flex-none">
                  {lang === 'ru' ? 'Скоро' : 'Tez kunda'}
                </span>
              )}
              {active && s.available && (
                <span
                  className="size-7 rounded-xl flex items-center justify-center flex-none shadow-xs text-white"
                  style={{ backgroundColor: s.color }}
                >
                  <Check size={16} strokeWidth={3.2} />
                </span>
              )}
            </button>
          )
        })}
      </div>

      <div className="shrink-0 pt-3">
        <BigButton label="Davom etish" onClick={() => { setSubject(picked[0] ?? 'yhq'); onNext() }} />
        <div className="mt-4"><Dots active={1} /></div>
      </div>
    </Screen>
  )
}

// ══════════════════════ 3. MAQSAD TANLASH ═══════════════════════════════════
const GOALS = [
  { id: '15',  label: '15 daqiqa', desc: 'Yengil rejim',   color: 'var(--p-blue)' },
  { id: '30',  label: '30 daqiqa', desc: 'O\u2019rtacha rejim', color: 'var(--p-success)' },
  { id: '60',  label: '1 soat',    desc: 'Samarali rejim', color: 'var(--p-purple)' },
  { id: '120', label: '2 soat +',  desc: 'Intensiv rejim', color: 'var(--p-warning)' },
]

function GoalStep({ onDone, onBack }: { onDone: (goal: string) => void; onBack: () => void }) {
  const [goal, setGoal] = useState('30')

  return (
    <Screen>
      <button type="button" onClick={onBack} aria-label="Orqaga"
        className="flex size-11 shrink-0 items-center justify-center self-start rounded-xl text-pmuted transition-colors hover:bg-pcard hover:text-pfg active:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pprimary">
        <ChevronLeft size={24} />
      </button>
      <div className="mb-[clamp(0.75rem,3dvh,1.5rem)] mt-1 shrink-0">
        <GreenTitle>Kuniga qancha vaqt<br />ajratasiz?</GreenTitle>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1">
        <div className="flex flex-col gap-3">
          {GOALS.map((g) => {
            const active = goal === g.id
            return (
              <button key={g.id} type="button" onClick={() => setGoal(g.id)} aria-pressed={active}
                className={`flex min-h-16 w-full items-center gap-3.5 rounded-2xl p-3.5 text-left shadow-xs transition-all active:scale-[0.98] ${
                  active ? 'ring-2 ring-pprimary bg-pprimary/10' : 'bg-pcard hover:bg-psurface'
                }`}>
                <div className="flex size-10 flex-none items-center justify-center rounded-full"
                  style={{ background: `color-mix(in srgb, ${g.color} 15%, transparent)`, color: g.color }}>
                  <Clock3 size={21} />
                </div>
                <div className="flex-1">
                  <p className="text-[15px] font-semibold text-pfg leading-tight">{g.label}</p>
                  <p className="text-xs font-semibold mt-0.5" style={{ color: 'var(--p-subtle)' }}>{g.desc}</p>
                </div>
                <span className={`size-6 rounded-full flex items-center justify-center flex-none transition-all ${
                  active ? 'ring-2 ring-pprimary bg-pprimary/15' : 'bg-psurface'
                }`}>
                  {active && <span className="size-2.5 rounded-full bg-pprimary" />}
                </span>
              </button>
            )
          })}
        </div>

        {/* Maqsad kartasi */}
        <div className="mt-3 flex items-center gap-3 rounded-2xl p-3.5 shadow-xs"
          style={{ background: 'var(--p-card)' }}>
          <div className="size-10 rounded-xl flex items-center justify-center flex-none shadow-2xs"
            style={{ background: 'color-mix(in srgb, var(--p-danger) 15%, transparent)' }}>
            <Rocket size={20} className="text-pdanger" />
          </div>
          <div>
            <p className="text-[13px] font-semibold text-pfg">Maqsadga erishamiz!</p>
            <p className="text-xs font-semibold mt-0.5" style={{ color: 'var(--p-subtle)' }}>
              Doimiy o'rganish — muvaffaqiyat kaliti.
            </p>
          </div>
        </div>
      </div>

      <div className="shrink-0 pt-3">
        <BigButton label="Boshlash" onClick={() => onDone(goal)} />
        <div className="mt-4"><Dots active={2} /></div>
      </div>
    </Screen>
  )
}

// ══════════════════════ ONBOARDING KONTEYNERI ══════════════════════════════
export default function Onboarding({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState(0)

  const finish = (goal: string) => {
    try { localStorage.setItem('yhq-goal', goal) } catch { /* private mode */ }
    onDone()
  }

  if (step === 0) return <WelcomeStep onNext={() => setStep(1)} />
  if (step === 1) return <SubjectStep onNext={() => setStep(2)} onBack={() => setStep(0)} />
  return <GoalStep onDone={finish} onBack={() => setStep(1)} />
}
