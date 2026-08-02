import { useState } from 'react'
import {
  ChevronRight, ChevronLeft, Check, Zap, BookOpen, FlaskConical, Clock3, Rocket,
} from 'lucide-react'
import { SUBJECTS } from '../../config/subjects'
import { useSubjectStore } from '../../store/useSubjectStore'
import { useAppStore } from '../../store/useAppStore'

// ── Qadam indikatorlari ─────────────────────────────────────────────────────
function Dots({ active }: { active: number }) {
  return (
    <div className="flex items-center justify-center gap-2 pb-6">
      {[0, 1, 2].map((i) => (
        <span key={i} className={`rounded-full transition-all duration-300 ${
          i === active ? 'w-6 h-2.5 bg-duo-green' : 'w-2.5 h-2.5 bg-line'
        }`} />
      ))}
    </div>
  )
}

// ── Umumiy ekran o'rashi ────────────────────────────────────────────────────
function Screen({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col px-6 pt-14 pb-6"
      style={{ background: 'linear-gradient(180deg, #0a1520 0%, #0d1a2b 100%)' }}>
      {children}
    </div>
  )
}

function GreenTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-[26px] font-black text-white text-center leading-tight">{children}</h2>
}
function Sub({ children }: { children: React.ReactNode }) {
  return <p className="text-[13px] font-semibold text-center mt-2" style={{ color: '#7f93ab' }}>{children}</p>
}
function BigButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className="btn-3d-green w-full py-4 rounded-2xl font-black text-[16px] flex items-center justify-center gap-2">
      {label}
      <ChevronRight size={20} strokeWidth={3} />
    </button>
  )
}

// ── Suzuvchi fan chiplari (welcome ekrani) ─────────────────────────────────
function FloatChip({ className, style, children, delay = '0s' }: {
  className?: string; style?: React.CSSProperties
  children: React.ReactNode; delay?: string
}) {
  return (
    <div className={`absolute w-14 h-14 rounded-2xl flex items-center justify-center onboarding-float ${className ?? ''}`}
      style={{ animationDelay: delay, ...style }}>
      {children}
    </div>
  )
}

