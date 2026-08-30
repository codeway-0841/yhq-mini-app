import React, { useState } from 'react'
import { Calculator, Sparkles, ArrowRight, Clock, Award } from 'lucide-react'
import { playSound } from '../../../shared/lib/sounds'
import { config } from '../../../shared/config'

interface LandingCalculatorProps {
  lang: 'uz' | 'ru'
}

export const LandingCalculator: React.FC<LandingCalculatorProps> = ({ lang }) => {
  const [examType, setExamType] = useState<number>(0) // 0: Attestatsiya / Sertifikat, 1: DTM, 2: YHQ
  const [stageIndex, setStageIndex] = useState(1) // 0: Yangi, 1: O'rtada, 2: Imtihon yaqin
  const [dailyMinutes, setDailyMinutes] = useState(30)
  const [completedTopics, setCompletedTopics] = useState(20)

  const botUsername = config.botUsername || 'kivvi_app_bot'
  const telegramBotUrl = `https://t.me/${botUsername}`

  const maxUnits = examType === 2 ? 70 : 40
  const unitLabelUz = examType === 2 ? 'bilet' : 'mavzu/test'
  const unitLabelRu = examType === 2 ? 'билетов' : 'тем/тестов'

  // Dynamic readiness algorithm
  const baseRate = (completedTopics / maxUnits) * 60
  const dailyBonus = (dailyMinutes / 60) * 25
  const stageBonus = stageIndex === 0 ? 5 : stageIndex === 1 ? 10 : 15
  const readiness = Math.min(99, Math.max(25, Math.round(baseRate + dailyBonus + stageBonus)))

  const remainingUnits = Math.max(0, maxUnits - completedTopics)
  const daysNeeded = Math.max(3, Math.ceil((remainingUnits * 10 * 1.5) / dailyMinutes))

  const expectedScore = examType === 0
    ? readiness >= 85 ? 'A+ (90-100 Ball)' : readiness >= 70 ? 'B+ (75-89 Ball)' : 'C (60-74 Ball)'
    : examType === 1
    ? readiness >= 85 ? '180+ Ball (Grant)' : readiness >= 70 ? '150+ Ball' : '120+ Ball'
    : readiness >= 90 ? '20 / 20 Ball' : readiness >= 80 ? '19 / 20' : '18 / 20'

  return (
    <section id="calculator" className="py-20 md:py-28 relative">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10">
        {/* Section Title */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-pprimary/10 text-pprimary text-[12px] font-bold uppercase tracking-wider mb-3">
            <Calculator size={14} strokeWidth={1.75} />
            <span>{lang === 'uz' ? 'Imtihon Kalkulyatori' : 'Калькулятор готовности'}</span>
          </div>
          <h2 className="text-3xl sm:text-5xl font-display font-extrabold text-pfg tracking-tight mb-4">
            {lang === 'uz'
              ? "Imtihonga tayyorgarlik darajangizni aniqlang"
              : 'Узнайте свой уровень готовности к экзамену'}
          </h2>
          <p className="text-[15px] sm:text-[17px] text-pmuted leading-relaxed font-sans font-medium">
            {lang === 'uz'
              ? "Imtihon turi va tayyorgarlik parametrlaringizni kiriting — AI algoritmi ehtimoliy natijangizni hisoblab beradi."
              : 'Выберите тип экзамена и текущие параметры — ИИ рассчитает прогноз сдачи и срок подготовки.'}
          </p>
        </div>

        {/* Interactive Calculator Box */}
        <div className="p-6 sm:p-12 rounded-sheet bg-pcard shadow-2xl relative overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 xl:gap-14 items-center">
            {/* Input Controls (7 cols) */}
            <div className="lg:col-span-7 space-y-7 font-sans">
              {/* Question 0: Exam Type */}
              <div>
                <label className="block text-[14.5px] font-bold text-pfg mb-3">
                  1. {lang === 'uz' ? 'Qaysi imtihonga tayyorlanyapsiz?' : 'К какому экзамену вы готовитесь?'}
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {[
                    { labelUz: '🇷🇺 Sertifikat & Attestatsiya', labelRu: '🇷🇺 Сертификат и Аттестация' },
                    { labelUz: '🏛 DTM Kirish Imtihoni', labelRu: '🏛 Поступление в ВУЗ (ДТМ)' },
                    { labelUz: '🚗 YHQ Haydovchilik', labelRu: '🚗 Экзамен ПДД' },
                  ].map((e, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        playSound('click')
                        setExamType(idx)
                        setCompletedTopics(idx === 2 ? 25 : 15)
                      }}
                      className={`p-3 rounded-control text-[12.5px] font-semibold transition-all text-left shadow-xs active:scale-[0.98] ${
                        examType === idx
                          ? 'bg-pprimary text-ponprimary shadow-md font-bold'
                          : 'bg-psurface/80 text-pmuted hover:text-pfg hover:bg-psurface'
                      }`}
                    >
                      {lang === 'uz' ? e.labelUz : e.labelRu}
                    </button>
                  ))}
                </div>
              </div>

              {/* Question 1: Stage */}
              <div>
                <label className="block text-[14.5px] font-bold text-pfg mb-3">
                  2. {lang === 'uz' ? 'Hozirgi bosqichingiz?' : 'Ваш текущий этап подготовки?'}
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { labelUz: 'Boshida', labelRu: 'В начале' },
                    { labelUz: 'O\'rtasida', labelRu: 'В середине' },
                    { labelUz: 'Imtihon yaqin', labelRu: 'Скоро экзамен' },
                  ].map((s, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        playSound('click')
                        setStageIndex(idx)
                      }}
                      className={`p-3 rounded-control text-[13px] font-semibold transition-all shadow-xs active:scale-[0.98] ${
                        stageIndex === idx
                          ? 'bg-pprimary text-ponprimary shadow-md font-bold'
                          : 'bg-psurface/80 text-pmuted hover:text-pfg hover:bg-psurface'
                      }`}
                    >
                      {lang === 'uz' ? s.labelUz : s.labelRu}
                    </button>
                  ))}
                </div>
              </div>

              {/* Question 2: Daily Minutes */}
              <div>
                <div className="flex items-center justify-between mb-2.5">
                  <label className="text-[14.5px] font-bold text-pfg">
                    3. {lang === 'uz' ? 'Kuniga qancha vaqt ajrata olasiz?' : 'Сколько минут в день готовы уделять?'}
                  </label>
                  <span className="text-[13px] font-bold text-pprimary px-3 py-1 rounded-control bg-pprimary/10">
                    {dailyMinutes} {lang === 'uz' ? 'daqiqa' : 'минут'}
                  </span>
                </div>
                <input
                  type="range"
                  min={10}
                  max={90}
                  step={5}
                  value={dailyMinutes}
                  onChange={(e) => setDailyMinutes(Number(e.target.value))}
                  className="w-full h-2.5 bg-psurface rounded-lg appearance-none cursor-pointer accent-pprimary"
                />
                <div className="flex justify-between text-[11px] text-psubtle mt-1.5 font-medium">
                  <span>10 daq</span>
                  <span>30 daq</span>
                  <span>60 daq</span>
                  <span>90 daq</span>
                </div>
              </div>

              {/* Question 3: Completed Units */}
              <div>
                <div className="flex items-center justify-between mb-2.5">
                  <label className="text-[14.5px] font-bold text-pfg">
                    4. {lang === 'uz' ? `Nechta ${unitLabelUz} o'rgangansiz?` : `Сколько ${unitLabelRu} уже прошли?`}
                  </label>
                  <span className="text-[13px] font-bold text-pgold px-3 py-1 rounded-control bg-pgold/10">
                    {completedTopics} / {maxUnits} {lang === 'uz' ? unitLabelUz : unitLabelRu}
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={maxUnits}
                  step={1}
                  value={completedTopics}
                  onChange={(e) => setCompletedTopics(Number(e.target.value))}
                  className="w-full h-2.5 bg-psurface rounded-lg appearance-none cursor-pointer accent-pgold"
                />
              </div>
            </div>

            {/* Results Panel (5 cols) */}
            <div className="lg:col-span-5 p-7 sm:p-9 rounded-sheet bg-gradient-to-b from-psurface to-pcard text-center flex flex-col justify-between shadow-xl">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-widest text-psubtle">
                  {lang === 'uz' ? 'AI Tahlil Natijasi' : 'Прогноз ИИ'}
                </span>

                <div className="my-5">
                  <div className="text-6xl sm:text-7xl font-display font-black text-pprimary mb-1.5 tracking-tight">
                    {readiness}%
                  </div>
                  <div className="text-[13.5px] font-bold text-pfg font-sans">
                    {readiness >= 85
                      ? lang === 'uz' ? 'A\'lo darajada tayyorgarlik 🚀' : 'Отличный уровень готовности 🚀'
                      : readiness >= 65
                      ? lang === 'uz' ? 'Yaxshi, ammo takrorlash kerak 💡' : 'Хорошо, но нужно закрепить 💡'
                      : lang === 'uz' ? 'Mavzularni to\'liq o\'rganish tavsiya etiladi ⚠️' : 'Рекомендуется пройти все темы ⚠️'}
                  </div>
                </div>

                <div className="space-y-3 pt-4 text-left text-[13px] mb-7 font-sans">
                  <div className="flex items-center justify-between">
                    <span className="text-pmuted flex items-center gap-2">
                      <Clock size={15} strokeWidth={1.75} className="text-pblue" />
                      <span>{lang === 'uz' ? 'Kerakli muddat:' : 'Срок подготовки:'}</span>
                    </span>
                    <span className="font-bold text-pfg text-[14px]">~{daysNeeded} {lang === 'uz' ? 'kun' : 'дней'}</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-pmuted flex items-center gap-2">
                      <Award size={15} strokeWidth={1.75} className="text-pgold" />
                      <span>{lang === 'uz' ? 'Kutilayotgan natija:' : 'Прогноз результата:'}</span>
                    </span>
                    <span className="font-black text-psuccess text-[15px]">{expectedScore}</span>
                  </div>
                </div>
              </div>

              <a
                href={telegramBotUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => playSound('click')}
                className="w-full py-3.5 rounded-container bg-pprimary text-ponprimary font-bold text-[14px] flex items-center justify-center gap-2.5 shadow-lg shadow-pprimary/25 hover:brightness-110 active:scale-[0.98] transition-all"
              >
                <Sparkles size={16} strokeWidth={2} />
                <span>{lang === 'uz' ? 'Shaxsiy Rejani Boshlash' : 'Начать по плану'}</span>
                <ArrowRight size={15} strokeWidth={2} />
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
