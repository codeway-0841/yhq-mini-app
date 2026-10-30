import { useEffect, useRef, useState } from 'react'
import type { Rive, StateMachineInput } from '@rive-app/webgl2-course'
import { useAppStore } from '../../shared/store/useAppStore'
import { PathMascot } from '../lessons'

const NODE_RIVE = '/darslik-map/koji-gameboard.riv'
const MACHINE = 'node_all'
let nodeBuffer: Promise<ArrayBuffer> | null = null

function getNodeBuffer() {
  if (!nodeBuffer) {
    nodeBuffer = fetch(NODE_RIVE).then((response) => {
      if (!response.ok) throw new Error(`Course node: HTTP ${response.status}`)
      return response.arrayBuffer()
    }).catch((error: unknown) => {
      nodeBuffer = null
      throw error
    })
  }
  return nodeBuffer
}

function isDarkTheme() {
  const theme = document.body.dataset.theme || document.documentElement.dataset.theme
  return theme ? theme === 'dark' : window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false
}

function setInput(inputs: StateMachineInput[], name: string, value: boolean | number) {
  const input = inputs.find((item) => item.name === name)
  if (input) input.value = value
}

/** Only the current and selected nodes mount the Rive animation. */
export function CourseMapNodeArt({ current, src, completed = false, levelReview = false }: {
  current: boolean
  src: string
  completed?: boolean
  levelReview?: boolean
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const noAnimation = useAppStore((state) => state.settings.noAnimation)
  const [reducedMotion, setReducedMotion] = useState(() =>
    typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
  )
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const media = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    if (!media) return
    const update = () => setReducedMotion(media.matches)
    update()
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])

  useEffect(() => {
    setReady(false)
    const canvas = canvasRef.current
    if (!canvas || noAnimation || reducedMotion) return

    let disposed = false
    let instance: Rive | null = null
    let resizeObserver: ResizeObserver | null = null
    let themeObserver: MutationObserver | null = null
    let frame = 0

    void Promise.all([
      import('@rive-app/webgl2-course'),
      import('@rive-app/webgl2-course/rive.wasm?url'),
      import('@rive-app/webgl2-course/rive_fallback.wasm?url'),
      getNodeBuffer(),
    ]).then(([pkg, wasmModule, fallbackWasmModule, buffer]) => {
      if (disposed) return
      const rive = ((pkg as { default?: unknown }).default ?? pkg) as typeof import('@rive-app/webgl2-course')
      rive.RuntimeLoader.setWasmUrl(wasmModule.default)
      rive.RuntimeLoader.setWasmFallbackUrl(fallbackWasmModule.default)
      const resize = () => {
        if (instance && canvas.clientWidth > 0 && canvas.clientHeight > 0) {
          try { instance.resizeDrawingSurfaceToCanvas() } catch { /* Canvas may already be detached. */ }
        }
      }
      instance = new rive.Rive({
        canvas,
        buffer: buffer.slice(0),
        artboard: 'Gameboard Node',
        stateMachine: MACHINE,
        autoplay: true,
        useOffscreenRenderer: true,
        isTouchScrollEnabled: true,
        layout: new rive.Layout({ fit: rive.Fit.Contain, alignment: rive.Alignment.Center }),
        onLoad: () => {
          if (disposed || !instance) return
          const inputs = instance.stateMachineInputs(MACHINE) ?? []
          const updateTheme = () => setInput(inputs, 'dark-mode', isDarkTheme())
          updateTheme()
          setInput(inputs, 'color', 1)
          setInput(inputs, 'level', levelReview)
          setInput(inputs, 'completed', completed)
          setInput(inputs, 'icon', completed ? 1 : 0)
          resize()
          themeObserver = new MutationObserver(updateTheme)
          themeObserver.observe(document.body, { attributes: true, attributeFilter: ['data-theme'] })
          // Rive starts the state machine after onLoad; fire the mascot trigger once it is running.
          frame = window.requestAnimationFrame(() => {
            frame = window.requestAnimationFrame(() => {
              if (disposed) return
              setInput(inputs, 'select', true)
              if (current) inputs.find((input) => input.name === 'koji_appear')?.fire()
              setReady(true)
            })
          })
        },
        onLoadError: () => { if (!disposed) setReady(false) },
      })
      if (typeof ResizeObserver !== 'undefined') {
        resizeObserver = new ResizeObserver(resize)
        resizeObserver.observe(canvas)
      }
    }).catch(() => { if (!disposed) setReady(false) })

    return () => {
      disposed = true
      if (frame) window.cancelAnimationFrame(frame)
      resizeObserver?.disconnect()
      themeObserver?.disconnect()
      instance?.cleanup()
    }
  }, [completed, current, levelReview, noAnimation, reducedMotion])

  return (
    <>
      <canvas ref={canvasRef} className="cmap-node-rive" aria-hidden="true" style={{ visibility: ready ? 'visible' : 'hidden' }} />
      {!ready && <img className="cmap-node-art" src={src} alt="" width={128} height={134} loading="lazy" />}
      {current && !ready && (
        <span className="cmap-node-mascot" aria-hidden="true">
          <PathMascot animation="idle" variant="tile" />
        </span>
      )}
    </>
  )
}
