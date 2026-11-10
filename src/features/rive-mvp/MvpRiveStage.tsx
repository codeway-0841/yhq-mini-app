import { memo, useEffect, useRef, useState, type ReactNode } from 'react'
import type { Rive } from '@rive-app/webgl2-course'
import { getBrilliantBuffer, loadBrilliantRiveRuntime } from '../../shared/components/BrilliantEndstateRive'

export interface MvpRiveStageProps {
  /** `/brilliant/` ichidagi `.riv` fayl nomi */
  file: string
  label: string
  artboard?: string
  stateMachine?: string
  fit?: 'contain' | 'cover'
  /** ViewModel nomi (agar bo'lsa `viewModelByName` yoki `defaultViewModel`) */
  viewModel?: string
  booleans?: Record<string, boolean>
  numbers?: Record<string, number>
  strings?: Record<string, string>
  /** On-load paytida fire qilinadigan VM triggerlar */
  vmTriggers?: string[]
  /** On-load paytida o'rnatiladigan SM input qiymatlari */
  smBooleans?: Record<string, boolean>
  smNumbers?: Record<string, number>
  /** On-load paytida fire qilinadigan SM trigger nomlari */
  smTriggers?: string[]
  /** Mount bo'lgandan keyin dinamik SM trigger yuborish uchun: { name, seq } */
  pulseSmTrigger?: { name: string; seq: number } | null
  /** Mount bo'lgandan keyin dinamik VM trigger yuborish uchun: { name, seq } */
  pulseVmTrigger?: { name: string; seq: number } | null
  /** Mount bo'lgandan keyin dinamik VM boolean/number o'zgartirish */
  liveBooleans?: Record<string, boolean>
  liveNumbers?: Record<string, number>
  dark?: boolean
  nonce?: number
  className?: string
  fallback?: ReactNode
  onRiveEvent?: (name: string) => void
  onStateChange?: (states: string[]) => void
}

/**
 * Brilliant barcha 37 ta `.riv` faylini aniq Artboard / StateMachine / ViewModel
 * bilan xatosiz chizish uchun universal MVP sahna komponenti.
 */
