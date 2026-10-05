/**
 * Balans paneli (v2 redesign) — ikkita ko'rinish, bitta mantiq.
 *
 * Muammo (eski holat): balans — sahifa tepasidagi oddiy karta; 20 ta buyum
 * bo'ylab pastga tushganda balans KO'ZDAN Yo'qOLADI va odam "shu narsaga
 * yetadimi?" degan savolga javob topolmaydi (do'konlarning klassik xatosi).
 *
 * Yechim: hero (katta, kontekst bilan) + skrollda header ichida paydo
 * bo'ladigan ixcham KAPSULA. Ikkalasi `useCountUp` bilan jonli — xariddan
 * keyin raqam "sakramaydi", sanaladi (Faza 4 effekti shu yerda yashaydi).
 *
 * TRUST: balans FAQAT `useAppStore.coins` (server javobidan yoziladi).
 */
import { Info } from 'lucide-react'
import { CoinIcon } from '../../shared/components/CoinIcon'
import { PremiumIcon } from '../../shared/components/PremiumIcon'
import { useCountUp } from '../../shared/hooks/useCountUp'
import { formatCoins } from '../../shared/lib/format'
import { cn } from '../../shared/lib/cn'

interface BalanceHeroProps {
  coins: number
  isPremium: boolean
  label: string
  earnHint: string
}

/** Katta balans kartasi — sahifa boshidagi asosiy "hamyon" ko'rinishi. */
export function BalanceHero({ coins, isPremium, label, earnHint }: BalanceHeroProps) {
  const shown = useCountUp(coins)
  return (
    <div className="rounded-2xl bg-pcard px-4 py-3.5 shadow-xs">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-psubtle">{label}</p>
          <p className="mt-1 flex items-center gap-1.5 text-[30px] font-semibold leading-none tracking-tight tabular-nums">
            <CoinIcon size={24} className="flex-none text-pgold" />
            {formatCoins(shown)}
          </p>
        </div>
        {isPremium && (
          <span className="inline-flex flex-none items-center gap-1 rounded-full bg-[rgb(var(--p-gold-rgb)/0.14)] px-2.5 py-1 text-[10.5px] font-semibold text-pgold shadow-xs">
            <PremiumIcon size={12} /> Premium
          </span>
        )}
      </div>
      {/* "Tanga qanday olinadi?" — ma'lumot qatori (o'lik CTA emas) */}
      <p className="mt-3 flex items-center gap-1.5 border-t border-pline pt-2.5 text-[11px] text-pmuted">
        <Info size={12} strokeWidth={1.75} className="flex-none text-psubtle" />
        <span className="min-w-0 flex-1 truncate">{earnHint}</span>
      </p>
    </div>
  )
}

/**
 * Ixcham kapsula — skrollda header ichida paydo bo'ladi (App Store / Play
 * uslubi). Balans doim ko'rinib turadi, lekin sahifani egallamaydi.
 */
export function BalanceCapsule({
  coins, visible, label,
}: { coins: number; visible: boolean; label: string }) {
  const shown = useCountUp(coins)
  return (
    <div
      aria-hidden={!visible}
      className={cn(
        'mx-auto flex w-fit items-center gap-1.5 overflow-hidden rounded-full bg-psurface px-3 shadow-2xs',
        'transition-[max-height,opacity,transform,margin] duration-200 ease-out',
        visible
          ? 'mt-1.5 max-h-9 opacity-100 translate-y-0'
          : 'mt-0 max-h-0 opacity-0 -translate-y-1 pointer-events-none',
      )}
    >
      <CoinIcon size={14} className="flex-none text-pgold" />
      <span
        className="text-[13.5px] font-semibold tabular-nums text-pfg"
        aria-label={`${label}: ${formatCoins(shown)}`}
      >
        {formatCoins(shown)}
      </span>
      <span className="truncate text-[10.5px] font-medium text-psubtle">{label}</span>
    </div>
  )
}
