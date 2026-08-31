import {
  BookMarked,
  Brain,
  Gamepad2,
  Timer,
} from 'lucide-react'
import { copy, t, type Lang } from './copy'
import { Reveal, spot } from './lib'

/** Ikkilamchi funksiyalar — asosiy jarayonlar Showcase'da jonli ko'rsatiladi. */
export function Bento({ lang }: { lang: Lang }) {
  const b = copy.bento

  const cards: {
    key: string
    icon: React.ReactNode
    title: { uz: string; ru: string }
    body: { uz: string; ru: string }
  }[] = [
    {
      key: 'adaptive',
      icon: <Brain size={18} />,
      title: { uz: 'Adaptiv mashq', ru: 'Адаптивная тренировка' },
      body: {
        uz: 'Algoritm xatolaringizni tahlil qiladi va zaif mavzularni o‘z vaqtida takrorlatadi (intervalli takrorlash usuli).',
        ru: 'Алгоритм анализирует ошибки и повторяет слабые темы в нужный момент (интервальные повторения).',
      },
    },
    {
      key: 'signs',
      icon: <Gamepad2 size={18} />,
      title: { uz: 'Belgilar o‘yini', ru: 'Игра знаков' },
      body: {
        uz: 'Yo‘l belgilarini tezkor o‘yin formatida o‘rganing — rekordlar o‘rnating va bilimlaringizni mustahkamlang.',
        ru: 'Запоминайте дорожные знаки в быстрой игровой форме — рекорды и серии.',
      },
    },
    {
      key: 'speed',
      icon: <Timer size={18} />,
      title: { uz: 'Speed rejimi va fleshkartalar', ru: 'Режим Speed и флешкарты' },
      body: {
        uz: 'Vaqtga qarshi savol-javoblar va tezkor kartochkalar reaksiyangizni imtihon tezligiga olib chiqadi.',
        ru: 'Вопросы на время и быстрые карточки — доводят реакцию до экзаменационной скорости.',
      },
    },
    {
      key: 'mistakes',
      icon: <BookMarked size={18} />,
      title: { uz: 'Xatolar daftari', ru: 'Дневник ошибок' },
      body: {
        uz: 'Barcha xatolar alohida daftarda saqlanadi — har bir to‘g‘ri tuzatilgan xato uchun coin beriladi.',
        ru: 'Все ошибки записываются в отдельный дневник — каждый исправленный вопрос награждается монетами.',
      },
    },
  ]

  return (
    <section id="features" className="relative py-24 border-t border-[var(--l-line)]">
      <div className="glow-orb w-[500px] h-[400px] left-[-160px] top-1/4 bg-[rgba(26,129,252,0.08)]" />
      <div className="relative max-w-6xl mx-auto px-5 sm:px-8">
        <Reveal className="text-center mb-14">
          <span className="eyebrow mb-4">{t(b.eyebrow, lang)}</span>
          <h2 className="font-display font-bold tracking-[-0.02em] text-3xl sm:text-5xl text-[var(--l-text)] mb-4">
            {t(b.title, lang)}
          </h2>
          <p className="text-[var(--l-muted)] max-w-2xl mx-auto leading-relaxed">{t(b.sub, lang)}</p>
        </Reveal>

        <div className="grid sm:grid-cols-2 gap-4">
          {cards.map((c, i) => (
            <Reveal key={c.key} delay={i * 70}>
              <div onMouseMove={spot} className="spot h-full p-6">
                <div className="icon-box mb-4">{c.icon}</div>
                <h3 className="font-display font-semibold text-lg text-[var(--l-text)] mb-2">
                  {t(c.title, lang)}
                </h3>
                <p className="text-[14px] text-[var(--l-muted)] leading-relaxed">{t(c.body, lang)}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
