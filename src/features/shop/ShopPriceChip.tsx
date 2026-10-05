/**
 * Do'kon narx tugmasi — "bajariladigan amal" ierarxiyasi (v2 redesign).
 *
 * Muammo (eski holat): har bir buyum bir xil `bg-psurface` chip ko'rsatardi —
 * 1'000 tangasi bor odam 1'600 lik buyum oldida "nima bo'ladi?" degan savolga
 * javob topolmasdi (bosilsa xato chiqardi). Do'kon "narx" emas, "qancha
 * yetmayapti"ni aytishi kerak.
 *
 * Holatlar (rang intizomi — aksent FAQAT bajariladigan amalga):
 *  - XARID MUMKIN  → `bg-pprimary text-ponprimary` (yagona aksent) + narx
 *  - YETMAYDI      → neytral `bg-psurface`, matn LOCKED, tagida "yana N kerak"
 *  - EGASI         → success wash + "Tanlash" / "O'rnatilgan" (equip oqimi)
 *  - BAND          → spinner, tugma bloklangan
 *
 * Trust boundary: bu komponent FAQAT ko'rinish — balans/narx server'dan
 * keladi, qaror (affordable) faqat UI qulayligi uchun (server baribir
 * COINS_INSUFFICIENT qaytaradi).
 */
import { Check, Loader2, Lock } from 'lucide-react'
import { CoinIcon } from '../../shared/components/CoinIcon'
import { formatCoins } from '../../shared/lib/format'
import { cn } from '../../shared/lib/cn'

interface ShopPriceChipProps {
  price: number
  /** Balans yetadimi (faqat ko'rinish uchun) */
  affordable: boolean
  /** Yetmayotgan tanga — `affordable=false` da ko'rsatiladi */
  missing: number
  busy?: boolean
  disabled?: boolean
  onBuy: () => void
  /** "yana N kerak" matni (i18n'dan); `{n}` — formatlangan son */
  missingLabel: (missing: string) => string
}

export function ShopPriceChip({
  price, affordable, missing, busy = false, disabled = false,
  onBuy, missingLabel,
}: ShopPriceChipProps) {
  return (
    <div className="flex w-full flex-col gap-1">
      <button
        type="button"
        onClick={onBuy}
        disabled={disabled || busy}
        aria-label={`${formatCoins(price)} — ${missing > 0 ? missingLabel(formatCoins(missing)) : ''}`.trim()}
        className={cn(
          'flex min-h-11 w-full items-center justify-center gap-1.5 rounded-xl text-[12.5px] font-semibold',
          'transition-[transform,background-color,filter] duration-150 ease-out active:scale-[0.97]',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pprimary',
          'disabled:pointer-events-none disabled:opacity-40',
          affordable
            ? 'bg-pprimary text-ponprimary shadow-xs hover:brightness-[1.06]'
            : 'bg-psurface text-pmuted shadow-2xs hover:text-pfg',
        )}
      >
        {busy ? (
          <Loader2 size={14} className="animate-spin" />
        ) : affordable ? (
          <><CoinIcon size={14} /> {formatCoins(price)}</>
        ) : (
          <><Lock size={12} strokeWidth={2.25} /> {formatCoins(price)}</>
        )}
      </button>
      {!affordable && missing > 0 && (
        <p className="text-center text-[10px] font-medium leading-tight text-psubtle">
          {missingLabel(formatCoins(missing))}
        </p>
      )}
    </div>
  )
}

interface ShopEquipChipProps {
  equipped: boolean
  busy?: boolean
  disabled?: boolean
  onToggle: () => void
  equipLabel: string
  unequipLabel: string
}

/** Egalik holati tugmasi — "Tanlash" ↔ "O'rnatilgan" (success wash). */
export function ShopEquipChip({
  equipped, busy = false, disabled = false, onToggle, equipLabel, unequipLabel,
}: ShopEquipChipProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled || busy}
      aria-pressed={equipped}
      className={cn(
        'flex min-h-11 w-full items-center justify-center gap-1.5 rounded-xl text-[12.5px] font-semibold',
        'transition-transform duration-150 ease-out active:scale-[0.97] shadow-2xs',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pprimary',
        'disabled:pointer-events-none disabled:opacity-40',
        equipped
          ? 'bg-[rgb(var(--p-success-rgb)/0.14)] text-psuccess'
          : 'bg-[rgb(var(--p-primary-rgb)/0.12)] text-pprimary',
      )}
    >
      {busy ? (
        <Loader2 size={14} className="animate-spin" />
      ) : equipped ? (
        <><Check size={13} strokeWidth={2.5} /> {unequipLabel}</>
      ) : (
        equipLabel
      )}
    </button>
  )
}
