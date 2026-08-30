import React from 'react'
import { Sparkles, Star, Quote, CheckCircle2 } from 'lucide-react'

interface LandingTestimonialsProps {
  lang: 'uz' | 'ru'
}

export const LandingTestimonials: React.FC<LandingTestimonialsProps> = ({ lang }) => {
  const reviews = [
    {
      name: 'Nargiza Usmanova',
      city: 'Toshkent shahri (Ona tili va Rus tili o\'qituvchisi)',
      rating: 5,
      score: '96 / 100 Ball',
      textUz: "O'qituvchilar attestatsiyasiga tayyorlanishda KIWI'dagi Rus tili moduli juda yordam berdi. Har bir grammatika qoidasi tushuntirilgani sababli Oliy toifani (96 ball bilan) qo'lga kiritdim va ustamamni 50% ga oshirdim!",
      textRu: 'При подготовке к аттестации модуль русского языка в KIWI очень помог. Благодаря детальным разборам правил получила Высшую категорию (96 баллов) и надбавку!',
      badgeUz: 'Oliy Toifa Attestatsiya 🎓',
      badgeRu: 'Высшая категория 🎓',
    },
    {
      name: 'Jasurbek Shokirov',
      city: 'Samarqand shahri (Abituriyent / Talaba)',
      rating: 5,
      score: '184.5 Ball',
      textUz: "OTMga kirish imtihonlariga tayyorlanishda 1v1 PvP Oktagon duellarida do'stlarim bilan bilim sinashib o'qidim. Zerikmasdan, o'yin sifatida tayyorlandim va Toshkent Davlat Yuridik Universitetiga davlat granti asosida qabul qilindim!",
      textRu: 'Готовился к поступлению в ВУЗ через 1v1 PvP дуэли в Октагоне. Учился с интересом и поступил в ТГЮУ на государственный грант!',
      badgeUz: 'Davlat Granti 🏛',
      badgeRu: 'Госгрант 🏛',
    },
    {
      name: 'Dilshod Rahimov',
      city: "Farg'ona viloyati (Haydovchi)",
      rating: 5,
      score: '20 / 20 Ball',
      textUz: "Yo'l harakati qoidalarining barcha 70 biletini KIWI'da 4 kunda to'liq o'rganib chiqdim. Rasmiy imtihon simulyatori xuddi DYXBB markazidagidek ishlaganligi sababli 20/20 natija bilan birinchi urinishda guvohnoma oldim!",
      textRu: 'Все 70 билетов ПДД прошел в KIWI за 4 дня. Симулятор работает в точности как в экзаменационном центре, сдал на 20/20 с первой попытки!',
      badgeUz: 'Prava oldi 🚗',
      badgeRu: 'Получил права 🚗',
    },
  ]

  return (
    <section className="py-20 md:py-28 relative">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-pprimary/10 text-pprimary text-[12px] font-bold uppercase tracking-wider mb-3">
            <Sparkles size={14} strokeWidth={1.75} />
            <span>{lang === 'uz' ? 'Fikrlar' : 'Отзывы'}</span>
          </div>
          <h2 className="text-3xl sm:text-5xl font-display font-extrabold text-pfg tracking-tight mb-4">
            {lang === 'uz'
              ? "O'quvchilarimiz va ustozlar nima deydi?"
              : 'Что говорят наши ученики и преподаватели?'}
          </h2>
          <p className="text-[15px] sm:text-[17px] text-pmuted leading-relaxed font-sans font-medium">
            {lang === 'uz'
              ? "O'qituvchilar, abituriyentlar va haydovchilar KIWI orqali o'z maqsadlariga erishmoqda."
              : 'Преподаватели, абитуриенты и водители достигают своих целей вместе с KIWI.'}
          </p>
        </div>

        {/* Reviews Grid (Widescreen 3-Columns) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
          {reviews.map((rev, idx) => (
            <div
              key={idx}
              className="p-7 sm:p-9 rounded-sheet bg-pcard hover:shadow-xl transition-all duration-200 flex flex-col justify-between shadow-sm relative overflow-hidden group hover:-translate-y-1"
            >
              <Quote className="absolute -bottom-4 -right-4 w-28 h-28 text-psurface opacity-30 pointer-events-none transition-transform group-hover:scale-105" />

              <div>
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-1 text-pgold">
                    {[...Array(rev.rating)].map((_, i) => (
                      <Star key={i} size={15} className="fill-pgold text-pgold" />
                    ))}
                  </div>
                  <span className="text-[12px] font-bold px-3 py-1 rounded-full bg-psuccess/15 text-psuccess font-mono">
                    {rev.score}
                  </span>
                </div>

                <p className="text-[14px] sm:text-[15px] text-pmuted leading-relaxed mb-8 italic font-sans font-medium">
                  "{lang === 'uz' ? rev.textUz : rev.textRu}"
                </p>
              </div>

              <div className="pt-4 flex items-center justify-between">
                <div>
                  <h4 className="text-[14.5px] font-bold text-pfg font-sans">{rev.name}</h4>
                  <p className="text-[12px] text-psubtle">{rev.city}</p>
                </div>
                <div className="flex items-center gap-1 text-[11px] font-bold text-pprimary">
                  <CheckCircle2 size={14} strokeWidth={2} />
                  <span>{lang === 'uz' ? rev.badgeUz : rev.badgeRu}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
