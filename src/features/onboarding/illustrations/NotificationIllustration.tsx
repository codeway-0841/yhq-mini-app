export function NotificationIllustration({ className = 'w-64 h-64' }: { className?: string }) {
  return (
    <div className={`relative flex items-center justify-center select-none ${className}`}>
      <svg
        viewBox="0 0 280 240"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full overflow-visible"
      >
        {/* iOS Notification Alert Box */}
        <g transform="translate(35, 30)">
          {/* Card background */}
          <rect
            x="0"
            y="0"
            width="210"
            height="115"
            rx="18"
            fill="#FFFFFF"
            stroke="#E5E7EB"
            strokeWidth="1.2"
            filter="drop-shadow(0px 8px 24px rgba(0,0,0,0.06))"
          />

          {/* Alert Title */}
          <text
            x="105"
            y="38"
            fill="#111827"
            fontSize="12.5"
            fontWeight="600"
            fontFamily="system-ui, -apple-system, sans-serif"
            textAnchor="middle"
          >
            Brilliant Would Like to Send
          </text>
          <text
            x="105"
            y="54"
            fill="#111827"
            fontSize="12.5"
            fontWeight="600"
            fontFamily="system-ui, -apple-system, sans-serif"
            textAnchor="middle"
          >
            You Notifications
          </text>

          {/* Divider line horizontal */}
          <line x1="0" y1="72" x2="210" y2="72" stroke="#F3F4F6" strokeWidth="1" />

          {/* Divider line vertical */}
          <line x1="105" y1="72" x2="105" y2="115" stroke="#F3F4F6" strokeWidth="1" />

          {/* Button "Don't allow" */}
          <text
            x="52.5"
            y="97"
            fill="#6B7280"
            fontSize="12.5"
            fontWeight="500"
            fontFamily="system-ui, -apple-system, sans-serif"
            textAnchor="middle"
          >
            Don't allow
          </text>

          {/* Highlighted green border around "Allow" */}
          <rect
            x="105"
            y="72"
            width="105"
            height="43"
            rx="0 0 18 0"
            stroke="#10B981"
            strokeWidth="1.8"
            fill="none"
          />

          {/* Button "Allow" */}
          <text
            x="157.5"
            y="97"
            fill="#10B981"
            fontSize="13"
            fontWeight="600"
            fontFamily="system-ui, -apple-system, sans-serif"
            textAnchor="middle"
          >
            Allow
          </text>
        </g>

        {/* Green Mascot finger/hand tapping on Allow */}
        <g transform="translate(115, 95) rotate(-28)">
          {/* Green pebble mascot body */}
          <path
            d="M 30 10 C 45 10 55 20 55 35 C 55 50 45 60 30 60 C 15 60 5 50 5 35 C 5 20 15 10 30 10 Z"
            fill="#10B981"
            filter="drop-shadow(0px 6px 18px rgba(16,185,129,0.4))"
          />
          {/* Extended finger pointing up */}
          <path
            d="M 24 12 L 24 -10 C 24 -15 36 -15 36 -10 L 36 12 Z"
            fill="#10B981"
          />
          {/* Eye square */}
          <rect x="22" y="27" width="16" height="15" rx="3" fill="#FFFFFF" />
          <rect x="26" y="31" width="8" height="7" rx="1.5" fill="#111827" />
        </g>
      </svg>
    </div>
  )
}
