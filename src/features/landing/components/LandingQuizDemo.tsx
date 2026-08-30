import React, { useState } from 'react'
import { CheckCircle2, XCircle, ArrowRight, RotateCcw, Sparkles, BookOpen, AlertCircle, Trophy } from 'lucide-react'
import { config } from '../../../shared/config'

interface QuestionSample {
  id: number
  questionUz: string
  questionRu: string
  image?: string
  optionsUz: string[]
  optionsRu: string[]
  correctIndex: number
  explanationUz: string
  explanationRu: string
  ruleRef: string
}

const DEMO_QUESTIONS: QuestionSample[] = [
  {
    id: 1,
    questionUz: "Qaysi transport vositasi chorrahani birinchi bo'lib kesib o'tish huquqiga ega?",
    questionRu: 'Какое транспортное средство имеет право первого проезда перекрестка?',
    image: '/images/q002.jpg',
    optionsUz: [
      'Tramvay va tez yordam avtomobili',
      "Ko'k rangli yengil avtomobil",
      'Oq rangli avtobus',
      "O'ngdan kelayotgan qizil avtomobil",
    ],
    optionsRu: [
      'Трамвай и автомобиль скорой помощи',
      'Синий легковой автомобиль',
      'Белый автобус',
      'Красный автомобиль, приближающийся справа',
    ],
    correctIndex: 1,
    explanationUz: "YHQ 13.1-bandiga ko'ra: Asosiy yo'lda harakatlanayotgan transport vositasi ikkinchi darajali yo'ldan kelayotganlarga nisbatan imtiyozga ega.",
    explanationRu: 'Согласно пункту 13.1 ПДД: Транспортное средство, движущееся по главной дороге, имеет преимущество перед движущимися по второстепенной.',
    ruleRef: 'YHQ 13.1-band',
  },
  {
    id: 2,
    questionUz: "Ushbu yo'l belgisi qanday ma'noni bildiradi?",
    questionRu: 'Что означает данный дорожный знак?',
    image: '/images/q005.jpg',
    optionsUz: [
      "Faqat to'g'riga harakatlanish",
      "Bir tomonlama harakatlanish yo'li",
      "Asosiy yo'lning boshlanishi",
      "Aylanma harakat chorrahasi",
    ],
    optionsRu: [
      'Движение только прямо',
      'Дорога с односторонним движением',
      'Начало главной дороги',
      'Круговое движение',
    ],
    correctIndex: 0,
    explanationUz: "4.1.1 'Harakatlanish to'g'riga' buyuruvchi belgisi: Transport vositalariga faqat ko'rsatilgan yo'nalishda harakatlanishga ruxsat beradi.",
    explanationRu: 'Предписывающий знак 4.1.1 «Движение прямо»: разрешает движение только в указанном направлении.',
    ruleRef: '4.1.1 belgisi',
  },
  {
    id: 3,
    questionUz: "Aholi punktlarida yengil avtomobillarning ruxsat etilgan eng yuqori tezligi qancha?",
    questionRu: 'Какова максимально разрешенная скорость для легковых автомобилей в населенных пунктах?',
    optionsUz: [
      '70 km/soat',
      '60 km/soat',
      '50 km/soat',
      '80 km/soat',
    ],
    optionsRu: [
      '70 км/ч',
      '60 км/ч',
      '50 км/ч',
      '80 км/ч',
    ],
    correctIndex: 1,
    explanationUz: "YHQ 78-bandiga binoan O'zbekiston Respublikasi hududidagi barcha aholi punktlarida ruxsat etilgan tezlik 60 km/soat etib belgilangan.",
    explanationRu: 'Согласно пункту 78 ПДД, на всех дорогах в населенных пунктах Узбекистана максимальная разрешенная скорость составляет 60 км/ч.',
    ruleRef: 'YHQ 78-band',
  },
]

interface LandingQuizDemoProps {
  lang: 'uz' | 'ru'
  onOpenAuth: () => void
}

