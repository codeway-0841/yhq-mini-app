import React from 'react'
import { Sparkles, Check, X } from 'lucide-react'

interface LandingComparisonProps {
  lang: 'uz' | 'ru'
}

export const LandingComparison: React.FC<LandingComparisonProps> = ({ lang }) => {
  const comparisonItems = [
    {
      featureUz: '2026-yilgi yangi rasmiy savollar bazasi (8 ta fan)',
      featureRu: 'Актуальная официальная база вопросов 2026 (8 предметов)',
      kiwi: true,
      others: 'Qisman / Eskirgan',
    },
    {
      featureUz: 'Har bir savolda batafsil qonuniy/ilmiy izoh',
      featureRu: 'Подробное пояснение к каждому вопросу',
      kiwi: true,
      others: false,
    },
    {
      featureUz: '1v1 Jonli PvP Duel arenasi (Oktagon)',
      featureRu: 'Живые 1v1 PvP дуэли в Октагоне',
      kiwi: true,
      others: false,
    },
    {
      featureUz: 'Smart AI xatolar ustida ishlash (Spaced Repetition)',
      featureRu: 'Умный ИИ для работы над ошибками',
      kiwi: true,
      others: false,
    },
    {
      featureUz: 'Telegram orqali o\'rnatishsiz bir zumda kirish',
      featureRu: 'Мгновенный вход через Telegram без установки',
      kiwi: true,
      others: false,
    },
    {
      featureUz: 'Interaktiv formulalar, belgilar va audio darslar',
      featureRu: 'Интерактивные формулы, знаки и аудиоуроки',
      kiwi: true,
      others: false,
    },
    {
      featureUz: 'Haftalik Boss Battle & Sovrinli Gamifikatsiya',
      featureRu: 'Еженедельные рейды на Босса и призы',
      kiwi: true,
      others: false,
    },
  ]

  return (
    <section className="py-20 md:py-28 bg-psurface/30 relative">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-pprimary/10 text-pprimary text-[12px] font-bold uppercase tracking-wider mb-3">
            <Sparkles size={14} strokeWidth={1.75} />
            <span>{lang === 'uz' ? 'Taqqoslash' : 'Сравнение'}</span>
          </div>
          <h2 className="text-3xl sm:text-5xl font-display font-extrabold text-pfg tracking-tight mb-4">
            {lang === 'uz' ? 'Oddiy kitoblar vs KIWI' : 'Обычные книги против KIWI'}
          </h2>
          <p className="text-[15px] sm:text-[17px] text-pmuted leading-relaxed font-sans font-medium">
            {lang === 'uz'
              ? 'Nega minglab o\'quvchilar an\'anaviy kitoblardan ko\'ra KIWI platformasini afzal ko\'rishadi?'
              : 'Почему тысячи учеников выбирают платформу KIWI вместо устаревших бумажных тестов?'}
          </p>
        </div>

        {/* Comparison Table (Widescreen) */}
        <div className="max-w-5xl mx-auto rounded-sheet bg-pcard shadow-2xl overflow-hidden font-sans">
          <div className="grid grid-cols-12 p-5 sm:p-6 bg-psurface/80 font-bold text-[13px] sm:text-[15px] text-pfg">
            <div className="col-span-6 sm:col-span-7">
              {lang === 'uz' ? 'Imkoniyatlar & Xususiyatlar' : 'Возможности и функции'}
            </div>
            <div className="col-span-3 sm:col-span-3 text-center text-pprimary flex items-center justify-center gap-1.5 font-display font-bold">
              <span>KIWI Platform</span>
              <span className="hidden sm:inline text-[10px] px-2 py-0.5 rounded-full bg-pprimary/15 font-bold font-mono">Pro</span>
            </div>
            <div className="col-span-3 sm:col-span-2 text-center text-pmuted font-medium">
              {lang === 'uz' ? 'Boshqalar' : 'Другие'}
            </div>
          </div>

          <div>
            {comparisonItems.map((item, idx) => (
              <div
                key={idx}
                className={`grid grid-cols-12 p-4 sm:p-5 items-center text-[13px] sm:text-[14px] transition-colors ${
                  idx % 2 === 1 ? 'bg-psurface/30' : ''
                } hover:bg-psurface/60`}
              >
                <div className="col-span-6 sm:col-span-7 text-pfg font-semibold leading-snug">
                  {lang === 'uz' ? item.featureUz : item.featureRu}
                </div>

                <div className="col-span-3 sm:col-span-3 flex items-center justify-center">
                  <div className="w-7 h-7 rounded-full bg-pprimary/15 text-pprimary flex items-center justify-center shadow-xs">
                    <Check size={16} strokeWidth={2.5} />
                  </div>
                </div>

                <div className="col-span-3 sm:col-span-2 flex items-center justify-center text-pmuted text-[12px]">
                  {typeof item.others === 'string' ? (
                    <span className="text-[12px] font-medium text-pwarning text-center">
                      {item.others}
                    </span>
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-psurface text-psubtle flex items-center justify-center">
                      <X size={14} strokeWidth={2} />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
