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
  | 'post-checkout'
  | 'review-mistakes'
  | 'review-complete'
  | 'lcr-transition'
  | 'assessment-intro'
  | 'warm-up'
  | 'level-insertion'
  | 'koji-entrance'

export type BrilliantLessonTrigger = 'kojiGem' | 'kojiFlip' | 'kojiSpin' | 'koji360' | 'kojiFail'
export type BrilliantPracticeTrigger = 'play100' | 'play50Plus' | 'playFailure'
export type BrilliantProgressTrigger = 'playMastered' | 'playPassed' | 'playPoor'

const ENDSTATES_FILE = 'endstates.e233a7c3.riv'
const PROGRESS_CHECK_FILE = 'progress-check.ae37b864.riv'
const POST_CHECKOUT_FILE = 'post-checkout-flow-premium-pro.a15dbd04.riv'
const LCR_TRANSITION_FILE = 'lcr-koji-transition.c8f8f68d.riv'
const LEVEL_CHECK_FILE = 'level-check.e74e7d3c.riv'
const ASSESSMENT_INTRO_FILE = 'level-check-assessment-intro.1dfae46f.riv'
const LEVEL_INSERTION_FILE = 'level-insertion-intro.fb376b71.riv'
const LOHP_ENTRANCE_FILE = 'lohp_koji_entrance.344647d5.riv'

const KIND = {
  streak:              { file: ENDSTATES_FILE,        artboard: 'MAIN_streak-endstate',       stateMachine: 'StreakEndstate',         viewModel: 'StreakEndstateVM' },
  charge:              { file: ENDSTATES_FILE,        artboard: 'Streaks Forgive',            stateMachine: 'streaksForgive',         viewModel: 'StreaksForgiveVM' },
  lesson:              { file: ENDSTATES_FILE,        artboard: 'MAIN_lesson-endstate',       stateMachine: 'LessonEndstate',         viewModel: 'LessonEndstateVM' },
  practice:            { file: ENDSTATES_FILE,        artboard: 'MAIN_practice-endstate',     stateMachine: 'PracticeEndstate',       viewModel: 'PracticeEndstateVM' },
  xp:                  { file: ENDSTATES_FILE,        artboard: 'MAIN_xp-starburst',          stateMachine: 'XPStarburst',            viewModel: 'XPStarburstVM' },
  'rate-app':          { file: ENDSTATES_FILE,        artboard: 'MAIN_RateTheApp',            stateMachine: 'RateTheApp',             viewModel: 'RateTheAppVM' },
  'premium-lock':      { file: ENDSTATES_FILE,        artboard: 'MAIN_premium-nudge',         stateMachine: 'PremiumNudgeLockBounce', viewModel: 'PremiumNudgeVM' },
  'recommended-level': { file: ENDSTATES_FILE,        artboard: 'MAIN_RecommendedLevelCheck', stateMachine: 'RecommendedLevelCheck',  viewModel: 'RecommendedLevelCheckVM' },
  'progress-intro':    { file: PROGRESS_CHECK_FILE,   artboard: 'MAIN_ProgressCheckIntro',    stateMachine: 'ProgressCheckIntro',     viewModel: 'ProgressCheckIntroVM' },
  'progress-endstate': { file: PROGRESS_CHECK_FILE,   artboard: 'MAIN_ProgressCheckEndstate', stateMachine: 'ProgressCheckEndstate',  viewModel: 'ProgressCheckEndstateVM' },
  'post-checkout':     { file: POST_CHECKOUT_FILE,    artboard: 'MAIN_PostCheckoutFlow',      stateMachine: 'PostCheckoutFlow',       viewModel: 'PostCheckoutFlowVM' },
  'review-mistakes':   { file: LCR_TRANSITION_FILE,   artboard: 'MAIN_ReviewMistakes',        stateMachine: 'ReviewMistakes',         viewModel: 'ReviewMistakesVM' },
  'lcr-transition':    { file: LCR_TRANSITION_FILE,   artboard: 'MAIN_LCR Transition',        stateMachine: 'LCRTransition',          viewModel: 'LCRTransitionVM' },
  'assessment-intro':  { file: ASSESSMENT_INTRO_FILE, artboard: 'MAIN_AssessmentIntro',       stateMachine: 'AssessmentIntro',        viewModel: 'LevelCheckVM' },
  'warm-up':           { file: LEVEL_CHECK_FILE,      artboard: 'MAIN_WarmUp',                stateMachine: 'WarmUp',                 viewModel: 'LevelCheckVM' },
  'review-complete':   { file: LEVEL_CHECK_FILE,      artboard: 'MAIN_ReviewComplete',        stateMachine: 'ReviewComplete',         viewModel: 'ReviewCompleteVM' },
  'level-insertion':   { file: LEVEL_INSERTION_FILE,  artboard: 'MAIN_LevelInsertionIntro',   stateMachine: 'LevelInsertionIntro',    viewModel: 'LevelInsertionIntroVM' },
  'koji-entrance':     { file: LOHP_ENTRANCE_FILE,    artboard: 'MAIN_KojiEntrance',          stateMachine: 'KojiEntrance',           viewModel: 'KojiEntranceVM' },
} as const

