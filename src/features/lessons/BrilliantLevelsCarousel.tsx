import { useId } from 'react'

export interface BrilliantModuleTheme {
  accent: string
  badgeBg: string
  dotColor: string
  buttonBg: string
  buttonShadow: string
  buttonText: string
  checkBg: string
  recommended?: boolean
}

/**
 * Exact color themes from Brilliant's Swipe Levels Interaction (60fps.design):
 * - Royal Blue (#3557ff)
 * - Golden Amber (#f6b31f / #f6b31f) with dark button text (#111827)
 * - Vibrant Purple (#8a4cff)
 */
export const BRILLIANT_MODULE_THEMES: Record<number, BrilliantModuleTheme> = {
  1: {
    accent: '#3557ff',
    badgeBg: 'rgba(53, 87, 255, 0.16)',
    dotColor: '#3557ff',
    buttonBg: '#3557ff',
    buttonShadow: '#2f49ec',
    buttonText: '#ffffff',
    checkBg: '#839cff',
    recommended: false,
  },
  2: {
    accent: '#f6b31f',
    badgeBg: 'rgba(246, 179, 31, 0.2)',
    dotColor: '#f6b31f',
    buttonBg: '#f6b31f',
    buttonShadow: '#e0a31c',
    buttonText: '#111827',
    checkBg: '#f6b31f',
    recommended: false,
  },
  3: {
    accent: '#3557ff',
    badgeBg: 'rgba(53, 87, 255, 0.16)',
    dotColor: '#3557ff',
    buttonBg: '#3557ff',
    buttonShadow: '#2f49ec',
    buttonText: '#ffffff',
    checkBg: '#839cff',
    recommended: false,
  },
  4: {
    accent: '#3557ff',
    badgeBg: 'rgba(53, 87, 255, 0.16)',
    dotColor: '#3557ff',
    buttonBg: '#3557ff',
    buttonShadow: '#2f49ec',
    buttonText: '#ffffff',
    checkBg: '#839cff',
    recommended: true,
  },
  5: {
    accent: '#8a4cff',
    badgeBg: 'rgba(138, 76, 255, 0.18)',
    dotColor: '#8a4cff',
    buttonBg: '#8a4cff',
    buttonShadow: '#7a3fe8',
    buttonText: '#ffffff',
    checkBg: '#a07bff',
    recommended: true,
  },
  6: {
    accent: '#f6b31f',
    badgeBg: 'rgba(246, 179, 31, 0.2)',
    dotColor: '#f6b31f',
    buttonBg: '#f6b31f',
    buttonShadow: '#e0a31c',
    buttonText: '#111827',
    checkBg: '#f6b31f',
    recommended: false,
  },
  7: {
    accent: '#8a4cff',
    badgeBg: 'rgba(138, 76, 255, 0.18)',
    dotColor: '#8a4cff',
    buttonBg: '#8a4cff',
    buttonShadow: '#7a3fe8',
    buttonText: '#ffffff',
    checkBg: '#a07bff',
    recommended: true,
  },
  8: {
    accent: '#3557ff',
    badgeBg: 'rgba(53, 87, 255, 0.16)',
    dotColor: '#3557ff',
    buttonBg: '#3557ff',
    buttonShadow: '#2f49ec',
    buttonText: '#ffffff',
    checkBg: '#839cff',
    recommended: false,
  },
}

export function getBrilliantTheme(moduleId: number): BrilliantModuleTheme {
  return BRILLIANT_MODULE_THEMES[moduleId] ?? BRILLIANT_MODULE_THEMES[1]
}

/**
 * 1-to-1 3D Hero Illustrations matching each frame of 03_brilliant-swipe-levels-interaction.mp4:
 * - Frame 1: Balance Scale with 3D weight & spheres
 * - Frame 2: Golden 3D Jigsaw Puzzle Piece & Glowing Blue Lightbulb
 * - Frame 3: Blue 3D Magnifying Glass with Checkmark & Yellow 3D Cube
 * - Frame 4: 3D Geometric Mondrian Easel (Blue/Yellow/White)
 * - Frame 5: Purple & Yellow 3D Code Blocks with Play Button & Pointer Hand
 */
const HERO_PNGS: Record<number, string> = {
  1: '/brilliant/hero_scale.png',
  2: '/brilliant/hero_code.png',
  3: '/brilliant/hero_gears.png',
  4: '/brilliant/hero_dice.png',
  5: '/brilliant/hero_math.png',
}

