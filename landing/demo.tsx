/**
 * Jonli demo vidjetlar — landing'da app'ning ASOSIY JARAYONLARINI avtomatik
 * ijro etadi (Termius uslubi: scroll qilsangiz funksiya o'zini ko'rsatadi).
 * Har bir demo faqat ko'rinib turganda ishlaydi (IntersectionObserver) va
 * loop qiladi. reduced-motion'da statik holatda qoladi.
 *
 * DuelDemo — src/features/octagon (RoundScreen + DuelHeader) UI'ning
 * SADIQ miniatyurasi: 10 raund · 15s · letter-badge variantlar ·
 * blue "ack kutilmoqda" → green/red reveal · header'da hisob (yashil:qizil).
 */
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { CheckCircle2, Lock, Signal, BatteryFull, Swords, Wifi, X, XCircle } from 'lucide-react'
import { MERCH_ITEMS } from '../shared/merch-items'
import type { Lang } from './copy'

/** Lokal i18n helper (copy.ts dagi `t` bilan bir xil) */
const t2 = (p: { uz: string; ru: string }, lang: Lang) => (lang === 'uz' ? p.uz : p.ru)

/* ── Ko'rinishni kuzatish — demo faqat viewport'da ishlaydi ────────────────── */
function useInViewActive(threshold = 0.35) {
  const ref = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const io = new IntersectionObserver(([e]) => setActive(e.isIntersecting), { threshold })
    io.observe(el)
    return () => io.disconnect()
  }, [threshold])

  return { ref, active }
}

/* ── Ramkalar ──────────────────────────────────────────────────────────────── */

function StatusBar() {
  return (
    <div className="flex items-center justify-between pb-3 text-[11px] text-[var(--l-muted)]">
      <span className="font-semibold">9:41</span>
      <div className="flex items-center gap-1.5">
        <Signal size={12} />
        <Wifi size={12} />
        <BatteryFull size={13} />
      </div>
    </div>
  )
}

export function PhoneFrame({ children, label }: { children: ReactNode; label: string }) {
  return (
    <div className="relative w-[300px] sm:w-[330px] mx-auto">
      <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 z-10 rounded-full border border-[rgba(77,163,255,0.3)] bg-[rgba(6,9,10,0.92)] px-3.5 py-1 text-[11px] font-semibold text-[var(--l-blue-bright)] whitespace-nowrap">
        {label}
      </div>
      <div className="phone-glow rounded-[2.4rem] border border-[var(--l-line-strong)] bg-gradient-to-b from-[rgba(255,255,255,0.08)] to-[rgba(255,255,255,0.02)] p-2.5">
        <div className="rounded-[1.9rem] bg-[#0a0f0e] border border-[var(--l-line)] px-4 py-4 overflow-hidden min-h-[430px]">
          <StatusBar />
          {children}
        </div>
      </div>
    </div>
  )
}

export function BrowserFrame({ children, url }: { children: ReactNode; url: string }) {
  return (
    <div className="relative w-full max-w-[560px] mx-auto rounded-2xl border border-[var(--l-line-strong)] bg-gradient-to-b from-[rgba(255,255,255,0.07)] to-[rgba(255,255,255,0.02)] p-2 shadow-2xl">
      <div className="rounded-xl bg-[#0a0f0e] border border-[var(--l-line)] overflow-hidden">
        <div className="flex items-center gap-2.5 px-3.5 py-2.5 border-b border-[var(--l-line)]">
          <div className="flex gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[rgba(244,93,93,0.7)]" />
            <span className="w-2.5 h-2.5 rounded-full bg-[rgba(240,185,11,0.7)]" />
            <span className="w-2.5 h-2.5 rounded-full bg-[rgba(77,163,255,0.7)]" />
          </div>
          <span className="flex-1 text-center text-[11px] font-mono text-[var(--l-faint)] bg-[rgba(255,255,255,0.04)] rounded-md py-1 px-3 truncate">
            {url}
          </span>
        </div>
        {children}
      </div>
    </div>
  )
}

/* ═══ PVP DUEL — Octagon'ning sadiq miniatyurasi (10 raund × 15s) ══════════ */

