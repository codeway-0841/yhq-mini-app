import React from 'react'

interface IconProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string
  className?: string
}

/**
 * 1:1 Authentic Wondering Red Bear Mascot
 * Faithfully recreated from live screenshot node_clicked_detail.png
 */
export function WonderRedBear({ size = 100, className = '' }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 140"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`inline-block ${className}`}
    >
      <defs>
        {/* Deep Crimson Body Gradient */}
        <linearGradient id="bearBodyGrad" x1="60" y1="10" x2="60" y2="135" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#B31B38" />
          <stop offset="50%" stopColor="#96152D" />
          <stop offset="100%" stopColor="#780D21" />
        </linearGradient>

        {/* Inner Ear Dark Maroon */}
        <radialGradient id="innerEarGrad" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#4A0512" />
          <stop offset="100%" stopColor="#690C1D" />
        </radialGradient>

        {/* Snout Radial Highlight */}
        <radialGradient id="snoutGrad" cx="50%" cy="40%" r="60%">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="85%" stopColor="#F5ECE9" />
          <stop offset="100%" stopColor="#EADBDA" />
        </radialGradient>

        {/* Belly Soft Cream Gradient */}
        <linearGradient id="bellyGrad" x1="60" y1="75" x2="60" y2="125" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="100%" stopColor="#F8EFEF" />
        </linearGradient>

        {/* Soft Drop Shadow */}
        <filter id="bearShadow" x="-10%" y="-10%" width="120%" height="130%">
          <feDropShadow dx="0" dy="6" stdDeviation="6" floodColor="#780D21" floodOpacity="0.25" />
        </filter>
      </defs>

      <g filter="url(#bearShadow)">
        {/* Left Ear */}
        <circle cx="34" cy="28" r="13" fill="#96152D" />
        <circle cx="35" cy="29" r="8" fill="url(#innerEarGrad)" />

        {/* Right Ear */}
        <circle cx="86" cy="28" r="13" fill="#96152D" />
        <circle cx="85" cy="29" r="8" fill="url(#innerEarGrad)" />

        {/* Main Pear-Shaped Body & Head (slight tilt) */}
        <path
          d="M60 22
             C40 22 30 36 28 54
             C26 70 20 86 20 104
             C20 124 36 134 60 134
             C84 134 100 124 100 104
             C100 86 94 70 92 54
             C90 36 80 22 60 22 Z"
          fill="url(#bearBodyGrad)"
        />

        {/* Left Foot */}
        <ellipse cx="44" cy="132" rx="11" ry="6" fill="#780D21" />

        {/* Right Foot */}
        <ellipse cx="76" cy="132" rx="11" ry="6" fill="#780D21" />

        {/* White Cream Belly */}
        <path
          d="M60 74
             C47 74 38 86 38 102
             C38 116 47 126 60 126
             C73 126 82 116 82 102
             C82 86 73 74 60 74 Z"
          fill="url(#bellyGrad)"
        />

        {/* White Muzzle / Snout */}
        <ellipse cx="60" cy="52" rx="14" ry="10.5" fill="url(#snoutGrad)" />

        {/* Nose */}
        <path
          d="M56 47
             C56 45 64 45 64 47
             C64 50 62 52 60 52
             C58 52 56 50 56 47 Z"
          fill="#1C1819"
        />
        {/* Tiny nose highlight */}
        <ellipse cx="58.5" cy="46.5" rx="1.5" ry="0.8" fill="#FFFFFF" opacity="0.6" />

        {/* Subtle Mouth Line */}
        <path
          d="M60 52 L60 55 M57 55 C58.5 56.5 61.5 56.5 63 55"
          stroke="#403839"
          strokeWidth="1.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Eyes with highlight dots */}
        {/* Left Eye */}
        <ellipse cx="49" cy="42" rx="3.2" ry="4" fill="#1C1819" />
        <circle cx="48" cy="40.5" r="1.3" fill="#FFFFFF" />

        {/* Right Eye */}
        <ellipse cx="71" cy="42" rx="3.2" ry="4" fill="#1C1819" />
        <circle cx="70" cy="40.5" r="1.3" fill="#FFFFFF" />

        {/* Left Arm (curved inward hugging belly) */}
        <path
          d="M26 68
             C20 74 16 86 21 95
             C25 102 34 102 39 96
             C41 93 40 88 36 84
             C31 79 30 73 26 68 Z"
          fill="#861226"
        />

        {/* Right Arm (tilted up slightly) */}
        <path
          d="M94 68
             C100 74 104 86 99 95
             C95 102 86 102 81 96
             C79 93 80 88 84 84
             C89 79 90 73 94 68 Z"
          fill="#861226"
        />
      </g>
    </svg>
  )
}

