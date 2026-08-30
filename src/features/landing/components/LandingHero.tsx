import React, { useState } from 'react'
import {
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Star,
  Users,
  Award,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Flame,
  Languages,
  Car,
  Zap,
} from 'lucide-react'
import { playSound } from '../../../shared/lib/sounds'
import { config } from '../../../shared/config'

interface LandingHeroProps {
  lang: 'uz' | 'ru'
  onOpenAuth: () => void
  onOpenApkModal: () => void
  onScrollToDemo: () => void
}

interface DemoSubjectQuestion {
  id: string
  subjectNameUz: string
  subjectNameRu: string
  icon: React.ElementType
  badgeUz: string
  badgeRu: string
  questionUz: string
  questionRu: string
  options: {
    textUz: string
    textRu: string
    correct: boolean
  }[]
  explanationUz: string
  explanationRu: string
}

const DEMO_QUESTIONS: DemoSubjectQuestion[] = [
  {
    id: 'rustili',
    subjectNameUz: 'Rus tili',
    subjectNameRu: 'Русский язык',
    icon: Languages,
    badgeUz: 'Milliy Sertifikat & Attestatsiya',
    badgeRu: 'Национальный Сертификат и Аттестация',
    questionUz: 'Укажите предложение с составным глагольным сказуемым:',
    questionRu: 'Укажите предложение с составным глагольным сказуемым:',
    options: [
      {
        textUz: 'Он начал внимательно читать новую книгу.',
        textRu: 'Он начал внимательно читать новую книгу.',
        correct: true,
      },
      {
        textUz: 'Вечер был тихим и прохладным.',
        textRu: 'Вечер был тихим и прохладным.',
        correct: false,
      },
      {
        textUz: 'Мы приехали на вокзал вовремя.',
        textRu: 'Мы приехали на вокзал вовремя.',
        correct: false,
      },
    ],
    explanationUz: '"Начал читать" — yordamchi fe\'l (начал) va infinitiv (читать) birikmasidan iborat tarkibli fe\'l kesim hisoblanadi.',
    explanationRu: '«Начал читать» — составное глагольное сказуемое (вспомогательный глагол + инфинитив).',
  },
  {
    id: 'yhq',
    subjectNameUz: 'Yo\'l Harakati (YHQ)',
    subjectNameRu: 'Правила Дорожного Движения',
    icon: Car,
    badgeUz: 'DXX YHXBB 2026 Biletlari',
    badgeRu: 'Билеты ГСБДД 2026',
    questionUz: 'Qaysi holatda haydovchiga chorrahada harakatlanish imtiyozi beriladi?',
    questionRu: 'В каком случае водителю предоставляется преимущество на перекрестке?',
    options: [
      {
        textUz: 'Asosiy yo\'ldan harakatlanayotganda (2.1 belgisi)',
        textRu: 'При движении по главной дороге (знак 2.1)',
        correct: true,
      },
      {
        textUz: 'Ikkinchi darajali yo\'ldan chapga burilganda',
        textRu: 'При повороте налево со второстепенной дороги',
        correct: false,
      },
      {
        textUz: 'Yo\'l bering (2.4) belgisi o\'rnatilganda',
        textRu: 'При установленном знаке «Уступите дорогу»',
        correct: false,
      },
    ],
    explanationUz: 'YHQ 13.1-bandiga binoan 2.1 "Asosiy yo\'l" belgisida harakatlanuvchi haydovchi imtiyozga ega.',
    explanationRu: 'Согласно п. 13.1 ПДД, знак 2.1 «Главная дорога» дает приоритет проезда.',
  },
  {
    id: 'fizika',
    subjectNameUz: 'Fizika & Matematika',
    subjectNameRu: 'Физика и Математика',
    icon: Zap,
    badgeUz: 'DTM & Attestatsiya Formulalari',
    badgeRu: 'Формулы ДТМ и Аттестации',
    questionUz: 'f(x) = 3x² - 6x + 5 funksiyaning eng kichik qiymatini toping:',
    questionRu: 'Найдите наименьшее значение функции f(x) = 3x² - 6x + 5:',
    options: [
      {
        textUz: 'y_min = 2 (x = 1 nuqtada)',
        textRu: 'y_min = 2 (в точке x = 1)',
        correct: true,
      },
      {
        textUz: 'y_min = 5',
        textRu: 'y_min = 5',
        correct: false,
      },
      {
        textUz: 'y_min = 0',
        textRu: 'y_min = 0',
        correct: false,
      },
    ],
    explanationUz: 'Parabola uchi x = -b/(2a) = 6/6 = 1. Funksiya qiymati: f(1) = 3(1) - 6(1) + 5 = 2.',
    explanationRu: 'Вершина параболы x = -b/(2a) = 1. Значение f(1) = 3 - 6 + 5 = 2.',
  },
]