interface DuelRound {
  q: { uz: string; ru: string }
  opts: { uz: string; ru: string }[]
  correct: number
  youPick: number
  oppCorrect: boolean
}

const DUEL_ROUNDS: DuelRound[] = [
  {
    q: { uz: '«Asosiy yo‘l» belgisi qaysi?', ru: 'Какой знак «Главная дорога»?' },
    opts: [
      { uz: '2.1 — sariq romb', ru: '2.1 — жёлтый ромб' },
      { uz: '2.4 — «Yo‘l bering»', ru: '2.4 — «Уступите дорогу»' },
      { uz: '3.1 — «Kirish taqiqlangan»', ru: '3.1 — «Въезд запрещён»' },
    ],
    correct: 0, youPick: 0, oppCorrect: true,
  },
  {
    q: { uz: 'Maktab atrofida 300 m masofada tezlik chegarasi?', ru: 'Ограничение скорости у школы в пределах 300 м?' },
    opts: [
      { uz: '20 km/soat', ru: '20 км/ч' },
      { uz: '30 km/soat', ru: '30 км/ч' },
      { uz: '50 km/soat', ru: '50 км/ч' },
    ],
    correct: 1, youPick: 1, oppCorrect: false,
  },
  {
    q: { uz: 'Shahar ichida eng yuqori tezlik?', ru: 'Максимальная скорость в городе?' },
    opts: [
      { uz: '70 km/soat', ru: '70 км/ч' },
      { uz: '90 km/soat', ru: '90 км/ч' },
      { uz: '110 km/soat', ru: '110 км/ч' },
    ],
    correct: 0, youPick: 2, oppCorrect: true, // demo: SIZ xato qilasiz
  },
  {
    q: { uz: 'Piyodalar o‘tish joyida nima shart?', ru: 'Что обязательно у перехода?' },
    opts: [
      { uz: 'Signal berish', ru: 'Просигналить' },
      { uz: 'Piyodaga yo‘l berish', ru: 'Уступить пешеходу' },
      { uz: 'Tezlikni oshirish', ru: 'Увеличить скорость' },
    ],
    correct: 1, youPick: 1, oppCorrect: true,
  },
  {
    q: { uz: 'Alkogol ta’sirida haydash —', ru: 'Вождение в состоянии опьянения —' },
    opts: [
      { uz: 'Faqat jarima', ru: 'Только штраф' },
      { uz: 'Ruxsat etiladi', ru: 'Разрешено' },
      { uz: 'Qat’iyan taqiqlangan', ru: 'Строго запрещено' },
    ],
    correct: 2, youPick: 2, oppCorrect: false,
  },
]

const LETTERS = ['A', 'B', 'C', 'D']

