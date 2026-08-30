import React from 'react'
import {
  FileText,
  Swords,
  Compass,
  Brain,
  Flame,
  Coins,
  Sparkles,
  ArrowRight,
  ShieldAlert,
  Clock,
  Award,
} from 'lucide-react'

interface LandingFeaturesProps {
  lang: 'uz' | 'ru'
}

export const LandingFeatures: React.FC<LandingFeaturesProps> = ({ lang }) => {
  return (
    <section id="features" className="py-20 md:py-28 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Title */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-pprimary/10 border border-pprimary/20 text-pprimary text-xs font-semibold uppercase tracking-wider mb-3">
            <Sparkles className="w-3.5 h-3.5" />
            <span>{lang === 'uz' ? 'Imkoniyatlar' : 'Функционал'}</span>
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-display font-bold text-pfg tracking-tight mb-4">
            {lang === 'uz'
              ? 'Nega aynan KIWI bilan tayyorlanish kerak?'
              : 'Почему выбирают платформу KIWI?'}
          </h2>
          <p className="text-base sm:text-lg text-pmuted">
            {lang === 'uz'
              ? "Quruq yodlash emas — qiziqarli o'yinlar, real imtihon simulyatori va aqlli tahlil orqali bilimlarni mustahkamlang."
              : 'Не просто заучивание, а интерактивные игры, симуляторы реального экзамена и глубокий анализ ошибок.'}
          </p>
        </div>

        {/* Bento Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-3 gap-6">
          {/* Card 1 (Large - 2 cols on md/lg) */}
          <div className="md:col-span-2 p-6 sm:p-8 rounded-sheet bg-pcard border border-pline hover:border-plineStrong transition-all duration-300 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-80 h-80 bg-pprimary/10 blur-[90px] rounded-full pointer-events-none -z-10" />

            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 rounded-container bg-pprimary/10 border border-pprimary/20 text-pprimary">
                <FileText className="w-6 h-6" />
              </div>
              <div>
                <span className="text-xs font-bold text-pprimary tracking-wider uppercase">
                  {lang === 'uz' ? 'Asl Imtihon Standarti' : 'Экзаменационный стандарт'}
                </span>
                <h3 className="text-xl sm:text-2xl font-bold text-pfg">
                  {lang === 'uz'
                    ? '70 ta Rasmiy Bilet & Imtihon Simulyatori'
                    : '70 официальных билетов и экзамен'}
                </h3>
              </div>
            </div>

            <p className="text-sm sm:text-base text-pmuted mb-6 leading-relaxed">
              {lang === 'uz'
                ? "DXX YHXBB va barcha avtomaktablarning rasmiy bazasiga 100% mos keladi. 20 ta savol, 20 daqiqa vaqt va 2 ta xato limiti bilan haqiqiy imtihon muhitini his qiling."
                : 'Полное 100% соответствие официальной базе ГСБДД. 20 вопросов, 20 минут времени и лимит в 2 ошибки для создания атмосферы реального экзамена.'}
            </p>

            {/* Visual Highlights */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-4 border-t border-pline">
              <div className="p-3 rounded-control bg-psurface/60 border border-pline">
                <Clock className="w-4 h-4 text-pprimary mb-1" />
                <div className="text-xs font-bold text-pfg">
                  {lang === 'uz' ? '20 daqiqa taymer' : 'Таймер 20 мин'}
                </div>
                <div className="text-[11px] text-pmuted">
                  {lang === 'uz' ? 'Vaqtni to\'g\'ri taqsimlash' : 'Контроль времени'}
                </div>
              </div>

              <div className="p-3 rounded-control bg-psurface/60 border border-pline">
                <ShieldAlert className="w-4 h-4 text-pdanger mb-1" />
                <div className="text-xs font-bold text-pfg">
                  {lang === 'uz' ? '2 xato = yiqildi' : '2 ошибки = стоп'}
                </div>
                <div className="text-[11px] text-pmuted">
                  {lang === 'uz' ? 'Asl sharoit' : 'Реальные условия'}
                </div>
              </div>

              <div className="p-3 rounded-control bg-psurface/60 border border-pline col-span-2 sm:col-span-1">
                <Award className="w-4 h-4 text-pgold mb-1" />
                <div className="text-xs font-bold text-pfg">
                  {lang === 'uz' ? '100% qonuniy izoh' : 'Пояснения к ПДД'}
                </div>
                <div className="text-[11px] text-pmuted">
                  {lang === 'uz' ? 'Barcha bandlar bilan' : 'С ссылками на пункты'}
                </div>
              </div>
            </div>
          </div>

          {/* Card 2: Octagon PvP Duel (1 col) */}
          <div className="p-6 sm:p-8 rounded-sheet bg-pcard border border-pline hover:border-plineStrong transition-all duration-300 relative overflow-hidden flex flex-col justify-between group">
            <div className="absolute top-0 right-0 w-60 h-60 bg-pgold/10 blur-[80px] rounded-full pointer-events-none -z-10" />

            <div>
              <div className="p-3 rounded-container bg-pgold/10 border border-pgold/20 text-pgold w-fit mb-6">
                <Swords className="w-6 h-6" />
              </div>
              <span className="text-xs font-bold text-pgold tracking-wider uppercase">
                {lang === 'uz' ? 'Real-Vaqtli Jang' : 'Реальное время'}
              </span>
              <h3 className="text-xl font-bold text-pfg mt-1 mb-3">
                {lang === 'uz' ? 'Oktagon — 1v1 PvP Duel' : 'Октагон — 1v1 PvP Дуэль'}
              </h3>
              <p className="text-sm text-pmuted leading-relaxed mb-4">
                {lang === 'uz'
                  ? "Do'stlaringiz bilan link orqali yoki butun O'zbekistondan tasodifiy raqiblar bilan real vaqtda savol-javob jangi o'tkazing."
                  : 'Сразитесь с друзьями по ссылке или случайными соперниками со всего Узбекистана в реальном времени.'}
              </p>
            </div>

            <div className="flex items-center gap-2 text-xs font-semibold text-pgold">
              <span>{lang === 'uz' ? 'Ligalar & Reyting ochkolari' : 'Лиги и рейтинговые очки'}</span>
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
            </div>
          </div>

          {/* Card 3: Road Signs & Game (1 col) */}
          <div className="p-6 sm:p-8 rounded-sheet bg-pcard border border-pline hover:border-plineStrong transition-all duration-300 relative overflow-hidden flex flex-col justify-between group">
            <div className="absolute top-0 right-0 w-60 h-60 bg-pblue/10 blur-[80px] rounded-full pointer-events-none -z-10" />

            <div>
              <div className="p-3 rounded-container bg-pblue/10 border border-pblue/20 text-pblue w-fit mb-6">
                <Compass className="w-6 h-6" />
              </div>
              <span className="text-xs font-bold text-pblue tracking-wider uppercase">
                {lang === 'uz' ? 'Interaktiv Ta\'lim' : 'Интерактив'}
              </span>
              <h3 className="text-xl font-bold text-pfg mt-1 mb-3">
                {lang === 'uz' ? "Yo'l Belgilari & O'yin" : 'Дорожные Знаки и Игра'}
              </h3>
              <p className="text-sm text-pmuted leading-relaxed mb-4">
                {lang === 'uz'
                  ? "8 ta toifadagi barcha yo'l belgilari, audio va video darsliklar hamda belgilarni tez topish bo'yicha maxsus mini-o'yin."
                  : 'Все дорожные знаки в 8 категориях, аудио- и видеоуроки, а также мини-игра на скоростное распознавание знаков.'}
              </p>
            </div>

            <div className="flex items-center gap-2 text-xs font-semibold text-pblue">
              <span>{lang === 'uz' ? '200+ belgi to\'liq tahlil bilan' : '200+ знаков с разбором'}</span>
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
            </div>
          </div>

          {/* Card 4: AI Adaptive Spaced Repetition (1 col) */}
          <div className="p-6 sm:p-8 rounded-sheet bg-pcard border border-pline hover:border-plineStrong transition-all duration-300 relative overflow-hidden flex flex-col justify-between group">
            <div className="absolute top-0 right-0 w-60 h-60 bg-pprimary/10 blur-[80px] rounded-full pointer-events-none -z-10" />

            <div>
              <div className="p-3 rounded-container bg-pprimary/10 border border-pprimary/20 text-pprimary w-fit mb-6">
                <Brain className="w-6 h-6" />
              </div>
              <span className="text-xs font-bold text-pprimary tracking-wider uppercase">
                {lang === 'uz' ? 'Aqlli Takrorlash' : 'Умное повторение'}
              </span>
              <h3 className="text-xl font-bold text-pfg mt-1 mb-3">
                {lang === 'uz' ? 'Smart AI Adaptive' : 'Smart AI Адаптивность'}
              </h3>
              <p className="text-sm text-pmuted leading-relaxed mb-4">
                {lang === 'uz'
                  ? "Spaced Repetition algoritmi siz adashgan va qiyinchilik tug'dirgan savollarni eslab qoladi va kerakli vaqtda qayta takrorlatadi."
                  : 'Алгоритм интервального повторения отслеживает ваши ошибки и предлагает нужные вопросы для закрепления.'}
              </p>
            </div>

            <div className="flex items-center gap-2 text-xs font-semibold text-pprimary">
              <span>{lang === 'uz' ? 'Nolga teng xatolar' : 'Минимум ошибок'}</span>
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
            </div>
          </div>

          {/* Card 5: Boss Battle & Lucky Spin (1 col) */}
          <div className="p-6 sm:p-8 rounded-sheet bg-pcard border border-pline hover:border-plineStrong transition-all duration-300 relative overflow-hidden flex flex-col justify-between group">
            <div className="absolute top-0 right-0 w-60 h-60 bg-ppurple/10 blur-[80px] rounded-full pointer-events-none -z-10" />

            <div>
              <div className="flex items-center gap-2 mb-6">
                <div className="p-3 rounded-container bg-ppurple/10 border border-ppurple/20 text-ppurple">
                  <Flame className="w-6 h-6" />
                </div>
                <div className="p-3 rounded-container bg-pgold/10 border border-pgold/20 text-pgold">
                  <Coins className="w-6 h-6" />
                </div>
              </div>
              <span className="text-xs font-bold text-ppurple tracking-wider uppercase">
                {lang === 'uz' ? 'Gamifikatsiya & Sovrinlar' : 'Геймификация и призы'}
              </span>
              <h3 className="text-xl font-bold text-pfg mt-1 mb-3">
                {lang === 'uz' ? 'Boss Battle & Lucky Spin' : 'Босс-битва и Спин'}
              </h3>
              <p className="text-sm text-pmuted leading-relaxed mb-4">
                {lang === 'uz'
                  ? "Haftalik jamoaviy boss jangi, kunlik omadli charxpalak, o'yin ichidagi tangalar, noyob avatar ramkalari va temalar."
                  : 'Еженедельные босс-рейды с сообществом, колесо фортуны каждый день, монеты, скины и уникальные рамки аватара.'}
              </p>
            </div>

            <div className="flex items-center gap-2 text-xs font-semibold text-ppurple">
              <span>{lang === 'uz' ? 'Qiziqarli rag\'bat tizimi' : 'Увлекательная мотивация'}</span>
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
