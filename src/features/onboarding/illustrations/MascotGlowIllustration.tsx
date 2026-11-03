import { useEffect, useState } from 'react'

export function MascotGlowIllustration({ className = 'w-64 h-64' }: { className?: string }) {
  // Eye blink animation: toggles between smile and square eye every few seconds
  const [blink, setBlink] = useState(false)

  useEffect(() => {
    const interval = setInterval(() => {
      setBlink(true)
      setTimeout(() => setBlink(false), 800)
    }, 2800)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className={`relative flex items-center justify-center select-none ${className}`}>
      <svg
        viewBox="0 0 280 280"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full overflow-visible"
      >
        <g transform="translate(140, 140)">
          {/* Outer glowing halo ring 1 */}
          <path
            d="M 0 -85 C 45 -85 85 -45 85 0 C 85 45 45 85 0 85 C -45 85 -85 45 -85 0 C -85 -45 -45 -85 0 -85 Z"
            fill="#FEF08A"
            fillOpacity="0.3"
            filter="blur(12px)"
          />

          {/* Outer yellow/lime rounded diamond layer */}
          <path
            d="M 0 -72 C 30 -72 72 -30 72 0 C 72 30 30 72 0 72 C -30 72 -72 30 -72 0 C -72 -30 -30 -72 0 -72 Z"
            fill="#ECFCCB"
            stroke="#FEF08A"
            strokeWidth="3.5"
          />

          {/* Middle white/light lime buffer ring */}
          <path
            d="M 0 -64 C 26 -64 64 -26 64 0 C 64 26 26 64 0 64 C -26 64 -64 26 -64 0 C -64 -26 -26 -64 0 -64 Z"
            fill="#F7FEE7"
          />

          {/* Inner green diamond body */}
          <path
            d="M 0 -54 C 22 -54 54 -22 54 0 C 54 22 22 54 0 54 C -22 54 -54 22 -54 0 C -54 -22 -22 -54 0 -54 Z"
            fill="url(#greenGradient)"
            filter="drop-shadow(0px 4px 14px rgba(16,185,129,0.3))"
          />

          {/* Facial expression: toggles between smile arc and square eye */}
          {!blink ? (
            /* Curved friendly smile */
            <path
              d="M -16 -4 Q 0 8 16 -4"
              stroke="#064E3B"
              strokeWidth="4"
              strokeLinecap="round"
              fill="none"
            />
          ) : (
            /* Square blinking eye */
            <g transform="translate(-14, -14)">
              <rect x="0" y="0" width="28" height="24" rx="4" fill="#FFFFFF" />
              <rect x="6" y="5" width="16" height="14" rx="2" fill="#111827" />
            </g>
          )}
        </g>

        <defs>
          <linearGradient id="greenGradient" x1="0" y1="-54" x2="0" y2="54" gradientUnits="userSpaceOnUse">
            <stop stopColor="#86EFAC" offset="0%" />
            <stop stopColor="#10B981" offset="45%" />
            <stop stopColor="#059669" offset="100%" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  )
}
