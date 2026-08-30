import React, { useState } from 'react'
import {
  FileText,
  Compass,
  Brain,
  Flame,
  Coins,
  Sparkles,
  ShieldAlert,
  Clock,
  Award,
  RotateCw,
  Zap,
} from 'lucide-react'
import { playSound } from '../../../shared/lib/sounds'
import Confetti from '../../../shared/components/Confetti'

interface LandingFeaturesBentoProps {
  lang: 'uz' | 'ru'
}

export const LandingFeaturesBento: React.FC<LandingFeaturesBentoProps> = ({ lang }) => {
  // Card 1: Exam matrix active question state
  const [activeQ, setActiveQ] = useState(3)

  // Card 3: Sign/Formula card flip state
  const [cardFlipped, setCardFlipped] = useState(false)

  // Card 5: Lucky Spin state
  const [spinning, setSpinning] = useState(false)
  const [spinDeg, setSpinDeg] = useState(0)
  const [spinWon, setSpinWon] = useState<string | null>(null)
  const [showConfetti, setShowConfetti] = useState(false)

  // Card 6: Boss Battle Raid state
  const [bossHp, setBossHp] = useState(84250)
  const [bossHit, setBossHit] = useState(false)

  const handleSpin = () => {
    if (spinning) return
    setSpinning(true)
    setSpinWon(null)
    setShowConfetti(false)
    playSound('chime')
    const randomRot = 1440 + Math.floor(Math.random() * 360)
    setSpinDeg((prev) => prev + randomRot)

    setTimeout(() => {
      setSpinning(false)
      playSound('win')
      setSpinWon(lang === 'uz' ? '🎉 Yutuq: 500 Coin + 1 Kunlik VIP!' : '🎉 Приз: 500 Coin + 1 День VIP!')
      setShowConfetti(true)
      setTimeout(() => setShowConfetti(false), 3000)
    }, 2800)
  }

  const handleAttackBoss = () => {
    playSound('combo')
    setBossHit(true)
    setBossHp((prev) => Math.max(0, prev - 50))
    setTimeout(() => setBossHit(false), 300)
  }

  return (
    <section id="features" className="py-20 md:py-28 relative">
      {showConfetti && <Confetti count={40} />}

      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10">
        {/* Section Title */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-pprimary/10 text-pprimary text-[12px] font-bold uppercase tracking-wider mb-3">
            <Sparkles size={14} strokeWidth={1.75} />
            <span>{lang === 'uz' ? 'Imkoniyatlar' : 'Функционал'}</span>
          </div>
          <h2 className="text-3xl sm:text-5xl font-display font-extrabold text-pfg tracking-tight mb-4">
            {lang === 'uz'
              ? 'Nega aynan KIWI bilan tayyorlanish kerak?'
              : 'Почему выбирают платформу KIWI?'}
          </h2>
          <p className="text-[15px] sm:text-[17px] text-pmuted leading-relaxed font-sans font-medium">
            {lang === 'uz'
              ? "Quruq yodlash emas — qiziqarli o'yinlar, real imtihon simulyatori va aqlli tahlil orqali bilimlarni mustahkamlang."
              : 'Не просто заучивание, а интерактивные игры, симуляторы реального экзамена и глубокий анализ ошибок.'}
          </p>
        </div>

        {/* Bento Grid (Widescreen 3-Columns) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
          {/* Card 1: Rasmiy Imtihon & Attestatsiya Simulyatori (2 Cols on lg) */}
          <div className="lg:col-span-2 p-6 sm:p-10 rounded-sheet bg-pcard hover:shadow-xl transition-all duration-300 relative overflow-hidden flex flex-col justify-between shadow-sm">
            <div>
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <FileText size={28} strokeWidth={1.75} className="text-pprimary" />
                  <div>
                    <span className="text-[11px] font-bold text-pprimary tracking-wider uppercase">
                      {lang === 'uz' ? 'Haqiqiy Imtihon Muhiti' : 'Экзаменационный стандарт'}
                    </span>
                    <h3 className="text-xl sm:text-3xl font-display font-bold text-pfg tracking-tight">
                      {lang === 'uz'
                        ? 'Attestatsiya, DTM va YHQ Imtihon Simulyatori'
                        : 'Симулятор Экзаменов: Аттестация, ДТМ и ПДД'}
                    </h3>
                  </div>
                </div>

                <div className="hidden sm:flex items-center gap-2 text-[12px] font-mono font-bold bg-psurface px-3.5 py-1.5 rounded-full text-pprimary shadow-xs">
                  <Clock size={14} strokeWidth={1.75} />
                  <span>19:42 qoldi</span>
                </div>
              </div>

              <p className="text-[14px] sm:text-[15px] text-pmuted mb-6 leading-relaxed font-sans font-medium">
                {lang === 'uz'
                  ? "Milliy sertifikat, O'qituvchilar attestatsiyasi, DTM kirish testlari va YHQ biletlari formati bo'yicha taymer, xatolar tahlili va to'liq ballar hisobi bilan real imtihon tajribasi."
                  : 'Реальный опыт экзамена по форматам Национального сертификата, Аттестации педагогов, ДТМ и ПДД с контролем времени и подсчетом баллов.'}
              </p>

              {/* Interactive 20-question Matrix Simulation */}
              <div className="p-4 sm:p-5 rounded-container bg-psurface/80 mb-6 shadow-xs">
                <div className="flex items-center justify-between text-[12px] text-pmuted mb-3">
                  <span className="font-bold text-pfg">
                    {lang === 'uz' ? '20 talik savollar matritsasi (Bosing):' : 'Матрица 20 вопросов (Кликните):'}
                  </span>
                  <span className="text-psuccess font-bold">1 xato / Max 2</span>
                </div>

                <div className="grid grid-cols-10 gap-2 sm:gap-2.5">
                  {Array.from({ length: 20 }, (_, i) => i + 1).map((qNum) => {
                    const isPassed = qNum < activeQ
                    const isError = qNum === 2
                    const isCurrent = qNum === activeQ

                    let qStyle = 'bg-pcard text-pmuted'
                    if (isCurrent) qStyle = 'bg-pprimary text-ponprimary font-bold shadow-md scale-105'
                    else if (isError) qStyle = 'bg-pdanger/20 text-pdanger font-bold'
                    else if (isPassed) qStyle = 'bg-psuccess/20 text-psuccess font-bold'

                    return (
                      <button
                        key={qNum}
                        type="button"
                        onClick={() => {
                          playSound('click')
                          setActiveQ(qNum)
                        }}
                        className={`h-9 sm:h-10 rounded-control text-[12px] sm:text-[13px] font-bold flex items-center justify-center transition-all hover:scale-105 shadow-xs ${qStyle}`}
                      >
                        {qNum}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2 text-[12px]">
              <div className="p-3 rounded-control bg-psurface flex items-center gap-2.5 shadow-xs">
                <ShieldAlert size={16} strokeWidth={1.75} className="text-pdanger shrink-0" />
                <span className="text-pmuted font-medium">Xatolar ustida ishlash</span>
              </div>
              <div className="p-3 rounded-control bg-psurface flex items-center gap-2.5 shadow-xs">
                <Clock size={16} strokeWidth={1.75} className="text-pprimary shrink-0" />
                <span className="text-pmuted font-medium">Real vaqt taymeri</span>
              </div>
              <div className="p-3 rounded-control bg-psurface flex items-center gap-2.5 col-span-2 sm:col-span-1 shadow-xs">
                <Award size={16} strokeWidth={1.75} className="text-pgold shrink-0" />
                <span className="text-pmuted font-medium">100% tushuntirish</span>
              </div>
            </div>
          </div>

          {/* Card 2: Interactive Lucky Spin Wheel (1 Col) */}
          <div className="p-6 sm:p-8 rounded-sheet bg-pcard hover:shadow-xl transition-all duration-300 relative overflow-hidden flex flex-col justify-between shadow-sm">
            <div>
              <div className="flex items-center gap-2.5 mb-4">
                <Coins size={24} strokeWidth={1.75} className="text-pgold" />
                <div>
                  <span className="text-[11px] font-bold text-pgold uppercase tracking-wider">
                    {lang === 'uz' ? 'Kunlik Bonus' : 'Ежедневный бонус'}
                  </span>
                  <h4 className="text-xl font-display font-bold text-pfg">
                    {lang === 'uz' ? 'Lucky Spin Charxpalak' : 'Колесо Фортуны'}
                  </h4>
                </div>
              </div>

              <p className="text-[13px] text-pmuted mb-4 font-sans font-medium">
                {lang === 'uz'
                  ? 'Har kuni omadli g\'ildirakni aylantiring va bepul tangalar, VIP tarif hamda sovg\'alar yuting:'
                  : 'Крутите колесо каждый день и выигрывайте монеты, VIP доступ и призы:'}
              </p>

              {/* Wheel Graphic */}
              <div className="flex flex-col items-center justify-center py-3 relative">
                <div className="relative w-40 h-40 flex items-center justify-center">
                  <div className="absolute -top-2.5 z-10 w-4 h-4 bg-pdanger transform rotate-45 shadow-md" />

                  <div
                    className="w-36 h-36 rounded-full bg-gradient-to-tr from-pgold/30 via-pprimary/30 to-pblue/30 flex items-center justify-center shadow-inner transition-transform duration-[2800ms] ease-out"
                    style={{ transform: `rotate(${spinDeg}deg)` }}
                  >
                    <div className="w-12 h-12 rounded-full bg-pcard flex items-center justify-center text-xs font-bold text-pgold shadow-md">
                      KIWI
                    </div>
                  </div>
                </div>

                {spinWon && (
                  <div className="text-[12px] font-bold text-psuccess mt-2 text-center animate-in zoom-in-95">
                    {spinWon}
                  </div>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={handleSpin}
              disabled={spinning}
              className="w-full py-3 rounded-control bg-pgold text-pongold font-bold text-[13px] flex items-center justify-center gap-2 shadow-md shadow-pgold/20 hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-60 mt-4"
            >
              <RotateCw size={15} className={spinning ? 'animate-spin' : ''} />
              <span>{spinning ? (lang === 'uz' ? 'Aylanmoqda...' : 'Вращается...') : (lang === 'uz' ? 'Aylantirish (Spin)' : 'Крутить (Спин)')}</span>
            </button>
          </div>

          {/* Card 3: Interactive Flashcards & Rules (1 Col) */}
          <div className="p-6 sm:p-8 rounded-sheet bg-pcard hover:shadow-xl transition-all duration-300 relative overflow-hidden flex flex-col justify-between shadow-sm">
            <div>
              <div className="flex items-center gap-2.5 mb-4">
                <Compass size={24} strokeWidth={1.75} className="text-pblue" />
                <div>
                  <span className="text-[11px] font-bold text-pblue uppercase tracking-wider">
                    {lang === 'uz' ? 'Interaktiv' : 'Интерактив'}
                  </span>
                  <h4 className="text-xl font-display font-bold text-pfg">
                    {lang === 'uz' ? 'Formulalar & Qoidalar' : 'Формулы и Правила'}
                  </h4>
                </div>
              </div>

              <p className="text-[13px] text-pmuted mb-4 font-sans font-medium">
                {lang === 'uz'
                  ? 'Shpargalkalar, belgilar va qoidalarni tezkor takrorlash kartalari:'
                  : 'Шпаргалки, формулы и правила в формате удобных карточек:'}
              </p>

              {/* Flippable Card */}
              <div
                onClick={() => {
                  playSound('click')
                  setCardFlipped(!cardFlipped)
                }}
                className="cursor-pointer p-5 rounded-container bg-psurface transition-all text-center min-h-[140px] flex flex-col items-center justify-center relative shadow-xs active:scale-[0.98]"
              >
                {!cardFlipped ? (
                  <div className="space-y-2 animate-in fade-in">
                    <div className="w-14 h-14 rounded-full bg-pprimary/20 text-pprimary text-xl flex items-center justify-center mx-auto shadow-md font-mono font-bold">
                      E=mc²
                    </div>
                    <div className="text-[13px] font-bold text-pfg">Eynshteyn Formulasi</div>
                    <div className="text-[11px] text-psubtle">Aylantirish uchun bosing ↻</div>
                  </div>
                ) : (
                  <div className="space-y-2 animate-in fade-in text-left text-[13px]">
                    <span className="font-bold text-pblue text-[13px]">Fizika: Energiya va Massa</span>
                    <p className="text-pmuted text-[12px] leading-relaxed">
                      Jismning to'liq energiyasi uning massasi va yorug'lik tezligi kvadratiga to'g'ri mutanosib.
                    </p>
                    <span className="text-[11px] text-pprimary font-bold block">Orqaga qaytarish ↻</span>
                  </div>
                )}
              </div>
            </div>

            <div className="text-[12px] text-pmuted mt-4 pt-3 flex items-center justify-between">
              <span>Barcha fanlar shpargalkasi</span>
              <span className="text-pblue font-bold text-[11px]">Audio/Matn</span>
            </div>
          </div>

          {/* Card 4: AI Spaced Repetition Memory Curve (1 Col) */}
          <div className="p-6 sm:p-8 rounded-sheet bg-pcard hover:shadow-xl transition-all duration-300 relative overflow-hidden flex flex-col justify-between shadow-sm">
            <div>
              <div className="flex items-center gap-2.5 mb-4">
                <Brain size={24} strokeWidth={1.75} className="text-pprimary" />
                <div>
                  <span className="text-[11px] font-bold text-pprimary uppercase tracking-wider">
                    {lang === 'uz' ? 'Ebbinghaus AI' : 'Эббингауз ИИ'}
                  </span>
                  <h4 className="text-xl font-display font-bold text-pfg">
                    {lang === 'uz' ? 'Smart Spaced Repetition' : 'Интервальное повторение'}
                  </h4>
                </div>
              </div>

              <p className="text-[13px] text-pmuted mb-4 font-sans font-medium">
                {lang === 'uz'
                  ? 'Siz adashgan savollarni xotirangiz o\'chib borayotgan daqiqada qayta taqdim etadi:'
                  : 'Предлагает сложные вопросы ровно в момент, когда память начинает угасать:'}
              </p>

              {/* Memory Retention Bar Graphic */}
              <div className="p-4 rounded-container bg-psurface space-y-3 text-[13px] shadow-xs">
                <div>
                  <div className="flex justify-between text-[12px] mb-1.5">
                    <span className="text-pfg font-bold">KIWI AI bilan:</span>
                    <span className="text-psuccess font-bold">92% eslab qolish</span>
                  </div>
                  <div className="w-full h-2 bg-pcanvas rounded-full overflow-hidden">
                    <div className="bg-pprimary h-full rounded-full" style={{ width: '92%' }} />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-[12px] mb-1.5 text-pmuted">
                    <span>Oddiy darslikda:</span>
                    <span>18% (1 haftadan so'ng)</span>
                  </div>
                  <div className="w-full h-2 bg-pcanvas rounded-full overflow-hidden">
                    <div className="bg-pmuted/40 h-full rounded-full" style={{ width: '18%' }} />
                  </div>
                </div>
              </div>
            </div>

            <div className="text-[12px] text-pprimary font-bold mt-4 pt-3">
              ✓ Xatolarni 100% yo'q qilish kafolati
            </div>
          </div>

          {/* Card 5: Weekly Boss Battle Raid (1 Col) */}
          <div className="p-6 sm:p-8 rounded-sheet bg-pcard hover:shadow-xl transition-all duration-300 relative overflow-hidden flex flex-col justify-between shadow-sm">
            <div>
              <div className="flex items-center gap-2.5 mb-4">
                <Flame size={24} strokeWidth={1.75} className="text-ppurple" />
                <div>
                  <span className="text-[11px] font-bold text-ppurple uppercase tracking-wider">
                    {lang === 'uz' ? 'Jamoaviy Jang' : 'Командный рейд'}
                  </span>
                  <h4 className="text-xl font-display font-bold text-pfg">
                    {lang === 'uz' ? 'Haftalik Boss Battle' : 'Битва с Боссом'}
                  </h4>
                </div>
              </div>

              <p className="text-[13px] text-pmuted mb-4 font-sans font-medium">
                {lang === 'uz'
                  ? 'Har dushanba butun hamjamiyat bilan bitta katta Boss ga qarshi zarba bering:'
                  : 'Каждый понедельник наносите совместный урон супер-боссу недели:'}
              </p>

              {/* Interactive Boss HP Simulation */}
              <div className="p-4 rounded-container bg-psurface text-center shadow-xs">
                <div className={`text-3xl mb-1 transition-transform ${bossHit ? 'scale-125 animate-bounce' : ''}`}>
                  👹
                </div>
                <div className="text-[13px] font-bold text-pfg mb-1">Mega Qoidabuzar Boss</div>
                <div className="w-full h-2.5 bg-pcanvas rounded-full overflow-hidden mb-2">
                  <div
                    className="bg-pdanger h-full rounded-full transition-all duration-300"
                    style={{ width: `${(bossHp / 100000) * 100}%` }}
                  />
                </div>
                <div className="text-[11px] text-pmuted font-mono">HP: {bossHp.toLocaleString()} / 100,000</div>
              </div>
            </div>

            <button
              type="button"
              onClick={handleAttackBoss}
              className="w-full py-3 rounded-control bg-pdanger/20 hover:bg-pdanger/30 text-pdanger font-bold text-[13px] flex items-center justify-center gap-2 transition-all mt-4 shadow-xs active:scale-[0.98]"
            >
              <Zap size={14} strokeWidth={2} />
              <span>{lang === 'uz' ? '⚔️ Hujum qilish (-50 DMG)' : '⚔️ Ударить (-50 DMG)'}</span>
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}
