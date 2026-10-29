import { useEffect, useRef, useState } from 'react'
import type { Rive } from '@rive-app/webgl2'
import './rive-canvas.css'

type CanvasStatus = 'loading' | 'ready' | 'error'

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

    void import('@rive-app/webgl2').then(async ({ Rive, RuntimeLoader, Layout, Fit }) => {
      const { default: wasmUrl } = await import('@rive-app/webgl2/rive.wasm?url')
      if (disposed) return
      RuntimeLoader.setWasmUrl(wasmUrl)
      instance = new Rive({
        src: `/brilliant/${file}`,
        canvas,
        animations: [animationRef.current],
        autoplay: playRef.current,
        layout: new Layout({ fit: fit === 'cover' ? Fit.Cover : Fit.Contain }),
        isTouchScrollEnabled: true,
        onLoad: () => {
          if (disposed) return
          instance?.resizeDrawingSurfaceToCanvas()
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
      })
      if (typeof ResizeObserver !== 'undefined') {
        resizeObserver = new ResizeObserver(() => instance?.resizeDrawingSurfaceToCanvas())
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
