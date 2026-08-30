import { useState, type CSSProperties } from 'react'
import {
  ArrowRight,
  BatteryFull,
  CheckCircle2,
  Flame,
  Play,
  RotateCcw,
  Signal,
  Swords,
  Wifi,
  XCircle,
} from 'lucide-react'
import { APP_URL } from './config'
import { copy, t, type Lang } from './copy'
import { Reveal, useTilt } from './lib'
import { BruteIcon } from './demo'

/** Hero'dagi jonli demo savol — app'dagi test oqimining miniatyurasi.
 *  HAQIQIY savol bazadan (traffic_rules_db, external_id=1020). */
const DEMO = {
  header: { uz: 'YHQ · 1-savol', ru: 'ПДД · Вопрос 1' },
  question: {
    uz: 'Maktab va maktabgacha ta’lim tashkilotlari atrofidagi yo‘llarda 300 metrgacha bo‘lgan masofada qanday eng yuqori tezlikda harakatlanishga ruxsat etiladi?',
    ru: 'Какая максимальная скорость разрешена на расстоянии до 300 метров на дорогах вокруг школ и дошкольных учреждений?',
  },
  options: [
    { uz: '20 km/soat', ru: '20 км/ч', correct: false },
    { uz: '30 km/soat', ru: '30 км/ч', correct: true },
    { uz: '50 km/soat', ru: '50 км/ч', correct: false },
    { uz: '60 km/soat', ru: '60 км/ч', correct: false },
  ],
  explanation: {
    uz: 'Maktab va maktabgacha ta’lim tashkilotlari atrofidagi yo‘llarda 300 m masofada eng yuqori tezlik — 30 km/soat.',
    ru: 'На дорогах вокруг школ и дошкольных учреждений в пределах 300 м максимальная скорость — 30 км/ч.',
  },
  retry: { uz: 'Qayta urinish', ru: 'Попробовать снова' },
  startCta: { uz: 'Barcha testlar', ru: 'Все тесты' },
}

function MiniQuiz({ lang }: { lang: Lang }) {
  const [selected, setSelected] = useState<number | null>(null)
  const [streak, setStreak] = useState(7)
  const [xp, setXp] = useState(1250)
  const [xpBurst, setXpBurst] = useState(0)

  const pick = (i: number) => {
    if (selected !== null) return
    setSelected(i)
    if (DEMO.options[i].correct) {
      setStreak((s) => s + 1)
      setXp((v) => v + 50)
      setXpBurst((b) => b + 1)
    }
  }

  const reset = () => setSelected(null)

  return (
    <div className="relative">
      {/* Status bar */}
      <div className="flex items-center justify-between px-1 pb-3 text-[11px] text-[var(--l-muted)]">
        <span className="font-semibold">9:41</span>
        <div className="flex items-center gap-1.5">
          <Signal size={12} />
          <Wifi size={12} />
          <BatteryFull size={13} />
        </div>
      </div>

      {/* App header */}
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-[var(--l-line)]">
        <div className="text-[13px] font-bold text-[var(--l-text)]">{t(DEMO.header, lang)}</div>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-[rgba(240,185,11,0.12)] text-[var(--l-gold)] text-[11px] font-bold">
            <Flame size={11} className="fill-[var(--l-gold)]" />
            x{streak}
          </span>
          <span className="relative text-[11px] font-bold text-[var(--l-green-bright)] font-mono">
            {xp.toLocaleString()} XP
            {xpBurst > 0 && (
              <span key={xpBurst} className="xp-fly absolute -top-1 right-0 text-[var(--l-green-bright)]">
                +50
              </span>
            )}
          </span>
        </div>
      </div>

      {/* Savol */}
      <p className="text-[14px] leading-snug font-semibold text-[var(--l-text)] mb-3.5">
        {t(DEMO.question, lang)}
      </p>

      {/* Variantlar */}
      <div className="space-y-2 mb-3">
        {DEMO.options.map((o, i) => {
          let cls =
            'border-[var(--l-line)] bg-[rgba(255,255,255,0.03)] text-[var(--l-text)] hover:bg-[rgba(255,255,255,0.06)]'
          if (selected !== null) {
            if (o.correct) {
              cls = 'border-[rgba(46,230,168,0.5)] bg-[rgba(46,230,168,0.1)] text-[var(--l-green-bright)]'
            } else if (i === selected) {
              cls = 'border-[rgba(244,93,93,0.5)] bg-[rgba(244,93,93,0.1)] text-[var(--l-red)]'
            } else {
              cls = 'border-[var(--l-line)] bg-transparent text-[var(--l-faint)]'
            }
          }
          return (
            <button
              key={i}
              type="button"
              onClick={() => pick(i)}
              disabled={selected !== null}
              className={`w-full text-left px-3.5 py-2.5 rounded-xl border text-[12.5px] font-medium transition-all flex items-center justify-between gap-2 ${cls}`}
            >
              <span className="leading-snug">{lang === 'uz' ? o.uz : o.ru}</span>
              {selected !== null && o.correct && <CheckCircle2 size={15} className="shrink-0" />}
              {selected === i && !o.correct && <XCircle size={15} className="shrink-0" />}
            </button>
          )
        })}
      </div>

      {/* Izoh — javobdan keyin ochiladi (app'dagi post-answer reveal kabi) */}
      {selected !== null && (
        <div className="rounded-xl border border-[rgba(46,230,168,0.2)] bg-[rgba(46,230,168,0.05)] px-3.5 py-2.5 mb-3">
          <p className="text-[11.5px] leading-relaxed text-[var(--l-muted)]">{t(DEMO.explanation, lang)}</p>
        </div>
      )}

      {/* Pastki qator */}
      <div className="flex items-center justify-between pt-1">
        <button
          type="button"
          onClick={reset}
          className="flex items-center gap-1.5 text-[12px] text-[var(--l-muted)] hover:text-[var(--l-text)] transition-colors font-medium"
        >
          <RotateCcw size={12} />
          {t(DEMO.retry, lang)}
        </button>
        <a
          href={APP_URL}
          className="text-[12px] font-bold text-[var(--l-green-bright)] hover:underline"
        >
          {t(DEMO.startCta, lang)} →
        </a>
      </div>
    </div>
  )
}