/**
 * 1:1 Authentic Active Circular Path Node with Peeking Chubby Clay Star Mascot
 * Faithfully recreated from lesson_reading_view.png ("Passion Limits Growth" node)
 */
export function WonderActivePeekingNode({ size = 56, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 56 56"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`inline-block select-none shrink-0 ${className}`}
    >
      <defs>
        {/* Soft cyan/sky ambient glow */}
        <filter id="activeGlow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="#60B5F5" floodOpacity="0.55" />
        </filter>

        {/* Circular clip path so peeking star stays neatly within the ring */}
        <clipPath id="circleClip">
          <circle cx="28" cy="28" r="25" />
        </clipPath>

        <linearGradient id="nodeBgGrad" x1="28" y1="3" x2="28" y2="53" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="100%" stopColor="#EDF7FE" />
        </linearGradient>
      </defs>

      {/* Outer Glowing Ring */}
      <circle
        cx="28"
        cy="28"
        r="25"
        fill="url(#nodeBgGrad)"
        stroke="#60B5F5"
        strokeWidth="3"
        filter="url(#activeGlow)"
      />

      {/* Peeking Mascot inside circle */}
      <g clipPath="url(#circleClip)">
        {/* Chubby Star Mascot Body Peeking Up from Bottom Edge */}
        <path
          d="M28 20
             C30.2 20 32 23.5 33.8 28
             C37.2 27 41.5 27.5 44 30.5
             C47 34 46.5 39 43.5 43
             C46 47 46 53 42 56
             L14 56
             C10 53 10 47 12.5 43
             C9.5 39 9 34 12 30.5
             C14.5 27.5 18.8 27 22.2 28
             C24 23.5 25.8 20 28 20 Z"
          fill="#261312"
        />

        {/* Two Curious Pure White Dot Eyes Gazing Up */}
        <circle cx="25.5" cy="30" r="1.8" fill="#FFFFFF" />
        <circle cx="30.5" cy="29.2" r="1.8" fill="#FFFFFF" />
      </g>
    </svg>
  )
}

export function WonderPathMascot({ size = 56, className = '' }: { size?: number; className?: string }) {
  return <WonderActivePeekingNode size={size} className={className} />
}

/**
 * 1:1 Authentic Wondering 3D Locked Node Disk
 * Faithfully recreated from lesson_reading_view.png
 */
