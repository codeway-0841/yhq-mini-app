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
    <div className="flex items-center justify-center gap-2 pb-6">
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
    <div className="min-h-screen flex flex-col bg-pcanvas"
      style={{ background: 'linear-gradient(180deg, var(--p-canvas) 0%, var(--p-surface) 100%)' }}>
      <div className="flex flex-col flex-1 px-6 pt-14 pb-6 max-w-md mx-auto w-full">
        {children}
      </div>
    </div>
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
    <button onClick={onClick}
      className="bg-pprimary text-ponprimary font-semibold hover:brightness-[1.06] active:scale-[0.98] transition-[transform,background-color,filter] duration-[120ms] w-full py-4 rounded-2xl text-[16px] flex items-center justify-center gap-2 shadow-md">
      {label}
      <ChevronRight size={20} strokeWidth={3} />
    </button>
  )
}

// ══════════════════════ 1. XUSH KELIBSIZ ════════════════════════════════════
function WelcomeStep({ onNext }: { onNext: () => void }) {
  return (
    <Screen>
      <div className="mt-6">
        <GreenTitle>Xush <span className="text-pprimary">kelibsiz!</span></GreenTitle>
        <Sub>Barcha fanlarni bitta ilovada o'rganing va test yeching.</Sub>
      </div>

      {/* Brend illutsiyasi — splash bilan bir xil (glow'siz, toza) */}
      <div className="relative flex-1 flex items-center justify-center my-4">
        <img
          src="/images/splash-brand.png"
          alt="KIVVI"
          className="w-[290px] rounded-3xl animate-fadeIn shadow-lg"
        />
      </div>

      <BigButton label="Boshlash" onClick={onNext} />
      <div className="mt-5"><Dots active={0} /></div>
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
      <button onClick={onBack} aria-label="Orqaga"
        className="self-start w-9 h-9 rounded-xl flex items-center justify-center text-pmuted active:opacity-60">
        <ChevronLeft size={26} />
      </button>
      <div className="mt-1 mb-6">
        <GreenTitle>Qaysi <span className="text-pprimary">fanni</span><br />o'rganmoqchisiz?</GreenTitle>
        <Sub>Bir yoki bir nechta fan tanlashingiz mumkin</Sub>
      </div>

      <div className="flex-1 flex flex-col gap-3 overflow-y-auto">
        {SUBJECTS.map((s) => {
          const active = picked.includes(s.id)
          const Icon = s.icon
          return (
            <button key={s.id} onClick={() => toggle(s.id, s.available)}
              className={`flex items-center gap-3.5 w-full rounded-2xl p-3.5 text-left transition-all active:scale-[0.98] shadow-xs ${
                !s.available ? 'opacity-55' : ''
              } ${
                active ? 'ring-2 ring-pprimary bg-pprimary/10' : 'bg-pcard hover:bg-psurface'
              }`}>
              <Icon size={22} strokeWidth={1.75} className="shrink-0 text-pmuted" />
              <span className="flex-1 text-[15px] font-semibold text-pfg">
                {lang === 'ru' ? s.nameRu : s.name}
              </span>
              {!s.available && (
                <span className="text-[10px] font-semibold uppercase tracking-wide text-psubtle flex-none">
                  {lang === 'ru' ? 'Скоро' : 'Tez kunda'}
                </span>
              )}
              {active && s.available && (
                <span className="size-7 rounded-xl bg-pprimary flex items-center justify-center flex-none shadow-xs">
                  <Check size={16} className="text-white" strokeWidth={3.2} />
                </span>
              )}
            </button>
          )
        })}
      </div>

      <div className="pt-4">
        <BigButton label="Davom etish" onClick={() => { setSubject(picked[0] ?? 'yhq'); onNext() }} />
        <div className="mt-5"><Dots active={1} /></div>
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
      <button onClick={onBack} aria-label="Orqaga"
        className="self-start w-9 h-9 rounded-xl flex items-center justify-center text-pmuted active:opacity-60">
        <ChevronLeft size={26} />
      </button>
      <div className="mt-1 mb-6">
        <GreenTitle>Kuniga qancha vaqt<br />ajratasiz?</GreenTitle>
      </div>

      <div className="flex flex-col gap-3">
        {GOALS.map((g) => {
          const active = goal === g.id
          return (
            <button key={g.id} onClick={() => setGoal(g.id)}
              className={`flex items-center gap-3.5 w-full rounded-2xl p-4 text-left transition-all active:scale-[0.98] shadow-xs ${
                active ? 'ring-2 ring-pprimary bg-pprimary/10' : 'bg-pcard hover:bg-psurface'
              }`}>
              <div className="w-11 h-11 rounded-full flex items-center justify-center flex-none"
                style={{ background: `color-mix(in srgb, ${g.color} 15%, transparent)`, color: g.color }}>
                <Clock3 size={22} />
              </div>
              <div className="flex-1">
                <p className="text-[15px] font-semibold text-pfg leading-tight">{g.label}</p>
                <p className="text-[11px] font-semibold mt-0.5" style={{ color: 'var(--p-subtle)' }}>{g.desc}</p>
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
      <div className="mt-4 rounded-2xl p-3.5 flex items-center gap-3 shadow-xs"
        style={{ background: 'var(--p-card)' }}>
        <div className="size-10 rounded-xl flex items-center justify-center flex-none shadow-2xs"
          style={{ background: 'color-mix(in srgb, var(--p-danger) 15%, transparent)' }}>
          <Rocket size={20} className="text-pdanger" />
        </div>
        <div>
          <p className="text-[13px] font-semibold text-pfg">Maqsadga erishamiz!</p>
          <p className="text-[11px] font-semibold mt-0.5" style={{ color: 'var(--p-subtle)' }}>
            Doimiy o'rganish — muvaffaqiyat kaliti.
          </p>
        </div>
      </div>

      <div className="flex-1" />
      <div className="pt-4">
        <BigButton label="Boshlash" onClick={() => onDone(goal)} />
        <div className="mt-5"><Dots active={2} /></div>
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
