import * as React from 'react'
import { cn } from '@/shared/lib/cn'

/**
 * KIWI Spec (chek / App Store "Transaction" uslubi) — barcha modal va
 * sheet'lar uchun YAGONA kontent tili:
 *
 *   [hero ikonka] → sarlavha → kichik izoh → KATTA raqam → oq karta + qatorlar
 *
 * Qatorlar (SpecRow) — chekdagi kabi: chapda yumshoq rangli dumaloq ikonka,
 * o'rtada label, o'ngda muted qiymat. Ierarxiya FAQAT tipografiya, bo'shliq va
 * sirt (canvas → surface → card) orqali beriladi — ramka/1px chiziq YO'Q
 * (dizayn qoidasi 14: karta ustida wireframe border taqiqlangan).
 *
 * Rang: aksent (pprimary) faqat `tone="primary"` da; qolgan ohanglar semantik
 * tokenlardan (`--p-blue-rgb`, `--p-purple-rgb`, `--p-success-rgb`, ...), ya'ni
 * tema va aksent almashganda avtomatik uyg'unlashadi.
 */

// ── Ohanglar (ikonka chip foni/matni) ──────────────────────────────────────
// Tailwind sinf nomlari STATIK bo'lishi shart (JIT skanerlaydi).
const TONES = {
  primary: {
    chip: 'bg-[rgb(var(--p-primary-rgb)/0.14)]',
    icon: 'text-pprimary',
  },
  blue: {
    chip: 'bg-[rgb(var(--p-blue-rgb)/0.14)]',
    icon: 'text-pblue',
  },
  purple: {
    chip: 'bg-[rgb(var(--p-purple-rgb)/0.14)]',
    icon: 'text-ppurple',
  },
  pink: {
    chip: 'bg-[rgb(var(--p-danger-rgb)/0.14)]',
    icon: 'text-pdanger',
  },
  amber: {
    chip: 'bg-[rgb(var(--p-warning-rgb)/0.16)]',
    icon: 'text-pwarning',
  },
  green: {
    chip: 'bg-[rgb(var(--p-success-rgb)/0.14)]',
    icon: 'text-psuccess',
  },
  gold: {
    chip: 'bg-[rgb(var(--p-gold-rgb)/0.16)]',
    icon: 'text-pgold',
  },
  neutral: {
    chip: 'bg-[rgb(var(--p-fg-rgb)/0.06)]',
    icon: 'text-pmuted',
  },
} as const

export type SpecTone = keyof typeof TONES

// ── Karta ──────────────────────────────────────────────────────────────────

export interface SpecCardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Qatorlar orasida ingichka ajratgich (default: false — Apple uslubi) */
  divided?: boolean
  /** Karta ostidagi izoh/qator (masalan: umumiy summa) */
  footer?: React.ReactNode
  children?: React.ReactNode
}

/**
 * SpecCard — sheet ichidagi oq, yumshoq soyalik karta (radius `rounded-3xl`).
 * Ichiga faqat `SpecRow` (yoki oddiy kontent) qo'yiladi.
 */
export function SpecCard({ divided = false, footer, className, children, ...props }: SpecCardProps) {
  return (
    <div
      className={cn(
        'relative z-10 overflow-hidden rounded-3xl bg-pcard',
        'shadow-[0_2px_10px_rgba(0,0,0,0.04),0_14px_30px_-18px_rgba(0,0,0,0.20)]',
        className,
      )}
      {...props}
    >
      <div className={cn(divided && 'divide-y divide-pline')}>{children}</div>
      {footer ? <div className="border-t border-pline px-4 py-3">{footer}</div> : null}
    </div>
  )
}

// ── Qator ──────────────────────────────────────────────────────────────────

/**
 * `SpecList` ichida qatorlar semantik `<dl>` juftligi (`dt`/`dd`) bo'ladi;
 * ro'yxatdan tashqarida esa oddiy `<div>` — noto'g'ri HTML chiqmasligi uchun.
 */
const SpecListContext = React.createContext(false)

export interface SpecRowProps {
  /** Chapdagi ikonka (chip ichida 16px) */
  icon?: React.ReactNode
  /** Ikonka chipining ohangi (default: neutral) */
  tone?: SpecTone
  label: React.ReactNode
  /** Label ostidagi kichik izoh (masalan provayder · sana) */
  hint?: React.ReactNode
  /** O'ng tomondagi qiymat — muted, tabular raqamlar */
  value?: React.ReactNode
  /** Qiymat ustidagi kichik izoh (masalan valyuta kursi) */
  valueHint?: React.ReactNode
  /** Qiymatni semantik rangda ko'rsatish */
  valueClassName?: string
  className?: string
  /** Qator bosiladigan bo'lsa (butun qator target bo'ladi) */
  onClick?: () => void
  /** Tanlangan holat (picker/sheet ro'yxatlarida) */
  selected?: boolean
}

/**
 * SpecRow — chek qatori: [ikonka chip] [label] ......... [qiymat].
 * `SpecList` ichida `<dt>/<dd>` (semantik), aks holda `<div>`;
 * `onClick` berilsa — butun qator `<button>` bo'ladi.
 */