export function WonderLockedDisk({ size = 52, className = '' }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 52 52"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`inline-block ${className}`}
    >
      <defs>
        {/* 3D Extruded Beige Cylinder Shading */}
        <linearGradient id="diskFaceGrad" x1="26" y1="4" x2="26" y2="48" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="40%" stopColor="#F5EFE6" />
          <stop offset="100%" stopColor="#E9DFD0" />
        </linearGradient>

        <filter id="diskShadow" x="-10%" y="-5%" width="120%" height="130%">
          <feDropShadow dx="0" dy="3" stdDeviation="1.5" floodColor="#C7BAA7" floodOpacity="0.8" />
        </filter>
      </defs>

      {/* 3D Drop Rim */}
      <circle cx="26" cy="27" r="22" fill="#D9CEBE" />

      {/* Main Top Face */}
      <circle
        cx="26"
        cy="25"
        r="22"
        fill="url(#diskFaceGrad)"
        stroke="#E2D7C7"
        strokeWidth="1.2"
        filter="url(#diskShadow)"
      />

      {/* Clean Padlock Icon Centered */}
      <g transform="translate(19, 17)" stroke="#A89F91" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        {/* Shackle */}
        <path d="M4 7V4.5C4 2.5 5.8 1 7 1C8.2 1 10 2.5 10 4.5V7" fill="none" />
        {/* Lock Body */}
        <rect x="2" y="7" width="10" height="8" rx="2" fill="#F1ECE4" />
        {/* Keyhole */}
        <circle cx="7" cy="10.5" r="1" fill="#A89F91" stroke="none" />
        <path d="M7 11.5V13" strokeWidth="1.2" />
      </g>
    </svg>
  )
}

/**
 * 1:1 Authentic Wondering Bottom-Right Floating Mascot Star/Pebble
 * Faithfully recreated from live_auth_dashboard.png
 */
export function WonderFloatingMascot({ size = 28, className = '', onClick }: IconProps & { onClick?: () => void }) {
  const content = (
    <img
      src="/star.svg"
      alt="Wondering Mascot"
      style={{ width: size, height: size }}
      className="shrink-0 select-none pointer-events-none"
    />
  )

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`size-11 rounded-full bg-[#FFFDF8] dark:bg-[#1E1512] border border-stone-300/80 dark:border-stone-700 shadow-md hover:shadow-lg active:scale-95 flex items-center justify-center transition-all cursor-pointer ${className}`}
        aria-label="Wondering Mascot"
      >
        {content}
      </button>
    )
  }

  return (
    <div
      className={`size-8 rounded-full bg-[#FFFDF8] dark:bg-[#1E1512] border border-stone-200 dark:border-stone-700 shadow-2xs flex items-center justify-center ${className}`}
    >
      {content}
    </div>
  )
}

/**
 * 1:1 Authentic Wondering 3D Isometric Artwork: Learning How to Learn
 * Faithfully recreated from course_overview_desktop.png and lesson_reading_view.png
 */