/** Telefon atrofidagi suzuvchi 3D chiplar (translateZ qatlamlari). */
function FloatingChips({ lang }: { lang: Lang }) {
  return (
    <>
      {/* Coin mukofoti */}
      <div
        style={{ '--z': '90px', '--fd': '0.4s' } as CSSProperties}
        className="chip-3d floaty absolute -right-2 sm:-right-20 top-3 flex items-center gap-2 rounded-2xl border border-[var(--l-line)] bg-[rgba(10,15,14,0.9)] backdrop-blur px-3.5 py-2.5 shadow-2xl"
      >
        <img src="/images/coin-stack.svg" alt="" className="w-6 h-6" />
        <div className="text-left">
          <div className="text-[13px] font-bold text-[var(--l-gold)]">+120 coin</div>
          <div className="text-[10px] text-[var(--l-faint)]">{lang === 'uz' ? 'Kunlik vazifa' : 'Ежедневное задание'}</div>
        </div>
      </div>

      {/* Duel g'alabasi */}
      <div
        style={{ '--z': '70px', '--fd': '1.3s' } as CSSProperties}
        className="chip-3d floaty absolute -left-2 sm:-left-20 top-44 flex items-center gap-2 rounded-2xl border border-[rgba(46,230,168,0.25)] bg-[rgba(10,15,14,0.9)] backdrop-blur px-3.5 py-2.5 shadow-2xl"
      >
        <span className="icon-box !w-8 !h-8 !rounded-lg !bg-[rgba(46,230,168,0.1)] !border-[rgba(46,230,168,0.3)] !text-[var(--l-green-bright)]">
          <Swords size={14} />
        </span>
        <div className="text-left">
          <div className="text-[13px] font-bold text-[var(--l-text)]">Duel 10:7</div>
          <div className="text-[10px] text-[var(--l-green-bright)]">{lang === 'uz' ? 'G‘alaba!' : 'Победа!'}</div>
        </div>
      </div>

      {/* Boss zarari */}
      <div
        style={{ '--z': '110px', '--fd': '2.1s' } as CSSProperties}
        className="chip-3d floaty absolute -right-2 sm:-right-16 bottom-14 flex items-center gap-2 rounded-2xl border border-[rgba(139,92,246,0.3)] bg-[rgba(10,15,14,0.9)] backdrop-blur px-3.5 py-2.5 shadow-2xl"
      >
        <span className="w-8 h-8 rounded-lg bg-[rgba(139,92,246,0.14)] flex items-center justify-center shrink-0">
          <BruteIcon className="w-5 h-5 text-[#c084fc]" />
        </span>
        <div className="text-left">
          <div className="text-[13px] font-bold text-[var(--l-purple)]">−5 HP</div>
          <div className="text-[10px] text-[var(--l-faint)]">Boss Battle</div>
        </div>
      </div>
    </>
  )
}

