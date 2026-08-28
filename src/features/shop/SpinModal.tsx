/**
 * Omad g'ildiragi (Lucky Spin) modali — kunlik 1 marta BEPUL aylantirish.
 *
 * TRUST BOUNDARY:
 *  - NATIJA FAQAT server'dan keladi (POST /coins/spin — crypto RNG + og'irliklar);
 *    g'ildirak animatsiyasi server segmentiga aniq "qonadi" (halol spektakl).
 *  - 1/kun: server atomik claim (daily_spins PK); 409 da holat qayta o'qiladi.
 *  - Balans/tarif FAQAT server javobidan: coins → setCoins(balance),
 *    premium → syncFromServer (tariff/premium_until o'zgarishi).
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { X, Coins, Crown, Loader2, Sparkles, Target } from 'lucide-react'
import DialogOverlay from '../../shared/components/DialogOverlay'
import Confetti from '../../shared/components/Confetti'
import { Button } from '../../shared/components/ui/button'
import { api, ApiError } from '../../shared/api'
import { SPIN_SEGMENTS, getSpinSegment, type SpinSegment } from '../../../shared/lucky-spin'
import { useAppStore } from '../../shared/store/useAppStore'
import { playSound } from '../../shared/lib/sounds'
import { track } from '../../shared/lib/analytics'
import { haptics } from '../../platform/haptics'
import { useT } from '../../shared/i18n'

const SEG_COUNT = SPIN_SEGMENTS.length
const SEG_ANGLE = 360 / SEG_COUNT
const SPIN_MS = 4500

/** Segment label: coins → "+N", premium → "24h" (Crown ikonkasi alohida chiziladi) */
const segLabel = (s: SpinSegment) => (s.kind === 'coins' ? `+${s.amount}` : '24h')

type Phase = 'loading' | 'idle' | 'requesting' | 'spinning' | 'done' | 'used'

// Sektorlar uchun boy ranglar palitrasi (Casino Gold & Royal Violet)
const SECTOR_STYLES = [
  { fill: '#0f766e', stroke: '#14b8a6', glow: 'rgba(20, 184, 166, 0.4)' }, // 5: Emerald
  { fill: '#6b21a8', stroke: '#a855f7', glow: 'rgba(168, 85, 247, 0.4)' }, // 10: Purple
  { fill: '#b45309', stroke: '#f59e0b', glow: 'rgba(245, 158, 11, 0.4)' }, // 15: Amber
  { fill: '#1d4ed8', stroke: '#3b82f6', glow: 'rgba(59, 130, 246, 0.4)' }, // 20: Blue
  { fill: '#047857', stroke: '#10b981', glow: 'rgba(16, 185, 129, 0.4)' }, // 30: Green
  { fill: '#4338ca', stroke: '#6366f1', glow: 'rgba(99, 102, 241, 0.4)' }, // 50: Indigo
  { fill: '#be123c', stroke: '#f43f5e', glow: 'rgba(244, 63, 94, 0.4)' },  // 100: Rose
  { fill: '#b45309', stroke: '#fbbf24', glow: 'rgba(251, 191, 36, 0.6)' },  // 👑: Gold VIP
]

function createSectorPath(i: number, total: number = 8, r: number = 132, cx: number = 150, cy: number = 150): string {
  const anglePer = (2 * Math.PI) / total
  const a1 = i * anglePer - Math.PI / 2
  const a2 = (i + 1) * anglePer - Math.PI / 2
  const x1 = cx + r * Math.cos(a1)
  const y1 = cy + r * Math.sin(a1)
  const x2 = cx + r * Math.cos(a2)
  const y2 = cy + r * Math.sin(a2)
  return `M ${cx} ${cy} L ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r} ${r} 0 0 1 ${x2.toFixed(2)} ${y2.toFixed(2)} Z`
}

