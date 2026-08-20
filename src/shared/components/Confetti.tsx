import { useMemo } from 'react'

/**
 * Confetti — muvaffaqiyatni nishonlash (FAQAT CSS animatsiya, lib yo'q).
 * Ranglar aksent temaga ergashadi (--p-primary).
 * `noAnimation` yoki OS reduced-motion'da avtomatik yashirinadi (index.css).
 */
const COLORS = ['var(--p-primary)', 'var(--p-gold)', 'var(--p-blue)', 'var(--p-purple)']

export default function Confetti({ count = 30 }: { count?: number }) {
  const pieces = useMemo(() => Array.from({ length: count }, (_, i) => ({
    left:  4 + Math.random() * 92,
    delay: Math.random() * 0.5,
    dur:   1.9 + Math.random() * 1.2,
    size:  6 + Math.random() * 6,
    color: COLORS[i % COLORS.length],
    round: Math.random() > 0.5,
  })), [count])
  return (
    <div className="pointer-events-none fixed inset-0 z-[60] overflow-hidden" aria-hidden>
      {pieces.map((p, i) => (
        <span key={i} className="confetti-piece" style={{
          left: `${p.left}%`,
          animationDelay: `${p.delay}s`,
          animationDuration: `${p.dur}s`,
          width: p.size,
          height: p.size * 0.6,
          background: p.color,
          borderRadius: p.round ? '50%' : '2px',
        }} />
      ))}
    </div>
  )
}