export function WonderIsometricArtwork({ size = 48, className = '' }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`inline-block rounded-xl overflow-hidden ${className}`}
    >
      <defs>
        {/* Mint Platform Base */}
        <linearGradient id="mintBase" x1="0" y1="0" x2="100" y2="100" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#A2D7CE" />
          <stop offset="100%" stopColor="#89C7BC" />
        </linearGradient>

        {/* Cosmic Sphere Gradient */}
        <radialGradient id="sphereGrad" cx="40%" cy="35%" r="65%">
          <stop offset="0%" stopColor="#3B82F6" />
          <stop offset="60%" stopColor="#1D4ED8" />
          <stop offset="100%" stopColor="#0F172A" />
        </radialGradient>

        {/* Inner Geodesic Core Glow */}
        <radialGradient id="innerGridGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#93C5FD" />
          <stop offset="80%" stopColor="#1E3A8A" />
          <stop offset="100%" stopColor="#0B1536" />
        </radialGradient>

        {/* Turquoise Cube Gradients */}
        <linearGradient id="cubeTop" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#67E8F9" />
          <stop offset="100%" stopColor="#22D3EE" />
        </linearGradient>
        <linearGradient id="cubeLeft" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#0891B2" />
          <stop offset="100%" stopColor="#0E7490" />
        </linearGradient>

        {/* Lavender Arch Gradient */}
        <linearGradient id="archGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#E9D5FF" />
          <stop offset="50%" stopColor="#C084FC" />
          <stop offset="100%" stopColor="#9333EA" />
        </linearGradient>
      </defs>

      {/* Base Background Rounded Tile */}
      <rect width="100" height="100" rx="20" fill="url(#mintBase)" />

      {/* Shadow under 3D elements */}
      <ellipse cx="50" cy="72" rx="38" ry="14" fill="#67AFA2" opacity="0.4" />

      {/* 1. Large Cutaway Sphere (Center-Top) */}
      <g transform="translate(18, 10)">
        {/* Back Hemisphere / Sphere */}
        <circle cx="32" cy="32" r="28" fill="url(#sphereGrad)" />

        {/* Cutaway Core (Left front hemisphere) */}
        <path
          d="M32 4
             A28 28 0 0 0 32 60
             A18 28 0 0 0 32 4 Z"
          fill="url(#innerGridGlow)"
        />

        {/* Inner Geodesic Grid Lines */}
        <path
          d="M16 20 L32 32 M12 32 L32 32 M16 44 L32 32 M24 10 L32 32 M24 54 L32 32"
          stroke="#93C5FD"
          strokeWidth="1"
          opacity="0.8"
        />
        <circle cx="22" cy="32" r="10" stroke="#60A5FA" strokeWidth="0.8" fill="none" opacity="0.7" />

        {/* Luminous Inner Core Dot */}
        <circle cx="30" cy="32" r="4" fill="#FFFFFF" opacity="0.9" />
      </g>

      {/* 2. Coiled Spring on Turquoise Cube (Lower Left) */}
      <g transform="translate(14, 48)">
        {/* Isometric Cube Base */}
        {/* Top Face */}
        <polygon points="16,14 26,9 16,4 6,9" fill="url(#cubeTop)" />
        {/* Left Face */}
        <polygon points="6,9 16,14 16,24 6,19" fill="url(#cubeLeft)" />
        {/* Right Face */}
        <polygon points="16,14 26,9 26,19 16,24" fill="#065F46" opacity="0.3" />

        {/* Coiled 3D Helix Spring standing on cube */}
        <path
          d="M16 6
             C8 4 6 -2 12 -5
             C18 -8 24 -4 18 0
             C12 4 4 -2 10 -8
             C16 -14 22 -10 16 -6"
          stroke="#38BDF8"
          strokeWidth="3.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </g>

      {/* 3. Lavender Triple Archway (Lower Right) */}
      <g transform="translate(56, 42)">
        {/* Outer Arch */}
        <path
          d="M4 36 V18 C4 8 26 8 26 18 V36 M10 36 V20 C10 14 20 14 20 20 V36"
          fill="url(#archGrad)"
          stroke="#7E22CE"
          strokeWidth="0.8"
        />
        {/* Isometric Thickness Side */}
        <path
          d="M26 18 V36 L29 33 V16 C29 7 8 7 8 16 L5 18"
          fill="#6B21A8"
          opacity="0.5"
        />
      </g>
    </svg>
  )
}

/**
 * 1:1 Wondering Sidebar Icons
 */
export function WonderHomeIcon({ size = 20, className = '' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M12 2.7L2.8 10.3C2.3 10.7 2 11.3 2 12V20C2 21.1 2.9 22 4 22H9C9.6 22 10 21.6 10 21V15H14V21C14 21.6 14.4 22 15 22H20C21.1 22 22 21.1 22 20V12C22 11.3 21.7 10.7 21.2 10.3L12 2.7Z" />
    </svg>
  )
}

export function WonderCreateIcon({ size = 20, className = '' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      {/* Primary 4-pointed sparkle */}
      <path
        d="M10 2C10 6.4 6.4 10 2 10C6.4 10 10 13.6 10 18C10 13.6 13.6 10 18 10C13.6 10 10 6.4 10 2Z"
        fill="currentColor"
      />
      {/* Secondary mini sparkle */}
      <path
        d="M18 14C18 16 16.5 17.5 14.5 17.5C16.5 17.5 18 19 18 21C18 19 19.5 17.5 21.5 17.5C19.5 17.5 18 16 18 14Z"
        fill="currentColor"
      />
    </svg>
  )
}

