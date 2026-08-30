import React from 'react'
import { Send, Globe, Smartphone, ShieldCheck, Heart } from 'lucide-react'
import { config } from '../../../shared/config'
import { playSound } from '../../../shared/lib/sounds'

interface LandingFooterProps {
  lang: 'uz' | 'ru'
  onOpenAuth: () => void
  onOpenApkModal: () => void
}

export const LandingFooter: React.FC<LandingFooterProps> = ({
  lang,
  onOpenAuth,
  onOpenApkModal,
}) => {
  const botUsername = config.botUsername || 'kivvi_app_bot'
  const telegramBotUrl = `https://t.me/${botUsername}`

  return (
    <footer className="bg-psurface/40 pt-16 pb-12 relative font-sans">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10 xl:gap-16 mb-14">
          {/* Col 1: Brand Info */}
          <div className="md:col-span-1 space-y-4">
            <div className="flex items-center gap-3">
              <img
                src="/images/splash-brand.webp"
                alt="KIWI"
                className="w-11 h-11 rounded-2xl object-cover shadow-sm shadow-pprimary/10"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = '/images/splash-brand.png'
                }}
              />
              <div className="flex flex-col">
                <span className="font-display font-black text-2xl tracking-tight text-pfg">
                  KI<span className="text-pprimary">WI</span>
                </span>
                <span className="text-[12px] text-pmuted font-medium">
                  {lang === 'uz' ? "Universal Ta'lim & Imtihonlar Platformasi" : 'Образовательная и Экзаменационная Платформа'}
                </span>
              </div>
            </div>

            <p className="text-[13px] text-pmuted leading-relaxed font-medium">
              {lang === 'uz'
                ? "O'zbekistondagi eng zamonaviy va interaktiv ta'lim platformasi. Attestatsiya, Milliy sertifikat, DTM va YHQ imtihonlariga kafolatli tayyorgarlik."
                : 'Современная интерактивная образовательная платформа в Узбекистане. Гарантированная подготовка к Аттестации, Сертификатам, ДТМ и ПДД.'}
            </p>

            <div className="flex items-center gap-2 text-[12px] text-pmuted font-medium pt-1">
              <span className="w-2 h-2 rounded-full bg-psuccess inline-block animate-pulse" />
              <span>{lang === 'uz' ? 'Barcha tizimlar barqaror ishlamoqda' : 'Все системы работают штатно'}</span>
            </div>
          </div>

          {/* Col 2: Navigation Links */}
          <div>
            <h4 className="text-[11px] font-bold uppercase tracking-widest text-pfg mb-5 font-mono">
              {lang === 'uz' ? 'Bo\'limlar' : 'Разделы'}
            </h4>
            <ul className="space-y-3 text-[13px] text-pmuted font-medium">
              <li>
                <a href="#features" className="hover:text-pprimary transition-colors">
                  {lang === 'uz' ? 'Imkoniyatlar' : 'Возможности'}
                </a>
              </li>
              <li>
                <a href="#arena" className="hover:text-pprimary transition-colors">
                  {lang === 'uz' ? 'PvP Duel Arena' : 'PvP Арена'}
                </a>
              </li>
              <li>
                <a href="#calculator" className="hover:text-pprimary transition-colors">
                  {lang === 'uz' ? 'Imtihon Kalkulyatori' : 'Калькулятор'}
                </a>
              </li>
              <li>
                <a href="#showcase" className="hover:text-pprimary transition-colors">
                  {lang === 'uz' ? 'Ilova Ko\'rinishi' : 'Интерфейс'}
                </a>
              </li>
              <li>
                <a href="#subjects" className="hover:text-pprimary transition-colors">
                  {lang === 'uz' ? 'Fanlar Ekotizimi' : 'Предметы'}
                </a>
              </li>
              <li>
                <a href="#pricing" className="hover:text-pprimary transition-colors">
                  {lang === 'uz' ? 'Tariflar' : 'Тарифы'}
                </a>
              </li>
              <li>
                <a href="#faq" className="hover:text-pprimary transition-colors">
                  {lang === 'uz' ? 'Ko\'p beriladigan savollar' : 'FAQ'}
                </a>
              </li>
            </ul>
          </div>

          {/* Col 3: Platforms */}
          <div>
            <h4 className="text-[11px] font-bold uppercase tracking-widest text-pfg mb-5 font-mono">
              {lang === 'uz' ? 'Platformalar' : 'Платформы'}
            </h4>
            <ul className="space-y-3 text-[13px] text-pmuted font-medium">
              <li>
                <a
                  href={telegramBotUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => playSound('click')}
                  className="hover:text-pprimary transition-colors flex items-center gap-2"
                >
                  <Send size={15} strokeWidth={1.75} className="text-pprimary" />
                  <span>Telegram Mini App</span>
                </a>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => {
                    playSound('click')
                    onOpenAuth()
                  }}
                  className="hover:text-pprimary transition-colors flex items-center gap-2"
                >
                  <Globe size={15} strokeWidth={1.75} className="text-pblue" />
                  <span>{lang === 'uz' ? 'Veb Ilova (kivvi.uz)' : 'Веб-приложение'}</span>
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => {
                    playSound('click')
                    onOpenApkModal()
                  }}
                  className="hover:text-pprimary transition-colors flex items-center gap-2"
                >
                  <Smartphone size={15} strokeWidth={1.75} className="text-pgold" />
                  <span>Android APK</span>
                </button>
              </li>
            </ul>
          </div>

          {/* Col 4: Support & Legal */}
          <div>
            <h4 className="text-[11px] font-bold uppercase tracking-widest text-pfg mb-5 font-mono">
              {lang === 'uz' ? 'Qo\'llab-quvvatlash' : 'Поддержка'}
            </h4>
            <ul className="space-y-3 text-[13px] text-pmuted font-medium">
              <li>
                <a
                  href={`https://t.me/${botUsername}?start=support`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => playSound('click')}
                  className="hover:text-pprimary transition-colors flex items-center gap-2"
                >
                  <Send size={15} strokeWidth={1.75} className="text-pmuted" />
                  <span>Telegram Yordam</span>
                </a>
              </li>
              <li>
                <a
                  href="/privacy.html"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-pprimary transition-colors flex items-center gap-2"
                >
                  <ShieldCheck size={15} strokeWidth={1.75} className="text-pmuted" />
                  <span>{lang === 'uz' ? 'Maxfiylik Siyosati' : 'Политика конфиденциальности'}</span>
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-[12px] text-pmuted">
          <div>
            © {new Date().getFullYear()} KIWI. {lang === 'uz' ? 'Barcha huquqlar himoyalangan.' : 'Все права защищены.'}
          </div>

          <div className="flex items-center gap-1.5 font-medium">
            <span>{lang === 'uz' ? 'O\'zbekistonda' : 'Сделано в Узбекистане с'}</span>
            <Heart size={14} className="text-pdanger fill-pdanger" />
            <span>{lang === 'uz' ? 'mehr bilan yaratilgan' : ''}</span>
          </div>
        </div>
      </div>
    </footer>
  )
}
