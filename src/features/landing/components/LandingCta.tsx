import React from 'react'
import { Sparkles, ArrowRight, ShieldCheck } from 'lucide-react'
import { config } from '../../../shared/config'
import { playSound } from '../../../shared/lib/sounds'

interface LandingCtaProps {
  lang: 'uz' | 'ru'
  onOpenAuth: () => void
  onOpenApkModal: () => void
}

export const LandingCta: React.FC<LandingCtaProps> = ({
  lang,
  onOpenAuth,
  onOpenApkModal,
}) => {
  const botUsername = config.botUsername || 'kivvi_app_bot'
  const telegramBotUrl = `https://t.me/${botUsername}`

  return (
    <section className="py-20 md:py-28 relative overflow-hidden">
      {/* Background Glow */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-pprimary/5 to-transparent pointer-events-none -z-10" />
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[800px] sm:w-[1200px] h-[350px] bg-pprimary/10 blur-[140px] rounded-full pointer-events-none -z-10" />

      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10 text-center">
        <div className="max-w-6xl mx-auto p-8 sm:p-16 xl:p-20 rounded-sheet bg-gradient-to-b from-pcard via-pcard to-psurface shadow-2xl relative overflow-hidden">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-pprimary/10 text-pprimary text-[12px] font-bold uppercase tracking-wider mb-6">
            <Sparkles size={14} strokeWidth={2} />
            <span>{lang === 'uz' ? 'Bugunoq boshlang' : 'Начните сегодня'}</span>
          </div>

          {/* Heading */}
          <h2 className="text-3xl sm:text-5xl xl:text-6xl font-display font-extrabold text-pfg tracking-tight mb-6 max-w-3xl mx-auto leading-tight">
            {lang === 'uz'
              ? "Imtihonlarga tayyorgarlikni yangi bosqichga olib chiqing"
              : 'Выведите подготовку к экзаменам на новый уровень'}
          </h2>

          {/* Subtitle */}
          <p className="text-[15px] sm:text-[17px] text-pmuted max-w-2xl mx-auto mb-10 leading-relaxed font-sans font-medium">
            {lang === 'uz'
              ? "Telegram bot orqali ro'yxatdan o'ting yoki veb-versiyada barcha fanlar testlarini yechishni hoziroq boshlang. O'rnatish shart emas!"
              : 'Запустите бота в Telegram или начните решать тесты по всем предметам в веб-версии прямо сейчас. Без установки!'}
          </p>

          {/* Action CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5 max-w-xl mx-auto font-sans">
            <a
              href={telegramBotUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => playSound('click')}
              className="w-full sm:w-auto px-8 py-4 rounded-container bg-pprimary text-ponprimary font-bold text-[14.5px] flex items-center justify-center gap-2.5 shadow-xl shadow-pprimary/25 hover:brightness-110 active:scale-[0.98] transition-all duration-150"
            >
              <Sparkles size={16} strokeWidth={2} />
              <span>{lang === 'uz' ? 'Telegramda Bepul Boshlash' : 'Начать в Telegram бесплатно'}</span>
              <ArrowRight size={15} strokeWidth={2} />
            </a>

            <button
              type="button"
              onClick={() => {
                playSound('click')
                onOpenAuth()
              }}
              className="w-full sm:w-auto px-6 py-4 rounded-container bg-psurface hover:bg-pcard text-pfg font-semibold text-[14.5px] flex items-center justify-center gap-2.5 transition-all duration-150 active:scale-[0.98] shadow-xs"
            >
              <ShieldCheck size={16} strokeWidth={1.75} className="text-pmuted" />
              <span>{lang === 'uz' ? 'Veb-versiya' : 'Веб-версия'}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                playSound('click')
                onOpenApkModal()
              }}
              className="w-full sm:w-auto px-5 py-4 rounded-container bg-psurface/80 hover:bg-psurface text-pmuted hover:text-pfg font-semibold text-[14.5px] flex items-center justify-center gap-2 transition-all duration-150 active:scale-[0.98] shadow-xs"
            >
              <span>APK</span>
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}
