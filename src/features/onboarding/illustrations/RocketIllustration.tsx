export function RocketIllustration({ className = 'w-64 h-64' }: { className?: string }) {
  return (
    <div className={`relative flex items-center justify-center select-none ${className}`}>
      <svg
        viewBox="0 0 320 340"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full overflow-visible"
      >
        {/* Math formula on left: J = u · \delta m */}
        <g className="font-serif italic text-gray-800 text-[16px]">
          <text x="35" y="145" fill="#1F2937" fontSize="17" fontFamily="Georgia, serif">
            J = u · δm
          </text>
        </g>

        {/* Thrust flame & smoke cloud */}
        <g id="exhaust-cloud">
          {/* Outer soft glow */}
          <ellipse cx="160" cy="275" rx="55" ry="40" fill="#FEF08A" fillOpacity="0.45" />
          {/* Main cloud bubbles */}
          <circle cx="160" cy="265" r="38" fill="#FDE047" fillOpacity="0.6" />
          <circle cx="140" cy="275" r="32" fill="#FBBF24" fillOpacity="0.55" />
          <circle cx="180" cy="275" r="30" fill="#FBBF24" fillOpacity="0.55" />
          <circle cx="150" cy="290" r="24" fill="#F59E0B" fillOpacity="0.5" />
          <circle cx="170" cy="288" r="22" fill="#F59E0B" fillOpacity="0.5" />

          {/* Floating particle dots */}
          <circle cx="132" cy="305" r="4.5" fill="#F97316" />
          <circle cx="188" cy="298" r="5" fill="#F97316" />
          <circle cx="168" cy="268" r="6" fill="#EA580C" />
          <circle cx="120" cy="265" r="4" fill="#FDBA74" />
        </g>

        {/* Vector annotations: arrow down with 'u' */}
        <g id="annotations">
          {/* Dashed line pointing down */}
          <line
            x1="160"
            y1="240"
            x2="160"
            y2="310"
            stroke="#1F2937"
            strokeWidth="1.5"
            strokeDasharray="4 3"
          />
          {/* Arrowhead */}
          <polygon points="160,316 156,307 164,307" fill="#1F2937" />
          {/* 'u' letter */}
          <text x="142" y="278" fill="#1F2937" fontSize="16" fontFamily="Georgia, serif" fontStyle="italic">
            u
          </text>

          {/* Particle with line to \delta m */}
          <line x1="174" y1="268" x2="204" y2="268" stroke="#1F2937" strokeWidth="1.2" />
          <text x="210" y="272" fill="#1F2937" fontSize="16" fontFamily="Georgia, serif" fontStyle="italic">
            δm
          </text>
        </g>

        {/* Rocket Body */}
        <g id="rocket" transform="translate(142, 45)">
          {/* Rocket antenna tip */}
          <line x1="18" y1="0" x2="18" y2="20" stroke="#9CA3AF" strokeWidth="2.5" strokeLinecap="round" />
          
          {/* Nose cone */}
          <path
            d="M 18,20 C 13,28 10,40 10,56 L 26,56 C 26,40 23,28 18,20 Z"
            fill="#E5E7EB"
            stroke="#4B5563"
            strokeWidth="1.5"
          />

          {/* Cockpit window (green badge with square) */}
          <circle cx="18" cy="42" r="7.5" fill="#10B981" />
          <rect x="15" y="39" width="6" height="6" rx="1.5" fill="#FFFFFF" />
          <rect x="16.5" y="40.5" width="3" height="3" fill="#10B981" />

          {/* Upper Stage */}
          <rect x="10" y="56" width="16" height="28" fill="#F3F4F6" stroke="#4B5563" strokeWidth="1.5" />
          <rect x="10" y="70" width="16" height="7" fill="#F97316" />

          {/* Middle Stage */}
          <rect x="10" y="84" width="16" height="42" fill="#FFFFFF" stroke="#4B5563" strokeWidth="1.5" />
          <line x1="10" y1="96" x2="26" y2="96" stroke="#9CA3AF" strokeWidth="1" />
          <line x1="10" y1="108" x2="26" y2="108" stroke="#9CA3AF" strokeWidth="1" />
          <rect x="15" y="99" width="6" height="6" fill="#E5E7EB" stroke="#6B7280" strokeWidth="1" />

          {/* Lower Stage / Engine skirt */}
          <path
            d="M 10,126 L 4,162 L 32,162 L 26,126 Z"
            fill="#6B7280"
            stroke="#374151"
            strokeWidth="1.5"
          />
          <path d="M 6,152 L 30,152 L 32,162 L 4,162 Z" fill="#F97316" />

          {/* Engine nozzle */}
          <path
            d="M 12,162 L 8,172 L 28,172 L 24,162 Z"
            fill="#1F2937"
            stroke="#111827"
            strokeWidth="1.5"
          />
        </g>
      </svg>
    </div>
  )
}
