import { useEffect, useRef, useState } from 'react'
import type { Rive, StateMachineInput } from '@rive-app/webgl2-course'
import { useAppStore } from '../../shared/store/useAppStore'

let asset: Promise<ArrayBuffer> | null = null
function loadAsset() {
  if (!asset) asset = fetch('/darslik-map/koji-gameboard.riv').then((response) => {
    if (!response.ok) throw new Error('Unable to load lesson animation')
    return response.arrayBuffer()
  }).catch((error: unknown) => { asset = null; throw error })
  return asset
}

export function HomeLessonNode({ color, fallback, completed = false }: { color: number; fallback: string; completed?: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const noAnimation = useAppStore((state) => state.settings.noAnimation)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    setReady(false)
    const element = canvas.current
    if (!element || noAnimation || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    let disposed = false
    let instance: Rive | null = null
    let frame = 0
    let resizeObserver: ResizeObserver | null = null
    let themeObserver: MutationObserver | null = null

    void Promise.all([
      import('@rive-app/webgl2-course'),
      import('@rive-app/webgl2-course/rive.wasm?url'),
      import('@rive-app/webgl2-course/rive_fallback.wasm?url'),
      loadAsset(),
    ]).then(([pkg, wasm, fallbackWasm, buffer]) => {
      if (disposed) return
      const rive = ((pkg as { default?: unknown }).default ?? pkg) as typeof import('@rive-app/webgl2-course')
      rive.RuntimeLoader.setWasmUrl(wasm.default)
      rive.RuntimeLoader.setWasmFallbackUrl(fallbackWasm.default)
      const resize = () => {
        if (instance && element.clientWidth && element.clientHeight) instance.resizeDrawingSurfaceToCanvas()
      }
      instance = new rive.Rive({
        canvas: element,
        buffer: buffer.slice(0),
        artboard: 'Gameboard Node',
        stateMachine: 'node_all',
        autoplay: true,
        useOffscreenRenderer: true,
        isTouchScrollEnabled: true,
        layout: new rive.Layout({ fit: rive.Fit.Contain, alignment: rive.Alignment.Center }),
        onLoad: () => {
          if (disposed || !instance) return
          const inputs = instance.stateMachineInputs('node_all') ?? []
          const set = (name: string, value: boolean | number) => {
            const input: StateMachineInput | undefined = inputs.find((item) => item.name === name)
            if (input) input.value = value
          }
          const updateTheme = () => set('dark-mode', document.body.dataset.theme === 'dark')
          updateTheme()
          themeObserver = new MutationObserver(updateTheme)
          themeObserver.observe(document.body, { attributes: true, attributeFilter: ['data-theme'] })
          set('color', color)
          set('completed', completed)
          set('icon', completed ? 1 : 0)
          resize()
          frame = requestAnimationFrame(() => {
            frame = requestAnimationFrame(() => {
              if (disposed) return
              if (!completed) {
                set('select', true)
                inputs.find((input) => input.name === 'koji_appear')?.fire()
              }
              setReady(true)
            })
          })
        },
        onLoadError: () => { if (!disposed) setReady(false) },
      })
      if (typeof ResizeObserver !== 'undefined') {
        resizeObserver = new ResizeObserver(resize)
        resizeObserver.observe(element)
      }
    }).catch(() => { if (!disposed) setReady(false) })
    return () => {
      disposed = true
      if (frame) cancelAnimationFrame(frame)
      resizeObserver?.disconnect()
      themeObserver?.disconnect()
      instance?.cleanup()
    }
  }, [color, completed, noAnimation])

  return (
    <span className="relative block h-14 w-14 shrink-0" aria-hidden="true">
      <canvas ref={canvas} className="absolute inset-0 h-full w-full" style={{ visibility: ready ? 'visible' : 'hidden' }} />
      {!ready && <img src={fallback} alt="" className="h-full w-full object-contain" />}
    </span>
  )
}
