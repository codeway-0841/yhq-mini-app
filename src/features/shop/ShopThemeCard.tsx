/**
 * Tema kartasi (v2 redesign) — mini-ilova preview bilan.
 *
 * Eski karta: 52px rangli blok + label + narx chip'i — mahsulot ko'rinmasdi.
 * Yangi karta: `ThemeMiniApp` (haqiqiy palitradan chizilgan ilova kadri) +
 * holat belgisi + narx/egalik ierarxiyasi.
 *
 * Progressiv takomillashtirish (App Store uslubi): egalik — burchakdagi ✓
 * badge, pastdagi katta "Sotib olingan" bloki EMAS (u joyni behuda egallardi).
 * Coin-eksklyuziv temalarda `premium: false` bo'lgani uchun "Tangaga" belgisi.
 */
import { Check } from 'lucide-react'
import type { AccentTheme } from '../../shared/config/themes'
import { useT } from '../../shared/i18n'
import ThemeMiniApp from './ThemeMiniApp'
import { ShopPriceChip } from './ShopPriceChip'

interface ShopThemeCardProps {
  theme: AccentTheme
  lang: 'uz' | 'ru'
  price: number
  owned: boolean
  active: boolean
  affordable: boolean
  missing: number
  busy: boolean
  disabled: boolean
  onBuy: () => void
}

export default function ShopThemeCard({
  theme, lang, price, owned, active, affordable, missing, busy, disabled, onBuy,
}: ShopThemeCardProps) {
  const tt = useT(lang)
  return (
    <div className="relative flex flex-col gap-2.5 overflow-hidden rounded-2xl bg-pcard p-3.5 shadow-xs">
      {/* Holat FAQAT pastdagi tugmada ko'rsatiladi — burchakda ham badge
          qo'yilsa bir xil ma'no ikki marta takrorlanadi (vizual shovqin). */}
      <ThemeMiniApp theme={theme} />
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-[13px] font-semibold">{theme.label[lang]}</p>
        {!owned && !theme.premium && (
          <span className="flex-none rounded-full bg-[rgb(var(--p-gold-rgb)/0.14)] px-2 py-0.5 text-[9px] font-semibold text-pgold">
            {tt('shopCoinThemeBadge')}
          </span>
        )}
      </div>
      {owned ? (
        <div className="flex min-h-11 items-center justify-center gap-1.5 rounded-xl bg-[rgb(var(--p-success-rgb)/0.14)] text-[12.5px] font-semibold text-psuccess">
          <Check size={14} strokeWidth={2.5} /> {active ? tt('shopActive') : tt('shopOwned')}
        </div>
      ) : (
        <ShopPriceChip
          price={price}
          affordable={affordable}
          missing={missing}
          busy={busy}
          disabled={disabled}
          onBuy={onBuy}
          missingLabel={(m) => tt('shopMissingCoins').replace('{n}', m)}
        />
      )}
    </div>
  )
}
