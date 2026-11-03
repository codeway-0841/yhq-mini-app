export function WorkoutMascotIllustration({ className = 'w-64 h-64' }: { className?: string }) {
  return (
    <div className={`relative flex items-center justify-center select-none ${className}`}>
      <svg
        viewBox="0 0 280 240"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full overflow-visible"
      >
        {/* Mascot Body (green organic rounded pebble) */}
        <g transform="translate(90, 45) rotate(-10)">
          <path
            d="M 40 10 C 65 10 80 25 80 50 C 80 75 65 90 40 90 C 15 90 0 75 0 50 C 0 25 15 10 40 10 Z"
            fill="#10B981"
            filter="drop-shadow(0px 8px 24px rgba(16,185,129,0.35))"
          />
          {/* Eye */}
          <rect x="25" y="32" width="28" height="25" rx="5" fill="#FFFFFF" />
          <rect x="33" y="40" width="12" height="12" rx="2.5" fill="#111827" />
        </g>

        {/* 3D Dumbbell */}
        <g transform="translate(135, 105) rotate(18)">
          {/* Left Weight Disk */}
          <polygon points="12,10 28,10 36,26 28,42 12,42 4,26" fill="#4B5563" />
          <polygon points="4,26 12,10 16,12 8,28" fill="#374151" />
          <polygon points="8,28 16,12 28,12 20,28" fill="#6B7280" />
          <circle cx="20" cy="26" r="3" fill="#1F2937" />

          {/* Dumbbell bar */}
          <rect x="28" y="22" width="30" height="8" rx="2" fill="#374151" />
          <rect x="28" y="24" width="30" height="4" fill="#6B7280" />

          {/* Right Weight Disk */}
          <g transform="translate(38, 0)">
            <polygon points="12,10 28,10 36,26 28,42 12,42 4,26" fill="#4B5563" />
            <polygon points="4,26 12,10 16,12 8,28" fill="#374151" />
            <polygon points="8,28 16,12 28,12 20,28" fill="#6B7280" />
            <circle cx="20" cy="26" r="3" fill="#1F2937" />
          </g>
        </g>
      </svg>
    </div>
  )
}