export const LandingQuizDemo: React.FC<LandingQuizDemoProps> = ({ lang, onOpenAuth: _onOpenAuth }) => {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [selectedOption, setSelectedOption] = useState<number | null>(null)
  const [showExplanation, setShowExplanation] = useState(false)
  const [score, setScore] = useState(0)
  const [answeredCount, setAnsweredCount] = useState(0)

  const currentQ = DEMO_QUESTIONS[currentIndex]
  const botUsername = config.botUsername || 'kivvi_app_bot'
  const telegramBotUrl = `https://t.me/${botUsername}`

  const handleSelectOption = (idx: number) => {
    if (selectedOption !== null) return // Already answered
    setSelectedOption(idx)
    setShowExplanation(true)
    setAnsweredCount((prev) => prev + 1)
    if (idx === currentQ.correctIndex) {
      setScore((prev) => prev + 1)
    }
  }

  const handleNext = () => {
    if (currentIndex < DEMO_QUESTIONS.length - 1) {
      setCurrentIndex((prev) => prev + 1)
      setSelectedOption(null)
      setShowExplanation(false)
    }
  }

  const handleRestart = () => {
    setCurrentIndex(0)
    setSelectedOption(null)
    setShowExplanation(false)
    setScore(0)
    setAnsweredCount(0)
  }

  const isCompleted = answeredCount === DEMO_QUESTIONS.length && selectedOption !== null

  return (
    <section id="demo" className="py-16 md:py-24 bg-psurface/40 border-y border-pline relative">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-2xl mx-auto mb-10">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-pprimary/10 border border-pprimary/20 text-pprimary text-xs font-semibold uppercase tracking-wider mb-3">
            <Sparkles className="w-3.5 h-3.5" />
            <span>{lang === 'uz' ? 'Jonli Sinov' : 'Интерактивный тест'}</span>
          </div>
          <h2 className="text-2xl sm:text-4xl font-display font-bold text-pfg tracking-tight">
            {lang === 'uz'
              ? "Bilimingizni hoziroq sinab ko'ring"
              : 'Проверьте свои знания прямо сейчас'}
          </h2>
          <p className="text-sm sm:text-base text-pmuted mt-2">
            {lang === 'uz'
              ? "Quyidagi rasmiy imtihon savoliga javob bering va tizim qanday ishlashini ko'ring:"
              : 'Ответьте на официальный экзаменационный вопрос и посмотрите как работает система:'}
          </p>
        </div>

        {/* Interactive Quiz Card */}
        <div className="bg-pcard border border-plineStrong rounded-sheet shadow-2xl p-5 sm:p-8 relative overflow-hidden">
          {/* Progress Bar & Header */}
          <div className="flex items-center justify-between gap-4 pb-4 mb-6 border-b border-pline text-xs text-pmuted">
            <div className="flex items-center gap-2 font-medium">
              <span className="px-2 py-0.5 rounded-full bg-psurface text-pfg font-semibold">
                {currentIndex + 1} / {DEMO_QUESTIONS.length}
              </span>
              <span>{lang === 'uz' ? 'Demo savol' : 'Демо вопрос'}</span>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1 text-pprimary font-semibold">
                <Trophy className="w-3.5 h-3.5" />
                <span>
                  {score} {lang === 'uz' ? "to'g'ri" : 'верно'}
                </span>
              </div>
              <button
                type="button"
                onClick={handleRestart}
                className="p-1.5 rounded-control hover:bg-psurface text-pmuted hover:text-pfg transition-colors"
                title={lang === 'uz' ? 'Qayta boshlash' : 'Сначала'}
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Question Text */}
          <h3 className="text-base sm:text-lg font-semibold text-pfg mb-5 leading-snug">
            {lang === 'uz' ? currentQ.questionUz : currentQ.questionRu}
          </h3>

          {/* Question Image (if any) */}
          {currentQ.image && (
            <div className="mb-6 rounded-container overflow-hidden border border-pline bg-psurface/50 flex items-center justify-center max-h-64">
              <img
                src={currentQ.image}
                alt="Question illustration"
                className="max-h-60 w-auto object-contain rounded-control transition-transform duration-300 hover:scale-105"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none'
                }}
              />
            </div>
          )}

          {/* Options Grid */}
          <div className="space-y-2.5 mb-6">
            {(lang === 'uz' ? currentQ.optionsUz : currentQ.optionsRu).map((opt, idx) => {
              const isSelected = selectedOption === idx
              const isCorrect = idx === currentQ.correctIndex
              let optionStyle = 'bg-psurface/60 border-pline text-pfg hover:border-pprimary/50 hover:bg-psurface'

              if (selectedOption !== null) {
                if (isCorrect) {
                  optionStyle = 'bg-psuccess/15 border-psuccess text-psuccess font-semibold'
                } else if (isSelected) {
                  optionStyle = 'bg-pdanger/15 border-pdanger text-pdanger font-semibold'
                } else {
                  optionStyle = 'bg-psurface/30 border-pline/40 text-pmuted opacity-60'
                }
              }

              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSelectOption(idx)}
                  disabled={selectedOption !== null}
                  className={`w-full text-left p-3.5 sm:p-4 rounded-container border text-xs sm:text-sm transition-all duration-200 flex items-start justify-between gap-3 ${optionStyle}`}
                >
                  <div className="flex items-start gap-3">
                    <span className="w-5 h-5 rounded-full bg-pcanvas/60 border border-pline flex items-center justify-center text-[11px] font-bold shrink-0 mt-0.5">
                      {String.fromCharCode(65 + idx)}
                    </span>
                    <span>{opt}</span>
                  </div>

                  {selectedOption !== null && (
                    <div className="shrink-0 mt-0.5">
                      {isCorrect && <CheckCircle2 className="w-5 h-5 text-psuccess" />}
                      {isSelected && !isCorrect && <XCircle className="w-5 h-5 text-pdanger" />}
                    </div>
                  )}
                </button>
              )
            })}
          </div>

          {/* Legal Explanation Card (revealed upon answer) */}
          {showExplanation && (
            <div className="p-4 rounded-container bg-psurface border border-pline mb-6 animate-in fade-in slide-in-from-top-2 duration-300">
              <div className="flex items-start gap-2.5">
                <BookOpen className="w-4 h-4 text-pprimary shrink-0 mt-0.5" />
                <div className="flex-1 text-xs sm:text-sm">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold text-pfg">
                      {lang === 'uz' ? 'Qonuniy Tushuntirish' : 'Пояснение ПДД'}
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-pprimary/10 text-pprimary text-[10px] font-semibold">
                      {currentQ.ruleRef}
                    </span>
                  </div>
                  <p className="text-pmuted leading-relaxed">
                    {lang === 'uz' ? currentQ.explanationUz : currentQ.explanationRu}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Action Footer */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
            <div className="text-xs text-pmuted flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 text-pprimary" />
              <span>
                {lang === 'uz'
                  ? "Barcha 700+ savollarda to'liq qonuniy izoh bor"
                  : 'Все 700+ вопросов снабжены подробным разбором'}
              </span>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              {!isCompleted && selectedOption !== null && currentIndex < DEMO_QUESTIONS.length - 1 ? (
                <button
                  type="button"
                  onClick={handleNext}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-control bg-pprimary text-ponprimary text-xs font-semibold flex items-center justify-center gap-2 hover:brightness-110 transition-all"
                >
                  <span>{lang === 'uz' ? 'Keyingi savol' : 'Следующий вопрос'}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              ) : (
                <a
                  href={telegramBotUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full sm:w-auto px-5 py-2.5 rounded-control bg-pprimary text-ponprimary text-xs font-semibold flex items-center justify-center gap-2 hover:brightness-110 shadow-md shadow-pprimary/20 transition-all"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>
                    {lang === 'uz'
                      ? "Barcha 70 biletni Telegramda yechish"
                      : 'Решать все 70 билетов в Telegram'}
                  </span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </a>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