export function BrilliantHeroIllustration({
  moduleId,
  forceSvg = false,
  className = 'w-[236px] h-[192px]',
}: {
  moduleId: number
  forceSvg?: boolean
  className?: string
}) {
  const uid = useId()
  const variant = ((moduleId - 1) % 5) + 1

  if (!forceSvg && HERO_PNGS[variant]) {
    return (
      <div className={`relative flex items-center justify-center ${className} select-none pointer-events-none`}>
        <img
          src={HERO_PNGS[variant]}
          alt=""
          className="max-w-full max-h-full object-contain drop-shadow-[0_8px_20px_rgba(0,0,0,0.08)] select-none pointer-events-none"
        />
      </div>
    )
  }

  if (variant === 1) {
    // Frame 00:00 — Solving Equations: 3D Blue Balance Scale + Grey Weight + Spheres
    return (
      <svg viewBox="0 0 220 175" className={`${className} overflow-visible select-none`} aria-hidden="true">
        <defs>
          <linearGradient id={`${uid}-scale-blue`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#3b82f6" />
            <stop offset="100%" stopColor="#1d4ed8" />
          </linearGradient>
          <linearGradient id={`${uid}-weight`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#9ca3af" />
            <stop offset="55%" stopColor="#6b7280" />
            <stop offset="100%" stopColor="#4b5563" />
          </linearGradient>
          <radialGradient id={`${uid}-sphere-blue`} cx="35%" cy="30%" r="65%">
            <stop offset="0%" stopColor="#60a5fa" />
            <stop offset="55%" stopColor="#2563eb" />
            <stop offset="100%" stopColor="#1e3a8a" />
          </radialGradient>
        </defs>

        {/* Left Pan: 3D Trapezoid Weight */}
        <g transform="translate(0, 4)">
          <circle cx="58" cy="38" r="6" fill="none" stroke="#9ca3af" strokeWidth="4.5" />
          <polygon points="44,43 72,43 79,78 37,78" fill={`url(#${uid}-weight)`} />
          <polygon points="64,43 72,43 79,78 68,78" fill="#4b5563" opacity="0.65" />
          {/* Left Blue Pan Bowl */}
          <path d="M22 78 H94 C91 96 76 105 58 105 C40 105 25 96 22 78 Z" fill={`url(#${uid}-scale-blue)`} />
          <ellipse cx="58" cy="78" rx="36" ry="4.5" fill="#60a5fa" />
          <rect x="52" y="103" width="12" height="14" rx="2" fill="#1e40af" />
        </g>

        {/* Right Pan: Blue Sphere + Striped Gold Sphere + Dark Sphere */}
        <g transform="translate(0, 2)">
          {/* Big Blue Sphere */}
          <circle cx="154" cy="56" r="24" fill={`url(#${uid}-sphere-blue)`} />
          {/* Dark Striped Sphere on right */}
          <circle cx="174" cy="68" r="14" fill="#374151" />
          <path d="M162 64 Q174 58 186 64 M161 71 Q174 65 187 71" stroke="#111827" strokeWidth="2.5" fill="none" />
          {/* Golden Striped Sphere in front */}
          <circle cx="143" cy="68" r="13.5" fill="#fbbf24" />
          <path d="M131 64 Q143 60 155 64 M130 70 Q143 66 156 70 M133 76 Q143 72 153 76" stroke="#92400e" strokeWidth="2.2" fill="none" />
          {/* Right Blue Pan Bowl */}
          <path d="M118 78 H194 C191 96 176 105 156 105 C136 105 121 96 118 78 Z" fill={`url(#${uid}-scale-blue)`} />
          <ellipse cx="156" cy="78" rx="38" ry="4.5" fill="#60a5fa" />
          <rect x="150" y="103" width="12" height="14" rx="2" fill="#1e40af" />
        </g>

        {/* Crossbar & Center Fulcrum */}
        <path d="M48 117 H166" stroke="#1d4ed8" strokeWidth="9" strokeLinecap="round" />
        <path d="M107 104 L117 122 H97 Z" fill="#111827" />
        <rect x="102" y="120" width="10" height="22" fill="#1d4ed8" />
        {/* 3D Stepped Pedestal Base */}
        <path d="M68 152 C68 143 78 138 107 138 C136 138 146 143 146 152 Z" fill={`url(#${uid}-scale-blue)`} />
        <rect x="56" y="150" width="102" height="10" rx="5" fill="#1d4ed8" />
        <ellipse cx="107" cy="162" rx="56" ry="4" fill="#cbd5e1" opacity="0.55" />
      </svg>
    )
  }

  if (variant === 2) {
    // Frame 00:01 — Science Puzzles: Golden 3D Jigsaw Piece + Glowing 3D Lightbulb
    return (
      <svg viewBox="0 0 220 175" className={`${className} overflow-visible select-none`} aria-hidden="true">
        <defs>
          <linearGradient id={`${uid}-gold-front`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#fde047" />
            <stop offset="55%" stopColor="#facc15" />
            <stop offset="100%" stopColor="#eab308" />
          </linearGradient>
          <linearGradient id={`${uid}-gold-side`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ca8a04" />
            <stop offset="100%" stopColor="#a16207" />
          </linearGradient>
          <radialGradient id={`${uid}-bulb-glow`} cx="45%" cy="38%" r="60%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="55%" stopColor="#dbeafe" />
            <stop offset="100%" stopColor="#93c5fd" />
          </radialGradient>
        </defs>

        {/* 3D Extruded Back Layer of Jigsaw */}
        <rect x="56" y="28" width="104" height="86" rx="8" fill={`url(#${uid}-gold-side)`} />
        {/* Left Jigsaw Knob (3D) */}
        <ellipse cx="46" cy="72" rx="15" ry="15" fill="#ca8a04" />
        <ellipse cx="50" cy="70" rx="14" ry="14" fill={`url(#${uid}-gold-front)`} />

        {/* Main Golden Jigsaw Body */}
        <path
          d="M62 24 H94 C94 36 118 36 118 24 H154 C158 24 162 28 162 32 V104 C162 108 158 112 154 112 H62 C58 112 54 108 54 104 V32 C54 28 58 24 62 24 Z"
          fill={`url(#${uid}-gold-front)`}
        />
        {/* Top Jigsaw Cutout Shadow */}
        <path d="M93 24 C93 38 119 38 119 24" fill="#fef08a" opacity="0.6" />
        {/* Right Jigsaw Cutout */}
        <circle cx="156" cy="68" r="14" fill="#ffffff" />
        <path d="M156 54 A14 14 0 0 0 142 68 A14 14 0 0 0 156 82" fill="#a16207" opacity="0.45" />

        {/* 3D Glowing Lightbulb in Front */}
        <g transform="translate(0, 6)">
          {/* Soft Shadow on Jigsaw */}
          <ellipse cx="109" cy="88" rx="32" ry="36" fill="#a16207" opacity="0.22" />
          {/* Bulb Glass Sphere */}
          <path
            d="M78 82 C78 60 93 46 112 46 C131 46 146 60 146 82 C146 96 135 106 129 118 H95 C89 106 78 96 78 82 Z"
            fill={`url(#${uid}-bulb-glow)`}
            stroke="#bfdbfe"
            strokeWidth="1.5"
          />
          {/* Inner Filament Glow */}
          <path d="M104 116 V92 C104 85 120 85 120 92 V116" fill="none" stroke="#60a5fa" strokeWidth="3" strokeLinecap="round" />
          {/* Highlight Specular */}
          <ellipse cx="98" cy="68" rx="10" ry="15" transform="rotate(-22 98 68)" fill="#ffffff" opacity="0.85" />
          {/* Screw Base */}
          <rect x="96" y="118" width="32" height="8" rx="4" fill="#9ca3af" />
          <rect x="98" y="126" width="28" height="7" rx="3.5" fill="#6b7280" />
          <path d="M103 133 H121 L117 141 H107 Z" fill="#374151" />
        </g>
      </svg>
    )
  }

  if (variant === 3) {
    // Frame 00:02 — Logic: Blue 3D Magnifying Glass with Checkmark + Golden 3D Cube with X
    return (
      <svg viewBox="0 0 220 175" className={`${className} overflow-visible select-none`} aria-hidden="true">
        {/* Golden 3D Cube on Right */}
        <g transform="translate(108, 52)">
          {/* Top Face */}
          <polygon points="34,0 68,18 34,34 0,18" fill="#fef08a" />
          {/* Left Face */}
          <polygon points="0,18 34,34 34,88 0,72" fill="#eab308" />
          {/* Right Face */}
          <polygon points="34,34 68,18 68,72 34,88" fill="#facc15" />
          <rect x="18" y="34" width="52" height="54" rx="3" fill="#facc15" />
          {/* X Mark on Front Face */}
          <path d="M36 52 L52 68 M52 52 L36 68" stroke="#a16207" strokeWidth="4.5" strokeLinecap="round" />
        </g>

        {/* Blue 3D Magnifying Glass */}
        <g transform="translate(36, 14)">
          {/* Handle (going down-right behind/under) */}
          <path d="M88 94 L126 132" stroke="#1e3a8a" strokeWidth="16" strokeLinecap="round" />
          <path d="M88 94 L124 130" stroke="#2563eb" strokeWidth="12" strokeLinecap="round" />
          {/* 3D Extruded Outer Ring */}
          <circle cx="58" cy="58" r="46" fill="#1d4ed8" />
          <circle cx="54" cy="54" r="46" fill="#2563eb" />
          {/* Inner Lens */}
          <circle cx="54" cy="54" r="35" fill="#93c5fd" />
          <path d="M28 32 A32 32 0 0 1 78 30" stroke="#dbeafe" strokeWidth="5" fill="none" strokeLinecap="round" opacity="0.7" />
          {/* Checkmark inside Lens */}
          <path d="M40 55 L50 65 L70 43" fill="none" stroke="#1e293b" strokeWidth="5.5" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      </svg>
    )
  }

  if (variant === 4) {
    // Frame 00:03 — Mathematical Thinking: 3D Geometric Mondrian Board on Easel
    return (
      <svg viewBox="0 0 220 175" className={`${className} overflow-visible select-none`} aria-hidden="true">
        {/* Easel Wooden Legs & Top Clamp */}
        <rect x="103" y="12" width="14" height="12" rx="2" fill="#d97706" />
        <rect x="97" y="17" width="26" height="6" rx="2" fill="#92400e" />
        {/* Easel Bottom Legs */}
        <path d="M76 132 L66 158" stroke="#d97706" strokeWidth="9" strokeLinecap="round" />
        <path d="M144 132 L154 158" stroke="#d97706" strokeWidth="9" strokeLinecap="round" />
        <path d="M110 132 V154" stroke="#92400e" strokeWidth="8" strokeLinecap="round" />

        {/* 3D Board Depth Side */}
        <rect x="52" y="23" width="118" height="106" rx="4" fill="#d1d5db" />

        {/* Main Geometric Canvas */}
        <g transform="translate(50, 22)">
          {/* Top-Left Large Royal Blue Square */}
          <rect x="0" y="0" width="76" height="72" fill="#2563eb" />
          {/* Top-Right White Block */}
          <rect x="76" y="0" width="38" height="36" fill="#f8fafc" stroke="#e2e8f0" strokeWidth="1" />
          {/* Middle-Right Golden Block */}
          <rect x="76" y="36" width="38" height="36" fill="#eab308" />
          {/* Bottom-Left Light Blue Block */}
          <rect x="0" y="72" width="76" height="32" fill="#60a5fa" />
          {/* Bottom-Right Split Blocks */}
          <rect x="76" y="72" width="19" height="16" fill="#fef08a" />
          <rect x="95" y="72" width="19" height="16" fill="#a16207" />
          <rect x="76" y="88" width="19" height="16" fill="#fde047" />
          <rect x="95" y="88" width="19" height="16" fill="#ca8a04" />
        </g>

        {/* Easel Bottom Tray Bar */}
        <rect x="44" y="126" width="132" height="9" rx="3" fill="#475569" />
      </svg>
    )
  }

  // Frame 00:04 — Thinking in Code: Purple & Yellow 3D Code Blocks + Play Button + Hand
  return (
    <svg viewBox="0 0 220 175" className={`${className} overflow-visible select-none`} aria-hidden="true">
      {/* Top Golden Repeat/Loop Bracket Block */}
      <g transform="translate(46, 22)">
        <path
          d="M0 8 C0 3.5 3.5 0 8 0 H118 C122.5 0 126 3.5 126 8 V24 C126 28.5 122.5 32 118 32 H26 V64 H18 C8 64 0 56 0 46 Z"
          fill="#eab308"
        />
        <path
          d="M2 6 C2 2.5 4.5 0 8 0 H118 C121.5 0 124 2.5 124 6 V20 H22 V58 H12 C6 58 2 54 2 48 Z"
          fill="#fef08a"
        />
        <rect x="10" y="7" width="44" height="8" rx="4" fill="#eab308" />
        <path d="M108 10 L113 15 L118 10" stroke="#a16207" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      </g>

      {/* Tilted 3D Purple Command Block Being Dragged */}
      <g transform="translate(64, 58) rotate(-8)">
        <rect x="0" y="4" width="76" height="32" rx="7" fill="#6b21a8" />
        <rect x="0" y="0" width="76" height="30" rx="7" fill="#9333ea" />
        <rect x="10" y="11" width="38" height="8" rx="4" fill="#d8b4fe" />
      </g>

      {/* Dark Square Play Button on Left */}
      <g transform="translate(44, 96)">
        <rect x="0" y="3" width="34" height="34" rx="8" fill="#0f172a" />
        <rect x="0" y="0" width="34" height="32" rx="8" fill="#1e293b" />
        <polygon points="13,9 13,23 24,16" fill="#ffffff" />
      </g>

      {/* Bottom Light Purple Slot Block */}
      <g transform="translate(88, 102)">
        <rect x="0" y="4" width="78" height="32" rx="8" fill="#c084fc" />
        <rect x="0" y="0" width="78" height="30" rx="8" fill="#e9d5ff" />
        <rect x="8" y="6" width="18" height="18" rx="5" fill="#a855f7" />
        <path d="M17 11 V19 M13 15 H21" stroke="#ffffff" strokeWidth="2.2" strokeLinecap="round" />
        <rect x="34" y="11" width="32" height="8" rx="4" fill="#a855f7" />
      </g>

      {/* Cartoon White Glove Hand Cursor Grabbing the Purple Block */}
      <g transform="translate(128, 60)">
        <path
          d="M12 18 V6 C12 2.5 17 2.5 17 6 V15 C17 12 22 12 22 15 V17 C22 14 27 14 27 17 V20 C27 17 31 17 31 20 V29 C31 37 25 42 17 42 H13 C7 42 3 36 3 30 V23 C3 19 8 18 12 18 Z"
          fill="#ffffff"
          stroke="#1e293b"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
        <line x1="17" y1="15" x2="17" y2="23" stroke="#1e293b" strokeWidth="2" strokeLinecap="round" />
        <line x1="22" y1="16" x2="22" y2="23" stroke="#1e293b" strokeWidth="2" strokeLinecap="round" />
        <line x1="27" y1="18" x2="27" y2="24" stroke="#1e293b" strokeWidth="2" strokeLinecap="round" />
      </g>
    </svg>
  )
}

/**
 * 1-to-1 3D Isometric Row Icon from the bottom card of 03_brilliant-swipe-levels-interaction.mp4:
 * - current: Isometric grey ring platform + floating 3D green gem/crown above it
 * - done: Isometric 3D cylinder platform + two grey cones/pawns on top
 * - upcoming: Flat hatched grey isometric oval disc
 */
export function BrilliantLessonRowIcon({
  state,
  accentColor = '#3557ff',
}: {
  state: 'done' | 'current' | 'upcoming'
  accentColor?: string
}) {
  if (state === 'done') {
    return (
      <div className="flex h-11 w-12 shrink-0 items-center justify-center">
        <img
          src="/brilliant/mascot_done.png"
          alt=""
          width={40}
          height={40}
          className="size-10 shrink-0 select-none object-contain pointer-events-none drop-shadow-sm"
        />
      </div>
    )
  }

  if (state === 'upcoming') {
    return (
      <div className="flex h-11 w-12 shrink-0 items-center justify-center">
        <img
          src="/brilliant/mascot_upcoming.png"
          alt=""
          width={42}
          height={32}
          className="h-8 w-11 shrink-0 select-none object-contain pointer-events-none opacity-85"
        />
      </div>
    )
  }

  // Current level - pick mascot by theme accent color
  let mascotSrc = '/brilliant/mascot_blue.png'
  const normalized = accentColor.toLowerCase()
  if (normalized.includes('8a4cff') || normalized.includes('purple')) {
    mascotSrc = '/brilliant/mascot_purple.png'
  } else if (
    normalized.includes('f6b31f') ||
    normalized.includes('gold') ||
    normalized.includes('amber') ||
    normalized.includes('yellow')
  ) {
    mascotSrc = '/brilliant/mascot_gold.png'
  }

  return (
    <div className="flex h-11 w-12 shrink-0 items-center justify-center">
      <img
        src={mascotSrc}
        alt=""
        width={46}
        height={42}
        className="h-11 w-12 shrink-0 select-none object-contain pointer-events-none drop-shadow"
      />
    </div>
  )
}

export default BrilliantHeroIllustration