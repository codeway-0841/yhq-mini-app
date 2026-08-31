import { useState } from 'react'
import { ArrowRight, Check, ChevronDown, LogIn, PenLine, Trophy } from 'lucide-react'
import { APP_URL, BOT_URL } from './config'
import { copy, t, type Lang } from './copy'
import { Reveal, spot, useCountUp } from './lib'
import { PREMIUM_PLANS, HIGHLIGHT_PLAN, formatUzs } from '../shared/premium-plans'
import { SUBJECT_BASES } from '../shared/subjects'

/* ── Statistika — count-up raqamlar ────────────────────────────────────────── */

function Stat({ value, suffix, label }: { value: number; suffix: string; label: string }) {
  const { ref, val } = useCountUp(value)
  return (
    <div className="text-center">
      <div className="font-display font-bold text-4xl sm:text-5xl text-[var(--l-text)] tracking-tight">
        <span ref={ref}>{val.toLocaleString().replace(/,/g, ' ')}</span>
        <span className="grad-text">{suffix}</span>
      </div>
      <div className="mt-2 text-sm text-[var(--l-muted)]">{label}</div>
    </div>
  )
}

export function Stats({ lang }: { lang: Lang }) {
  const s = copy.stats
  // 100 000+ — barcha fanlar bo'yicha UMUMIY baza (fanlar bazasi import
  // qilingani sari to'ldiriladi; alohida fan statistikasi yozilmaydi).
  return (
    <section className="border-y border-[var(--l-line)] bg-[rgba(255,255,255,0.014)]">
      <div className="max-w-6xl mx-auto px-5 sm:px-8 py-14 grid grid-cols-2 lg:grid-cols-4 gap-10">
        <Reveal><Stat value={100000} suffix="+" label={t(s.q, lang)} /></Reveal>
        <Reveal delay={80}><Stat value={8} suffix="" label={t(s.subj, lang)} /></Reveal>
        <Reveal delay={160}><Stat value={24} suffix="/7" label={t(s.pvp, lang)} /></Reveal>
        <Reveal delay={240}><Stat value={30} suffix={lang === 'uz' ? ' s' : ' с'} label={t(s.reg, lang)} /></Reveal>
      </div>
    </section>
  )
}

/* ── Jarayon — 3 qadam ─────────────────────────────────────────────────────── */

