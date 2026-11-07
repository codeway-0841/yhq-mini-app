import { memo, useEffect, useRef, useState, type ReactNode } from 'react'
import type { Rive } from '@rive-app/webgl2-course'

/**
 * Brilliant `endstates.*.riv` artboardlarini view-model orqali ishga tushiradi.
 *
 * Brilliant bu artboardlarni oddiy animatsiya sifatida emas, ViewModel (`StreakEndstateVM`,
 * `StreaksForgiveVM`, `LessonEndstateVM`, `PracticeEndstateVM`, `XPStarburstVM`) orqali boshqaradi:
 * `darkMode`, `color`, `streakAnimation` yoziladi va tegishli trigger (`playAnimation`, `kojiGem`,
 * `play100`, va h.k.) bosiladi.
 */
export type BrilliantEndstateKind = 'streak' | 'charge' | 'lesson' | 'practice' | 'xp'
export type BrilliantLessonTrigger = 'kojiGem' | 'kojiFlip' | 'kojiSpin' | 'koji360' | 'kojiFail'
export type BrilliantPracticeTrigger = 'play100' | 'play50Plus' | 'playFailure'

const FILE = 'endstates.e233a7c3.riv'

const KIND = {
  streak:   { artboard: 'MAIN_streak-endstate',   stateMachine: 'StreakEndstate',   viewModel: 'StreakEndstateVM' },
  charge:   { artboard: 'Streaks Forgive',        stateMachine: 'streaksForgive',   viewModel: 'StreaksForgiveVM' },
  lesson:   { artboard: 'MAIN_lesson-endstate',   stateMachine: 'LessonEndstate',   viewModel: 'LessonEndstateVM' },
  practice: { artboard: 'MAIN_practice-endstate', stateMachine: 'PracticeEndstate', viewModel: 'PracticeEndstateVM' },
  xp:       { artboard: 'MAIN_xp-starburst',      stateMachine: 'XPStarburst',      viewModel: 'XPStarburstVM' },
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
  /**
   * `streak` uchun `streakAnimation` (0 = Koji bilan birinchi seriya sahnasi, 1 = chaqmoq, 2 = marra);
   * `lesson` / `practice` uchun `color` indeksi (0 = yashil/ko'k default).
   */
  variant?: number
  /** `lesson` kind uchun qaysi Koji animatsiyasi o'ynashi ('kojiGem' | 'kojiFlip' | 'kojiSpin' | 'koji360' | 'kojiFail') */
  lessonTrigger?: BrilliantLessonTrigger
  /** `practice` kind uchun qaysi natija animatsiyasi o'ynashi ('play100' | 'play50Plus' | 'playFailure') */
  practiceTrigger?: BrilliantPracticeTrigger
  dark?: boolean
  /** O'zgarsa animatsiya boshidan qayta o'ynaydi */
  nonce?: number
  className?: string
  fallback?: ReactNode
  /** Rive ichidagi timeline eventlari (`play-streak-sound`, `play-streak-charge-sound`, `reveal_xp`, `reveal_title`, `transition_up`) */
  onRiveEvent?: (name: string) => void
}

export const BrilliantEndstateRive = memo(function BrilliantEndstateRive({
  kind,
  label,
  variant = 0,
  lessonTrigger = 'kojiGem',
  practiceTrigger = 'play100',
  dark = false,
  nonce = 0,
  className = '',
  fallback = null,
  onRiveEvent,
}: BrilliantEndstateRiveProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const instanceRef = useRef<ReturnType<NonNullable<ReturnType<Rive['viewModelByName']>>['instance']> | null>(null)
  const darkRef = useRef(dark)
  const variantRef = useRef(variant)
  const lessonTriggerRef = useRef(lessonTrigger)
  const practiceTriggerRef = useRef(practiceTrigger)
  const onEventRef = useRef(onRiveEvent)
  const [failed, setFailed] = useState(false)
  darkRef.current = dark
  variantRef.current = variant
  lessonTriggerRef.current = lessonTrigger
  practiceTriggerRef.current = practiceTrigger
  onEventRef.current = onRiveEvent

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
      const { Rive: RiveCtor, RuntimeLoader, Layout, Fit, Alignment, EventType } = mod
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
          if (EventType?.RiveEvent) {
            try {
              rive.on(EventType.RiveEvent, (ev) => {
                const data = ev?.data as { name?: string } | undefined
                if (data?.name && onEventRef.current) {
                  onEventRef.current(data.name)
                }
              })
            } catch { /* event listener ixtiyoriy */ }
          }
          const vm = rive.viewModelByName(cfg.viewModel)
          const inst = vm?.defaultInstance() ?? vm?.instance() ?? null
          if (!inst) return
          rive.bindViewModelInstance(inst)
          instanceRef.current = inst as never

          try {
            const dm = inst.boolean('darkMode')
            if (dm) dm.value = darkRef.current
          } catch { /* darkMode mavjud bo'lmasa o'tkazib yuboriladi */ }

          if (kind === 'streak') {
            try {
              const sa = inst.number('streakAnimation')
              if (sa) sa.value = variantRef.current
            } catch { /* ignore */ }
            inst.trigger('playAnimation')?.trigger()
          } else if (kind === 'charge' || kind === 'xp') {
            inst.trigger('playAnimation')?.trigger()
          } else if (kind === 'lesson') {
            try {
              const col = inst.number('color')
              if (col) col.value = variantRef.current
            } catch { /* ignore */ }
            const trig = lessonTriggerRef.current
            try { inst.trigger(trig)?.trigger() } catch { /* ignore */ }
            try {
              const b = inst.boolean(trig)
              if (b) b.value = true
            } catch { /* ignore */ }
          } else if (kind === 'practice') {
            try {
              const col = inst.number('color')
              if (col) col.value = variantRef.current
            } catch { /* ignore */ }
            const trig = practiceTriggerRef.current
            try { inst.trigger(trig)?.trigger() } catch { /* ignore */ }
            try {
              const b = inst.boolean(trig)
              if (b) b.value = true
            } catch { /* ignore */ }
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
      instanceRef.current = null
      rive?.cleanup()
    }
  }, [kind, nonce, lessonTrigger, practiceTrigger])

  useEffect(() => {
    try {
      const dm = (instanceRef.current as unknown as { boolean?: (n: string) => { value: boolean } | null } | null)?.boolean?.('darkMode')
      if (dm) dm.value = dark
    } catch { /* ignore */ }
  }, [dark])

  return (
    <div className={`relative ${className}`} role="img" aria-label={label}>
      <canvas ref={canvasRef} className="absolute inset-0 size-full" aria-hidden="true" />
      {failed && <div className="absolute inset-0 flex items-center justify-center">{fallback}</div>}
    </div>
  )
})

export default BrilliantEndstateRive