export function WonderCanvasIcon({ size = 20, className = '' }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {/* Left Hemisphere */}
      <path d="M12 5C10 3 6 3 4 6C2 9 3 13 4 15C5 17 6 18 8 18C9 18 10 17.5 12 16" />
      <path d="M8 8C7 10 7 12 8 14" />
      {/* Right Hemisphere */}
      <path d="M12 5C14 3 18 3 20 6C22 9 21 13 20 15C19 17 18 18 16 18C15 18 14 17.5 12 16" />
      <path d="M16 8C17 10 17 12 16 14" />
      {/* Central Connector */}
      <path d="M12 5V19" />
    </svg>
  )
}

export function WonderCoursesIcon({ size = 20, className = '' }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      className={className}
    >
      {/* Three staggered vertical book/bars */}
      <path d="M5 19V7" />
      <path d="M11 19V4" />
      <path d="M17 19L19 9" />
    </svg>
  )
}

export function WonderProfileIcon({ size = 20, className = '' }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <circle cx="12" cy="7" r="4" />
      <path d="M5 21C5 17.1 8.1 14 12 14C15.9 14 19 17.1 19 21" />
    </svg>
  )
}

export function WonderSidebarToggleIcon({ size = 18, className = '' }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <rect x="3" y="4" width="18" height="16" rx="4" />
      <path d="M9 4V20" />
    </svg>
  )
}

/**
 * 1:1 Wondering TopBar Action Bar Icons
 */
export function WonderLearningMapIcon({ size = 16, className = '' }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M2 5C5 3 9 3 12 5C15 3 19 3 22 5V19C19 17 15 17 12 19C9 17 5 17 2 19V5Z" />
      <path d="M12 5V19" />
    </svg>
  )
}

export function WonderSourcesIcon({ size = 16, className = '' }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      className={className}
    >
      <path d="M6 19V5" />
      <path d="M12 19V5" />
      <path d="M18 19L20 7" />
    </svg>
  )
}

export function WonderPodcastIcon({ size = 16, className = '' }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M3 14C3 9 7 5 12 5C17 5 21 9 21 14" />
      <rect x="2" y="14" width="4" height="7" rx="2" />
      <rect x="18" y="14" width="4" height="7" rx="2" />
    </svg>
  )
}

export function WonderQuickExerciseIcon({ size = 16, className = '' }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M13 2L4 14H11L10 22L20 9H13L13 2Z" />
    </svg>
  )
}

export function WonderViewSavedIcon({ size = 16, className = '' }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <rect x="6" y="3" width="14" height="18" rx="2" />
      <path d="M10 8H16" />
      <path d="M10 12H16" />
      <path d="M10 16H14" />
      {/* Spiral wire rings */}
      <circle cx="4" cy="6" r="1.5" />
      <circle cx="4" cy="11" r="1.5" />
      <circle cx="4" cy="16" r="1.5" />
    </svg>
  )
}

/**
 * 1:1 Table Icons (Pro sky-blue check & Free X circle)
 */
export function WonderProCheckmark({ size = 18, className = '' }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      stroke="#38BDF8"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M4 10.5L8 14.5L16 5.5" />
    </svg>
  )
}

export function WonderFreeXCircle({ size = 18, className = '' }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      stroke="#A8A29E"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <circle cx="10" cy="10" r="7.5" strokeWidth="1.4" />
      <path d="M7.5 7.5L12.5 12.5" />
      <path d="M12.5 7.5L7.5 12.5" />
    </svg>
  )
}

export function WonderFreeCheckmark({ size = 18, className = '' }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      stroke="#78716C"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M4 10.5L8 14.5L16 5.5" />
    </svg>
  )
}

/**
 * 1:1 Authentic Wondering 3D Course Overview Hero Banner
 * Faithfully recreated from course_overview_desktop.png
 */