export const MvpRiveStage = memo(function MvpRiveStage({
  file,
  label,
  artboard,
  stateMachine,
  fit = 'contain',
  viewModel,
  booleans,
  numbers,
  strings,
  vmTriggers,
  smBooleans,
  smNumbers,
  smTriggers,
  pulseSmTrigger,
  pulseVmTrigger,
  liveBooleans,
  liveNumbers,
  dark = false,
  nonce = 0,
  className = '',
  fallback = null,
  onRiveEvent,
  onStateChange,
}: MvpRiveStageProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const riveRef = useRef<Rive | null>(null)
  const vmInstRef = useRef<ReturnType<NonNullable<ReturnType<Rive['viewModelByName']>>['instance']> | null>(null)
  const [failed, setFailed] = useState(false)

  const onEventRef = useRef(onRiveEvent)
  const onStateRef = useRef(onStateChange)
  onEventRef.current = onRiveEvent
  onStateRef.current = onStateChange

  const propsKey = JSON.stringify({
    booleans,
    numbers,
    strings,
    vmTriggers,
    smBooleans,
    smNumbers,
    smTriggers,
  })

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    let disposed = false
    let rive: Rive | null = null
    let observer: ResizeObserver | null = null
    setFailed(false)

    void Promise.all([loadBrilliantRiveRuntime(), getBrilliantBuffer(file)])
      .then(([mod, buffer]) => {
        if (disposed) return
        const { Rive: RiveCtor, Layout, Fit, Alignment, EventType } = mod
        const resize = () => {
          if (rive && canvas.clientWidth > 0 && canvas.clientHeight > 0) {
            try {
              rive.resizeDrawingSurfaceToCanvas()
            } catch {
              /* canvas detached */
            }
          }
        }

        rive = new RiveCtor({
          buffer: buffer.slice(0),
          canvas,
          ...(artboard ? { artboard } : {}),
          ...(stateMachine ? { stateMachines: stateMachine } : {}),
          autoplay: true,
          autoBind: false,
          layout: new Layout({
            fit: fit === 'cover' ? Fit.Cover : Fit.Contain,
            alignment: Alignment.Center,
          }),
          onLoad: () => {
            if (disposed || !rive) return
            riveRef.current = rive
            resize()

            if (EventType?.RiveEvent) {
              try {
                rive.on(EventType.RiveEvent, (ev) => {
                  const data = ev?.data as { name?: string } | undefined
                  if (data?.name && onEventRef.current) {
                    onEventRef.current(data.name)
                  }
                })
              } catch {
                /* optional */
              }
            }

            if (EventType?.StateChange) {
              try {
                rive.on(EventType.StateChange, (ev) => {
                  if (Array.isArray(ev?.data) && onStateRef.current) {
                    onStateRef.current(ev.data.map(String))
                  }
                })
              } catch {
                /* optional */
              }
            }

            // 1) ViewModel binding
            try {
              const vm = viewModel
                ? rive.viewModelByName(viewModel)
                : rive.defaultViewModel?.()
              const inst = vm?.defaultInstance() ?? vm?.instance() ?? null
              if (inst) {
                rive.bindViewModelInstance(inst)
                vmInstRef.current = inst as never
                try {
                  const dm = inst.boolean('darkMode')
                  if (dm) dm.value = dark
                } catch {
                  /* optional */
                }
                if (booleans) {
                  for (const [k, v] of Object.entries(booleans)) {
                    try {
                      const p = inst.boolean(k)
                      if (p) p.value = v
                    } catch {
                      /* optional */
                    }
                  }
                }
                if (numbers) {
                  for (const [k, v] of Object.entries(numbers)) {
                    try {
                      const p = inst.number(k)
                      if (p) p.value = v
                    } catch {
                      /* optional */
                    }
                  }
                }
                if (strings) {
                  for (const [k, v] of Object.entries(strings)) {
                    try {
                      const p = inst.string(k)
                      if (p) p.value = v
                    } catch {
                      /* optional */
                    }
                  }
                }
                if (vmTriggers) {
                  for (const tr of vmTriggers) {
                    try {
                      inst.trigger(tr)?.trigger()
                    } catch {
                      /* optional */
                    }
                  }
                }
              }
            } catch {
              /* some .riv files use SM inputs only */
            }

            // 2) StateMachine inputs
            const smName = stateMachine ?? rive.stateMachineNames?.[0]
            if (smName) {
              try {
                const inputs = rive.stateMachineInputs(smName) ?? []
                const byName = new Map(inputs.map((inp) => [inp.name, inp]))
                if (smBooleans) {
                  for (const [k, v] of Object.entries(smBooleans)) {
                    const inp = byName.get(k)
                    if (inp) inp.value = v
                  }
                }
                if (smNumbers) {
                  for (const [k, v] of Object.entries(smNumbers)) {
                    const inp = byName.get(k)
                    if (inp) inp.value = v
                  }
                }
                if (smTriggers) {
                  for (const tr of smTriggers) {
                    byName.get(tr)?.fire?.()
                  }
                }
              } catch {
                /* ignore */
              }
            }
          },
          onLoadError: () => {
            if (!disposed) setFailed(true)
          },
        })

        if (typeof ResizeObserver !== 'undefined') {
          observer = new ResizeObserver(resize)
          observer.observe(canvas)
        }
      })
      .catch(() => {
        if (!disposed) setFailed(true)
      })

    return () => {
      disposed = true
      observer?.disconnect()
      riveRef.current = null
      vmInstRef.current = null
      rive?.cleanup()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file, artboard, stateMachine, fit, viewModel, dark, nonce, propsKey])

  // Dinamik SM trigger (masalan Habit tanlaganda yoki AI Koji javob berganda)
  useEffect(() => {
    if (!pulseSmTrigger || !riveRef.current) return
    const smName = stateMachine ?? riveRef.current.stateMachineNames?.[0]
    if (!smName) return
    try {
      const inp = riveRef.current.stateMachineInputs(smName)?.find((i) => i.name === pulseSmTrigger.name)
      inp?.fire?.()
    } catch {
      /* ignore */
    }
  }, [pulseSmTrigger, stateMachine])

  // Dinamik VM trigger (masalan AskKoji yoki Habit powerup)
  useEffect(() => {
    if (!pulseVmTrigger || !vmInstRef.current) return
    try {
      vmInstRef.current.trigger(pulseVmTrigger.name)?.trigger()
    } catch {
      /* ignore */
    }
  }, [pulseVmTrigger])

  // Dinamik VM boolean & number
  useEffect(() => {
    const inst = vmInstRef.current
    if (!inst) return
    if (liveBooleans) {
      for (const [k, v] of Object.entries(liveBooleans)) {
        try {
          const p = inst.boolean(k)
          if (p) p.value = v
        } catch {
          /* ignore */
        }
      }
    }
    if (liveNumbers) {
      for (const [k, v] of Object.entries(liveNumbers)) {
        try {
          const p = inst.number(k)
          if (p) p.value = v
        } catch {
          /* ignore */
        }
      }
    }
  }, [liveBooleans, liveNumbers])

  return (
    <div className={`relative ${className}`} role="img" aria-label={label}>
      <canvas ref={canvasRef} className="absolute inset-0 size-full" aria-hidden="true" />
      {failed && <div className="absolute inset-0 flex items-center justify-center">{fallback}</div>}
    </div>
  )
})