export function Hero({ lang }: { lang: Lang }) {
  const h = copy.hero
  const { sceneRef, objRef } = useTilt(8)

  return (
    <section className="relative pt-36 pb-20 md:pt-44 md:pb-28 overflow-hidden">
      {/* Fon qatlamlari: grid + glow + noise */}
      <div className="bg-grid absolute inset-0 pointer-events-none" />
      <div className="glow-orb w-[720px] h-[480px] left-1/2 -translate-x-1/2 -top-40 bg-[rgba(15,164,127,0.16)]" />
      <div className="glow-orb w-[420px] h-[420px] right-[-120px] top-1/3 bg-[rgba(139,92,246,0.07)]" />

      <div className="relative max-w-6xl mx-auto px-5 sm:px-8">
        <div className="grid lg:grid-cols-2 gap-14 lg:gap-10 items-center">
          {/* Chap: matn + CTA */}
          <div className="text-center lg:text-left">
            <Reveal>
              <div className="inline-flex items-center gap-2 rounded-full border border-[var(--l-line)] bg-[rgba(255,255,255,0.03)] px-3.5 py-1.5 mb-7">
                <span className="pulse-dot inline-block w-1.5 h-1.5 rounded-full bg-[var(--l-green-bright)]" />
                <span className="text-[12.5px] font-medium text-[var(--l-muted)]">{t(h.pill, lang)}</span>
              </div>
            </Reveal>

            <Reveal delay={90}>
              <h1 className="font-display font-bold tracking-[-0.03em] leading-[1.04] text-[42px] sm:text-6xl xl:text-[68px] text-[var(--l-text)] mb-6">
                {t(h.h1a, lang)}
                <br />
                <span className="grad-text">{t(h.h1b, lang)}</span>
              </h1>
            </Reveal>

            <Reveal delay={180}>
              <p className="text-[16px] sm:text-lg text-[var(--l-muted)] leading-relaxed max-w-xl mx-auto lg:mx-0 mb-9">
                {t(h.sub, lang)}
              </p>
            </Reveal>

            <Reveal delay={260}>
              <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3 mb-5">
                <a href={APP_URL} className="btn-l btn-l-primary w-full sm:w-auto !px-7 !py-3.5">
                  {t(h.ctaPrimary, lang)}
                  <ArrowRight size={16} />
                </a>
                <a href="#process" className="btn-l btn-l-ghost w-full sm:w-auto !px-6 !py-3.5">
                  <Play size={15} className="text-[var(--l-muted)]" />
                  {t(h.ctaSecondary, lang)}
                </a>
              </div>
              <p className="text-[12.5px] text-[var(--l-faint)]">{t(h.trust, lang)}</p>
            </Reveal>
          </div>

          {/* O'ng: 3D tilt telefon + jonli mini-quiz */}
          <Reveal delay={200} className="relative">
            <div ref={sceneRef} className="tilt-scene relative mx-auto w-fit">
              <div ref={objRef} className="tilt-obj relative">
                {/* Demo yorlig'i */}
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-10 rounded-full border border-[rgba(46,230,168,0.3)] bg-[rgba(6,9,10,0.9)] px-3.5 py-1 text-[11px] font-semibold text-[var(--l-green-bright)] whitespace-nowrap">
                  {t(h.demoLabel, lang)}
                </div>

                {/* Telefon korpusi */}
                <div className="phone-glow relative w-[300px] sm:w-[330px] rounded-[2.6rem] border border-[var(--l-line-strong)] bg-gradient-to-b from-[rgba(255,255,255,0.08)] to-[rgba(255,255,255,0.02)] p-2.5">
                  <div className="rounded-[2rem] bg-[#0a0f0e] border border-[var(--l-line)] px-4 py-4 overflow-hidden">
                    <MiniQuiz lang={lang} />
                  </div>
                </div>

                {/* Telefon ostidagi glow */}
                <div className="glow-orb w-[300px] h-[120px] left-1/2 -translate-x-1/2 -bottom-10 bg-[rgba(15,164,127,0.22)]" />

                <FloatingChips lang={lang} />
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  )
}
