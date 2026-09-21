import { useEffect, useRef, useState, type DetailedHTMLProps, type HTMLAttributes, type ReactNode } from 'react'
import 'mathlive'
import type { MathfieldElement } from 'mathlive'

/**
 * Math Board — MathLive kiritish maydoni (Faza 3, P2-C).
 *
 * `<math-field>` web-component: strukturalangan kiritish (kasr/ildiz/log),
 * qiymat LaTeX (`el.value`). UNCONTROLLED: boshlang'ich qiymat mount'dagi
 * `value` prop'dan olinadi va keyin ICHKI holat yashaydi (kursor xavfsiz).
 *
 * P2-C: remount kaliti PARENT'da (`<StepInput key={...}>`) — ichki key +
 * saqlangan `useState` kombinatsiyasi eski formulani qayta chiqarardi.
 * Parent accept/select/reset'da key'ni almashtiradi (inputKey).
 */

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    interface IntrinsicElements {
      'math-field': DetailedHTMLProps<HTMLAttributes<MathfieldElement>, MathfieldElement> & {
        children?: ReactNode
      }
    }
  }
}

interface StepInputProps {
  value: string
  onLatex: (latex: string) => void
  label: string
}

export default function StepInput({ value, onLatex, label }: StepInputProps) {
  const ref = useRef<MathfieldElement | null>(null)
  const onLatexRef = useRef(onLatex)
  onLatexRef.current = onLatex
  // Uncontrolled: boshlang'ich qiymat FAQAT mount'da. Parent har reset'da
  // yangi `key` beradi → yangi instance → yangi initial. Hech qachon
  // prop o'zgarishi bilan ichki holat ezilmaydi (kursor sakramaydi).
  const [initial] = useState(value)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const handler = (): void => {
      onLatexRef.current((el.value ?? '') as string)
    }
    el.addEventListener('input', handler)
    return () => el.removeEventListener('input', handler)
  }, [])

  return (
    <math-field
      ref={ref}
      aria-label={label}
      style={{ width: '100%', fontSize: '22px', padding: '8px 4px' }}
    >
      {initial}
    </math-field>
  )
}