export function DuelDemo({ lang, url }: { lang: Lang; url: string }) {
  const { ref, active } = useInViewActive()
  const [round, setRound] = useState(0)
  const [picked, setPicked] = useState<number | null>(null)
  const [revealed, setRevealed] = useState(false)
  const [oppAnswered, setOppAnswered] = useState(false)
  const [you, setYou] = useState(0)
  const [foe, setFoe] = useState(0)
  const [sec, setSec] = useState(15)
  const [ended, setEnded] = useState(false)

  // Raund ssenariysi — app'dagi ack oqimining nusxasi:
  // raqib javob berdi → SIZ tanlaysiz (blue, ack kutilmoqda) → reveal (green/red)
  useEffect(() => {
    if (!active || ended) return
    const cur = DUEL_ROUNDS[round]
    const t1 = setTimeout(() => setOppAnswered(true), 700)
    const t2 = setTimeout(() => setPicked(cur.youPick), 1400)
    const t3 = setTimeout(() => {
      setRevealed(true)
      if (cur.youPick === cur.correct) setYou((y) => y + 1)
      if (cur.oppCorrect) setFoe((f) => f + 1)
    }, 2100)
    const t4 = setTimeout(() => {
      if (round < DUEL_ROUNDS.length - 1) {
        setRound((r) => r + 1)
        setPicked(null)
        setRevealed(false)
        setOppAnswered(false)
        setSec(15)
      } else {
        setEnded(true)
      }
    }, 3300)
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4) }
  }, [active, round, ended])

  // Kosmetik 15s countdown (app: ROUND_TIMEOUT = 15_000)
  useEffect(() => {
    if (!active || ended) return
    const iv = setInterval(() => setSec((s) => Math.max(8, s - 1)), 400)
    return () => clearInterval(iv)
  }, [active, ended, round])

  // Loop reset
  useEffect(() => {
    if (!ended) return
    const t = setTimeout(() => {
      setRound(0); setPicked(null); setRevealed(false); setOppAnswered(false)
      setYou(0); setFoe(0); setSec(15); setEnded(false)
    }, 3200)
    return () => clearTimeout(t)
  }, [ended])

  const cur = DUEL_ROUNDS[round]
  const pct = (sec / 15) * 100
  const barColor = pct > 50 ? 'var(--l-blue-bright)' : pct > 25 ? 'var(--l-gold)' : 'var(--l-red)'

  return (
    <div ref={ref}>
      <BrowserFrame url={url}>
        {/* DuelHeader — app'dagi bilan bir xil: ✕ · ⚔ Duel · hisob (yashil:qizil) */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-[var(--l-line)]">
          <X size={16} className="text-[var(--l-faint)]" />
          <span className="flex items-center gap-2 text-[13px] font-bold text-[var(--l-text)]">
            <Swords size={14} className="text-[var(--l-muted)]" />
            Duel
          </span>
          <span className="text-[12px] font-mono font-bold">
            <span className="text-[var(--l-blue-bright)]">{you}</span>
            <span className="text-[var(--l-faint)]"> : </span>
            <span className="text-[var(--l-red)]">{foe}</span>
          </span>
        </div>

        <div className="p-4 sm:p-5">
          {!ended ? (
            <>
              {/* Raund taymer bar — app'dagi kabi rang almashtiradi */}
              <div className="w-full h-1.5 bg-[rgba(255,255,255,0.07)] rounded-full overflow-hidden mb-2.5">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${pct}%`, background: barColor, transition: 'width .4s linear, background .3s' }}
                />
              </div>
              <p className="text-[11px] text-[var(--l-muted)] mb-1 text-center">
                {lang === 'uz' ? 'Raund' : 'Раунд'} {round + 1} / 10
                <span className={`ml-2 font-bold ${sec <= 10 ? 'text-[var(--l-red)]' : 'text-[#60a5fa]'}`}>⏱ {sec}s</span>
                {oppAnswered && picked === null && (
                  <span className="ml-2 text-[var(--l-gold)]">• {lang === 'uz' ? 'Raqib javob berdi' : 'Соперник ответил'}</span>
                )}
              </p>

              <p className="text-[15px] font-semibold text-center mb-4 leading-snug text-[var(--l-text)] min-h-[42px]">
                {t2(cur.q, lang)}
              </p>

              {/* Variantlar — letter badge + app'dagi holat ranglari */}
              {cur.opts.map((o, i) => {
                const isPicked = picked === i
                let cls = 'border-[var(--l-line)] bg-[rgba(255,255,255,0.03)] text-[var(--l-text)]'
                if (picked !== null && !revealed && isPicked) {
                  // App'dagi ack-kutilayotgan holat — NEYTRAL BLUE
                  cls = 'border-[rgba(96,165,250,0.6)] bg-[rgba(96,165,250,0.1)] text-[var(--l-text)]'
                }
                if (revealed) {
                  if (i === cur.correct) cls = 'border-[rgba(46,230,168,0.5)] bg-[rgba(46,230,168,0.1)] text-[var(--l-success)]'
                  else if (isPicked) cls = 'border-[rgba(244,93,93,0.5)] bg-[rgba(244,93,93,0.1)] text-[var(--l-red)]'
                  else cls = 'border-[var(--l-line)] bg-transparent text-[var(--l-faint)]'
                }
                return (
                  <div
                    key={i}
                    className={`w-full text-left rounded-xl border p-3 mb-2 transition-all duration-300 flex items-center gap-3 ${cls}`}
                  >
                    <span className="w-6 h-6 rounded-full border border-current/30 flex items-center justify-center text-[10px] font-bold opacity-60 shrink-0">
                      {LETTERS[i]}
                    </span>
                    <span className="text-[13px] font-medium">{lang === 'uz' ? o.uz : o.ru}</span>
                    {revealed && i === cur.correct && <CheckCircle2 size={15} className="ml-auto shrink-0" />}
                    {revealed && isPicked && i !== cur.correct && <XCircle size={15} className="ml-auto shrink-0" />}
                  </div>
                )
              })}
            </>
          ) : (
            /* MatchEndScreen miniatyurasi */
            <div className="py-8 text-center animate-[fadeIn_.4s_ease]">
              <div className="text-4xl mb-3">🏆</div>
              <div className="font-display font-bold text-xl text-[var(--l-text)] mb-1">
                {you > foe ? (lang === 'uz' ? 'G‘alaba!' : 'Победа!') : (lang === 'uz' ? 'Durangga yaqin!' : 'Почти ничья!')}
              </div>
              <div className="font-mono font-bold text-2xl mb-3">
                <span className="text-[var(--l-blue-bright)]">{you}</span>
                <span className="text-[var(--l-faint)]"> : </span>
                <span className="text-[var(--l-red)]">{foe}</span>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[rgba(240,185,11,0.12)] text-[var(--l-gold)] text-[11px] font-bold px-3 py-1.5">
                <img src="/images/coin-stack.svg" alt="" className="w-3.5 h-3.5" />
                +120 coin
              </span>
            </div>
          )}
        </div>
      </BrowserFrame>
    </div>
  )
}

/* ═══ BOSS BATTLE — jamoaviy jang, HP kamayadi ════════════════════════════ */

/** Brute boss — public/images/boss/brute.svg INLINE nusxasi.
 *  <img> orqali currentColor meros bo'lmaydi (qora siluet chiqadi) —
 *  inline SVG'da esa CSS `color` bilan bo'yaladi. */
export function BruteIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 512 512" className={className} aria-hidden>
      <path
        fill="currentColor"
        d="M448 36c-29.4 44.05-63.2 65.7-126.3 64.8A79.99 75.99 0 0 0 256 68.01a79.99 75.99 0 0 0-65.8 32.79c-63 .9-96.85-20.77-126.2-64.8c-30.29 45.43 21.04 110.9 112.2 112.4a79.99 75.99 0 0 0 8.1 29.2C44.84 197.1 16.82 388.1 32 464h80c0-48 16-112 64-144l-16 144c0 16 64 16 64 0c0-32 16-64 32-64s32 32 32 64c0 16 64 16 64 0l-16-144c48 32 64 96 64 144h80c15.2-75.9-12.8-267-152.4-286.4a79.99 75.99 0 0 0 8.2-29.2C426.9 146.9 478.3 81.44 448 36m-256 87.8c13.5 15.7 27.2 31.3 48 40.2c0 0-22.9 15.7-32 8.7c-10.1-7.9-16-48.9-16-48.9m128 0s-5.9 41-16 48.9c-9.1 7-32-8.7-32-8.7c20.8-8.9 34.5-24.5 48-40.2"
      />
    </svg>
  )
}

interface Tick { id: number; x: number; dmg: number }

export function BossDemo({ lang, label }: { lang: Lang; label: string }) {
  const { ref, active } = useInViewActive()
  const [hp, setHp] = useState(68)
  const [ticks, setTicks] = useState<Tick[]>([])
  const [members, setMembers] = useState(1247)
  const [defeated, setDefeated] = useState(false)
  const idRef = useRef(0)

  useEffect(() => {
    if (!active || defeated) return
    const iv = setInterval(() => {
      const dmg = Math.random() < 0.14 ? 10 : 5
      idRef.current += 1
      const id = idRef.current
      setTicks((t) => [...t.slice(-5), { id, x: 18 + Math.random() * 60, dmg }])
      setTimeout(() => setTicks((t) => t.filter((k) => k.id !== id)), 1400)
      setHp((h) => {
        const nh = h - (dmg / 25) * 2 // vizual temp
        if (nh <= 0) { setDefeated(true); return 0 }
        return nh
      })
      if (Math.random() < 0.3) setMembers((m) => m + 1)
    }, 620)
    return () => clearInterval(iv)
  }, [active, defeated])

  useEffect(() => {
    if (!defeated) return
    const t = setTimeout(() => { setHp(100); setDefeated(false) }, 3000)
    return () => clearTimeout(t)
  }, [defeated])

  return (
    <div ref={ref}>
      <PhoneFrame label={label}>
        <div className="flex items-center justify-between pb-3 mb-4 border-b border-[var(--l-line)]">
          <span className="text-[13px] font-bold text-[var(--l-text)]">Boss Battle</span>
          <span className="text-[11px] font-semibold text-[var(--l-muted)]">{lang === 'uz' ? '34-hafta' : 'Неделя 34'}</span>
        </div>

        {/* Boss */}
        <div className="relative flex flex-col items-center pt-2 pb-5">
          {ticks.map((t) => (
            <span
              key={t.id}
              style={{ left: `${t.x}%` } as CSSProperties}
              className={`xp-fly absolute top-2 font-display font-bold text-lg ${t.dmg > 5 ? 'text-[var(--l-gold)]' : 'text-[var(--l-purple)]'}`}
            >
              −{t.dmg}{t.dmg > 5 ? ' CRIT' : ''}
            </span>
          ))}
          <div className={`relative transition-all ${defeated ? 'opacity-30 grayscale' : ''}`}>
            <div className="absolute inset-0 -m-6 rounded-full bg-[rgba(139,92,246,0.16)] blur-2xl" />
            <BruteIcon className="relative w-24 h-24 text-[#c084fc]" />
          </div>
          <div className="mt-2.5 font-display font-bold text-[15px] text-[var(--l-text)]">Brute</div>
          <div className="text-[11px] text-[var(--l-faint)] mb-4">
            {members.toLocaleString()} {lang === 'uz' ? 'ishtirokchi' : 'участников'}
          </div>

          {/* HP bar */}
          <div className="w-full">
            <div className="flex items-center justify-between text-[11px] text-[var(--l-muted)] mb-1.5">
              <span>HP</span>
              <span className="font-mono">{Math.max(0, Math.round(hp))}%</span>
            </div>
            <div className="h-2.5 rounded-full bg-[rgba(255,255,255,0.06)] overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[var(--l-purple)] to-[#c084fc] transition-all duration-500"
                style={{ width: `${Math.max(0, hp)}%` }}
              />
            </div>
          </div>
        </div>

        {defeated ? (
          <div className="rounded-xl border border-[rgba(240,185,11,0.35)] bg-[rgba(240,185,11,0.08)] px-3.5 py-3 text-center animate-[fadeIn_.4s_ease]">
            <div className="font-bold text-[13px] text-[var(--l-gold)] mb-0.5">
              {lang === 'uz' ? 'Boss yengildi!' : 'Босс повержен!'}
            </div>
            <div className="text-[12px] text-[var(--l-muted)]">
              +500 coin · {lang === 'uz' ? 'barcha ishtirokchilarga' : 'всем участникам'}
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-[var(--l-line)] bg-[rgba(255,255,255,0.03)] px-3.5 py-2.5 text-[11.5px] text-[var(--l-muted)] leading-relaxed">
            {lang === 'uz'
              ? 'Har to‘g‘ri javobingiz boss’ga 5 zarar yetkazadi.'
              : 'Каждый верный ответ наносит боссу 5 урона.'}
          </div>
        )}
      </PhoneFrame>
    </div>
  )
}

/* ═══ COIN → MERCH — balans o'sadi, REAL tovar sotib olinadi ═══════════════ */

export function MerchDemo({ lang, label }: { lang: Lang; label: string }) {
  const { ref, active } = useInViewActive()
  const HERO_ITEM = MERCH_ITEMS[2] // kiyim — futbolka (10 000c)
  const [balance, setBalance] = useState(9200)
  const [floats, setFloats] = useState<{ id: number }[]>([])
  const [bought, setBought] = useState(false)
  const idRef = useRef(0)

  useEffect(() => {
    if (!active || bought) return
    const iv = setInterval(() => {
      setBalance((b) => {
        if (b >= HERO_ITEM.price) {
          setBought(true)
          return b
        }
        idRef.current += 1
        const id = idRef.current
        setFloats((f) => [...f.slice(-3), { id }])
        setTimeout(() => setFloats((f) => f.filter((k) => k.id !== id)), 1300)
        return Math.min(HERO_ITEM.price, b + 100)
      })
    }, 480)
    return () => clearInterval(iv)
  }, [active, bought, HERO_ITEM.price])

  useEffect(() => {
    if (!bought) return
    const t = setTimeout(() => { setBought(false); setBalance(9200) }, 3400)
    return () => clearTimeout(t)
  }, [bought])

  const shown = bought ? balance - HERO_ITEM.price : balance

  return (
    <div ref={ref}>
      <PhoneFrame label={label}>
        <div className="flex items-center justify-between pb-3 mb-4 border-b border-[var(--l-line)]">
          <span className="text-[13px] font-bold text-[var(--l-text)]">Merch</span>
          <span className="relative flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[rgba(240,185,11,0.1)] text-[var(--l-gold)] text-[12px] font-bold">
            <img src="/images/coin-stack.svg" alt="" className="w-4 h-4" />
            {shown.toLocaleString()}
            {floats.map((f) => (
              <span key={f.id} className="xp-fly absolute -top-1 right-2 text-[var(--l-gold)]">+100</span>
            ))}
          </span>
        </div>

        <div className="space-y-2.5">
          {MERCH_ITEMS.map((item) => {
            const isHero = item.id === HERO_ITEM.id
            const done = isHero && bought
            return (
              <div
                key={item.id}
                className={`rounded-xl border p-3 transition-all duration-500 ${
                  done
                    ? 'border-[rgba(77,163,255,0.45)] bg-[rgba(77,163,255,0.06)]'
                    : isHero
                      ? 'border-[var(--l-line)] bg-[rgba(255,255,255,0.03)]'
                      : 'border-[var(--l-line)] bg-[rgba(255,255,255,0.02)] opacity-70'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="w-10 h-10 rounded-lg bg-[rgba(255,255,255,0.05)] border border-[var(--l-line)] flex items-center justify-center text-xl shrink-0">
                      {item.emoji}
                    </span>
                    <div className="min-w-0">
                      <div className="text-[12.5px] font-bold text-[var(--l-text)] leading-tight">
                        {lang === 'uz' ? item.label.uz : item.label.ru}
                      </div>
                      <div className="text-[10.5px] text-[var(--l-faint)]">
                        {item.stock} {lang === 'uz' ? 'ta qoldi' : 'в наличии'}
                      </div>
                    </div>
                  </div>
                  <span className="flex items-center gap-1 text-[12px] font-bold text-[var(--l-gold)] shrink-0">
                    {isHero ? <img src="/images/coin-stack.svg" alt="" className="w-3.5 h-3.5" /> : <Lock size={11} className="text-[var(--l-faint)]" />}
                    {item.price.toLocaleString()}
                  </span>
                </div>
                {isHero && (
                  <div
                    className={`mt-2.5 w-full text-center rounded-lg py-2 text-[12px] font-bold transition-all duration-300 ${
                      done
                        ? 'bg-[rgba(77,163,255,0.15)] text-[var(--l-blue-bright)]'
                        : 'bg-[rgba(255,255,255,0.06)] text-[var(--l-muted)]'
                    }`}
                  >
                    {done
                      ? (lang === 'uz' ? '✓ Buyurtma qabul qilindi' : '✓ Заказ принят')
                      : balance >= item.price
                        ? (lang === 'uz' ? 'Buyurtma berish…' : 'Оформление…')
                        : (lang === 'uz' ? 'Coin yig‘ilmoqda…' : 'Копим монеты…')}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <p className="mt-3.5 text-[10.5px] text-[var(--l-faint)] leading-relaxed text-center">
          {lang === 'uz'
            ? 'Real tovarlar — buyurtma ilova ichida rasmiylashtiriladi.'
            : 'Реальные товары — заказ оформляется внутри приложения.'}
        </p>
      </PhoneFrame>
    </div>
  )
}
