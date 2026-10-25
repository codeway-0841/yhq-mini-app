import * as React from 'react'
import { cn } from '@/shared/lib/cn'

export type ConfirmMascotEmotion = 'question' | 'warning' | 'danger'

export interface ConfirmMascotProps {
  /** Maskot holati — savol (?), ogohlantirish yoki xavfli amal */
  emotion?: ConfirmMascotEmotion
  className?: string
}

type Phase = 'look-left' | 'blink' | 'center' | 'symbol' | 'idle'

/**
 * 19×19 LED matritsa (koordinatalar -9..+9):
 * Videodagi kabi qalin 2-3 qatorli piksel halqa (ring) va o'rtasida qalin
 * piksel "?" yoki "!" belgisi.
 */
const RING_COORDS: ReadonlyArray<readonly [number, number]> = (() => {
  const pts: Array<readonly [number, number]> = []
  for (let y = -9; y <= 9; y++) {
    for (let x = -9; x <= 9; x++) {
      const dist = Math.hypot(x, y)
      if (dist >= 6.8 && dist <= 9.15) {
        pts.push([x, y] as const)
      }
    }
  }
  return pts
})()

const QUESTION_COORDS: ReadonlyArray<readonly [number, number]> = [
  // Tepa yoy
  [-1, -5], [0, -5], [1, -5],
  [-2, -4], [-1, -4], [0, -4], [1, -4], [2, -4],
  [-3, -3], [-2, -3], [1, -3], [2, -3], [3, -3],
  [-3, -2], [-2, -2], [1, -2], [2, -2], [3, -2],
  // O'ngdan o'rtaga burilish
  [1, -1], [2, -1],
  [0, 0], [1, 0],
  [-1, 1], [0, 1], [1, 1],
  [-1, 2], [0, 2],
  // Pastki nuqta (3×2 + markaz)
  [0, 4],
  [-1, 5], [0, 5], [1, 5],
  [0, 6],
]

const EXCLAMATION_COORDS: ReadonlyArray<readonly [number, number]> = [
  // Ustun
  [-1, -5], [0, -5], [1, -5],
  [-1, -4], [0, -4], [1, -4],
  [-1, -3], [0, -3], [1, -3],
  [-1, -2], [0, -2], [1, -2],
  [-1, -1], [0, -1], [1, -1],
  [0, 0],
  [0, 1],
  // Pastki nuqta
  [0, 4],
  [-1, 5], [0, 5], [1, 5],
  [0, 6],
]

/**
 * 7×10 LED ko'z piksellari (burchaklari kesilgan silliq to'rtburchak)
 * va siqilgan (squint: 8×4) holati.
 */
function buildEyePixels(squint: boolean): ReadonlyArray<readonly [number, number]> {
  const pts: Array<readonly [number, number]> = []
  if (squint) {
    // Gorizontal qisilgan ko'z: 8 ustun (-3.5..3.5), 4 qator (-1.5..1.5)
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 8; c++) {
        if ((r === 0 || r === 3) && (c === 0 || c === 7)) continue
        pts.push([c - 3.5, r - 1.5] as const)
      }
    }
  } else {
    // Tik to'liq ko'z: 7 ustun (-3..3), 9 qator (-4..4)
    for (let r = -4; r <= 4; r++) {
      for (let c = -3; c <= 3; c++) {
        if (Math.abs(r) === 4 && Math.abs(c) === 3) continue
        pts.push([c, r] as const)
      }
    }
  }
  return pts
}

const FULL_EYE_PIXELS = buildEyePixels(false)
const SQUINT_EYE_PIXELS = buildEyePixels(true)

/**
 * ConfirmMascot — videodagi 1:1 3D matte-binafsha robot-maskot va
 * LED piksel-matritsa animatsiyasi.
 *
 * Sikl:
 *  1. `look-left`: bosh chapga egiladi, chap ko'z to'liq (7×9), o'ng ko'z qisilgan (8×4)
 *  2. `blink`: bosh o'ngga o'tadi, chap ko'z qisiladi (8×4), o'ng ko'z to'liq ochiladi (7×9)
 *  3. `center`: bosh markazga qaytadi, ikkala ko'z ham to'liq (7×9)
 *  4. `symbol`: LED ekranda qalin piksel-halqa ichida `?` (yoki `!`) belgisi porlab chiqadi
 *  5. `idle`: qisqa o'tish va siklni qayta boshlash
 */
