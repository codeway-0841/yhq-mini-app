import { memo, useEffect, useRef, useState, type ReactNode } from 'react'
import type { Rive } from '@rive-app/webgl2-course'

/**
 * Brilliant `endstates.*.riv` hamda `progress-check.*.riv` artboardlarini view-model orqali ishga tushiradi.
 *
 * Brilliant bu artboardlarni oddiy animatsiya sifatida emas, ViewModel (`StreakEndstateVM`,
 * `StreaksForgiveVM`, `LessonEndstateVM`, `PracticeEndstateVM`, `XPStarburstVM`,
 * `ProgressCheckIntroVM`, `ProgressCheckEndstateVM`, `RateTheAppVM`, `PremiumNudgeVM`,
 * `RecommendedLevelCheckVM`) orqali boshqaradi.
 */
export type BrilliantEndstateKind =
  | 'streak'
  | 'charge'
  | 'lesson'
  | 'practice'
  | 'xp'
  | 'progress-intro'
  | 'progress-endstate'
  | 'rate-app'
  | 'premium-lock'
  | 'recommended-level'

export type BrilliantLessonTrigger = 'kojiGem' | 'kojiFlip' | 'kojiSpin' | 'koji360' | 'kojiFail'
export type BrilliantPracticeTrigger = 'play100' | 'play50Plus' | 'playFailure'
export type BrilliantProgressTrigger = 'playMastered' | 'playPassed' | 'playPoor'

const ENDSTATES_FILE = 'endstates.e233a7c3.riv'
const PROGRESS_CHECK_FILE = 'progress-check.ae37b864.riv'

const KIND = {
  streak:              { file: ENDSTATES_FILE,      artboard: 'MAIN_streak-endstate',       stateMachine: 'StreakEndstate',         viewModel: 'StreakEndstateVM' },
  charge:              { file: ENDSTATES_FILE,      artboard: 'Streaks Forgive',            stateMachine: 'streaksForgive',         viewModel: 'StreaksForgiveVM' },
  lesson:              { file: ENDSTATES_FILE,      artboard: 'MAIN_lesson-endstate',       stateMachine: 'LessonEndstate',         viewModel: 'LessonEndstateVM' },
  practice:            { file: ENDSTATES_FILE,      artboard: 'MAIN_practice-endstate',     stateMachine: 'PracticeEndstate',       viewModel: 'PracticeEndstateVM' },
  xp:                  { file: ENDSTATES_FILE,      artboard: 'MAIN_xp-starburst',          stateMachine: 'XPStarburst',            viewModel: 'XPStarburstVM' },
  'rate-app':          { file: ENDSTATES_FILE,      artboard: 'MAIN_RateTheApp',            stateMachine: 'RateTheApp',             viewModel: 'RateTheAppVM' },
  'premium-lock':      { file: ENDSTATES_FILE,      artboard: 'MAIN_premium-nudge',         stateMachine: 'PremiumNudgeLockBounce', viewModel: 'PremiumNudgeVM' },
  'recommended-level': { file: ENDSTATES_FILE,      artboard: 'MAIN_RecommendedLevelCheck', stateMachine: 'RecommendedLevelCheck',  viewModel: 'RecommendedLevelCheckVM' },
  'progress-intro':    { file: PROGRESS_CHECK_FILE, artboard: 'MAIN_ProgressCheckIntro',    stateMachine: 'ProgressCheckIntro',     viewModel: 'ProgressCheckIntroVM' },
  'progress-endstate': { file: PROGRESS_CHECK_FILE, artboard: 'MAIN_ProgressCheckEndstate', stateMachine: 'ProgressCheckEndstate',  viewModel: 'ProgressCheckEndstateVM' },
} as const

let wasmConfigured = false
const bufferCache = new Map<string, Promise<ArrayBuffer>>()

function getBuffer(file: string): Promise<ArrayBuffer> {
  let promise = bufferCache.get(file)
  if (!promise) {
    promise = fetch(`/brilliant/${file}`).then((r) => {
      if (!r.ok) throw new Error(`Failed to load /brilliant/${file}: HTTP ${r.status}`)
      return r.arrayBuffer()
    })
    promise.catch(() => { bufferCache.delete(file) })
    bufferCache.set(file, promise)
  }
  return promise
}