export function Process({ lang }: { lang: Lang }) {
  const p = copy.process
  const steps = [
    {
      n: '01',
      icon: <LogIn size={18} />,
      title: { uz: 'Kiring', ru: 'Войдите' },
      body: {
        uz: 'Telegram Mini App yoki app.kivvi.uz — tez va oson ro‘yxatdan o‘ting, karta talab qilinmaydi.',
        ru: 'Telegram Mini App или app.kivvi.uz — регистрация за 30 секунд, карта не нужна.',
      },
    },
    {
      n: '02',
      icon: <PenLine size={18} />,
      title: { uz: 'Mashq qiling', ru: 'Тренируйтесь' },
      body: {
        uz: 'Testlar, biletlar, fleshkartalar va adaptiv rejim — algoritm zaif mavzularingizni aniqlab, ularni mustahkamlaydi.',
        ru: 'Тесты, билеты, флешкарты и адаптивный режим — алгоритм находит и укрепляет слабые темы.',
      },
    },
    {
      n: '03',
      icon: <Trophy size={18} />,
      title: { uz: 'O‘lchang va yuting', ru: 'Измеряйте и побеждайте' },
      body: {
        uz: 'Imtihon simulyatori, PvP reyting va batafsil statistika — natijangizni raqamlarda ko‘rasiz.',
        ru: 'Симулятор экзамена, PvP-рейтинг и подробная статистика — результат виден в цифрах.',
      },
    },
  ]

  return (
    <section id="process" className="py-24">
      <div className="max-w-6xl mx-auto px-5 sm:px-8">
        <Reveal className="text-center mb-14">
          <span className="eyebrow mb-4">{t(p.eyebrow, lang)}</span>
          <h2 className="font-display font-bold tracking-[-0.02em] text-3xl sm:text-5xl text-[var(--l-text)]">
            {t(p.title, lang)}
          </h2>
        </Reveal>

        <div className="grid md:grid-cols-3 gap-4">
          {steps.map((st, i) => (
            <Reveal key={st.n} delay={i * 110}>
              <div onMouseMove={spot} className="spot h-full p-7">
                <div className="flex items-center justify-between mb-6">
                  <span className="icon-box">{st.icon}</span>
                  <span className="font-display font-bold text-4xl text-[rgba(255,255,255,0.07)]">{st.n}</span>
                </div>
                <h3 className="font-display font-semibold text-xl text-[var(--l-text)] mb-2.5">
                  {t(st.title, lang)}
                </h3>
                <p className="text-[14px] text-[var(--l-muted)] leading-relaxed">{t(st.body, lang)}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ── Fanlar — SUBJECT_BASES (shared/subjects.ts) yagona manbadan ───────────── */

/** public/ ichidagi fan rasmi (rustili uchun rasm hali yo'q — emoji fallback). */
const SUBJECT_IMG: Record<string, string> = {
  yhq: '/fan-yhq.webp',
  fizika: '/fan-fizika.webp',
  matematika: '/fan-matematika.webp',
  kimyo: '/fan-kimyo.webp',
  ingliz: '/fan-ingliz.webp',
  tarix: '/fan-tarix.webp',
  biologiya: '/fan-biologiya.webp',
}

export function Subjects({ lang }: { lang: Lang }) {
  const s = copy.subjects
  return (
    <section id="subjects" className="py-24 border-t border-[var(--l-line)]">
      <div className="max-w-6xl mx-auto px-5 sm:px-8">
        <Reveal className="text-center mb-14">
          <span className="eyebrow mb-4">{t(s.eyebrow, lang)}</span>
          <h2 className="font-display font-bold tracking-[-0.02em] text-3xl sm:text-5xl text-[var(--l-text)] mb-4">
            {t(s.title, lang)}
          </h2>
          <p className="text-[var(--l-muted)] max-w-2xl mx-auto leading-relaxed">{t(s.sub, lang)}</p>
        </Reveal>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {SUBJECT_BASES.map((subj, i) => {
            const img = SUBJECT_IMG[subj.id]
            return (
              <Reveal key={subj.id} delay={i * 60}>
                <div onMouseMove={spot} className={`spot h-full p-5 ${!subj.available ? 'opacity-60' : ''}`}>
                  <div className="flex items-start justify-between mb-4">
                    {img ? (
                      <img src={img} alt={subj.name} className="w-14 h-14 rounded-2xl object-cover" loading="lazy" />
                    ) : (
                      <span className="w-14 h-14 rounded-2xl bg-[rgba(255,255,255,0.04)] border border-[var(--l-line)] flex items-center justify-center text-2xl">
                        {subj.icon}
                      </span>
                    )}
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full ${
                        subj.available
                          ? 'bg-[rgba(77,163,255,0.12)] text-[var(--l-blue-bright)]'
                          : 'bg-[rgba(255,255,255,0.05)] text-[var(--l-faint)]'
                      }`}
                    >
                      {subj.available ? t(s.active, lang) : t(s.soon, lang)}
                    </span>
                  </div>
                  <div className="font-semibold text-[15px] text-[var(--l-text)]">
                    {lang === 'uz' ? subj.name : subj.nameRu}
                  </div>
                </div>
              </Reveal>
            )
          })}
        </div>
      </div>
    </section>
  )
}

/* ── Narxlar — shared/premium-plans.ts YAGONA MANBAdan ─────────────────────── */

export function Pricing({ lang }: { lang: Lang }) {
  const p = copy.pricing
  const freeFeatures = lang === 'uz' ? p.freeFeatures.uz : p.freeFeatures.ru

  return (
    <section id="pricing" className="py-24 border-t border-[var(--l-line)] relative">
      <div className="glow-orb w-[460px] h-[400px] right-[-140px] top-0 bg-[rgba(26,129,252,0.07)]" />
      <div className="relative max-w-6xl mx-auto px-5 sm:px-8">
        <Reveal className="text-center mb-14">
          <span className="eyebrow mb-4">{t(p.eyebrow, lang)}</span>
          <h2 className="font-display font-bold tracking-[-0.02em] text-3xl sm:text-5xl text-[var(--l-text)] mb-4">
            {t(p.title, lang)}
          </h2>
          <p className="text-[var(--l-muted)] max-w-2xl mx-auto leading-relaxed">{t(p.sub, lang)}</p>
        </Reveal>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 items-stretch">
          {/* Bepul tarif */}
          <Reveal>
            <div className="spot h-full p-6 flex flex-col">
              <div className="font-display font-semibold text-lg text-[var(--l-text)]">{t(p.free, lang)}</div>
              <div className="text-[12px] text-[var(--l-faint)] mb-5">{t(p.freeSub, lang)}</div>
              <div className="font-display font-bold text-3xl text-[var(--l-text)] mb-5">
                0
                <span className="text-sm font-medium text-[var(--l-muted)]"> so‘m</span>
              </div>
              <ul className="space-y-2.5 mb-7 flex-1">
                {freeFeatures.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-[13px] text-[var(--l-muted)]">
                    <Check size={14} className="mt-0.5 shrink-0 text-[var(--l-blue-bright)]" />
                    {f}
                  </li>
                ))}
              </ul>
              <a href={APP_URL} className="btn-l btn-l-ghost w-full !py-2.5 !text-sm">
                {t(p.cta, lang)}
              </a>
            </div>
          </Reveal>

          {/* Premium tariflar — shared/premium-plans.ts'dan */}
          {PREMIUM_PLANS.map((plan, i) => {
            const hot = plan.key === HIGHLIGHT_PLAN
            const features = lang === 'uz' ? plan.featuresUz : plan.featuresRu
            return (
              <Reveal key={plan.key} delay={(i + 1) * 80}>
                <div
                  onMouseMove={spot}
                  className={`spot h-full p-6 flex flex-col ${
                    hot ? '!border-[rgba(77,163,255,0.4)] !bg-[rgba(77,163,255,0.04)]' : ''
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="font-display font-semibold text-lg text-[var(--l-text)]">
                      {lang === 'uz' ? plan.tierNameUz : plan.tierNameRu}
                    </div>
                    {hot && (
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full bg-[rgba(77,163,255,0.15)] text-[var(--l-blue-bright)]">
                        {t(p.popular, lang)}
                      </span>
                    )}
                  </div>
                  <div className="text-[12px] text-[var(--l-faint)] mb-5">
                    {lang === 'uz' ? plan.badgeUz : plan.badgeRu}
                  </div>
                  <div className="mb-5">
                    <span className="text-[13px] text-[var(--l-faint)] line-through mr-2">
                      {formatUzs(plan.originalPriceUzs, lang)}
                    </span>
                    <span className="font-display font-bold text-3xl text-[var(--l-text)]">
                      {formatUzs(plan.priceUzs, lang)}
                    </span>
                    <span className="text-sm font-medium text-[var(--l-muted)]">{t(p.per30, lang)}</span>
                  </div>
                  <ul className="space-y-2.5 mb-7 flex-1">
                    {features.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-[13px] text-[var(--l-muted)]">
                        <Check size={14} className="mt-0.5 shrink-0 text-[var(--l-blue-bright)]" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <a href={APP_URL} className={`btn-l w-full !py-2.5 !text-sm ${hot ? 'btn-l-primary' : 'btn-l-ghost'}`}>
                    {t(p.cta, lang)}
                  </a>
                </div>
              </Reveal>
            )
          })}
        </div>

        {/* Xavfsiz to'lov qaydi */}
        <Reveal delay={200} className="mt-8 text-center">
          <p className="text-[13px] text-[var(--l-faint)] max-w-2xl mx-auto leading-relaxed">
            {t(p.note, lang)}
          </p>
        </Reveal>
      </div>
    </section>
  )
}

/* ── FAQ ───────────────────────────────────────────────────────────────────── */

export function Faq({ lang }: { lang: Lang }) {
  const f = copy.faq
  const [openIdx, setOpenIdx] = useState<number | null>(0)

  return (
    <section id="faq" className="py-24 border-t border-[var(--l-line)]">
      <div className="max-w-3xl mx-auto px-5 sm:px-8">
        <Reveal className="text-center mb-12">
          <span className="eyebrow mb-4">{t(f.eyebrow, lang)}</span>
          <h2 className="font-display font-bold tracking-[-0.02em] text-3xl sm:text-5xl text-[var(--l-text)]">
            {t(f.title, lang)}
          </h2>
        </Reveal>

        <div className="space-y-3">
          {f.items.map((item, i) => {
            const open = openIdx === i
            return (
              <Reveal key={i} delay={i * 50}>
                <div className={`spot ${open ? '!border-[rgba(77,163,255,0.25)]' : ''}`}>
                  <button
                    type="button"
                    onClick={() => setOpenIdx(open ? null : i)}
                    className="w-full flex items-center justify-between gap-4 px-6 py-4 text-left"
                  >
                    <span className="font-semibold text-[15px] text-[var(--l-text)]">{t(item.q, lang)}</span>
                    <ChevronDown
                      size={17}
                      className={`shrink-0 text-[var(--l-muted)] transition-transform duration-300 ${open ? 'rotate-180' : ''}`}
                    />
                  </button>
                  <div
                    className="grid transition-all duration-300 ease-out"
                    style={{ gridTemplateRows: open ? '1fr' : '0fr' }}
                  >
                    <div className="overflow-hidden">
                      <p className="px-6 pb-5 text-[14px] text-[var(--l-muted)] leading-relaxed">
                        {t(item.a, lang)}
                      </p>
                    </div>
                  </div>
                </div>
              </Reveal>
            )
          })}
        </div>
      </div>
    </section>
  )
}

/* ── Yakuniy CTA ───────────────────────────────────────────────────────────── */

export function Cta({ lang }: { lang: Lang }) {
  const c = copy.cta
  return (
    <section className="py-24">
      <div className="max-w-6xl mx-auto px-5 sm:px-8">
        <Reveal>
          <div className="relative overflow-hidden rounded-[28px] border border-[rgba(77,163,255,0.25)] px-6 sm:px-14 py-16 sm:py-20 text-center">
            {/* Ichki glow + grid */}
            <div className="bg-grid absolute inset-0 pointer-events-none" />
            <div className="glow-orb w-[560px] h-[300px] left-1/2 -translate-x-1/2 -top-32 bg-[rgba(26,129,252,0.2)]" />

            <div className="relative">
              <h2 className="font-display font-bold tracking-[-0.02em] text-3xl sm:text-5xl text-[var(--l-text)] mb-4">
                {t(c.title, lang)}
              </h2>
              <p className="text-[var(--l-muted)] max-w-xl mx-auto mb-9 leading-relaxed">{t(c.sub, lang)}</p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <a href={APP_URL} className="btn-l btn-l-primary w-full sm:w-auto !px-8 !py-4 !text-base">
                  {t(c.button, lang)}
                  <ArrowRight size={17} />
                </a>
                <a
                  href={BOT_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-l btn-l-ghost w-full sm:w-auto !px-7 !py-4 !text-base"
                >
                  {t(c.bot, lang)}
                </a>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