export const LandingHero: React.FC<LandingHeroProps> = ({
  lang,
  onOpenAuth,
  onOpenApkModal,
}) => {
  const botUsername = config.botUsername || 'kivvi_app_bot'
  const telegramBotUrl = `https://t.me/${botUsername}`

  const [activeSubjectIdx, setActiveSubjectIdx] = useState(0)
  const [selectedOpt, setSelectedOpt] = useState<number | null>(null)
  const [streakCount, setStreakCount] = useState(3)
  const [xpEarned, setXpEarned] = useState(250)
  const [showExplanation, setShowExplanation] = useState(false)

  const currentQ = DEMO_QUESTIONS[activeSubjectIdx]
  const SubjectIcon = currentQ.icon

  const handleSubjectTab = (idx: number) => {
    playSound('click')
    setActiveSubjectIdx(idx)
    setSelectedOpt(null)
    setShowExplanation(false)
  }

  const handleHeroChoice = (idx: number) => {
    if (selectedOpt !== null) return
    setSelectedOpt(idx)
    setShowExplanation(true)
    if (currentQ.options[idx].correct) {
      playSound('success')
      setStreakCount((prev) => prev + 1)
      setXpEarned((prev) => prev + 50)
    } else {
      playSound('error')
    }
  }

  const handleResetChoice = () => {
    playSound('click')
    setSelectedOpt(null)
    setShowExplanation(false)
  }

  return (
    <section id="hero" className="relative pt-32 pb-16 md:pt-40 md:pb-24 overflow-hidden">
      {/* Ambient Lighting Glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] sm:w-[1100px] h-[500px] sm:h-[700px] bg-gradient-to-tr from-pprimary/15 via-emerald-500/10 to-transparent blur-[160px] rounded-full pointer-events-none -z-10" />

      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 xl:gap-16 items-center">
          {/* Left Column: Authentic Copy & CTAs (7 cols) */}
          <div className="lg:col-span-7 text-center lg:text-left">
            {/* Top Ecosystem Pill */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-psurface/90 shadow-sm mb-6 animate-in fade-in slide-in-from-bottom-3 duration-500">
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-pprimary opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-pprimary"></span>
              </span>
              <span className="text-[12px] font-semibold text-pfg tracking-wide font-sans">
                {lang === 'uz'
                  ? 'DTM • Milliy Sertifikat • Attestatsiya • YHQ • Barcha Fanlar'
                  : 'ДТМ • Национальный Сертификат • Аттестация • ПДД • Все Предметы'}
              </span>
            </div>

            {/* Main Display Headline */}
            <h1 className="text-4xl sm:text-6xl lg:text-6xl xl:text-7xl font-display font-black tracking-[-0.035em] text-pfg leading-[1.08] mb-6">
              {lang === 'uz' ? (
                <>
                  Imtihonlarga tayyorlanishning{' '}
                  <span className="text-pprimary">
                    eng zamonaviy
                  </span>{' '}
                  va aqlli usuli
                </>
              ) : (
                <>
                  Самый современный и{' '}
                  <span className="text-pprimary">
                    умный способ
                  </span>{' '}
                  подготовки к экзаменам
                </>
              )}
            </h1>

            {/* Subtitle */}
            <p className="text-[15px] sm:text-[17px] xl:text-[19px] text-pmuted max-w-2xl mx-auto lg:mx-0 mb-9 leading-relaxed font-sans font-medium">
              {lang === 'uz'
                ? "Rus tili, Matematika, Fizika, Kimyo, Ingliz tili, Tarix, Biologiya hamda Yo'l Harakati Qoidalari — barchasi bitta qulay platformada. Jonli 1v1 PvP duellar, rasmiy test simulyatori va aqlli AI tahlil."
                : 'Русский язык, Математика, Физика, Химия, Английский язык, История, Биология и ПДД — все в одной платформе. Живые 1v1 PvP дуэли, симуляторы экзаменов и умный разбор ошибок.'}
            </p>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3.5 mb-10">
              {/* Primary Telegram CTA */}
              <a
                href={telegramBotUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => playSound('click')}
                className="w-full sm:w-auto px-7 py-4 rounded-container bg-pprimary text-ponprimary font-bold text-[15px] flex items-center justify-center gap-3 shadow-xl shadow-pprimary/25 hover:brightness-110 active:scale-[0.98] transition-all duration-150"
              >
                <Sparkles size={18} strokeWidth={2} />
                <span>{lang === 'uz' ? 'Telegramda Bepul Boshlash' : 'Начать в Telegram бесплатно'}</span>
                <ArrowRight size={16} strokeWidth={2} />
              </a>

              {/* Web Login */}
              <button
                type="button"
                onClick={() => {
                  playSound('click')
                  onOpenAuth()
                }}
                className="w-full sm:w-auto px-6 py-4 rounded-container bg-psurface hover:bg-pcard text-pfg font-semibold text-[15px] flex items-center justify-center gap-2.5 transition-all duration-150 active:scale-[0.98] shadow-xs"
              >
                <ShieldCheck size={18} strokeWidth={1.75} className="text-pmuted" />
                <span>{lang === 'uz' ? 'Veb-versiyaga kirish' : 'Войти через веб'}</span>
              </button>

              {/* Android APK */}
              <button
                type="button"
                onClick={() => {
                  playSound('click')
                  onOpenApkModal()
                }}
                className="w-full sm:w-auto px-5 py-4 rounded-container bg-psurface/70 hover:bg-psurface text-pmuted hover:text-pfg font-semibold text-[15px] flex items-center justify-center gap-2 transition-all duration-150 active:scale-[0.98] shadow-xs"
              >
                <span>APK</span>
              </button>
            </div>

            {/* Social Trust Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4">
              <div className="p-3.5 rounded-container bg-psurface/60 flex flex-col items-center lg:items-start shadow-xs">
                <div className="flex items-center gap-1 text-pgold mb-1">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} size={14} className="fill-pgold text-pgold" />
                  ))}
                </div>
                <span className="font-bold text-[13px] text-pfg">4.9 / 5.0</span>
                <span className="text-[11px] text-psubtle font-medium">12,000+ baholar</span>
              </div>

              <div className="p-3.5 rounded-container bg-psurface/60 flex flex-col items-center lg:items-start shadow-xs">
                <Users size={16} strokeWidth={1.75} className="text-pmuted mb-1" />
                <span className="font-bold text-[13px] text-pfg">50,000+</span>
                <span className="text-[11px] text-psubtle font-medium">O'quvchi & ustozlar</span>
              </div>

              <div className="p-3.5 rounded-container bg-psurface/60 flex flex-col items-center lg:items-start shadow-xs">
                <Award size={16} strokeWidth={1.75} className="text-pmuted mb-1" />
                <span className="font-bold text-[13px] text-pfg">98.4%</span>
                <span className="text-[11px] text-psubtle font-medium">Muvaffaqiyat ko'rsatkichi</span>
              </div>

              <div className="p-3.5 rounded-container bg-psurface/60 flex flex-col items-center lg:items-start shadow-xs">
                <Sparkles size={16} strokeWidth={1.75} className="text-pmuted mb-1" />
                <span className="font-bold text-[13px] text-pfg">8 ta Fan</span>
                <span className="text-[11px] text-psubtle font-medium">Barcha imtihon formatlari</span>
              </div>
            </div>
          </div>

          {/* Right Column: Multi-Subject Live Interactive Engine (5 cols) */}
          <div className="lg:col-span-5 relative">
            {/* Subject Selector Tabs */}
            <div className="flex items-center justify-center gap-1.5 mb-3 bg-psurface/80 p-1.5 rounded-full shadow-xs">
              {DEMO_QUESTIONS.map((q, idx) => {
                const TabIcon = q.icon
                const isActive = activeSubjectIdx === idx
                return (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() => handleSubjectTab(idx)}
                    className={`px-3.5 py-1.5 rounded-full text-[12px] font-semibold transition-all flex items-center gap-1.5 ${
                      isActive
                        ? 'bg-pprimary text-ponprimary shadow-xs font-bold'
                        : 'text-pmuted hover:text-pfg'
                    }`}
                  >
                    <TabIcon size={14} strokeWidth={isActive ? 2 : 1.75} />
                    <span>{q.subjectNameUz}</span>
                  </button>
                )
              })}
            </div>

            <div className="relative mx-auto max-w-md xl:max-w-lg rounded-sheet p-4 bg-gradient-to-b from-psurface via-pcard to-psurface shadow-2xl backdrop-blur-xl">
              {/* Inner Device Screen */}
              <div className="rounded-container bg-pcanvas p-5 sm:p-6 relative overflow-hidden shadow-inner">
                {/* Top Status & Streak */}
                <div className="flex items-center justify-between pb-3 mb-3">
                  <div className="flex items-center gap-2 font-bold text-[13px] text-pfg">
                    <SubjectIcon size={17} strokeWidth={1.75} className="text-pprimary" />
                    <span>{lang === 'uz' ? currentQ.subjectNameUz : currentQ.subjectNameRu}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-pwarning/15 text-pwarning font-bold text-[11px]">
                      <Flame size={13} className="fill-pwarning" />
                      <span>x{streakCount}</span>
                    </div>
                    <div className="text-[11px] font-mono font-bold text-pgold">
                      +{xpEarned} XP
                    </div>
                  </div>
                </div>

                {/* Subject Badge */}
                <div className="mb-3 px-3 py-1.5 rounded-control bg-psurface text-[11px] font-semibold text-pprimary flex items-center justify-between shadow-xs">
                  <span>{lang === 'uz' ? currentQ.badgeUz : currentQ.badgeRu}</span>
                  <span className="text-[10px] text-psubtle uppercase font-mono">Jonli Sinov</span>
                </div>

                {/* Question Prompt */}
                <h4 className="text-[15px] sm:text-[16px] font-bold text-pfg mb-4 leading-snug font-sans">
                  {lang === 'uz' ? currentQ.questionUz : currentQ.questionRu}
                </h4>

                {/* Interactive Options */}
                <div className="space-y-2 mb-4">
                  {currentQ.options.map((opt, idx) => {
                    const isSelected = selectedOpt === idx
                    let btnStyle = 'bg-psurface/90 text-pfg hover:bg-psurface'
                    if (selectedOpt !== null) {
                      if (opt.correct) {
                        btnStyle = 'bg-psuccess/20 text-psuccess font-bold'
                      } else if (isSelected) {
                        btnStyle = 'bg-pdanger/20 text-pdanger font-bold'
                      } else {
                        btnStyle = 'opacity-40 text-pmuted'
                      }
                    }

                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleHeroChoice(idx)}
                        disabled={selectedOpt !== null}
                        className={`w-full p-3 rounded-control text-left text-[13px] sm:text-[14px] font-medium transition-all flex items-center justify-between shadow-xs active:scale-[0.99] ${btnStyle}`}
                      >
                        <span className="leading-snug">{lang === 'uz' ? opt.textUz : opt.textRu}</span>
                        {selectedOpt !== null && (
                          <span className="ml-2 shrink-0">
                            {opt.correct && <CheckCircle2 size={16} className="text-psuccess" />}
                            {isSelected && !opt.correct && <XCircle size={16} className="text-pdanger" />}
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>

                {/* Explanation Box */}
                {showExplanation && (
                  <div className="p-3.5 rounded-control bg-psurface text-[12px] animate-in fade-in mb-3 shadow-xs">
                    <div className="flex items-center gap-1.5 text-pprimary font-bold text-[12px] mb-1">
                      <span>{lang === 'uz' ? 'Qonuniy / Ilmiy tushuntirish:' : 'Научное / Правовое пояснение:'}</span>
                    </div>
                    <p className="text-pmuted text-[12px] leading-relaxed font-sans">
                      {lang === 'uz' ? currentQ.explanationUz : currentQ.explanationRu}
                    </p>
                  </div>
                )}

                {/* Card Reset / Switch */}
                <div className="flex items-center justify-between pt-1">
                  <button
                    type="button"
                    onClick={handleResetChoice}
                    className="text-[12px] text-pmuted hover:text-pfg flex items-center gap-1.5 transition-colors font-medium"
                  >
                    <RotateCcw size={13} strokeWidth={1.75} />
                    <span>{lang === 'uz' ? 'Qayta urinish' : 'Сбросить'}</span>
                  </button>

                  <a
                    href={telegramBotUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[12px] font-bold text-pprimary hover:underline flex items-center gap-1"
                  >
                    <span>{lang === 'uz' ? 'Barcha testlar ›' : 'Все тесты ›'}</span>
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
