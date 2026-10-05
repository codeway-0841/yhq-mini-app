/**
 * Stagger o'ram (Faza 4) — grid bolalarini ketma-ket ochadi.
 *
 * Do'kon 20+ bir xil kartadan iborat: hammasi bir vaqtda "paydo" bo'lsa,
 * ko'z qaysi biri muhimligini ajratmaydi va sahifa "og'ir" tuyuladi. Kichik
 * kechikish (40ms qadam, 240ms cap) ro'yxatga ritm beradi.
 *
 * TEXNIKA: bolalar `cloneElement` bilan NUSXALANADI, oraliq DOM o'ram
 * QO'SHILMAYDI. Sabab: `display: contents` o'rami animatsiyani ko'rsata
 * olmaydi (bunday elementda box yo'q), oddiy o'ram esa CSS grid'da yangi
 * element bo'lib, kartalar joylashuvini buzadi. `Children.map` prefiksli
 * `key` yaratadi — ro'yxat tartibi o'zgarmasa instance saqlanadi.
 *
 * Rang/geometry'ga TEGMAYDI — faqat mavjud `.animate-sheetItemIn` klassi
 * ishlatiladi (`data-no-animation` va `prefers-reduced-motion` bilan
 * allaqachon o'chirilgan).
 */
import { Children, cloneElement, isValidElement, type CSSProperties, type ReactElement, type ReactNode } from 'react'

interface StaggerProps {
  children: ReactNode
  /** Qadam (ms) — kartalar orasidagi kechikish */
  step?: number
  /** Maksimal kechikish (ms) — uzun ro'yxat oxirida kutish bo'lmasin */
  max?: number
}

export default function Stagger({ children, step = 40, max = 240 }: StaggerProps) {
  return (
    <>
      {Children.map(children, (child, i) => {
        if (!isValidElement(child)) return child
        const delay = Math.min(i * step, max)
        const el = child as ReactElement<{ className?: string; style?: CSSProperties }>
        return cloneElement(el, {
          className: [el.props.className, 'animate-sheetItemIn'].filter(Boolean).join(' '),
          style: { ...(el.props.style ?? {}), animationDelay: `${delay}ms` },
        })
      })}
    </>
  )
}
