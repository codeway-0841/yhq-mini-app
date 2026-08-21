/**
 * Omad g'ildiragi (Lucky Spin) modali — kunlik 1 marta BEPUL aylantirish.
 *
 * TRUST BOUNDARY (shaqllanish tartibi):
 *  - NATIJA FAQAT server'dan keladi (POST /coins/spin — crypto RNG + og'irliklar);
 *    g'ildirak animatsiyasi server segmentiga "qonatiladi" (halol spektakl).
 *  - 1/kun: server atomik claim (daily_spins PK); 409 da holat qayta o'qiladi.
 *  - Balans/tarif FAQAT server javobidan: coins → setCoins(balance),
 *    premium → syncFromServer (tariff/premium_until o'zgarishi).
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { X, Coins, Loader2 } from 'lucide-react'
import DialogOverlay from '../../shared/components/DialogOverlay'
import Confetti from '../../shared/components/Confetti'
import { api, ApiError } from '../../shared/api'
import { SPIN_SEGMENTS, getSpinSegment, type SpinSegment } from '../../../shared/lucky-spin'
import { useAppStore } from '../../shared/store/useAppStore'
import { playSound } from '../../shared/lib/sounds'
import { track } from '../../shared/lib/analytics'
import { useT } from '../../shared/i18n'

const SEG = 360 / SPIN_SEGMENTS.length
const SPIN_MS = 4300

/** Segment label: coins → "+N", premium → "👑 24h" */
const segLabel = (s: SpinSegment) => (s.kind === 'coins' ? `+${s.amount}` : '👑 24h')

type Phase = 'loading' | 'idle' | 'requesting' | 'spinning' | 'done' | 'used'

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
    window.setTimeout(() => setCelebrate(false), 3200)
  }

  const spin = async () => {
    if (phase !== 'idle') return
    setError(null)
    setPhase('requesting')
    playSound('click')
    try {
      const res = await api.spinWheel()
      const idx = SPIN_SEGMENTS.findIndex((s) => s.id === res.segment.id)
      const segment = SPIN_SEGMENTS[idx] ?? SPIN_SEGMENTS[0]
      const c = idx * SEG + SEG / 2   // segment markazi (soat yo'nalishida, yuqoridan)
      setRotation((prev) => {
        const curMod = ((prev % 360) + 360) % 360
        const delta = (((-c - curMod) % 360) + 360) % 360
        return prev + 360 * 6 + delta
      })
      setPhase('spinning')
      track('spin_wheel', { id: res.segment.id, kind: res.segment.kind })
      // Balans/tarif — FAQAT server javobi bilan (client yozmaydi)
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

  // G'ildirak segmentlari — alternating gold/purple (token-based, dizayn №8)
  const gradient = useMemo(() => {
    const stops: string[] = []
    SPIN_SEGMENTS.forEach((_, i) => {
      const col = i % 2 === 0
        ? 'rgb(var(--p-gold-rgb) / 0.80)'
        : 'rgb(var(--p-purple-rgb) / 0.70)'
      stops.push(`${col} ${i * SEG + 0.5}deg ${(i + 1) * SEG - 0.5}deg`)
    })
    return `conic-gradient(from -22.5deg, ${stops.join(', ')})`
  }, [])

  const busy = phase === 'requesting' || phase === 'spinning'

  return (
    <DialogOverlay onClose={onClose} position="center" zIndex={60} className="animate-premiumIn">
      {celebrate && <Confetti count={40} />}
      <div className="bg-pcard border border-pline rounded-3xl w-[332px] max-w-[92vw] p-5 pt-4 relative">
        {/* Header */}
        <div className="flex items-center justify-between mb-1.5">
          <h2 className="text-[16px] font-black tracking-tight">{tt('spinTitle')}</h2>
          <button onClick={onClose} aria-label={tt('spinClose')}
            className="text-psubtle hover:text-pfg p-1 transition-colors">
            <X size={18} />
          </button>
        </div>
        <p className="text-[11.5px] text-pmuted leading-snug mb-4">{tt('spinDesc')}</p>

        {/* G'ildirak */}
        <div className="relative w-[264px] h-[264px] mx-auto">
          {/* Ko'rsatkich (yuqorida, harakatsiz) */}
          <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 z-20"
            style={{
              width: 0, height: 0,
              borderLeft: '11px solid transparent',
              borderRight: '11px solid transparent',
              borderTop: '18px solid var(--p-gold)',
              filter: 'drop-shadow(0 2px 3px rgb(var(--p-gold-rgb) / 0.5))',
            }} />
          {/* Aylanuvchi disk */}
          <div
            className="absolute inset-0 rounded-full border-4 border-pcard overflow-hidden"
            style={{
              background: gradient,
              boxShadow: '0 8px 28px rgb(var(--p-gold-rgb) / 0.25), inset 0 0 0 4px rgb(var(--p-gold-rgb) / 0.35)',
              transform: `rotate(${rotation}deg)`,
              transition: `transform ${SPIN_MS}ms cubic-bezier(0.15, 0.9, 0.25, 1)`,
            }}>
            {SPIN_SEGMENTS.map((s, i) => (
              <div key={s.id} className="absolute inset-0 flex justify-center"
                style={{ transform: `rotate(${i * SEG + SEG / 2}deg)` }}>
                <span className="pt-3 text-[12px] font-black whitespace-nowrap"
                  style={{ color: 'var(--p-canvas)' }}>
                  {segLabel(s)}
                </span>
              </div>
            ))}
          </div>
          {/* Markaziy hub (harakatsiz) */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-14 h-14 rounded-full bg-pcard border border-pline z-10 flex items-center justify-center text-[22px]">
            🎁
          </div>
        </div>

        {error && (
          <p className="mt-4 text-center text-[12.5px] font-semibold text-pwarning animate-fadeIn">{error}</p>
        )}

        {/* Natija / holat */}
        <div className="mt-4 min-h-[40px] flex items-center justify-center text-center">
          {phase === 'loading' && <Loader2 size={18} className="animate-spin text-psubtle" />}
          {phase === 'idle' && !error && (
            <p className="text-[12px] text-psubtle font-semibold">🍀</p>
          )}
          {phase === 'spinning' && (
            <p className="text-[12.5px] font-bold text-pmuted animate-pulse">{tt('spinSpinning')}</p>
          )}
          {(phase === 'done' || phase === 'used') && (
            <div className="animate-premiumIn">
              <p className="text-[11px] font-semibold text-psubtle uppercase tracking-wide">
                {phase === 'done' ? tt('spinCongrats') : tt('spinTodayPrize')}
              </p>
              {result && (
                <p className="mt-1 text-[22px] font-black flex items-center justify-center gap-1.5"
                  style={{ color: result.kind === 'coins' ? 'var(--p-gold)' : 'var(--p-purple)' }}>
                  {result.kind === 'coins' ? <Coins size={20} fill="currentColor" /> : '👑'}
                  {segLabel(result)}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Harakat tugmasi */}
        {phase === 'used' || phase === 'done' ? (
          <p className="mt-2 text-center text-[11.5px] text-pmuted font-semibold">{tt('spinUsed')}</p>
        ) : (
          <button
            onClick={spin}
            disabled={busy || phase === 'loading'}
            className="btn-premium-gold w-full mt-2 py-2.5 rounded-2xl text-[14px] font-black flex items-center justify-center gap-2 disabled:opacity-50 active:scale-[0.98] transition-transform">
            {busy ? <Loader2 size={16} className="animate-spin" /> : tt('spinButton')}
          </button>
        )}
      </div>
    </DialogOverlay>
  )
}
