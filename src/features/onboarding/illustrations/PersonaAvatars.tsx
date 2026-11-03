export function PersonaAvatar({ type }: { type: 'student' | 'professional' | 'parent' | 'lifelong' | 'teacher' | 'other' }) {
  switch (type) {
    case 'student':
      return (
        <svg viewBox="0 0 40 40" fill="none" className="w-10 h-10 shrink-0 select-none">
          {/* Hair back / ponytail */}
          <circle cx="20" cy="18" r="14" fill="#1F2937" />
          <path d="M 12 12 Q 10 5 17 8 Q 20 11 16 15 Z" fill="#1F2937" />
          {/* Headband */}
          <rect x="11" y="16" width="18" height="4" rx="2" fill="#F59E0B" />
          {/* Face */}
          <circle cx="20" cy="20" r="8" fill="#FBBF24" />
          {/* Hair bangs */}
          <path d="M 12 18 Q 20 16 28 18 Q 28 14 20 12 Q 12 14 12 18 Z" fill="#1F2937" />
          {/* Eyes */}
          <circle cx="17.5" cy="20" r="1" fill="#1F2937" />
          <circle cx="22.5" cy="20" r="1" fill="#1F2937" />
          {/* Body/Shirt */}
          <path d="M 10 38 C 10 30 14 28 20 28 C 26 28 30 30 30 38 Z" fill="#F59E0B" />
          {/* Collar/neck */}
          <rect x="18" y="27" width="4" height="4" fill="#FBBF24" />
        </svg>
      )

    case 'professional':
      return (
        <svg viewBox="0 0 40 40" fill="none" className="w-10 h-10 shrink-0 select-none">
          {/* Dark hair bob */}
          <path d="M 10 24 C 10 14 14 10 20 10 C 26 10 30 14 30 24 L 28 26 L 12 26 Z" fill="#111827" />
          {/* Face */}
          <circle cx="20" cy="19" r="7.5" fill="#FDE68A" />
          {/* Fringe */}
          <path d="M 13 18 Q 20 15 27 18 L 27 15 Q 20 12 13 15 Z" fill="#111827" />
          {/* Eyes */}
          <circle cx="17.5" cy="19" r="1" fill="#111827" />
          <circle cx="22.5" cy="19" r="1" fill="#111827" />
          {/* Neck */}
          <rect x="18" y="25" width="4" height="3" fill="#FDE68A" />
          {/* Suit & White collar */}
          <path d="M 8 38 C 8 30 12 28 20 28 C 28 28 32 30 32 38 Z" fill="#1F2937" />
          <polygon points="20,34 16,28 24,28" fill="#FFFFFF" />
          {/* Black tie */}
          <polygon points="20,38 18.5,31 20,30 21.5,31" fill="#111827" />
        </svg>
      )

    case 'parent':
      return (
        <svg viewBox="0 0 40 40" fill="none" className="w-10 h-10 shrink-0 select-none">
          {/* Hair */}
          <path d="M 12 18 C 12 12 15 10 20 10 C 25 10 28 12 28 18 Z" fill="#92400E" />
          {/* Face */}
          <circle cx="20" cy="19" r="7.5" fill="#FCD34D" />
          {/* Hair bangs */}
          <path d="M 13 16 Q 20 13 27 16 L 27 14 Q 20 11 13 14 Z" fill="#92400E" />
          {/* Eyes */}
          <circle cx="17.5" cy="19" r="1" fill="#1F2937" />
          <circle cx="22.5" cy="19" r="1" fill="#1F2937" />
          {/* Smile */}
          <path d="M 18 22 Q 20 24 22 22" stroke="#1F2937" strokeWidth="1" strokeLinecap="round" />
          {/* Neck */}
          <rect x="18" y="25" width="4" height="4" fill="#FCD34D" />
          {/* Blue Polo Shirt */}
          <path d="M 9 38 C 9 31 13 29 20 29 C 27 29 31 31 31 38 Z" fill="#3B82F6" />
          <polygon points="20,33 17,29 23,29" fill="#2563EB" />
        </svg>
      )

    case 'lifelong':
      return (
        <svg viewBox="0 0 40 40" fill="none" className="w-10 h-10 shrink-0 select-none">
          {/* Beanie / Hat */}
          <path d="M 11 17 C 11 11 15 9 20 9 C 25 9 29 11 29 17 Z" fill="#0D9488" />
          <rect x="10" y="15" width="20" height="4" rx="2" fill="#14B8A6" />
          {/* Face */}
          <circle cx="20" cy="20" r="7.5" fill="#FDE68A" />
          {/* Glasses */}
          <circle cx="17.5" cy="19.5" r="2.5" stroke="#1F2937" strokeWidth="1.2" fill="none" />
          <circle cx="22.5" cy="19.5" r="2.5" stroke="#1F2937" strokeWidth="1.2" fill="none" />
          <line x1="20" y1="19.5" x2="20" y2="19.5" stroke="#1F2937" strokeWidth="1.2" />
          {/* Smile */}
          <path d="M 18 24 Q 20 25.5 22 24" stroke="#1F2937" strokeWidth="1" strokeLinecap="round" />
          {/* Neck */}
          <rect x="18" y="26" width="4" height="3" fill="#FDE68A" />
          {/* Teal Sweater */}
          <path d="M 9 38 C 9 31 13 29 20 29 C 27 29 31 31 31 38 Z" fill="#0F766E" />
        </svg>
      )

    case 'teacher':
      return (
        <svg viewBox="0 0 40 40" fill="none" className="w-10 h-10 shrink-0 select-none">
          {/* Dark Red Headband */}
          <path d="M 12 17 C 12 12 15 10 20 10 C 25 10 28 12 28 17 Z" fill="#1F2937" />
          <rect x="10.5" y="14" width="19" height="3.5" rx="1.5" fill="#EF4444" />
          {/* Face */}
          <circle cx="20" cy="19.5" r="7.5" fill="#FCD34D" />
          {/* Glasses */}
          <rect x="15" y="18" width="4.5" height="3" rx="1" stroke="#111827" strokeWidth="1.2" fill="none" />
          <rect x="20.5" y="18" width="4.5" height="3" rx="1" stroke="#111827" strokeWidth="1.2" fill="none" />
          <line x1="19.5" y1="19.5" x2="20.5" y2="19.5" stroke="#111827" strokeWidth="1" />
          {/* Red shirt */}
          <rect x="18" y="26" width="4" height="3" fill="#FCD34D" />
          <path d="M 9 38 C 9 31 13 29 20 29 C 27 29 31 31 31 38 Z" fill="#DC2626" />
        </svg>
      )

    case 'other':
      return (
        <svg viewBox="0 0 40 40" fill="none" className="w-10 h-10 shrink-0 select-none">
          {/* Blonde hair */}
          <path d="M 12 18 C 12 11 15 9 20 9 C 25 9 28 11 28 18 Z" fill="#F59E0B" />
          {/* Face */}
          <circle cx="20" cy="19.5" r="7.5" fill="#FEF08A" />
          {/* Eyes looking up/side */}
          <circle cx="18" cy="18.5" r="1" fill="#1F2937" />
          <circle cx="23" cy="18.5" r="1" fill="#1F2937" />
          {/* Neck */}
          <rect x="18" y="26" width="4" height="3" fill="#FEF08A" />
          {/* Yellow shirt */}
          <path d="M 9 38 C 9 31 13 29 20 29 C 27 29 31 31 31 38 Z" fill="#EAB308" />
          {/* Thinking hand near chin */}
          <path d="M 19 28 Q 23 25 24 22" stroke="#F59E0B" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
      )
  }
}