export function SpecRow({
  icon,
  tone = 'neutral',
  label,
  hint,
  value,
  valueHint,
  valueClassName,
  className,
  onClick,
  selected,
}: SpecRowProps) {
  const semantic = React.useContext(SpecListContext)
  const LabelTag = semantic ? 'dt' : 'div'
  const ValueTag = semantic ? 'dd' : 'div'

  const content = (
    <>
      {icon ? (
        <span
          aria-hidden="true"
          className={cn(
            'grid size-7 flex-none place-items-center rounded-full',
            TONES[tone].chip,
            TONES[tone].icon,
            '[&>svg]:size-4',
          )}
        >
          {icon}
        </span>
      ) : null}

      <LabelTag className="min-w-0 flex-1">
        <span className="block truncate text-[15px] leading-tight text-pfg">{label}</span>
        {hint !== undefined && (
          <span className="mt-0.5 block truncate text-[11.5px] leading-tight text-psubtle">{hint}</span>
        )}
      </LabelTag>

      {(value !== undefined || valueHint !== undefined) && (
        <ValueTag className="flex min-w-0 flex-col items-end gap-0.5 text-right">
          {value !== undefined && (
            <span
              className={cn(
                'max-w-[62vw] truncate text-[15px] leading-tight tabular-nums text-pmuted',
                valueClassName,
              )}
            >
              {value}
            </span>
          )}
          {valueHint !== undefined && (
            <span className="text-[11.5px] leading-tight text-psubtle">{valueHint}</span>
          )}
        </ValueTag>
      )}
    </>
  )

  const rowClass = cn(
    'flex w-full items-center gap-3 px-4 py-3.5 text-left',
    selected && 'bg-[rgb(var(--p-primary-rgb)/0.07)]',
    onClick &&
      'cursor-pointer transition-colors duration-150 hover:bg-[rgb(var(--p-surface-rgb)/0.6)] active:bg-psurface',
    className,
  )

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={rowClass}
        aria-pressed={selected === undefined ? undefined : selected}
      >
        {content}
      </button>
    )
  }

  return <div className={rowClass}>{content}</div>
}

/** `SpecCard` + `SpecRow` lar uchun semantik o'ram (`<dl>`). */
export function SpecList({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <SpecListContext.Provider value={true}>
      <dl className={cn('text-[15px]', className)}>{children}</dl>
    </SpecListContext.Provider>
  )
}

// ── Hero (chek tepasidagi ikonka + nom) ────────────────────────────────────

export interface SpecHeroProps {
  /** Asosiy ikonka/emoji/badge (odatda 40–44px) */
  icon: React.ReactNode
  /** Ikonka burchagidagi kichik badge (masalan davlat bayrog'i) */
  badge?: React.ReactNode
  title: React.ReactNode
  subtitle?: React.ReactNode
  /** Ikonka fonini to'ldirish (masalan brend gradienti) */
  iconClassName?: string
  className?: string
}

/**
 * SpecHero — sheet tepasidagi markazlashgan blok: doimiy o'lchamli ikonka
 * (20px radius — iOS app icon proporsiyasi), nom va kichik izoh.
 */
export function SpecHero({ icon, badge, title, subtitle, iconClassName, className }: SpecHeroProps) {
  return (
    <div className={cn('relative z-10 flex flex-col items-center px-6 pt-1 text-center', className)}>
      <div className="relative">
        <div
          className={cn(
            'grid size-[84px] place-items-center overflow-hidden rounded-3xl',
            'bg-pcard shadow-[0_10px_26px_-12px_rgba(0,0,0,0.35)]',
            'text-[34px] leading-none',
            iconClassName,
          )}
        >
          {icon}
        </div>
        {badge ? (
          <span
            aria-hidden="true"
            className="absolute -bottom-1 -right-1 grid size-7 place-items-center overflow-hidden rounded-full bg-pcard text-[15px] leading-none shadow-[0_2px_8px_rgba(0,0,0,0.18)] ring-2 ring-psurface"
          >
            {badge}
          </span>
        ) : null}
      </div>

      <h3 className="mt-4 max-w-[19rem] text-balance font-display text-[19px] font-bold leading-snug tracking-tight text-pfg">
        {title}
      </h3>
      {subtitle ? <p className="mt-1 max-w-[19rem] text-[13.5px] leading-snug text-pmuted">{subtitle}</p> : null}
    </div>
  )
}

// ── Katta raqam (summa / ball / foiz) ──────────────────────────────────────

export interface SpecAmountProps {
  /** Katta raqam (matn yoki komponent) */
  value: React.ReactNode
  /** Raqam ostidagi izoh, ixtiyoriy ikonka bilan */
  caption?: React.ReactNode
  /** Izoh oldidagi kichik ikonka */
  captionIcon?: React.ReactNode
  /** Kichikroq variant (uzun matnli summalar uchun) */
  size?: 'md' | 'lg'
  className?: string
}

/**
 * SpecAmount — chekning markaziy raqami (44px, tabular, tight tracking).
 * `caption` — "You received ..." uslubidagi bitta qator.
 */
export function SpecAmount({ value, caption, captionIcon, size = 'lg', className }: SpecAmountProps) {
  return (
    <div className={cn('relative z-10 flex flex-col items-center px-5 text-center', className)}>
      <p
        className={cn(
          'font-display font-bold leading-none tracking-[-0.03em] tabular-nums text-pfg',
          size === 'lg' ? 'text-[40px]' : 'text-[30px]',
        )}
      >
        {value}
      </p>
      {caption ? (
        <p className="mt-3 inline-flex max-w-[20rem] items-center justify-center gap-1.5 text-[13px] leading-snug text-pmuted">
          {captionIcon ? <span className="flex-none [&>svg]:size-4">{captionIcon}</span> : null}
          <span>{caption}</span>
        </p>
      ) : null}
    </div>
  )
}

export default SpecCard