export function ConfirmMascot({
  emotion = 'question',
  className,
}: ConfirmMascotProps) {
  const [phase, setPhase] = React.useState<Phase>('look-left')

  React.useEffect(() => {
    if (
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      setPhase('symbol')
      return
    }

    let mounted = true
    const timers: number[] = []

    const schedule = () => {
      if (!mounted) return
      setPhase('look-left')
      timers.push(window.setTimeout(() => mounted && setPhase('blink'), 900))
      timers.push(window.setTimeout(() => mounted && setPhase('center'), 1750))
      timers.push(window.setTimeout(() => mounted && setPhase('symbol'), 2500))
      timers.push(window.setTimeout(() => mounted && setPhase('idle'), 5200))
      timers.push(window.setTimeout(() => mounted && schedule(), 6200))
    }

    schedule()
    return () => {
      mounted = false
      timers.forEach((id) => window.clearTimeout(id))
    }
  }, [])

  const isDanger = emotion === 'danger'
  const ledMain = isDanger ? '#ff3ca8' : '#e040fb'
  const ledBright = isDanger ? '#ff94d1' : '#f39bff'
  const symbolCoords = emotion === 'question' ? QUESTION_COORDS : EXCLAMATION_COORDS

  // Bosh va tana siljishi — yaxlit silikon/vinil korpus egilishi
  const bodyTransform =
    phase === 'look-left'
      ? 'translate(-8px, 2px) rotate(-3.5deg)'
      : phase === 'blink'
        ? 'translate(7px, 2px) rotate(3deg)'
        : phase === 'symbol'
          ? 'translate(0px, -2px) rotate(0deg)'
          : 'translate(0px, 0px) rotate(0deg)'

  const visorShiftX =
    phase === 'look-left' ? -18 : phase === 'blink' ? 15 : 0

  const leftEyePixels = phase === 'blink' ? SQUINT_EYE_PIXELS : FULL_EYE_PIXELS
  const rightEyePixels = phase === 'look-left' ? SQUINT_EYE_PIXELS : FULL_EYE_PIXELS

  const showSymbol = phase === 'symbol'
  const showEyes = phase === 'look-left' || phase === 'blink' || phase === 'center' || phase === 'idle'

  return (
    <div
      data-testid="confirm-mascot"
      data-emotion={emotion}
      data-phase={phase}
      aria-hidden="true"
      className={cn(
        'relative mx-auto flex w-full select-none items-end justify-center overflow-visible',
        className,
      )}
    >
      <svg
        viewBox="0 0 420 390"
        className="block h-auto w-full max-w-[440px] overflow-visible"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* 3D Soft-Touch Vinyl Purple tana — asosiy bazaviy sirt */}
          <radialGradient id="cmBodyBase" cx="55%" cy="18%" r="78%" fx="62%" fy="12%">
            <stop offset="0%" stopColor="#ef8cff" />
            <stop offset="28%" stopColor="#c44dff" />
            <stop offset="62%" stopColor="#8e24eb" />
            <stop offset="88%" stopColor="#560bad" />
            <stop offset="100%" stopColor="#2e0463" />
          </radialGradient>

          {/* Bosh tepa-o'ng 3D studio key-light yorug'ligi */}
          <radialGradient id="cmHeadKeyLight" cx="64%" cy="18%" r="54%">
            <stop offset="0%" stopColor="#ffb8ff" stopOpacity="0.92" />
            <stop offset="40%" stopColor="#d96bff" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#9d2df2" stopOpacity="0" />
          </radialGradient>

          {/* Bo'yin va iyak osti ambient occlusion (yumshoq chuqur soya) */}
          <radialGradient id="cmChinShadow" cx="50%" cy="48%" r="50%">
            <stop offset="0%" stopColor="#1b023b" stopOpacity="0.68" />
            <stop offset="60%" stopColor="#310669" stopOpacity="0.28" />
            <stop offset="100%" stopColor="#310669" stopOpacity="0" />
          </radialGradient>

          {/* Visor chuqurchasi (bezel rim) — pastki cheti yorqin binafsha */}
          <linearGradient id="cmVisorRim" x1="210" y1="68" x2="210" y2="236" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#2a0554" />
            <stop offset="55%" stopColor="#6c1bc2" />
            <stop offset="100%" stopColor="#e580ff" />
          </linearGradient>

          {/* Chuqur qora OLED ekran */}
          <radialGradient id="cmVisorScreen" cx="50%" cy="45%" r="65%">
            <stop offset="0%" stopColor="#07030d" />
            <stop offset="75%" stopColor="#030106" />
            <stop offset="100%" stopColor="#000000" />
          </radialGradient>

          {/* LED ekran ichki pushti-binafsha nuri */}
          <radialGradient id="cmLedAmbient" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={ledMain} stopOpacity="0.26" />
            <stop offset="65%" stopColor={ledMain} stopOpacity="0.07" />
            <stop offset="100%" stopColor={ledMain} stopOpacity="0" />
          </radialGradient>

          {/* LED piksellar uchun yumshoq neon bloom */}
          <filter id="cmLedBloom" x="-35%" y="-35%" width="170%" height="170%">
            <feGaussianBlur stdDeviation="1.8" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Orqa binafsha atmosfera nuri */}
        <ellipse
          cx="210"
          cy="175"
          rx="185"
          ry="135"
          fill="url(#cmLedAmbient)"
        />

        {/* Yaxlit 3D Bosh + Bo'yin + Yelkalar + Visor (bitta choksiz monoblok korpus) */}
        <g
          style={{
            transform: bodyTransform,
            transformOrigin: '210px 300px',
            transition: 'transform 520ms cubic-bezier(0.22, 1, 0.36, 1)',
          }}
        >
          {/* Choksiz 3D Vinyl Siluet: gumbaz tepa -> silliq iyak -> keng yelkalar va tana */}
          <path
            d="M -18 390
               C -18 308, 36 266, 68 228
               C 80 212, 82 188, 82 148
               C 82 60, 134 16, 210 16
               C 286 16, 338 60, 338 148
               C 338 188, 340 212, 352 228
               C 384 266, 438 308, 438 390
               Z"
            fill="url(#cmBodyBase)"
          />

          {/* Bosh tepa-o'ng 3D studio key-light yaltirashi */}
          <path
            d="M -18 390
               C -18 308, 36 266, 68 228
               C 80 212, 82 188, 82 148
               C 82 60, 134 16, 210 16
               C 286 16, 338 60, 338 148
               C 338 188, 340 212, 352 228
               C 384 266, 438 308, 438 390
               Z"
            fill="url(#cmHeadKeyLight)"
          />

          {/* O'ng yelka va ko'krak 3D yorug'lik hajmi */}
          <ellipse
            cx="275"
            cy="298"
            rx="135"
            ry="75"
            fill="url(#cmHeadKeyLight)"
            opacity="0.52"
          />

          {/* Visor osti / bo'yin bukilmasidagi tabiiy yumshoq 3D soya */}
          <ellipse
            cx="206"
            cy="244"
            rx="98"
            ry="26"
            fill="url(#cmChinShadow)"
          />

          {/* Visor va LED matritsa (perspektiva bilan siljiydi) */}
          <g
            style={{
              transform: `translate(${visorShiftX}px, 0px)`,
              transition: 'transform 520ms cubic-bezier(0.22, 1, 0.36, 1)',
            }}
          >
            {/* Visor tashqi 3D chuqurchasi (bezel) */}
            <rect
              x="110"
              y="66"
              width="200"
              height="164"
              rx="76"
              fill="url(#cmVisorRim)"
            />

            {/* Chuqur qora ekran */}
            <rect
              x="114"
              y="70"
              width="192"
              height="156"
              rx="72"
              fill="url(#cmVisorScreen)"
            />

            {/* Ekran ichidagi LED ambient glow */}
            <circle
              cx="210"
              cy="148"
              r="76"
              fill="url(#cmLedAmbient)"
            />

            {/* 1-HOLAT: Ikkita LED Piksel Ko'zlar */}
            <g
              filter="url(#cmLedBloom)"
              style={{
                opacity: showEyes && !showSymbol ? 1 : 0,
                transform: showEyes && !showSymbol ? 'scale(1)' : 'scale(0.82)',
                transformOrigin: '210px 148px',
                transition: 'opacity 180ms ease, transform 240ms ease',
              }}
            >
              {/* Chap ko'z (markazi: x=174, y=150) */}
              {leftEyePixels.map(([px, py], i) => (
                <rect
                  key={`le-${i}`}
                  x={174 + px * 4.4 - 1.75}
                  y={150 + py * 4.4 - 1.75}
                  width="3.5"
                  height="3.5"
                  rx="0.6"
                  fill={Math.abs(px) <= 1 && Math.abs(py) <= 1 ? ledBright : ledMain}
                />
              ))}

              {/* O'ng ko'z (markazi: x=238, y=150) */}
              {rightEyePixels.map(([px, py], i) => (
                <rect
                  key={`re-${i}`}
                  x={238 + px * 4.4 - 1.75}
                  y={150 + py * 4.4 - 1.75}
                  width="3.5"
                  height="3.5"
                  rx="0.6"
                  fill={Math.abs(px) <= 1 && Math.abs(py) <= 1 ? ledBright : ledMain}
                />
              ))}
            </g>

            {/* 2-HOLAT: Qalin LED Piksel Halqa + "?" (yoki "!") */}
            <g
              filter="url(#cmLedBloom)"
              style={{
                opacity: showSymbol ? 1 : 0,
                transform: showSymbol ? 'scale(1)' : 'scale(0.75)',
                transformOrigin: '210px 148px',
                transition: 'opacity 220ms ease, transform 300ms cubic-bezier(0.34, 1.56, 0.64, 1)',
              }}
            >
              {/* 2-3 qatorli qalin piksel halqa */}
              {RING_COORDS.map(([gx, gy], idx) => {
                const dist = Math.hypot(gx, gy)
                const isMidRing = dist >= 7.5 && dist <= 8.5
                return (
                  <rect
                    key={`ring-${idx}`}
                    x={210 + gx * 5.2 - 2.0}
                    y={148 + gy * 5.2 - 2.0}
                    width="4.0"
                    height="4.0"
                    rx="0.65"
                    fill={isMidRing ? ledBright : ledMain}
                    opacity={isMidRing ? 0.98 : 0.78}
                  />
                )
              })}

              {/* Markaziy qalin piksel "?" yoki "!" */}
              {symbolCoords.map(([gx, gy], idx) => (
                <rect
                  key={`sym-${idx}`}
                  x={210 + gx * 5.2 - 2.1}
                  y={148 + gy * 5.2 - 2.1}
                  width="4.2"
                  height="4.2"
                  rx="0.7"
                  fill={ledBright}
                />
              ))}
            </g>
          </g>
        </g>
      </svg>
    </div>
  )
}

export default ConfirmMascot