export function WonderCourseHeroBanner({ className = '' }: { className?: string }) {
  return (
    <div className={`w-full relative overflow-hidden rounded-3xl select-none ${className}`}>
      <svg
        viewBox="0 0 760 300"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-auto block"
      >
        <defs>
          {/* Mint Hero Background */}
          <linearGradient id="heroMintBase" x1="0" y1="0" x2="760" y2="300" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#AEE2D8" />
            <stop offset="50%" stopColor="#9BD5C9" />
            <stop offset="100%" stopColor="#8ACABC" />
          </linearGradient>

          {/* Cosmic Galaxy Sphere */}
          <radialGradient id="heroSphereGrad" cx="42%" cy="38%" r="62%">
            <stop offset="0%" stopColor="#3B82F6" />
            <stop offset="45%" stopColor="#1D4ED8" />
            <stop offset="85%" stopColor="#172554" />
            <stop offset="100%" stopColor="#0B1329" />
          </radialGradient>

          {/* Inner Geodesic Glow */}
          <radialGradient id="heroCoreGlow" cx="45%" cy="50%" r="55%">
            <stop offset="0%" stopColor="#BAE6FD" />
            <stop offset="50%" stopColor="#38BDF8" />
            <stop offset="85%" stopColor="#1E3A8A" />
            <stop offset="100%" stopColor="#081438" />
          </radialGradient>

          {/* Turquoise Cube Gradients */}
          <linearGradient id="heroCubeTop" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#67E8F9" />
            <stop offset="100%" stopColor="#22D3EE" />
          </linearGradient>
          <linearGradient id="heroCubeLeft" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#0891B2" />
            <stop offset="100%" stopColor="#0E7490" />
          </linearGradient>

          {/* Lavender Triple Arch */}
          <linearGradient id="heroArchFace" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#F3E8FF" />
            <stop offset="50%" stopColor="#D8B4FE" />
            <stop offset="100%" stopColor="#C084FC" />
          </linearGradient>
          <linearGradient id="heroArchSide" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#A855F7" />
            <stop offset="100%" stopColor="#7E22CE" />
          </linearGradient>
        </defs>

        {/* Outer Mint Pedestal */}
        <rect width="760" height="300" rx="28" fill="url(#heroMintBase)" />

        {/* Global Ambient Floor Shadows */}
        <ellipse cx="380" cy="238" rx="270" ry="42" fill="#66B3A4" opacity="0.45" />

        {/* 1. Coiled Spring on Turquoise Cube (Left) */}
        <g transform="translate(200, 140)">
          {/* Shadow under cube */}
          <ellipse cx="40" cy="98" rx="35" ry="12" fill="#589F91" opacity="0.5" />

          {/* Cube */}
          <polygon points="40,65 72,48 40,32 8,48" fill="url(#heroCubeTop)" />
          <polygon points="8,48 40,65 40,96 8,78" fill="url(#heroCubeLeft)" />
          <polygon points="40,65 72,48 72,78 40,96" fill="#0E7490" opacity="0.65" />

          {/* Spring Coils bouncing up */}
          <path
            d="M40,36
               C20,32 14,18 28,12
               C44,6 56,16 42,26
               C26,34 10,20 24,10
               C38,2 52,12 36,20
               C20,28 6,14 20,4
               C34,-8 48,2 34,10
               C20,18 4,2 18,-6
               C32,-16 46,-6 32,2
               C18,10 2,-4 16,-14
               C30,-24 44,-14 30,-6"
            stroke="#38BDF8"
            strokeWidth="5"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </g>

        {/* 2. Central Cutaway Cosmic Sphere */}
        <g transform="translate(365, 125)">
          {/* Sphere Floor Shadow */}
          <ellipse cx="0" cy="108" rx="72" ry="22" fill="#539688" opacity="0.5" />

          {/* Solid Sphere Background */}
          <circle cx="0" cy="0" r="76" fill="url(#heroSphereGrad)" />

          {/* Left Hemisphere Cutaway Core */}
          <path
            d="M0 -76
               A76 76 0 0 0 0 76
               A46 76 0 0 0 0 -76 Z"
            fill="url(#heroCoreGlow)"
          />

          {/* Cutaway Rim Highlight */}
          <path
            d="M0 -76 A46 76 0 0 1 0 76"
            stroke="#93C5FD"
            strokeWidth="2.5"
            strokeLinecap="round"
            fill="none"
            opacity="0.9"
          />

          {/* Geodesic Wireframe Lattice Structure inside */}
          <path
            d="M-40 -40 L0 0 M-60 -10 L0 0 M-65 15 L0 0 M-45 42 L0 0 M-20 62 L0 0 M-10 -65 L0 0"
            stroke="#BAE6FD"
            strokeWidth="1.6"
            opacity="0.8"
          />
          <ellipse cx="-25" cy="0" rx="35" ry="55" stroke="#93C5FD" strokeWidth="1.4" fill="none" opacity="0.75" />
          <ellipse cx="-15" cy="0" rx="18" ry="32" stroke="#60A5FA" strokeWidth="1.2" fill="none" opacity="0.85" />

          {/* Core Singularity Luminous Dot */}
          <circle cx="-5" cy="0" r="8" fill="#FFFFFF" opacity="0.95" />
          <circle cx="-5" cy="0" r="16" fill="#BAE6FD" opacity="0.35" />
        </g>

        {/* 3. Lavender Triple Arch Structure (Right) */}
        <g transform="translate(490, 130)">
          {/* Floor Shadow */}
          <ellipse cx="45" cy="105" rx="55" ry="16" fill="#56998C" opacity="0.5" />

          {/* Back Arch Column */}
          <path
            d="M50 92 V45 C50 24 85 24 85 45 V92 M62 92 V48 C62 36 73 36 73 48 V92"
            fill="url(#heroArchFace)"
            stroke="#9333EA"
            strokeWidth="1"
          />

          {/* Main Front Archways */}
          <path
            d="M10 98 V35 C10 10 55 10 55 35 V98 M24 98 V38 C24 24 41 24 41 38 V98"
            fill="url(#heroArchFace)"
            stroke="#7E22CE"
            strokeWidth="1.2"
          />

          {/* 3D Extrusion Side Panels */}
          <path
            d="M55 35 V98 L64 90 V30 C64 12 18 12 18 28 L10 35"
            fill="url(#heroArchSide)"
            opacity="0.85"
          />
        </g>
      </svg>
    </div>
  )
}

