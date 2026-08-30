import React, { useState, useEffect } from 'react'
import { Swords, Timer, Zap, Trophy, RotateCcw, Flame, Sparkles } from 'lucide-react'
import { playSound } from '../../../shared/lib/sounds'
import { config } from '../../../shared/config'

interface LandingPvPWidgetProps {
  lang: 'uz' | 'ru'
}

export const LandingPvPWidget: React.FC<LandingPvPWidgetProps> = ({ lang }) => {
  const [stage, setStage] = useState<'idle' | 'searching' | 'battle' | 'finished'>('idle')
  const [timeLeft, setTimeLeft] = useState(5)
  const [selectedOption, setSelectedOption] = useState<number | null>(null)
  const [winner, setWinner] = useState<'user' | 'opponent' | null>(null)

  const botUsername = config.botUsername || 'kivvi_app_bot'
  const telegramBotUrl = `https://t.me/${botUsername}`

  const startSearch = () => {
    playSound('click')
    setStage('searching')
    setTimeout(() => {
      playSound('match')
      setStage('battle')
      setTimeLeft(5)
      setSelectedOption(null)
      setWinner(null)
    }, 1800)
  }

  useEffect(() => {
    let timer: ReturnType<typeof setInterval>
    if (stage === 'battle' && timeLeft > 0 && selectedOption === null) {
      timer = setInterval(() => {
        setTimeLeft((prev) => prev - 1)
      }, 1000)
    } else if (stage === 'battle' && timeLeft === 0 && selectedOption === null) {
      playSound('error')
      setSelectedOption(0)
      setWinner('opponent')
      setStage('finished')
    }
    return () => clearInterval(timer)
  }, [stage, timeLeft, selectedOption])

  const handleAnswer = (idx: number) => {
    if (selectedOption !== null || stage !== 'battle') return
    setSelectedOption(idx)
    if (idx === 1) {
      playSound('win')
      setWinner('user')
      setStage('finished')
    } else {
      playSound('error')
      setWinner('opponent')
      setStage('finished')
    }
  }

  const handleReset = () => {
    playSound('click')
    setStage('idle')
    setTimeLeft(5)
    setSelectedOption(null)
    setWinner(null)
  }

  return (
    <div className="p-6 sm:p-10 rounded-sheet bg-gradient-to-b from-pcard via-pcard to-psurface shadow-2xl relative overflow-hidden">
      {/* Background Ambient Glow */}
      <div className="absolute top-0 right-0 w-80 h-80 bg-pgold/10 blur-[100px] rounded-full pointer-events-none -z-10" />

      {/* Header */}
      <div className="flex items-center justify-between pb-4 mb-6 text-[13px]">
        <div className="flex items-center gap-2 font-bold text-pgold">
          <Swords size={18} strokeWidth={1.75} />
          <span>{lang === 'uz' ? 'Oktagon 1v1 PvP Arena' : 'Октагон 1v1 PvP Арена'}</span>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-pmuted bg-psurface px-3 py-1 rounded-full shadow-xs">
          <span className="w-2 h-2 rounded-full bg-psuccess animate-pulse" />
          <span className="font-semibold">{lang === 'uz' ? '418 o\'yinchi online' : '418 игроков онлайн'}</span>
        </div>
      </div>

      {/* Stage: Idle */}
      {stage === 'idle' && (
        <div className="text-center py-8 sm:py-12">
          <div className="w-18 h-18 rounded-container bg-pgold/15 flex items-center justify-center mx-auto mb-5 text-pgold shadow-xl shadow-pgold/10">
            <Swords size={36} strokeWidth={1.75} />
          </div>
          <h4 className="text-xl sm:text-2xl font-display font-bold text-pfg mb-2">
            {lang === 'uz' ? 'Jonli Duel Simulyatori' : 'Симулятор живой дуэли'}
          </h4>
          <p className="text-[14px] text-pmuted max-w-md mx-auto mb-8 font-sans font-medium">
            {lang === 'uz'
              ? 'Raqib bilan 5 soniyalik blitz savol-javob jangini hoziroq sinab ko\'ring:'
              : 'Попробуйте 5-секундную блиц-дуэль с реальным соперником:'}
          </p>
          <button
            type="button"
            onClick={startSearch}
            className="px-8 py-3.5 rounded-container bg-pgold text-pongold font-bold text-[14px] inline-flex items-center gap-2 shadow-xl shadow-pgold/20 hover:brightness-110 active:scale-[0.98] transition-all"
          >
            <Zap size={16} strokeWidth={2} />
            <span>{lang === 'uz' ? 'Raqib Qidirish (Jangni Boshlash)' : 'Найти соперника'}</span>
          </button>
        </div>
      )}

      {/* Stage: Searching */}
      {stage === 'searching' && (
        <div className="text-center py-12 sm:py-16 animate-in fade-in">
          <div className="w-20 h-20 rounded-full border-2 border-pgold border-t-transparent animate-spin mx-auto mb-6" />
          <h4 className="text-lg sm:text-xl font-display font-bold text-pfg mb-2">
            {lang === 'uz' ? 'Munosib raqib qidirilmoqda...' : 'Поиск соперника...'}
          </h4>
          <p className="text-[12px] text-pmuted font-mono">
            {lang === 'uz' ? 'Oltin Liga • Elo: 1450' : 'Золотая Лига • Эло: 1450'}
          </p>
        </div>
      )}

      {/* Stage: Battle */}
      {stage === 'battle' && (
        <div className="animate-in fade-in">
          {/* Matchup Bar */}
          <div className="flex items-center justify-between p-4 rounded-container bg-psurface mb-6 shadow-xs">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-pprimary/20 text-pprimary flex items-center justify-center font-bold text-[13px] shadow-xs">
                Siz
              </div>
              <div className="text-left">
                <div className="text-[13px] font-bold text-pfg">{lang === 'uz' ? 'Siz' : 'Вы'}</div>
                <div className="text-[11px] text-psuccess font-bold">1420 Elo</div>
              </div>
            </div>

            {/* Timer Countdown */}
            <div className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-pdanger/15 text-pdanger font-mono font-bold text-[14px] shadow-xs">
              <Timer size={16} strokeWidth={2} />
              <span>00:0{timeLeft}</span>
            </div>

            <div className="flex items-center gap-3">
              <div className="text-right">
                <div className="text-[13px] font-bold text-pfg">Azizbek_UZ</div>
                <div className="text-[11px] text-pgold font-bold">1450 Elo</div>
              </div>
              <div className="w-10 h-10 rounded-full bg-pdanger/20 text-pdanger flex items-center justify-center font-bold text-[13px] shadow-xs">
                Aziz
              </div>
            </div>
          </div>

          {/* Question Prompt */}
          <div className="text-center mb-6">
            <span className="text-[11px] font-bold text-pprimary uppercase tracking-wider block mb-2 font-mono">
              Savol 1 / 1 (Blitz)
            </span>
            <h4 className="text-[15px] sm:text-[18px] font-bold text-pfg max-w-xl mx-auto leading-snug font-sans">
              {lang === 'uz'
                ? "Turar-joy dahalarida (jiloy zona) ruxsat etilgan eng yuqori tezlik qancha?"
                : 'Какова максимальная разрешенная скорость движения в жилых зонах?'}
            </h4>
          </div>

          {/* Answer Choices */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-2xl mx-auto">
            {[
              { textUz: '30 km/soat', textRu: '30 км/ч' },
              { textUz: '20 km/soat (To\'g\'ri)', textRu: '20 км/ч (Верно)' },
              { textUz: '50 km/soat', textRu: '50 км/ч' },
            ].map((opt, idx) => {
              const isSelected = selectedOption === idx
              let btnStyle = 'bg-psurface hover:bg-pcard text-pfg'
              if (selectedOption !== null) {
                if (idx === 1) btnStyle = 'bg-psuccess/30 text-psuccess font-bold'
                else if (isSelected) btnStyle = 'bg-pdanger/30 text-pdanger font-bold'
                else btnStyle = 'opacity-40 text-pmuted'
              }

              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleAnswer(idx)}
                  disabled={selectedOption !== null}
                  className={`p-4 rounded-container text-[14px] font-bold transition-all shadow-xs active:scale-[0.98] ${btnStyle}`}
                >
                  {lang === 'uz' ? opt.textUz : opt.textRu}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Stage: Finished */}
      {stage === 'finished' && (
        <div className="text-center py-6 sm:py-8 animate-in zoom-in-95">
          {winner === 'user' ? (
            <div>
              <div className="w-16 h-16 rounded-container bg-psuccess/20 text-psuccess flex items-center justify-center mx-auto mb-4 shadow-xl shadow-psuccess/20">
                <Trophy size={32} strokeWidth={1.75} />
              </div>
              <h4 className="text-2xl sm:text-3xl font-display font-extrabold text-psuccess mb-2">
                {lang === 'uz' ? 'G\'alaba! 🎉' : 'Победа! 🎉'}
              </h4>
              <p className="text-[13px] text-pmuted mb-6 font-sans">
                {lang === 'uz'
                  ? 'Siz raqibdan tezroq javob berdingiz: +25 Reyting ochkosi va 50 Coin qo\'lga kiritildi!'
                  : 'Вы ответили быстрее соперника: +25 очков рейтинга и 50 монет!'}
              </p>
            </div>
          ) : (
            <div>
              <div className="w-16 h-16 rounded-container bg-pdanger/20 text-pdanger flex items-center justify-center mx-auto mb-4">
                <Flame size={32} strokeWidth={1.75} />
              </div>
              <h4 className="text-2xl sm:text-3xl font-display font-extrabold text-pdanger mb-2">
                {lang === 'uz' ? 'Mag\'lubiyat ⚠️' : 'Поражение ⚠️'}
              </h4>
              <p className="text-[13px] text-pmuted mb-6 font-sans">
                {lang === 'uz'
                  ? 'Raqib tezroq topdi yoki vaqt tugadi. Keyingi duelda omadingizni sinab ko\'ring!'
                  : 'Соперник оказался быстрее или истекло время. Попробуйте еще раз!'}
              </p>
            </div>
          )}

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              type="button"
              onClick={handleReset}
              className="px-6 py-3 rounded-container bg-psurface hover:bg-pcard text-pfg font-bold text-[13px] flex items-center gap-2 transition-colors shadow-xs active:scale-[0.98]"
            >
              <RotateCcw size={15} strokeWidth={1.75} />
              <span>{lang === 'uz' ? 'Yana Sinash' : 'Еще раз'}</span>
            </button>

            <a
              href={telegramBotUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => playSound('click')}
              className="px-6 py-3 rounded-container bg-pprimary text-ponprimary font-bold text-[13px] flex items-center gap-2 shadow-lg shadow-pprimary/25 hover:brightness-110 active:scale-[0.98] transition-all"
            >
              <Sparkles size={15} strokeWidth={2} />
              <span>{lang === 'uz' ? 'Oktagonda Haqiqiy Jang' : 'Играть в Октагоне'}</span>
            </a>
          </div>
        </div>
      )}
    </div>
  )
}
