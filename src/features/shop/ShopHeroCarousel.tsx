/**
 * Hero — "Bugun" karuseli (v2 redesign, Faza 1).
 *
 * Muammo (eski holat): do'kon "katalog" edi — kirishga SABAB yo'q edi.
 * Mavsumiy drop (`seasonalDaysLeft`), kunlik spin va premium-pass bor edi-yu,
 * hammasi oddiy matn qatorlarida yashiringan edi.
 *
 * Yechim: sahifa tepasida gorizontal karusel (mobil) / 3 ustunli grid
 * (desktop) — eng aktual 3 taklif, har birida bitta CTA. Bu App Store /
 * Play Store "Today" pattern'i: do'kon emas, VITRINA.
 *
 * Kartalar FAQAT real taklif bo'lsa chiqadi (mavsum yopiq → karta yo'q).
 * Rang: aksent faqat CTA'da; atmosfera uchun juda yumshoq radial wash
 * (`rgb(var(--p-*-rgb)/0.10)`) — karta borderless qoidasi saqlanadi.
 */
import type { CSSProperties, ReactNode } from 'react'
import { Clock, Gift, Loader2, Sparkles } from 'lucide-react'
import { CoinIcon } from '../../shared/components/CoinIcon'
import { formatCoins } from '../../shared/lib/format'
import { cn } from '../../shared/lib/cn'

export interface HeroCard {
  id: string
  eyebrow: string
  title: string
  desc: string
  icon: ReactNode
  /** Aksent RGB TRIPLISI (bo'shliq bilan): `'217 164 65'` — `rgb(<accent> / 0.10)` uchun.
   *  CSS var'ni shu yerda ishlatib bo'lmaydi: `rgb(var(--x) / .1)` ishlamaydi. */
  accentRgb: string
  /** O'ng yuqoridagi holat chip'i (masalan "3 kun qoldi", "BEPUL") */
  badge?: { text: string; tone: 'gold' | 'primary' | 'success' } | null
  /** Narx (coin). `null` — narx yo'q (bepul amal) */
  price: number | null
  affordable: boolean
  missing: number
  missingLabel: (missing: string) => string
  ctaLabel: string
  onCta: () => void
  busy?: boolean
  disabled?: boolean
}

const BADGE_TONE: Record<'gold' | 'primary' | 'success', string> = {
  gold: 'bg-[rgb(var(--p-gold-rgb)/0.16)] text-pgold',
  primary: 'bg-[rgb(var(--p-primary-rgb)/0.14)] text-pprimary',
  success: 'bg-[rgb(var(--p-success-rgb)/0.14)] text-psuccess',
}

function HeroCardView({ card, index, fullWidth }: { card: HeroCard; index: number; fullWidth: boolean }) {
  return (
    <div
      className={cn(
        'animate-heroCard relative flex flex-col overflow-hidden rounded-2xl bg-pcard p-4 shadow-xs',
        fullWidth ? 'w-full' : 'w-[248px] shrink-0 snap-start lg:w-auto lg:shrink',
      )}
      style={{ '--hero-delay': `${index * 60}ms` } as CSSProperties}
    >
      {/* Atmosfera washi — juda yumshoq, faqat kontekst uchun */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -right-8 -top-10 size-32 rounded-full"
        style={{ background: `radial-gradient(circle, rgb(${card.accentRgb} / 0.16), transparent 68%)` }}
      />
      <div className="relative flex items-center gap-2">
        <span
          className="grid size-8 flex-none place-items-center rounded-xl text-pfg"
          style={{ background: `rgb(${card.accentRgb} / 0.14)` }}
        >
          {card.icon}
        </span>
        <p className="min-w-0 flex-1 truncate text-[10px] font-semibold uppercase tracking-[0.14em] text-psubtle">
          {card.eyebrow}
        </p>
        {card.badge && (
          <span className={cn('flex-none rounded-full px-2 py-0.5 text-[9.5px] font-semibold', BADGE_TONE[card.badge.tone])}>
            {card.badge.text}
          </span>
        )}
      </div>

      <p className="relative mt-3 text-[15px] font-semibold leading-tight">{card.title}</p>
      <p className="relative mt-1 line-clamp-2 min-h-[30px] text-[11.5px] leading-snug text-pmuted">{card.desc}</p>

      <div className="relative mt-3">
        <button
          type="button"
          onClick={card.onCta}
          disabled={card.disabled || card.busy}
          className={cn(
            'flex min-h-11 w-full items-center justify-center gap-1.5 rounded-xl text-[13px] font-semibold',
            'transition-[transform,background-color,filter] duration-150 ease-out active:scale-[0.98]',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pprimary',
            'disabled:pointer-events-none disabled:opacity-40',
            card.price === null || card.affordable
              ? 'bg-pprimary text-ponprimary shadow-xs hover:brightness-[1.06]'
              : 'bg-psurface text-pmuted shadow-2xs',
          )}
        >
          {card.busy ? (
            <Loader2 size={15} className="animate-spin" />
          ) : card.price === null ? (
            card.ctaLabel
          ) : (
            <><CoinIcon size={15} /> {card.ctaLabel}</>
          )}
        </button>
        {card.price !== null && !card.affordable && card.missing > 0 && (
          <p className="mt-1 text-center text-[10px] font-medium text-psubtle">
            {card.missingLabel(formatCoins(card.missing))}
          </p>
        )}
      </div>
    </div>
  )
}

export default function ShopHeroCarousel({ cards }: { cards: HeroCard[] }) {
  if (cards.length === 0) return null
  // Desktop to'ldirish: karusel grid'ga aylanadi. Bitta karta qolsa u 1/3
  // ustunda "osilib" qolmasin (vitrina emas, xato ko'rinadi) — to'liq kenglik.
  const single = cards.length === 1
  return (
    <div
      className={cn(
        'flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 pb-1',
        // Scrollport FAQAT gorizontal — vertikal sticky/scroll'ga ta'sir qilmaydi.
        single ? 'lg:block lg:overflow-visible' : 'lg:grid lg:grid-cols-3 lg:overflow-visible',
      )}
      style={{ scrollbarWidth: 'none' }}
    >
      {cards.map((card, i) => <HeroCardView key={card.id} card={card} index={i} fullWidth={single} />)}
    </div>
  )
}

/** Hero ikonkalari — merchandising ma'nosiga qarab (neytral, aksent washi ichida). */
export const HERO_ICONS = {
  seasonal: <Sparkles size={16} strokeWidth={1.9} />,
  spin: <Gift size={16} strokeWidth={1.9} />,
  clock: <Clock size={11} strokeWidth={2.1} />,
} as const