/**
 * 1:1 Authentic Wondering Discord Icon
 * Faithfully recreated from auth_profile.png
 */
export function WonderDiscordIcon({ size = 18, className = '' }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      className={`inline-block ${className}`}
    >
      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.929 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.894.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
    </svg>
  )
}

/**
 * 1:1 Authentic Wondering Running Blue Blob Mascot
 * Faithfully recreated from course_path_view.png
 */
export function WonderLoadingBlob({ size = 80, className = '' }: IconProps) {
  return (
    <div className={`inline-flex flex-col items-center justify-center select-none ${className}`}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 100 110"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="animate-bounce"
        style={{ animationDuration: '0.8s' }}
      >
        <defs>
          <radialGradient id="loadingBlobGrad" cx="45%" cy="40%" r="60%">
            <stop offset="0%" stopColor="#80DAFA" />
            <stop offset="70%" stopColor="#67CEF7" />
            <stop offset="100%" stopColor="#4ABEEF" />
          </radialGradient>
        </defs>

        {/* Soft Ground Shadow */}
        <ellipse cx="50" cy="102" rx="20" ry="3.5" fill="#DDD6C9" opacity="0.85" />

        {/* Running Back Foot */}
        <ellipse
          cx="38"
          cy="80"
          rx="5"
          ry="7.5"
          fill="#1C7EC5"
          transform="rotate(-35 38 80)"
        />

        {/* Running Front Foot */}
        <ellipse
          cx="58"
          cy="81"
          rx="5"
          ry="7.5"
          fill="#1C7EC5"
          transform="rotate(30 58 81)"
        />

        {/* Chubby Droplet Body (slight forward tilt) */}
        <ellipse
          cx="50"
          cy="52"
          rx="27"
          ry="28"
          fill="url(#loadingBlobGrad)"
        />

        {/* Left Big Cartoon Eye */}
        <ellipse cx="56" cy="46" rx="5" ry="6.5" fill="#FFFFFF" />
        <ellipse cx="58.2" cy="44.5" rx="3" ry="4" fill="#1C1819" />
        <circle cx="59.2" cy="43.2" r="1.1" fill="#FFFFFF" />

        {/* Right Big Cartoon Eye */}
        <ellipse cx="69" cy="46" rx="4.8" ry="6.5" fill="#FFFFFF" />
        <ellipse cx="71.2" cy="44.5" rx="3" ry="4" fill="#1C1819" />
        <circle cx="72.2" cy="43.2" r="1.1" fill="#FFFFFF" />

        {/* Cute Smile Curve */}
        <path
          d="M71 54.5 C73 57 75.5 56 76.5 53.5"
          stroke="#1C1819"
          strokeWidth="1.6"
          strokeLinecap="round"
          fill="none"
        />
      </svg>
    </div>
  )
}

