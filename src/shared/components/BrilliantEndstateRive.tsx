import { memo, useEffect, useRef, useState, type ReactNode } from 'react'
import type { Rive } from '@rive-app/webgl2-course'

/**
 * Brilliant `endstates.*.riv` artboardlarini view-model orqali ishga tushiradi.
 *
 * Brilliant bu artboardlarni oddiy animatsiya sifatida emas, ViewModel (`StreakEndstateVM`,
 * `StreaksForgiveVM`) orqali boshqaradi: `darkMode`, `streakAnimation` yoziladi va
 * `playAnimation` trigger'i bosiladi. Shu sababli oddiy `animation=` bilan ochilganda
 * chaqmoq/Koji ko'rinmaydi.
 */
export type BrilliantEndstateKind = 'streak' | 'charge'

const FILE = 'endstates.e233a7c3.riv'

const KIND = {
  // Rive faylidan o'qilgan nomlar (artboard / state machine / view model)
  streak: { artboard: 'MAIN_streak-endstate', stateMachine: 'StreakEndstate', viewModel: 'StreakEndstateVM' },
  charge: { artboard: 'Streaks Forgive', stateMachine: 'streaksForgive', viewModel: 'StreaksForgiveVM' },
} as const

let wasmConfigured = false
let bufferPromise: Promise<ArrayBuffer> | null = null

function getBuffer(): Promise<ArrayBuffer> {
  if (!bufferPromise) {
    bufferPromise = fetch(`/brilliant/${FILE}`).then((r) => {
      if (!r.ok) throw new Error(`Failed to load /brilliant/${FILE}: HTTP ${r.status}`)
      return r.arrayBuffer()
    })
    bufferPromise.catch(() => { bufferPromise = null })
  }
  return bufferPromise
}

export interface BrilliantEndstateRiveProps {
  kind: BrilliantEndstateKind
  label: string
  /** `streakAnimation` (0 = Koji bilan birinchi seriya sahnasi) */
  variant?: number
  dark?: boolean
  /** O'zgarsa animatsiya boshidan qayta o'ynaydi */
  nonce?: number
  className?: string
  fallback?: ReactNode
}

export const BrilliantEndstateRive = memo(function BrilliantEndstateRive({
  kind,
  label,
  variant = 0,
  dark = false,
  nonce = 0,
  className = '',
  fallback = null,
}: BrilliantEndstateRiveProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const instanceRef = useRef<ReturnType<NonNullable<ReturnType<Rive['viewModelByName']>>['instance']> | null>(null)
  const darkRef = useRef(dark)
  const variantRef = useRef(variant)
  const [failed, setFailed] = useState(false)
  darkRef.current = dark
  variantRef.current = variant

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const cfg = KIND[kind]
    let disposed = false
    let rive: Rive | null = null
    let observer: ResizeObserver | null = null
    setFailed(false)

    void Promise.all([
      import('@rive-app/webgl2-course'),
      import('@rive-app/webgl2-course/rive.wasm?url'),
      import('@rive-app/webgl2-course/rive_fallback.wasm?url'),
      getBuffer(),
    ]).then(([pkg, wasmMod, fallbackMod, buffer]) => {
      if (disposed) return
      const mod = ((pkg as { default?: unknown }).default ?? pkg) as typeof import('@rive-app/webgl2-course')
      const { Rive: RiveCtor, RuntimeLoader, Layout, Fit, Alignment } = mod
      if (!wasmConfigured && RuntimeLoader) {
        const wasmUrl = (wasmMod as { default?: string }).default ?? wasmMod
        const fallbackUrl = (fallbackMod as { default?: string }).default ?? fallbackMod
        if (typeof wasmUrl === 'string') RuntimeLoader.setWasmUrl(wasmUrl)
        if (typeof fallbackUrl === 'string') RuntimeLoader.setWasmFallbackUrl(fallbackUrl)
        wasmConfigured = true
      }
      const resize = () => {
        if (rive && canvas.clientWidth > 0 && canvas.clientHeight > 0) {
          try { rive.resizeDrawingSurfaceToCanvas() } catch { /* canvas yo'q bo'lib qolgan */ }
        }
      }
      rive = new RiveCtor({
        buffer: buffer.slice(0),
        canvas,
        artboard: cfg.artboard,
        stateMachines: cfg.stateMachine,
        autoplay: true,
        autoBind: false,
        layout: new Layout({ fit: Fit.Contain, alignment: Alignment.Center }),
        onLoad: () => {
          if (disposed || !rive) return
          resize()
          const vm = rive.viewModelByName(cfg.viewModel)
          const inst = vm?.defaultInstance() ?? vm?.instance() ?? null
          if (!inst) return
          rive.bindViewModelInstance(inst)
          instanceRef.current = inst as never
          const dm = inst.boolean('darkMode')
          if (dm) dm.value = darkRef.current
          const sa = inst.number('streakAnimation')
          if (sa) sa.value = variantRef.current
          inst.trigger('playAnimation')?.trigger()
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
      instanceRef.current = null
      rive?.cleanup()
    }
  }, [kind, nonce])

  useEffect(() => {
    const dm = (instanceRef.current as unknown as { boolean?: (n: string) => { value: boolean } | null } | null)?.boolean?.('darkMode')
    if (dm) dm.value = dark
  }, [dark])

  return (
    <div className={`relative ${className}`} role="img" aria-label={label}>
      <canvas ref={canvasRef} className="absolute inset-0 size-full" aria-hidden="true" />
      {failed && <div className="absolute inset-0 flex items-center justify-center">{fallback}</div>}
    </div>
  )
})

export default BrilliantEndstateRive
