export function FloatingCardsIllustration({ className = 'w-64 h-64' }: { className?: string }) {
  return (
    <div className={`relative flex items-center justify-center select-none ${className}`}>
      <svg
        viewBox="0 0 280 260"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full overflow-visible"
      >
        {/* Card 1 (Top-Left): Microchip */}
        <g transform="translate(110, 20) rotate(-6)">
          <rect
            x="0"
            y="0"
            width="80"
            height="95"
            rx="8"
            fill="#FFFFFF"
            stroke="#E5E7EB"
            strokeWidth="1.5"
            filter="drop-shadow(0px 4px 12px rgba(0,0,0,0.06))"
          />
          {/* Chip Body */}
          <rect x="25" y="24" width="30" height="30" rx="4" fill="#6D28D9" />
          <rect x="33" y="32" width="14" height="14" rx="2" fill="#4C1D95" />
          {/* Pins */}
          <line x1="31" y1="16" x2="31" y2="24" stroke="#6D28D9" strokeWidth="2.5" strokeLinecap="round" />
          <line x1="40" y1="16" x2="40" y2="24" stroke="#6D28D9" strokeWidth="2.5" strokeLinecap="round" />
          <line x1="49" y1="16" x2="49" y2="24" stroke="#6D28D9" strokeWidth="2.5" strokeLinecap="round" />

          <line x1="31" y1="54" x2="31" y2="62" stroke="#6D28D9" strokeWidth="2.5" strokeLinecap="round" />
          <line x1="40" y1="54" x2="40" y2="62" stroke="#6D28D9" strokeWidth="2.5" strokeLinecap="round" />
          <line x1="49" y1="54" x2="49" y2="62" stroke="#6D28D9" strokeWidth="2.5" strokeLinecap="round" />

          <line x1="17" y1="33" x2="25" y2="33" stroke="#6D28D9" strokeWidth="2.5" strokeLinecap="round" />
          <line x1="17" y1="45" x2="25" y2="45" stroke="#6D28D9" strokeWidth="2.5" strokeLinecap="round" />

          <line x1="55" y1="33" x2="63" y2="33" stroke="#6D28D9" strokeWidth="2.5" strokeLinecap="round" />
          <line x1="55" y1="45" x2="63" y2="45" stroke="#6D28D9" strokeWidth="2.5" strokeLinecap="round" />

          {/* Purple accent strip */}
          <rect x="12" y="78" width="56" height="3" rx="1.5" fill="#8B5CF6" />
        </g>

        {/* Card 2 (Top-Right): Bar Chart & Trendline */}
        <g transform="translate(145, 65) rotate(4)">
          <rect
            x="0"
            y="0"
            width="85"
            height="95"
            rx="8"
            fill="#FFFFFF"
            stroke="#E5E7EB"
            strokeWidth="1.5"
            filter="drop-shadow(0px 4px 12px rgba(0,0,0,0.06))"
          />
          {/* Black Trendline with points */}
          <path d="M 15 32 Q 35 15 50 25 T 70 18" stroke="#111827" strokeWidth="2" fill="none" strokeLinecap="round" />
          <circle cx="15" cy="32" r="3" fill="#111827" />
          <circle cx="50" cy="25" r="3" fill="#111827" />
          <circle cx="70" cy="18" r="3" fill="#111827" />

          {/* Orange bars */}
          <rect x="18" y="48" width="12" height="26" rx="2" fill="#F97316" />
          <rect x="36" y="38" width="12" height="36" rx="2" fill="#F97316" />
          <rect x="54" y="44" width="12" height="30" rx="2" fill="#FB923C" />

          {/* Orange accent strip */}
          <rect x="14" y="80" width="57" height="3" rx="1.5" fill="#F97316" />
        </g>

        {/* Shape (Bottom-Left): Green mascot pebble */}
        <g transform="translate(65, 115) rotate(-12)">
          <path
            d="M 28 4 C 42 4 52 14 52 28 C 52 42 42 52 28 52 C 14 52 4 42 4 28 C 4 14 14 4 28 4 Z"
            fill="#10B981"
            filter="drop-shadow(0px 4px 14px rgba(16,185,129,0.35))"
          />
          {/* Black & White eye/box */}
          <rect x="18" y="20" width="18" height="15" rx="3" fill="#FFFFFF" />
          <rect x="24" y="20" width="12" height="15" rx="2" fill="#111827" />
        </g>

        {/* Card 3 (Bottom-Right/Center): Code </> card */}
        <g transform="translate(125, 115) rotate(6)">
          <rect
            x="0"
            y="0"
            width="85"
            height="95"
            rx="8"
            fill="#FFFFFF"
            stroke="#E5E7EB"
            strokeWidth="1.5"
            filter="drop-shadow(0px 6px 16px rgba(0,0,0,0.08))"
          />
          {/* Green Code box */}
          <rect x="15" y="18" width="55" height="42" rx="4" fill="#10B981" />
          {/* Code text: </> */}
          <text
            x="42.5"
            y="45"
            fill="#FFFFFF"
            fontSize="18"
            fontWeight="bold"
            fontFamily="monospace"
            textAnchor="middle"
          >
            &lt;/&gt;
          </text>
          {/* Green accent strip */}
          <rect x="15" y="74" width="55" height="3.5" rx="1.5" fill="#10B981" />
        </g>
      </svg>
    </div>
  )
}