export interface BrilliantEndstateRiveProps {
  kind: BrilliantEndstateKind
  label: string
  /**
   * `streak` uchun `streakAnimation` (0 = Koji bilan birinchi seriya sahnasi, 1 = chaqmoq, 2 = marra);
   * `lesson` / `practice` / `progress-*` uchun `color` indeksi (0 = Green, 1 = Blue, 2 = Red, 3 = Orange, 4 = Yellow, 5 = Purple).
   */
  variant?: number
  /** `lesson` kind uchun qaysi Koji animatsiyasi o'ynashi */
  lessonTrigger?: BrilliantLessonTrigger
  /**
   * `MAIN_lesson-endstate` ichidagi rejim:
   * - `isLevel = false, skillCheckMastered = false` -> Oddiy dars yakuni (dumaloq podium + 3D checkmark tanga)
   * - `isLevel = true, skillCheckMastered = false`  -> Bosqich/Daraja yakuni (raqamli 3D Olmos)
   * - `skillCheckMastered = true`                   -> Skill Check Mastered (to'lqinli oltin nishon + nurlar)
   */
  isLevel?: boolean
  levelNumber?: number
  skillCheckMastered?: boolean
  /** `practice` kind uchun qaysi natija animatsiyasi o'ynashi */
  practiceTrigger?: BrilliantPracticeTrigger
  /** `progress-endstate` kind uchun qaysi bosqich imtihoni natijasi o'ynashi */
  progressTrigger?: BrilliantProgressTrigger
  dark?: boolean
  /** O'zgarsa animatsiya boshidan qayta o'ynaydi */
  nonce?: number
  className?: string
  fallback?: ReactNode
  /** Rive ichidagi timeline eventlari */
  onRiveEvent?: (name: string) => void
}

export const BrilliantEndstateRive = memo(function BrilliantEndstateRive({
  kind,
  label,
  variant = 0,
  lessonTrigger = 'kojiFlip',
  isLevel = false,
  levelNumber = 1,
  skillCheckMastered = false,
  practiceTrigger = 'play100',
  progressTrigger = 'playMastered',
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
  const isLevelRef = useRef(isLevel)
  const levelNumberRef = useRef(levelNumber)
  const skillCheckMasteredRef = useRef(skillCheckMastered)
  const practiceTriggerRef = useRef(practiceTrigger)
  const progressTriggerRef = useRef(progressTrigger)
  const onEventRef = useRef(onRiveEvent)
  const [failed, setFailed] = useState(false)
  darkRef.current = dark
  variantRef.current = variant
  lessonTriggerRef.current = lessonTrigger
  isLevelRef.current = isLevel
  levelNumberRef.current = levelNumber
  skillCheckMasteredRef.current = skillCheckMastered
  practiceTriggerRef.current = practiceTrigger
  progressTriggerRef.current = progressTrigger
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
      getBuffer(cfg.file),
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
          } else if (kind === 'charge' || kind === 'xp' || kind === 'rate-app' || kind === 'premium-lock') {
            inst.trigger('playAnimation')?.trigger()
          } else if (kind === 'progress-intro' || kind === 'recommended-level') {
            try {
              const col = inst.number('color')
              if (col) col.value = variantRef.current
            } catch { /* ignore */ }
            inst.trigger('playAnimation')?.trigger()
          } else if (kind === 'progress-endstate') {
            try {
              const col = inst.number('color')
              if (col) col.value = variantRef.current
            } catch { /* ignore */ }
            const trig = progressTriggerRef.current
            try { inst.trigger(trig)?.trigger() } catch { /* ignore */ }
          } else if (kind === 'lesson') {
            try {
              const col = inst.number('color')
              if (col) col.value = variantRef.current
            } catch { /* ignore */ }
            try {
              const lvl = inst.boolean('level')
              if (lvl) lvl.value = isLevelRef.current
            } catch { /* ignore */ }
            try {
              const scm = inst.boolean('skillCheckMastered')
              if (scm) scm.value = skillCheckMasteredRef.current
            } catch { /* ignore */ }
            try {
              const ln = inst.number('levelNumber')
              if (ln) ln.value = levelNumberRef.current
            } catch { /* ignore */ }
            const trig = lessonTriggerRef.current
            try { inst.trigger(trig)?.trigger() } catch { /* ignore */ }
          } else if (kind === 'practice') {
            try {
              const col = inst.number('color')
              if (col) col.value = variantRef.current
            } catch { /* ignore */ }
            const trig = practiceTriggerRef.current
            try { inst.trigger(trig)?.trigger() } catch { /* ignore */ }
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
  }, [kind, variant, nonce, lessonTrigger, isLevel, levelNumber, skillCheckMastered, practiceTrigger, progressTrigger])

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
