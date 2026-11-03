export function InterestIcon({ type }: { type: 'skills' | 'explore' | 'math' | 'brain' | 'school' | 'other' }) {
  switch (type) {
    case 'skills':
      return (
        <svg viewBox="0 0 36 36" fill="none" className="w-8 h-8 shrink-0 select-none">
          {/* Subtle grid box */}
          <rect x="4" y="4" width="28" height="28" rx="4" stroke="#E5E7EB" strokeWidth="1.2" fill="#F9FAFB" />
          <line x1="11" y1="4" x2="11" y2="32" stroke="#E5E7EB" strokeWidth="1" />
          <line x1="18" y1="4" x2="18" y2="32" stroke="#E5E7EB" strokeWidth="1" />
          <line x1="25" y1="4" x2="25" y2="32" stroke="#E5E7EB" strokeWidth="1" />
          <line x1="4" y1="11" x2="32" y2="11" stroke="#E5E7EB" strokeWidth="1" />
          <line x1="4" y1="18" x2="32" y2="18" stroke="#E5E7EB" strokeWidth="1" />
          <line x1="4" y1="25" x2="32" y2="25" stroke="#E5E7EB" strokeWidth="1" />
          {/* Green trending up arrow path */}
          <path d="M 6 26 L 14 18 L 20 22 L 28 10" stroke="#10B981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          <polygon points="28,10 24,10 28,14" fill="#10B981" />
        </svg>
      )

    case 'explore':
      return (
        <svg viewBox="0 0 36 36" fill="none" className="w-8 h-8 shrink-0 select-none">
          {/* Globe circle */}
          <circle cx="18" cy="18" r="14" fill="#2563EB" />
          {/* Continents (black/dark accents) */}
          <path d="M 9 14 Q 13 10 16 14 Q 18 19 14 22 Q 10 21 9 14 Z" fill="#1D4ED8" />
          <path d="M 20 10 Q 25 12 28 16 Q 26 21 21 20 Q 20 15 20 10 Z" fill="#1D4ED8" />
          <path d="M 17 25 Q 23 24 24 28 Q 19 32 17 25 Z" fill="#1D4ED8" />
          {/* Globe grid / meridian lines */}
          <ellipse cx="18" cy="18" rx="8" ry="14" stroke="#93C5FD" strokeWidth="1" fill="none" strokeOpacity="0.4" />
          <line x1="4" y1="18" x2="32" y2="18" stroke="#93C5FD" strokeWidth="1" strokeOpacity="0.4" />
        </svg>
      )

    case 'math':
      return (
        <svg viewBox="0 0 36 36" fill="none" className="w-8 h-8 shrink-0 select-none">
          {/* Geometric crossing black and blue arrows */}
          <line x1="8" y1="8" x2="28" y2="28" stroke="#111827" strokeWidth="2.5" strokeLinecap="round" />
          <polygon points="8,8 14,8 8,14" fill="#111827" />
          <polygon points="28,28 22,28 28,22" fill="#111827" />

          <line x1="8" y1="28" x2="28" y2="8" stroke="#3B82F6" strokeWidth="2.5" strokeLinecap="round" />
          <polygon points="8,28 14,28 8,22" fill="#3B82F6" />
          <polygon points="28,8 22,8 28,14" fill="#3B82F6" />
        </svg>
      )

    case 'brain':
      return (
        <svg viewBox="0 0 36 36" fill="none" className="w-8 h-8 shrink-0 select-none">
          {/* Concentric rings of target dartboard */}
          <circle cx="18" cy="18" r="14" stroke="#EF4444" strokeWidth="2.5" fill="none" />
          <circle cx="18" cy="18" r="9" stroke="#EF4444" strokeWidth="2.5" fill="none" />
          <circle cx="18" cy="18" r="4" fill="#EF4444" />
          {/* Subtle dart line */}
          <line x1="6" y1="6" x2="16" y2="16" stroke="#9CA3AF" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      )

    case 'school':
      return (
        <svg viewBox="0 0 36 36" fill="none" className="w-8 h-8 shrink-0 select-none">
          {/* Green hardcover notebook */}
          <rect x="7" y="6" width="18" height="24" rx="2" fill="#15803D" stroke="#166534" strokeWidth="1" />
          {/* Spine ribbon */}
          <rect x="7" y="6" width="3.5" height="24" rx="1" fill="#111827" />
          {/* Yellow bookmark ribbon */}
          <rect x="14" y="6" width="2" height="6" fill="#FACC15" />
          {/* Pencil */}
          <g transform="translate(25, 10)">
            <rect x="1" y="0" width="3" height="16" rx="1" fill="#F59E0B" />
            <polygon points="1,16 2.5,20 4,16" fill="#FDE68A" />
            <polygon points="2,18 2.5,20 3,18" fill="#111827" />
            <rect x="1" y="0" width="3" height="3" fill="#F43F5E" />
          </g>
        </svg>
      )

    case 'other':
      return (
        <svg viewBox="0 0 36 36" fill="none" className="w-8 h-8 shrink-0 select-none">
          {/* Two gray domino / puzzle blocks */}
          <rect x="6" y="8" width="10" height="20" rx="2" stroke="#9CA3AF" strokeWidth="1.5" fill="#F3F4F6" />
          <circle cx="11" cy="13" r="1.5" fill="#6B7280" />
          <circle cx="11" cy="23" r="1.5" fill="#6B7280" />
          <line x1="7" y1="18" x2="15" y2="18" stroke="#D1D5DB" strokeWidth="1" />

          <rect x="20" y="8" width="10" height="20" rx="2" stroke="#9CA3AF" strokeWidth="1.5" fill="#F3F4F6" />
          <circle cx="25" cy="13" r="1.5" fill="#6B7280" />
          <circle cx="25" cy="23" r="1.5" fill="#6B7280" />
          <line x1="21" y1="18" x2="29" y2="18" stroke="#D1D5DB" strokeWidth="1" />
        </svg>
      )
  }
}