export default function SpinModal({ onClose }: { onClose: () => void }) {
  const lang = useAppStore((s) => s.settings.language)
  const tt = useT(lang)
  const userId = useAppStore((s) => s.user?.id)
  const setCoins = useAppStore((s) => s.setCoins)
  const syncFromServer = useAppStore((s) => s.syncFromServer)

  const [phase, setPhase] = useState<Phase>('loading')
  const [result, setResult] = useState<SpinSegment | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [rotation, setRotation] = useState(0)
  const [celebrate, setCelebrate] = useState(false)
  const timerRef = useRef<number | null>(null)

  useEffect(() => {
    let alive = true
    api.getSpinState()
      .then((state) => {
        if (!alive) return
        if (state.spun && state.rewardId) {
          setResult(getSpinSegment(state.rewardId))
          setPhase('used')
        } else {
          setPhase('idle')
        }
      })
      .catch(() => { if (alive) setPhase('idle') })
    return () => {
      alive = false
      if (timerRef.current !== null) window.clearTimeout(timerRef.current)
    }
  }, [])

  const finishWithSegment = (segment: SpinSegment) => {
    setResult(segment)
    setPhase('done')
    setCelebrate(true)
    playSound('win')
    haptics.impact('heavy')
    window.setTimeout(() => setCelebrate(false), 3500)
  }

  const spin = async () => {
    if (phase !== 'idle') return
    setError(null)
    setPhase('requesting')
    playSound('click')
    haptics.impact('medium')
    try {
      const res = await api.spinWheel()
      const idx = SPIN_SEGMENTS.findIndex((s) => s.id === res.segment.id)
      const segment = SPIN_SEGMENTS[idx] ?? SPIN_SEGMENTS[0]
      
      // Sektor markazi (burchagi)
      const targetCenter = idx * SEG_ANGLE + SEG_ANGLE / 2

      setRotation((prev) => {
        const curMod = ((prev % 360) + 360) % 360
        const delta = (((-targetCenter - curMod) % 360) + 360) % 360
        return prev + 360 * 7 + delta // 7 to'liq aylanish + segment markaziga qonish
      })
      setPhase('spinning')
      track('spin_wheel', { id: res.segment.id, kind: res.segment.kind })

      // Balans/tarif — FAQAT server javobi bilan
      if (res.segment.kind === 'coins' && res.balance !== null) setCoins(res.balance)
      if (res.segment.kind === 'premium-days' && userId) void syncFromServer(userId)
      
      timerRef.current = window.setTimeout(() => finishWithSegment(segment), SPIN_MS)
    } catch (err) {
      const code = err instanceof ApiError ? err.code : undefined
      if (code === 'SPIN_ALREADY_USED_TODAY') {
        setPhase('used')
        api.getSpinState().then((s) => {
          if (s.spun && s.rewardId) setResult(getSpinSegment(s.rewardId))
        }).catch(() => {})
      } else {
        setError(tt('shopError'))
        playSound('error')
        setPhase('idle')
      }
    }
  }

  // Sektor yo'llari (SVG paths)
  const sectorPaths = useMemo(() => {
    return SPIN_SEGMENTS.map((_, i) => createSectorPath(i, SEG_COUNT, 132, 150, 150))
  }, [])

  // 16 ta perimetr chiroqchalari
  const perimeterPins = useMemo(() => {
    const pins = []
    const count = 16
    for (let i = 0; i < count; i++) {
      const angle = (i * (360 / count) - 90) * (Math.PI / 180)
      const r = 141
      pins.push({
        x: 150 + r * Math.cos(angle),
        y: 150 + r * Math.sin(angle),
        active: i % 2 === 0,
      })
    }
    return pins
  }, [])

  const busy = phase === 'requesting' || phase === 'spinning'

  return (
    <DialogOverlay onClose={onClose} position="center" zIndex={60} className="animate-premiumIn">
      {celebrate && <Confetti count={50} />}
      <div className="relative w-[340px] max-w-[92vw] overflow-hidden rounded-container border border-pline bg-pcard p-5 pt-4 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-1.5">
            <Sparkles size={18} className="text-pgold animate-pulse" />
            <h2 className="font-display text-[17px] font-bold tracking-tight text-pfg">{tt('spinTitle')}</h2>
          </div>
          <button
            onClick={onClose}
            aria-label={tt('spinClose')}
            className="rounded-full p-1 text-psubtle hover:bg-psurface hover:text-pfg transition-colors"
          >
            <X size={18} />
          </button>
        </div>
        <p className="mb-4 text-[11.5px] leading-snug text-pmuted">{tt('spinDesc')}</p>

        {/* ── G'ildirak Sahnasi ── */}
        <div className="relative mx-auto my-2 flex size-[280px] items-center justify-center">
          {/* 3D Needled Pointer (Yuqorida, ko'rsatkich) */}
          <div className="pointer-events-none absolute -top-1.5 left-1/2 z-30 -translate-x-1/2 drop-shadow-[0_4px_6px_rgba(0,0,0,0.5)]">
            <svg width="32" height="38" viewBox="0 0 32 38" fill="none">
              <path
                d="M16 36L4 12C2.5 9 4.5 4 8 4H24C27.5 4 29.5 9 28 12L16 36Z"
                fill="url(#pointerGold)"
                stroke="#ffffff"
                strokeWidth="1.5"
              />
              <circle cx="16" cy="11" r="4.5" fill="#e11d48" stroke="#ffffff" strokeWidth="1" />
              <defs>
                <linearGradient id="pointerGold" x1="16" y1="4" x2="16" y2="36" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#fbbf24" />
                  <stop offset="1" stopColor="#b45309" />
                </linearGradient>
              </defs>
            </svg>
          </div>

          {/* Aylanuvchi SVG G'ildirak */}
          <div
            className="relative size-[280px]"
            style={{
              transform: `rotate(${rotation}deg)`,
              transition: `transform ${SPIN_MS}ms cubic-bezier(0.15, 0.9, 0.25, 1)`,
            }}
          >
            <svg width="280" height="280" viewBox="0 0 300 300" className="drop-shadow-[0_8px_20px_rgba(0,0,0,0.45)]">
              <defs>
                {/* Oltin tashqi gardish gradienti */}
                <linearGradient id="goldRim" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#fde047" />
                  <stop offset="30%" stopColor="#d97706" />
                  <stop offset="50%" stopColor="#fef08a" />
                  <stop offset="70%" stopColor="#b45309" />
                  <stop offset="100%" stopColor="#fbbf24" />
                </linearGradient>
                {/* Markaziy medal gradienti */}
                <radialGradient id="centerHubGold" cx="40%" cy="40%" r="60%">
                  <stop offset="0%" stopColor="#fef08a" />
                  <stop offset="50%" stopColor="#f59e0b" />
                  <stop offset="100%" stopColor="#92400e" />
                </radialGradient>
              </defs>

              {/* 1. Tashqi metall gardish */}
              <circle cx="150" cy="150" r="148" fill="#1e1b4b" stroke="url(#goldRim)" strokeWidth="6" />

              {/* 2. Sektorlar */}
              {SPIN_SEGMENTS.map((s, i) => {
                const style = SECTOR_STYLES[i % SECTOR_STYLES.length]
                const isJackpot = s.kind === 'premium-days'
                return (
                  <path
                    key={s.id}
                    d={sectorPaths[i]}
                    fill={style.fill}
                    stroke={isJackpot ? '#fef08a' : '#1e1b4b'}
                    strokeWidth={isJackpot ? '2' : '1.2'}
                  />
                )
              })}

              {/* 3. Sektor matnlari va piktogrammalari (Aniq sohaning O'RTASIDA) */}
              {SPIN_SEGMENTS.map((s, i) => {
                const angle = i * SEG_ANGLE + SEG_ANGLE / 2
                const isJackpot = s.kind === 'premium-days'
                return (
                  <g key={`text-${s.id}`} transform={`rotate(${angle} 150 150)`}>
                    {isJackpot ? (
                      <>
                        <text
                          x="150"
                          y="48"
                          textAnchor="middle"
                          fill="#ffffff"
                          fontWeight="900"
                          fontSize="13px"
                          style={{ filter: 'drop-shadow(0 2px 3px rgba(0,0,0,0.9))', fontFamily: 'var(--font-sans)' }}
                        >
                          VIP
                        </text>
                        <text
                          x="150"
                          y="64"
                          textAnchor="middle"
                          fill="#fef08a"
                          fontWeight="800"
                          fontSize="11px"
                          style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.9))', fontFamily: 'var(--font-sans)' }}
                        >
                          24h
                        </text>
                      </>
                    ) : (
                      <>
                        <text
                          x="150"
                          y="50"
                          textAnchor="middle"
                          fill="#ffffff"
                          fontWeight="900"
                          fontSize="15px"
                          style={{ filter: 'drop-shadow(0 2px 3px rgba(0,0,0,0.9))', fontFamily: 'var(--font-sans)' }}
                        >
                          +{s.amount}
                        </text>
                        <text
                          x="150"
                          y="65"
                          textAnchor="middle"
                          fill="rgba(255,255,255,0.75)"
                          fontWeight="700"
                          fontSize="9px"
                          letterSpacing="0.05em"
                          style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.9))', fontFamily: 'var(--font-sans)' }}
                        >
                          COIN
                        </text>
                      </>
                    )}
                  </g>
                )
              })}

              {/* 4. Tashqi gardishdagi 16 ta oltin chiroqchalar */}
              {perimeterPins.map((pin, i) => (
                <circle
                  key={`pin-${i}`}
                  cx={pin.x}
                  cy={pin.y}
                  r="3.5"
                  fill={pin.active ? '#fef08a' : '#d97706'}
                  stroke="#ffffff"
                  strokeWidth="0.75"
                  style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.5))' }}
                />
              ))}

              {/* 5. Markaziy 3D Oltin Hub */}
              <circle cx="150" cy="150" r="26" fill="url(#centerHubGold)" stroke="#ffffff" strokeWidth="2" style={{ filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.4))' }} />
              <circle cx="150" cy="150" r="20" fill="#92400e" opacity="0.4" />
              {/* Lucide crown (emoji o'rniga vektor) */}
              <g transform="translate(150 150) scale(1.05) translate(-12 -12)" fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11.562 3.266a.5.5 0 0 1 .876 0L15.39 8.87a1 1 0 0 0 1.516.294L21.183 5.5a.5.5 0 0 1 .798.519l-2.834 10.246a1 1 0 0 1-.956.735H5.81a1 1 0 0 1-.957-.735L2.02 6.02a.5.5 0 0 1 .798-.519l4.276 3.664a1 1 0 0 0 1.516-.294z" />
                <path d="M5 21h14" />
              </g>
            </svg>
          </div>
        </div>

        {error && (
          <p className="mt-3 text-center text-[12.5px] font-semibold text-pdanger animate-fadeIn">{error}</p>
        )}

        {/* Natija / Holat */}
        <div className="mt-3 min-h-[44px] flex items-center justify-center text-center">
          {phase === 'loading' && <Loader2 size={20} className="animate-spin text-psubtle" />}
          {phase === 'idle' && !error && (
            <p className="text-[12.5px] font-semibold text-pmuted flex items-center gap-1.5">
              <Target size={14} strokeWidth={1.75} className="text-psubtle" />
              {lang === 'ru' ? 'Вращайте и выигрывайте призы!' : 'Aylantiring va sovrin yuting!'}
            </p>
          )}
          {phase === 'spinning' && (
            <p className="text-[13px] font-bold text-pprimary motion-safe:animate-pulse">
              {tt('spinSpinning')}
            </p>
          )}
          {(phase === 'done' || phase === 'used') && (
            <div className="animate-premiumIn">
              <p className="text-[11px] font-bold text-psubtle uppercase tracking-wider">
                {phase === 'done' ? tt('spinCongrats') : tt('spinTodayPrize')}
              </p>
              {result && (
                <div
                  className="mt-1 flex items-center justify-center gap-1.5 text-[22px] font-bold tabular-nums"
                  style={{ color: result.kind === 'coins' ? 'var(--p-gold)' : 'var(--p-purple)' }}
                >
                  {result.kind === 'coins' ? (
                    <Coins size={22} strokeWidth={2.2} />
                  ) : (
                    <Crown size={22} strokeWidth={2.2} />
                  )}
                  <span>{segLabel(result)}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Harakat tugmasi */}
        <div className="mt-3">
          {phase === 'used' || phase === 'done' ? (
            <div className="rounded-control bg-psurface py-3 text-center">
              <p className="text-[12px] font-semibold text-pmuted">{tt('spinUsed')}</p>
            </div>
          ) : (
            <Button
              variant="gold"
              block
              size="lg"
              loading={busy}
              disabled={busy || phase === 'loading'}
              onClick={spin}
            >
              <Sparkles size={16} strokeWidth={1.75} />
              {tt('spinButton')}
            </Button>
          )}
        </div>
      </div>
    </DialogOverlay>
  )
}
