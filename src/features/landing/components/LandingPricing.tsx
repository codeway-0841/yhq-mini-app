import React from 'react'
import { Sparkles, Check, Crown, ArrowRight, ShieldCheck, Zap } from 'lucide-react'
import { PREMIUM_PLANS, formatUzs, HIGHLIGHT_PLAN } from '../../../../shared/premium-plans'
import { config } from '../../../shared/config'
import { playSound } from '../../../shared/lib/sounds'

interface LandingPricingProps {
  lang: 'uz' | 'ru'
  onOpenAuth: () => void
}

export const LandingPricing: React.FC<LandingPricingProps> = ({ lang }) => {
  const botUsername = config.botUsername || 'kivvi_app_bot'
  const telegramBotUrl = `https://t.me/${botUsername}`

  return (
    <section id="pricing" className="py-20 md:py-28 bg-psurface/30 relative">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-pprimary/10 text-pprimary text-xs font-bold uppercase tracking-wider mb-3">
            <Sparkles className="w-3.5 h-3.5" />
            <span>{lang === 'uz' ? 'Rasmiy Tariflar' : 'Тарифные планы'}</span>
          </div>
          <h2 className="text-3xl sm:text-5xl font-display font-extrabold text-pfg tracking-tight mb-4">
            {lang === 'uz' ? 'Oddiy, shaffof va qulay narxlar' : 'Простые и прозрачные тарифы'}
          </h2>
          <p className="text-base sm:text-lg text-pmuted">
            {lang === 'uz'
              ? "Barcha tariflar 30 kunlik obunani o'z ichiga oladi. O'zingizga mos darajani tanlang va imtihonlarga 100% tayyor bo'ling."
              : 'Все тарифы включают 30 дней полного доступа. Выберите подходящий уровень и подготовьтесь на 100%.'}
          </p>
        </div>

        {/* Real 3-Plan Grid from shared/premium-plans.ts */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8 max-w-6xl mx-auto items-stretch">
          {PREMIUM_PLANS.map((plan) => {
            const isHighlight = plan.key === HIGHLIGHT_PLAN
            const isVip = plan.key === 'lifetime'

            return (
              <div
                key={plan.key}
                className={`p-7 sm:p-9 rounded-sheet flex flex-col justify-between transition-all duration-300 relative overflow-hidden shadow-lg ${
                  isHighlight
                    ? 'bg-gradient-to-b from-pcard via-pcard to-psurface shadow-2xl ring-2 ring-pprimary/50 md:-translate-y-2'
                    : 'bg-pcard hover:shadow-xl'
                }`}
              >
                {/* Popular Badge */}
                {isHighlight && (
                  <div className="absolute top-0 right-0 px-4 py-1.5 bg-pprimary text-ponprimary text-xs font-black rounded-bl-container tracking-wider flex items-center gap-1.5 shadow-md">
                    <Zap className="w-3.5 h-3.5" />
                    <span>{lang === 'uz' ? 'ENG MASHHUR' : 'ПОПУЛЯРНЫЙ'}</span>
                  </div>
                )}

                <div>
                  {/* Tier Badge */}
                  <div className="flex items-center gap-2 mb-3">
                    {isVip ? (
                      <Crown className="w-5 h-5 text-pgold" />
                    ) : (
                      <Sparkles className="w-5 h-5 text-pprimary" />
                    )}
                    <span className="text-xs font-extrabold uppercase tracking-wider text-pprimary">
                      {lang === 'uz' ? plan.badgeUz : plan.badgeRu}
                    </span>
                  </div>

                  <h3 className="text-2xl font-display font-extrabold text-pfg mb-1">
                    {lang === 'uz' ? plan.tierNameUz : plan.tierNameRu}
                  </h3>

                  <p className="text-xs text-pmuted mb-6">
                    {lang === 'uz' ? plan.periodUz : plan.periodRu} ({plan.days} {lang === 'uz' ? 'kun' : 'дней'})
                  </p>

                  {/* Price */}
                  <div className="mb-6">
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl sm:text-4xl font-display font-black text-pfg">
                        {formatUzs(plan.priceUzs, lang)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs line-through text-pmuted">
                        {formatUzs(plan.originalPriceUzs, lang)}
                      </span>
                      <span className="text-[11px] font-bold text-psuccess bg-psuccess/15 px-2 py-0.5 rounded-full">
                        -{plan.discountPercent}% chegirma
                      </span>
                    </div>
                  </div>

                  {/* Features Checklist */}
                  <div className="space-y-3 mb-8">
                    {(lang === 'uz' ? plan.featuresUz : plan.featuresRu).map((feat, i) => (
                      <div key={i} className="flex items-start gap-3 text-xs sm:text-sm text-pfg">
                        <div className="w-5 h-5 rounded-full bg-pprimary/15 text-pprimary flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
                          <Check className="w-3.5 h-3.5" />
                        </div>
                        <span className="leading-snug">{feat}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <a
                    href={telegramBotUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => playSound('click')}
                    className={`w-full py-3.5 rounded-container font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all duration-200 shadow-md ${
                      isHighlight
                        ? 'bg-pprimary text-ponprimary shadow-pprimary/30 hover:brightness-110 active:scale-98'
                        : 'bg-psurface hover:bg-pcard text-pfg active:scale-98'
                    }`}
                  >
                    <span>{lang === 'uz' ? `${plan.tierNameUz} ni Tanlash` : `Выбрать ${plan.tierNameRu}`}</span>
                    <ArrowRight className="w-4 h-4" />
                  </a>

                  <div className="text-[11px] text-center text-pmuted mt-3 font-medium">
                    {plan.stars} Telegram Stars / Click / Payme
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Payment Guarantee Footer */}
        <div className="flex items-center justify-center gap-6 mt-12 text-xs text-pmuted">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-psuccess" />
            <span>Click & Payme orqali xavfsiz to'lov</span>
          </div>
          <span>•</span>
          <span>Telegram Stars orqali 1 soniyada ulanish</span>
        </div>
      </div>
    </section>
  )
}