/**
 * 1:1 Authentic Wondering Section Notebook Icon
 * Faithfully recreated from lesson_reading_view.png & bottom_right_corner.png
 */
export function WonderSectionNotebookIcon({ size = 20, className = '' }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`inline-block ${className}`}
    >
      {/* Notebook Outline Body */}
      <rect x="5" y="2" width="15" height="20" rx="2" fill="none" />
      {/* Vertical Spine Divider */}
      <line x1="9" y1="2" x2="9" y2="22" />
      {/* Spiral Wire Notches on left */}
      <line x1="3" y1="6" x2="6" y2="6" strokeWidth="2" />
      <line x1="3" y1="10" x2="6" y2="10" strokeWidth="2" />
      <line x1="3" y1="14" x2="6" y2="14" strokeWidth="2" />
      <line x1="3" y1="18" x2="6" y2="18" strokeWidth="2" />
      {/* Right Content Marks */}
      <line x1="12" y1="7" x2="16" y2="7" opacity="0.6" />
      <line x1="12" y1="11" x2="15" y2="11" opacity="0.6" />
    </svg>
  )
}

/**
 * 1:1 Authentic Wondering Right Edge Drawer Peek Tab
 * Faithfully recreated from lesson_reading_view.png (bottom_right_corner.png)
 */
export function WonderDrawerPeekTab({ onClick, className = '' }: { onClick?: () => void; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`fixed right-0 bottom-[calc(6rem+var(--safe-bottom,0px))] z-30 flex flex-col items-center gap-1.5 pl-3 pr-2 py-3 rounded-l-2xl border border-r-0 border-stone-300/80 dark:border-stone-700/80 bg-white/75 dark:bg-[#1E1512]/75 backdrop-blur-xs shadow-xs hover:bg-white dark:hover:bg-[#1E1512] transition-all cursor-pointer ${className}`}
      title="View notes & saved concepts"
      aria-label="View notes & saved concepts"
    >
      {/* Pale Green/Grey Checkmark */}
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className="text-emerald-600/80 dark:text-emerald-400/80">
        <path d="M3 8.5 L6.5 12 L13 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {/* Subtle Mini Note Lines */}
      <div className="w-3.5 h-0.5 rounded-full bg-stone-300 dark:bg-stone-600" />
      <div className="w-2.5 h-0.5 rounded-full bg-stone-200 dark:bg-stone-700" />
    </button>
  )
}