// ══════════════════════ 1. XUSH KELIBSIZ ════════════════════════════════════
function WelcomeStep({ onNext }: { onNext: () => void }) {
  return (
    <Screen>
      <div className="mt-6">
        <GreenTitle>Xush <span className="text-duo-green">kelibsiz!</span></GreenTitle>
        <Sub>Barcha fanlarni bitta ilovada o'rganing va test yeching.</Sub>
      </div>

      {/* Maskot maydoni */}
      <div className="relative flex-1 flex items-center justify-center my-6">
        {/* Suzuvchi chiplar */}
        <FloatChip style={{ background: '#1E5BC6', top: '16%', left: '16%' }} delay="0s">
          <BookOpen size={26} className="text-white" />
        </FloatChip>
        <FloatChip style={{ background: '#e5b400', top: '10%', right: '16%' }} delay="0.4s">
          <Zap size={26} className="text-white" fill="currentColor" />
        </FloatChip>
        <FloatChip style={{ background: '#a85ed4', bottom: '22%', left: '12%' }} delay="0.8s">
          <span className="text-[26px] font-black text-white">π</span>
        </FloatChip>
        <FloatChip style={{ background: '#46a302', bottom: '30%', right: '12%' }} delay="1.2s">
          <FlaskConical size={26} className="text-white" />
        </FloatChip>

        {/* Maskot — TODO: user PNG almashtiradi (hozircha placeholder) */}
        <div className="relative w-56 h-64 rounded-[2rem] flex items-end justify-center overflow-hidden"
          style={{ background: 'radial-gradient(circle at 50% 35%, #1c3a4a 0%, #0f2433 70%)' }}>
          <span style={{ fontSize: 120, lineHeight: 1, marginBottom: 8 }}>🧑‍🎓</span>
          {/* Joylashgan yoshug'i — doira ichida telefon effekti */}
          <div className="absolute bottom-3 right-3 w-12 h-12 rounded-xl bg-duo-green flex items-center justify-center rotate-6">
            <Check size={26} className="text-white" strokeWidth={3.2} />
          </div>
        </div>
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
        className="self-start w-9 h-9 rounded-xl flex items-center justify-center text-white/70 active:opacity-60">
        <ChevronLeft size={26} />
      </button>
      <div className="mt-1 mb-6">
        <GreenTitle>Qaysi <span className="text-duo-green">fanni</span><br />o'rganmoqchisiz?</GreenTitle>
        <Sub>Bir yoki bir nechta fan tanlashingiz mumkin</Sub>
      </div>

      <div className="flex-1 flex flex-col gap-3 overflow-y-auto">
        {SUBJECTS.map((s) => {
          const active = picked.includes(s.id)
          const Icon = s.icon
          return (
            <button key={s.id} onClick={() => toggle(s.id, s.available)}
              className={`flex items-center gap-3.5 w-full rounded-2xl border-2 p-3.5 text-left transition-all active:scale-[0.98] ${
                !s.available ? 'opacity-55' : ''
              } ${
                active ? 'border-duo-green bg-duo-green/10' : 'border-line bg-[#12202f]'
              }`}>
              <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-none"
                style={{ background: `${s.color}26`, color: s.color }}>
                <Icon size={22} />
              </div>
              <span className="flex-1 text-[15px] font-bold text-white">
                {lang === 'ru' ? s.nameRu : s.name}
              </span>
              {!s.available && (
                <span className="text-[10px] font-extrabold uppercase tracking-wide text-white/40 flex-none">
                  {lang === 'ru' ? 'Скоро' : 'Tez kunda'}
                </span>
              )}
              {active && s.available && (
                <span className="w-7 h-7 rounded-lg border-2 bg-duo-green border-duo-green flex items-center justify-center flex-none">
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
  { id: '15',  label: '15 daqiqa', desc: 'Yengil rejim',   color: '#1cb0f6' },
  { id: '30',  label: '30 daqiqa', desc: 'O\u2019rtacha rejim', color: '#58cc02' },
  { id: '60',  label: '1 soat',    desc: 'Samarali rejim', color: '#ce82ff' },
  { id: '120', label: '2 soat +',  desc: 'Intensiv rejim', color: '#ff9600' },
]

function GoalStep({ onDone, onBack }: { onDone: (goal: string) => void; onBack: () => void }) {
  const [goal, setGoal] = useState('30')

  return (
    <Screen>
      <button onClick={onBack} aria-label="Orqaga"
        className="self-start w-9 h-9 rounded-xl flex items-center justify-center text-white/70 active:opacity-60">
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
              className={`flex items-center gap-3.5 w-full rounded-2xl border-2 p-4 text-left transition-all active:scale-[0.98] ${
                active ? 'border-duo-green bg-duo-green/10' : 'border-line bg-[#12202f]'
              }`}>
              <div className="w-11 h-11 rounded-full flex items-center justify-center flex-none"
                style={{ background: `${g.color}26`, color: g.color }}>
                <Clock3 size={22} />
              </div>
              <div className="flex-1">
                <p className="text-[15px] font-black text-white leading-tight">{g.label}</p>
                <p className="text-[11px] font-semibold mt-0.5" style={{ color: '#7f93ab' }}>{g.desc}</p>
              </div>
              <span className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-none transition-all ${
                active ? 'border-duo-green' : 'border-line'
              }`}>
                {active && <span className="w-3 h-3 rounded-full bg-duo-green" />}
              </span>
            </button>
          )
        })}
      </div>

      {/* Maqsad kartasi */}
      <div className="mt-4 rounded-2xl border border-line p-3.5 flex items-center gap-3"
        style={{ background: '#12202f' }}>
        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-none"
          style={{ background: '#ff4b4b26' }}>
          <Rocket size={20} className="text-duo-red" />
        </div>
        <div>
          <p className="text-[13px] font-black text-white">Maqsadga erishamiz! 🚀</p>
          <p className="text-[11px] font-semibold mt-0.5" style={{ color: '#7f93ab' }}>
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