let wasmConfigured = false
const bufferCache = new Map<string, Promise<ArrayBuffer>>()

export function getBrilliantBuffer(file: string): Promise<ArrayBuffer> {
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

export async function loadBrilliantRiveRuntime() {
  const [pkg, wasmMod, fallbackMod] = await Promise.all([
    import('@rive-app/webgl2-course'),
    import('@rive-app/webgl2-course/rive.wasm?url'),
    import('@rive-app/webgl2-course/rive_fallback.wasm?url'),
  ])
  const mod = ((pkg as { default?: unknown }).default ?? pkg) as typeof import('@rive-app/webgl2-course')
  if (!wasmConfigured && mod.RuntimeLoader) {
    const wasmUrl = (wasmMod as { default?: string }).default ?? wasmMod
    const fallbackUrl = (fallbackMod as { default?: string }).default ?? fallbackMod
    if (typeof wasmUrl === 'string') mod.RuntimeLoader.setWasmUrl(wasmUrl)
    if (typeof fallbackUrl === 'string') mod.RuntimeLoader.setWasmFallbackUrl(fallbackUrl)
    wasmConfigured = true
  }
  return mod
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
  /** `review-mistakes` uchun to'g'ri / jami xatolar soni */
  correctNum?: number
  totalNum?: number
  /** `level-insertion` uchun daraja nomi */
  levelTitle?: string
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
  correctNum = 0,
  totalNum = 5,
  levelTitle = '',
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
  const correctNumRef = useRef(correctNum)
  const totalNumRef = useRef(totalNum)
  const levelTitleRef = useRef(levelTitle)
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
  correctNumRef.current = correctNum
  totalNumRef.current = totalNum
  levelTitleRef.current = levelTitle
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
      loadBrilliantRiveRuntime(),
      getBrilliantBuffer(cfg.file),
    ]).then(([mod, buffer]) => {
      if (disposed) return
      const { Rive: RiveCtor, Layout, Fit, Alignment, EventType } = mod
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

          const setNum = (prop: string, val: number) => {
            try {
              const p = inst.number(prop)
              if (p) p.value = val
            } catch { /* property may not exist on VM */ }
          }
          const setBool = (prop: string, val: boolean) => {
            try {
              const p = inst.boolean(prop)
              if (p) p.value = val
            } catch { /* property may not exist on VM */ }
          }
          const setStr = (prop: string, val: string) => {
            try {
              const p = inst.string(prop)
              if (p) p.value = val
            } catch { /* property may not exist on VM */ }
          }
          const fire = (prop: string) => {
            try { inst.trigger(prop)?.trigger() } catch { /* ignore */ }
          }

          setBool('darkMode', darkRef.current)

          if (kind === 'streak') {
            setNum('streakAnimation', variantRef.current)
            fire('playAnimation')
          } else if (
            kind === 'charge' ||
            kind === 'xp' ||
            kind === 'rate-app' ||
            kind === 'premium-lock' ||
            kind === 'koji-entrance'
          ) {
            fire('playAnimation')
          } else if (kind === 'post-checkout') {
            setBool('text', false)
            fire('playAnimation')
          } else if (
            kind === 'progress-intro' ||
            kind === 'recommended-level' ||
            kind === 'review-complete'
          ) {
            setNum('color', variantRef.current)
            fire('playAnimation')
          } else if (kind === 'review-mistakes') {
            setNum('color', variantRef.current)
            setNum('correctNum', correctNumRef.current)
            setNum('totalNum', totalNumRef.current)
            fire('playAnimation')
          } else if (kind === 'lcr-transition') {
            setNum('color', variantRef.current)
            fire('playSkillCheck')
          } else if (kind === 'assessment-intro') {
            setNum('color', variantRef.current)
            fire('playAssessmentIntro')
          } else if (kind === 'warm-up') {
            setNum('color', variantRef.current)
            fire('playWarmUp')
          } else if (kind === 'level-insertion') {
            setNum('color', variantRef.current)
            setNum('numberOfSkills1to4', 3)
            if (levelTitleRef.current) setStr('levelTitle', levelTitleRef.current)
            fire('playAnimation')
          } else if (kind === 'progress-endstate') {
            setNum('color', variantRef.current)
            fire(progressTriggerRef.current)
          } else if (kind === 'lesson') {
            setNum('color', variantRef.current)
            setBool('level', isLevelRef.current)
            setBool('skillCheckMastered', skillCheckMasteredRef.current)
            setNum('levelNumber', levelNumberRef.current)
            fire(lessonTriggerRef.current)
          } else if (kind === 'practice') {
            setNum('color', variantRef.current)
            fire(practiceTriggerRef.current)
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
  }, [kind, variant, nonce, lessonTrigger, isLevel, levelNumber, skillCheckMastered, practiceTrigger, progressTrigger, correctNum, totalNum, levelTitle])

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
