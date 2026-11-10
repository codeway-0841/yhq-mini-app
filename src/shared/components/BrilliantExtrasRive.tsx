import { memo, useEffect, useRef, useState, type ReactNode } from 'react'
import type { Rive } from '@rive-app/webgl2-course'
import { getBrilliantBuffer, loadBrilliantRiveRuntime } from './BrilliantEndstateRive'

export type BrilliantExtrasKind = 'league' | 'jump-back-in' | 'lightning'
export type BrilliantLeagueState = 'promote' | 'stagnant' | 'demote'

const EXTRAS_CONFIG = {
  league: {
    file: 'leagues-badges.45867fa0.riv',
    artboard: 'MAIN_leagues',
    stateMachine: 'leagueBadges',
  },
  'jump-back-in': {
    file: 'koji-jump-back-in.7a4d3c18.riv',
    artboard: 'RUX Jump back In',
    stateMachine: 'RUX Jump back In',
  },
  lightning: {
    file: 'lightning.6513fd63.riv',
    artboard: 'Streaks Tooltip Animation',
    stateMachine: 'In-Lesson Streak Mobile',
  },
} as const

export interface BrilliantExtrasRiveProps {
  kind: BrilliantExtrasKind
  label: string
  /** Liga darajasi (`league` uchun 1..10) */
  leagueLevel?: number
  /** Liga o'zgarishi (`league` uchun 'promote' | 'stagnant' | 'demote') */
  leagueState?: BrilliantLeagueState
  /** Liga qulflanganmi (`league` uchun) */
  locked?: boolean
  /** Chaqmoq ko'rinishi (`lightning` uchun) */
  boltVisible?: boolean
  /** O'zgarsa animatsiya boshidan qayta o'ynaydi */
  nonce?: number
  className?: string
  fallback?: ReactNode
}

/**
 * Brilliant State-Machine Rive sahnalari (`leagues-badges`, `koji-jump-back-in`, `lightning`).
 * Umumiy WASM yuklovchi va ArrayBuffer keshini `BrilliantEndstateRive` bilan bo'lishadi.
 */
export const BrilliantExtrasRive = memo(function BrilliantExtrasRive({
  kind,
  label,
  leagueLevel = 1,
  leagueState = 'promote',
  locked = false,
  boltVisible = true,
  nonce = 0,
  className = '',
  fallback = null,
}: BrilliantExtrasRiveProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const levelRef = useRef(leagueLevel)
  const stateRef = useRef(leagueState)
  const lockedRef = useRef(locked)
  const boltRef = useRef(boltVisible)
  const [failed, setFailed] = useState(false)

  levelRef.current = leagueLevel
  stateRef.current = leagueState
  lockedRef.current = locked
  boltRef.current = boltVisible

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const cfg = EXTRAS_CONFIG[kind]
    let disposed = false
    let rive: Rive | null = null
    let observer: ResizeObserver | null = null
    setFailed(false)

    void Promise.all([
      loadBrilliantRiveRuntime(),
      getBrilliantBuffer(cfg.file),
    ]).then(([mod, buffer]) => {
      if (disposed) return
      const { Rive: RiveCtor, Layout, Fit, Alignment } = mod
      const resize = () => {
        if (rive && canvas.clientWidth > 0 && canvas.clientHeight > 0) {
          try { rive.resizeDrawingSurfaceToCanvas() } catch { /* canvas detached */ }
        }
      }

      rive = new RiveCtor({
        buffer: buffer.slice(0),
        canvas,
        artboard: cfg.artboard,
        stateMachines: cfg.stateMachine,
        autoplay: true,
        layout: new Layout({ fit: Fit.Contain, alignment: Alignment.Center }),
        onLoad: () => {
          if (disposed || !rive) return
          resize()
          const inputs = rive.stateMachineInputs(cfg.stateMachine) ?? []
          const byName = new Map(inputs.map((inp) => [inp.name, inp]))

          if (kind === 'league') {
            const lvl = byName.get('level_Number')
            if (lvl) lvl.value = Math.max(1, Math.min(10, Math.round(levelRef.current)))
            const lck = byName.get('locked')
            if (lck) lck.value = lockedRef.current
            const trig = byName.get(stateRef.current)
            trig?.fire?.()
          } else if (kind === 'lightning') {
            const bolt = byName.get('Bolt visible')
            if (bolt) bolt.value = boltRef.current
            const trig = byName.get('Lightning')
            trig?.fire?.()
          }
        },
        onLoadError: () => { if (!disposed) setFailed(true) },
      })

      if (typeof ResizeObserver !== 'undefined') {
        observer = new ResizeObserver(resize)
        observer.observe(canvas)
      }
    }).catch(() => { if (!disposed) setFailed(true) })

    return () => {
      disposed = true
      observer?.disconnect()
      rive?.cleanup()
    }
  }, [kind, leagueLevel, leagueState, locked, boltVisible, nonce])

  return (
    <div className={`relative ${className}`} role="img" aria-label={label}>
      <canvas ref={canvasRef} className="absolute inset-0 size-full" aria-hidden="true" />
      {failed && <div className="absolute inset-0 flex items-center justify-center">{fallback}</div>}
    </div>
  )
})

export default BrilliantExtrasRive
