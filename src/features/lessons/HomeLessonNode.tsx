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

export function HomeLessonNode({
  color,
  fallback,
  completed = false,
  locked = false,
  level = false,
  selected,
}: {
  color: number
  fallback: string
  completed?: boolean
  locked?: boolean
  level?: boolean
  selected?: boolean
}) {
  const effectiveSelected = selected ?? (!completed && !locked)
  const canvas = useRef<HTMLCanvasElement>(null)
  const inputsRef = useRef<StateMachineInput[]>([])
  const latestRef = useRef({ color, completed, locked, level, selected: effectiveSelected })
  latestRef.current = { color, completed, locked, level, selected: effectiveSelected }

  const noAnimation = useAppStore((state) => state.settings.noAnimation)
  const [ready, setReady] = useState(false)

  const setInput = (name: string, value: boolean | number) => {
    const input = inputsRef.current.find((item) => item.name === name)
    if (input) input.value = value
  }

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
          inputsRef.current = inputs
          const set = (name: string, value: boolean | number) => {
            const input: StateMachineInput | undefined = inputs.find((item) => item.name === name)
            if (input) input.value = value
          }
          const updateTheme = () => set('dark-mode', document.body.dataset.theme === 'dark')
          updateTheme()
          themeObserver = new MutationObserver(updateTheme)
          themeObserver.observe(document.body, { attributes: true, attributeFilter: ['data-theme'] })
          const s = latestRef.current
          set('color', s.color)
          set('level', s.level)
          set('padlock', !s.completed && s.locked)
          set('completed', s.completed)
          set('icon', s.completed && !s.level ? 1 : 0)
          set('select', s.selected)
          set('hover', false)
          resize()
          frame = requestAnimationFrame(() => {
            frame = requestAnimationFrame(() => {
              if (disposed) return
              if (!latestRef.current.completed && !latestRef.current.locked) {
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
      inputsRef.current = []
      if (frame) cancelAnimationFrame(frame)
      resizeObserver?.disconnect()
      themeObserver?.disconnect()
      instance?.cleanup()
    }
  }, [noAnimation])

  useEffect(() => {
    if (!inputsRef.current.length) return
    const id = requestAnimationFrame(() => {
      try {
        setInput('color', color)
        setInput('level', level)
        setInput('padlock', !completed && locked)
        setInput('completed', completed)
        setInput('icon', completed && !level ? 1 : 0)
        setInput('select', effectiveSelected)
      } catch { /* ignore */ }
    })
    return () => cancelAnimationFrame(id)
  }, [color, completed, locked, level, effectiveSelected])

  return (
    <span
      className="relative block h-14 w-14 shrink-0"
      aria-hidden="true"
      onPointerEnter={() => setInput('hover', true)}
      onPointerLeave={() => setInput('hover', false)}
    >
      <canvas ref={canvas} className="absolute inset-0 h-full w-full" style={{ visibility: ready ? 'visible' : 'hidden' }} />
      {!ready && <img src={fallback} alt="" className="h-full w-full object-contain" />}
    </span>
  )
}
