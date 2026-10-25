import { useId } from 'react'
import './learning-path.css'

export type PathMascotAnimation =
  | 'idle'
  | 'wave'
  | 'happy'
  | 'oops'
  | 'thinking'
  | 'celebrate'
  | 'level_up'
  | 'sleep'

export type PathMascotVariant = 'tile' | 'avatar'

export function PathMascot({
  animation = 'idle',
  variant = 'tile',
}: {
  animation?: PathMascotAnimation
  variant?: PathMascotVariant
} = {}) {
  return (
    <span className="learning-mascot" data-variant={variant} data-animation={animation} aria-hidden="true">
      <img
        className="learning-mascot-img"
        src="/images/kivvi-mascot-cutout.webp"
        alt=""
        draggable={false}
        loading="eager"
        decoding="async"
      />
    </span>
  )
}

export default function LessonToken({
  done,
  current,
  check = false,
  locked = false,
  read = false,
  stepNumber,
}: {
  done: boolean
  current: boolean
  check?: boolean
  locked?: boolean
  read?: boolean
  stepNumber?: number
}) {
  const id = useId()
  const octagon = '38,52 82,52 113,70 113,98 82,116 38,116 7,98 7,70'
  const state = locked ? 'locked' : current ? 'current' : done ? 'done' : read ? 'read' : 'unread'

  return (
    <span className="learning-tile" data-state={state} data-check={check}>
      <svg aria-hidden="true" viewBox="0 0 120 130" width="120" height="130">
        <defs>
          <linearGradient id={id + '-rim'} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--tile-light)" />
            <stop offset="100%" stopColor="var(--tile-color)" />
          </linearGradient>
          <linearGradient id={id + '-cap'} x1="0.2" y1="0" x2="0.8" y2="1">
            <stop offset="0%" stopColor="var(--tile-cap-top)" />
            <stop offset="100%" stopColor="var(--tile-color)" />
          </linearGradient>
          <radialGradient id={id + '-core'} cx="50%" cy="48%" r="52%">
            <stop offset="0%" stopColor="#e0f2fe" stopOpacity="0.95" />
            <stop offset="55%" stopColor="#38bdf8" stopOpacity="0.55" />
            <stop offset="100%" stopColor="var(--tile-color)" stopOpacity="0" />
          </radialGradient>
          <linearGradient id={id + '-beam'} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#38bdf8" stopOpacity="0" />
            <stop offset="65%" stopColor="#38bdf8" stopOpacity="0.16" />
            <stop offset="100%" stopColor="#bae6fd" stopOpacity="0.42" />
          </linearGradient>
        </defs>

        {/* Ground Ambient Shadow */}
        <ellipse cx="60" cy="114" rx="46" ry="14" fill="var(--tile-edge)" opacity="0.24" />

        {check ? (
          <>
            {/* 3D Octagon Boss / Milestone Pedestal */}
            <polygon points={octagon} fill="none" stroke="var(--p-primary)" strokeWidth="2" opacity="0.16" />
            {/* Extruded 3D Side Wall (14px deep) */}
            <polygon points="39,58 81,58 106,73 106,101 81,115 39,115 14,101 14,73" fill="var(--tile-side)" />
            {/* Outer Bevel Top */}
            <polygon points="39,48 81,48 106,63 106,89 81,103 39,103 14,89 14,63" fill={`url(#${id}-rim)`} />
            {/* Inner Raised Cap */}
            <polygon
              points="43,54 77,54 96,65 96,83 77,94 43,94 24,83 24,65"
              fill={`url(#${id}-cap)`}
              stroke="var(--tile-light)"
              strokeWidth="2"
            />
          </>
        ) : (
          <>
            {/* Extruded 3D Cylinder Base Wall (14px deep tactile lip) */}
            <path d="M16 79v13a44 21 0 0 0 88 0V79Z" fill="var(--tile-side)" />
            {/* Outer Rim Surface */}
            <ellipse cx="60" cy="79" rx="44" ry="21" fill={`url(#${id}-rim)`} />
            {/* Inner Raised Tactile Button CapSide */}
            <path d="M27 77v4a33 15.5 0 0 0 66 0v-4Z" fill="var(--tile-side)" opacity="0.55" />
            {/* Inner Raised Tactile Button Cap */}
            <ellipse
              cx="60"
              cy="76"
              rx="33"
              ry="15.5"
              fill={`url(#${id}-cap)`}
              stroke="var(--tile-light)"
              strokeWidth="2.2"
            />
          </>
        )}

        {/* Active Hologram Portal & Energy Core under Blue Mascot */}
        {current && (
          <>
            <path className="learning-beam" d="M28 24h64l7 54a35 16 0 0 1-78 0Z" fill={`url(#${id}-beam)`} />
            <ellipse cx="60" cy="76" rx="28" ry="13" fill={`url(#${id}-core)`} />
            <ellipse
              cx="60"
              cy="76"
              rx="20"
              ry="9"
              fill="none"
              stroke="#e0f2fe"
              strokeWidth="1.75"
              strokeDasharray="6 4"
              opacity="0.85"
            />
          </>
        )}

        {/* Perspective Surface Emblem (only when mascot is not standing on the node) */}
        {!current && (
          <g transform={check ? 'translate(60, 74) scale(1, 0.56)' : 'translate(60, 76) scale(1, 0.54)'}>
            {done ? (
              <path
                d="M-11 0 L-3 8 L12 -7"
                fill="none"
                stroke="#ffffff"
                strokeWidth="5.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ) : check ? (
              <polygon
                points="0,-14 4,-4 15,-4 6,3 9,13 0,7 -9,13 -6,3 -15,-4 -4,-4"
                fill="#ffffff"
                opacity={locked ? '0.55' : '0.92'}
              />
            ) : (
              <circle
                cx="0"
                cy="0"
                r="6"
                fill="#ffffff"
                opacity={locked ? '0.35' : read ? '0.9' : '0.6'}
              />
            )}
          </g>
        )}

        {/* Selection Orbit Ring */}
        {check ? (
          <polygon
            className="learning-orbit"
            points={octagon}
            pathLength="100"
            fill="none"
            stroke="var(--p-primary)"
            strokeWidth="3"
            strokeLinecap="round"
          />
        ) : (
          <ellipse
            className="learning-orbit"
            cx="60"
            cy="84"
            rx="54"
            ry="29"
            pathLength="100"
            fill="none"
            stroke="var(--p-primary)"
            strokeWidth="3"
            strokeLinecap="round"
          />
        )}
      </svg>

      {current && <PathMascot />}
      {!current && !done && !check && stepNumber != null && (
        <span className="learning-tile-number" aria-hidden="true">
          {stepNumber}
        </span>
      )}
    </span>
  )
}
