/**
 * Showcase — app'ning ASOSIY jarayonlarini jonli demo bilan ko'rsatadigan
 * bo'lim (Termius uslubi: matn yonida ishlayotgan real oqim).
 * Eslatma: test yechish demosi Hero'da (interaktiv) — bu yerda takrorlanmaydi.
 */
import { Check } from 'lucide-react'
import { copy, t, type Lang } from './copy'
import { Reveal } from './lib'
import { DuelDemo, BossDemo, MerchDemo } from './demo'

function ShowRow({
  flip = false,
  eyebrow,
  title,
  body,
  bullets,
  children,
}: {
  flip?: boolean
  eyebrow: string
  title: string
  body: string
  bullets: string[]
  children: React.ReactNode
}) {
  return (
    <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center py-14 lg:py-20">
      {/* Matn */}
      <Reveal className={flip ? 'lg:order-2' : ''}>
        <span className="eyebrow mb-4">{eyebrow}</span>
        <h3 className="font-display font-bold tracking-[-0.02em] text-2xl sm:text-4xl text-[var(--l-text)] mb-4">
          {title}
        </h3>
        <p className="text-[15px] sm:text-base text-[var(--l-muted)] leading-relaxed mb-6 max-w-lg">
          {body}
        </p>
        <ul className="space-y-3">
          {bullets.map((b) => (
            <li key={b} className="flex items-start gap-2.5 text-[14px] text-[var(--l-muted)]">
              <span className="mt-0.5 w-5 h-5 rounded-md bg-[rgba(46,230,168,0.12)] flex items-center justify-center shrink-0">
                <Check size={12} className="text-[var(--l-green-bright)]" />
              </span>
              {b}
            </li>
          ))}
        </ul>
      </Reveal>

      {/* Jonli demo */}
      <Reveal delay={140} className={flip ? 'lg:order-1' : ''}>
        <div className="relative">
          <div className="glow-orb w-[360px] h-[360px] left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2 bg-[rgba(15,164,127,0.09)]" />
          <div className="relative">{children}</div>
        </div>
      </Reveal>
    </div>
  )
}

export function Showcase({ lang }: { lang: Lang }) {
  const s = copy.showcase

  return (
    <section id="demo" className="relative py-16 sm:py-20">
      <div className="max-w-6xl mx-auto px-5 sm:px-8">
        <Reveal className="text-center mb-6">
          <span className="eyebrow mb-4">{t(s.eyebrow, lang)}</span>
          <h2 className="font-display font-bold tracking-[-0.02em] text-3xl sm:text-5xl text-[var(--l-text)] mb-4">
            {t(s.title, lang)}
          </h2>
          <p className="text-[var(--l-muted)] max-w-2xl mx-auto leading-relaxed">{t(s.sub, lang)}</p>
        </Reveal>

        <div className="divide-y divide-[var(--l-line)]">
          <ShowRow
            eyebrow={t(s.duel.eyebrow, lang)}
            title={t(s.duel.title, lang)}
            body={t(s.duel.body, lang)}
            bullets={lang === 'uz' ? s.duel.bullets.uz : s.duel.bullets.ru}
          >
            <DuelDemo lang={lang} url="app.kivvi.uz/#/octagon" />
          </ShowRow>

          <ShowRow
            flip
            eyebrow={t(s.boss.eyebrow, lang)}
            title={t(s.boss.title, lang)}
            body={t(s.boss.body, lang)}
            bullets={lang === 'uz' ? s.boss.bullets.uz : s.boss.bullets.ru}
          >
            <BossDemo lang={lang} label={t(s.boss.demoLabel, lang)} />
          </ShowRow>

          <ShowRow
            eyebrow={t(s.shop.eyebrow, lang)}
            title={t(s.shop.title, lang)}
            body={t(s.shop.body, lang)}
            bullets={lang === 'uz' ? s.shop.bullets.uz : s.shop.bullets.ru}
          >
            <MerchDemo lang={lang} label={t(s.shop.demoLabel, lang)} />
          </ShowRow>
        </div>
      </div>
    </section>
  )
}
