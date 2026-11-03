import { useEffect, useRef, useState } from 'react'
import type { Rive } from '@rive-app/webgl2-course'
import './rive-canvas.css'

type CanvasStatus = 'loading' | 'ready' | 'error'

let wasmConfigured = false
const rivBufferCache = new Map<string, Promise<ArrayBuffer>>()

function getRivBuffer(file: string): Promise<ArrayBuffer> {
  let p = rivBufferCache.get(file)
  if (!p) {
    p = fetch(`/brilliant/${file}`).then((r) => {
      if (!r.ok) throw new Error(`Failed to load /brilliant/${file}: HTTP ${r.status}`)
      return r.arrayBuffer()
    })
    rivBufferCache.set(file, p)
  }
  return p
}

export function RiveCanvas({
  file,
  animation,
  stateMachine,
  artboard,
  poster,
  label,
  className = '',
  fit = 'contain',
  alignment = 'center',
  play = true,
  nonce = 0,
}: {
  file: string
  animation?: string
  stateMachine?: string
  artboard?: string
  poster?: string
  label: string
  className?: string
  fit?: 'contain' | 'cover'
  alignment?: 'center' | 'bottom'
  play?: boolean
  nonce?: number
}) {
  const hostRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const riveRef = useRef<Rive | null>(null)
  const animationRef = useRef(animation)
  const stateMachineRef = useRef(stateMachine)
  const artboardRef = useRef(artboard)
  const playRef = useRef(play)
  const [status, setStatus] = useState<CanvasStatus>('loading')
  animationRef.current = animation
  stateMachineRef.current = stateMachine
  artboardRef.current = artboard
  playRef.current = play

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    let disposed = false
    let instance: Rive | null = null
    let resizeObserver: ResizeObserver | null = null
    setStatus('loading')

    void Promise.all([
      import('@rive-app/webgl2-course'),
      import('@rive-app/webgl2-course/rive.wasm?url'),
      import('@rive-app/webgl2-course/rive_fallback.wasm?url'),
      getRivBuffer(file).catch(() => null),
    ]).then(async ([pkg, wasmMod, fallbackWasmMod, buffer]) => {
      const riveModule = ((pkg as { default?: unknown }).default ?? pkg) as typeof import('@rive-app/webgl2-course')
      const { Rive, RuntimeLoader, Layout, Fit, Alignment } = riveModule
      if (!wasmConfigured && RuntimeLoader) {
        try {
          const wasmUrl = (wasmMod as { default?: string }).default ?? wasmMod
          const fallbackWasmUrl = (fallbackWasmMod as { default?: string }).default ?? fallbackWasmMod
          if (typeof wasmUrl === 'string') RuntimeLoader.setWasmUrl(wasmUrl)
          if (typeof fallbackWasmUrl === 'string') RuntimeLoader.setWasmFallbackUrl(fallbackWasmUrl)
          wasmConfigured = true
        } catch (_) {}
      }
      if (disposed) return
      const safeResize = () => {
        if (!instance || !canvas) return
        if (canvas.clientWidth > 0 && canvas.clientHeight > 0) {
          try {
            instance.resizeDrawingSurfaceToCanvas()
          } catch (_) {}
        }
      }

      const alignMode = alignment === 'bottom' && Alignment ? Alignment.BottomCenter : (Alignment ? Alignment.Center : undefined)
      const riveConfig: ConstructorParameters<typeof Rive>[0] = {
        canvas,
        artboard: artboardRef.current,
        autoplay: playRef.current,
        layout: new Layout({
          fit: fit === 'cover' ? Fit.Cover : Fit.Contain,
          alignment: alignMode,
        }),
        isTouchScrollEnabled: true,
        onLoad: () => {
          if (disposed || !instance) return
          safeResize()
          const anims = instance.animationNames || []
          const sms = instance.stateMachineNames || []

          if (playRef.current) {
            if (stateMachineRef.current && sms.includes(stateMachineRef.current)) {
              instance.play(stateMachineRef.current, true)
            } else if (animationRef.current && anims.includes(animationRef.current)) {
              try { instance.scrub(animationRef.current, 0) } catch (_) {}
              instance.play(animationRef.current)
            } else if (sms.length > 0) {
              instance.play(sms[0], true)
            } else if (anims.length > 0) {
              try { instance.scrub(anims[0], 0) } catch (_) {}
              instance.play(anims[0])
            }
          } else {
            instance.pause()
          }
          riveRef.current = instance
          setStatus('ready')
        },
        onLoadError: () => {
          if (!disposed) setStatus('error')
        },
      }
      if (stateMachineRef.current) {
        riveConfig.stateMachines = [stateMachineRef.current]
      } else if (animationRef.current) {
        riveConfig.animations = [animationRef.current]
      }
      if (buffer) {
        riveConfig.buffer = buffer.slice(0)
      } else {
        riveConfig.src = `/brilliant/${file}`
      }
      instance = new Rive(riveConfig)
      if (typeof ResizeObserver !== 'undefined') {
        resizeObserver = new ResizeObserver(() => {
          safeResize()
        })
        resizeObserver.observe(canvas)
      }
    }).catch(() => {
      if (!disposed) setStatus('error')
    })

    return () => {
      disposed = true
      resizeObserver?.disconnect()
      riveRef.current = null
      instance?.cleanup()
    }
  }, [file, fit, alignment, artboard])

  useEffect(() => {
    const instance = riveRef.current
    if (!instance || status !== 'ready') return
    if (play) {
      const anims = instance.animationNames || []
      const sms = instance.stateMachineNames || []

      if (stateMachine && sms.includes(stateMachine)) {
        try {
          instance.reset({
            artboard: artboardRef.current,
            stateMachine,
            autoplay: true,
          })
        } catch (_) {
          instance.play(stateMachine, true)
        }
      } else if (animation && anims.includes(animation)) {
        try {
          instance.reset({
            artboard: artboardRef.current,
            animations: [animation],
            autoplay: true,
          })
        } catch (_) {
          try { instance.stop() } catch (_) {}
          try { instance.scrub(animation, 0) } catch (_) {}
          instance.play(animation)
        }
      } else if (sms.length > 0) {
        try {
          instance.reset({
            artboard: artboardRef.current,
            stateMachine: sms[0],
            autoplay: true,
          })
        } catch (_) {
          instance.play(sms[0], true)
        }
      } else if (anims.length > 0) {
        try {
          instance.reset({
            artboard: artboardRef.current,
            animations: [anims[0]],
            autoplay: true,
          })
        } catch (_) {
          try { instance.stop() } catch (_) {}
          try { instance.scrub(anims[0], 0) } catch (_) {}
          instance.play(anims[0])
        }
      }
    } else {
      instance.pause()
    }
  }, [animation, stateMachine, play, status, nonce])

  return (
    <div ref={hostRef} className={`mascot-canvas-host ${className}`} role="img" aria-label={label}>
      <canvas ref={canvasRef} className="mascot-canvas" aria-hidden="true" />
      {status === 'error' && poster && (
        <img src={poster} alt="" className="mascot-canvas-poster" />
      )}
      {status === 'error' && !poster && (
        <span className="mascot-canvas-error" aria-hidden="true">!</span>
      )}
    </div>
  )
}
