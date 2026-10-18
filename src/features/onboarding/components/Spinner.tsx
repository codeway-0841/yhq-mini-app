/**
 * iOS uslubidagi 12 tayoqchali spinner — IMG_0928.MOV (13.0–18.5s) dagi
 * "yulduz" aylanishi: tayoqchalar diskret 30° qadamlar bilan buriladi.
 * Rang `currentColor` orqali (matn rangi) beriladi.
 */
export function Spinner({
  size = 30,
  label,
  className = '',
}: {
  size?: number
  label?: string
  className?: string
}) {
  return (
    <span
      role="status"
      aria-label={label ?? 'Loading'}
      className={`ob-spinner ${className}`}
      style={{ width: size, height: size }}
    >
      {Array.from({ length: 12 }, (_, i) => (
        <i
          key={i}
          style={{
            transform: `rotate(${i * 30}deg)`,
            opacity: 0.1 + (i / 11) * 0.9,
          }}
        />
      ))}
    </span>
  )
}
