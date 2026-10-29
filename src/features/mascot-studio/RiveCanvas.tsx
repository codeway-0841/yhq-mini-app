import { useEffect, useRef, useState } from 'react'
import type { Rive } from '@rive-app/webgl2'
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
  poster,
  label,
  className = '',
  fit = 'contain',
  play = true,
}: {
  file: string
  animation: string
  poster?: string
  label: string
  className?: string
  fit?: 'contain' | 'cover'
  play?: boolean
}) {
  const hostRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const riveRef = useRef<Rive | null>(null)
  const animationRef = useRef(animation)
  const playRef = useRef(play)
  const [status, setStatus] = useState<CanvasStatus>('loading')
  animationRef.current = animation
  playRef.current = play

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    let disposed = false
    let instance: Rive | null = null
    let resizeObserver: ResizeObserver | null = null
    setStatus('loading')

    void Promise.all([
      import('@rive-app/webgl2'),
      getRivBuffer(file).catch(() => null),
    ]).then(async ([pkg, buffer]) => {
      const riveModule = ((pkg as { default?: unknown }).default ?? pkg) as typeof import('@rive-app/webgl2')
      const { Rive, RuntimeLoader, Layout, Fit, Alignment } = riveModule
      if (!wasmConfigured) {
        try {
          const wasmMod = await import('@rive-app/webgl2/rive.wasm?url')
          const wasmUrl = (wasmMod as { default?: string }).default ?? wasmMod
          if (RuntimeLoader && typeof wasmUrl === 'string') {
            RuntimeLoader.setWasmUrl(wasmUrl)
            wasmConfigured = true
          }
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
      const riveConfig: ConstructorParameters<typeof Rive>[0] = {
        canvas,
        animations: [animationRef.current],
        autoplay: playRef.current,
        layout: new Layout({
          fit: fit === 'cover' ? Fit.Cover : Fit.Contain,
          alignment: Alignment ? Alignment.Center : undefined,
        }),
        isTouchScrollEnabled: true,
        onLoad: () => {
          if (disposed) return
          safeResize()
          if (playRef.current) {
            instance?.play(animationRef.current)
          } else {
            instance?.pause()
          }
          riveRef.current = instance
          setStatus('ready')
        },
        onLoadError: () => {
          if (!disposed) setStatus('error')
        },
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
  }, [file, fit])

  useEffect(() => {
    const instance = riveRef.current
    if (!instance || status !== 'ready') return
    if (play) {
      instance.play(animation)
    } else {
      instance.pause()
    }
  }, [animation, play, status])

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
