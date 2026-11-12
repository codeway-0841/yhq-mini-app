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
export function CourseMapNodeArt({
  current,
  src,
  completed = false,
  locked = false,
  selected = true,
  levelReview = false,
  entering = false,
  disappearing = false,
  color = 1,
}: {
  current: boolean
  src: string
  completed?: boolean
  locked?: boolean
  selected?: boolean
  levelReview?: boolean
  entering?: boolean
  disappearing?: boolean
  color?: number
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const inputsRef = useRef<StateMachineInput[]>([])
  const latestRef = useRef({ current, completed, locked, selected, levelReview, entering, disappearing, color })
  latestRef.current = { current, completed, locked, selected, levelReview, entering, disappearing, color }
  const wasEnteringRef = useRef(false)
  const wasDisappearingRef = useRef(false)
  const wasAppearedRef = useRef(false)

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
          inputsRef.current = inputs
          const s = latestRef.current
          const updateTheme = () => setInput(inputs, 'dark-mode', isDarkTheme())
          updateTheme()
          setInput(inputs, 'color', s.color)
          setInput(inputs, 'level', s.levelReview)
          setInput(inputs, 'padlock', !s.completed && s.locked)
          setInput(inputs, 'completed', s.completed)
          setInput(inputs, 'icon', !s.completed && s.locked ? 3 : s.completed && !s.levelReview ? 1 : 0)
          setInput(inputs, 'select', s.selected)
          setInput(inputs, 'hover', false)
          setInput(inputs, 'cursor_down', false)
          setInput(inputs, 'start_idle', false)
          resize()
          themeObserver = new MutationObserver(updateTheme)
          themeObserver.observe(document.body, { attributes: true, attributeFilter: ['data-theme'] })
          // Rive starts the state machine after onLoad; fire the mascot trigger once it is running.
          frame = window.requestAnimationFrame(() => {
            frame = window.requestAnimationFrame(() => {
              if (disposed) return
              const state = latestRef.current
              if (state.entering) {
                const trig = state.current && !state.completed && !state.locked
                  ? 'koji_enter_lesson'
                  : 'koji_appear_enter'
                inputs.find((input) => input.name === trig)?.fire()
                wasEnteringRef.current = true
                wasAppearedRef.current = false
              } else if (state.disappearing) {
                inputs.find((input) => input.name === 'koji_disappear')?.fire()
                wasDisappearingRef.current = true
                wasAppearedRef.current = false
              } else if (state.current && !state.completed && !state.locked) {
                inputs.find((input) => input.name === 'koji_appear')?.fire()
                wasAppearedRef.current = true
              }
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
      inputsRef.current = []
      wasEnteringRef.current = false
      wasDisappearingRef.current = false
      wasAppearedRef.current = false
      if (frame) window.cancelAnimationFrame(frame)
      resizeObserver?.disconnect()
      themeObserver?.disconnect()
      instance?.cleanup()
    }
  }, [noAnimation, reducedMotion])

  useEffect(() => {
    const inputs = inputsRef.current
    if (!inputs.length) return
    const id = window.requestAnimationFrame(() => {
      try {
        setInput(inputs, 'color', color)
        setInput(inputs, 'level', levelReview)
        setInput(inputs, 'padlock', !completed && locked)
        setInput(inputs, 'completed', completed)
        setInput(inputs, 'icon', !completed && locked ? 3 : completed && !levelReview ? 1 : 0)
        setInput(inputs, 'select', selected)
        if (entering && !wasEnteringRef.current) {
          const trig = current && !completed && !locked ? 'koji_enter_lesson' : 'koji_appear_enter'
          inputs.find((input) => input.name === trig)?.fire()
          wasAppearedRef.current = false
        } else if (disappearing && !wasDisappearingRef.current) {
          inputs.find((input) => input.name === 'koji_disappear')?.fire()
          wasAppearedRef.current = false
        } else if (!entering && wasEnteringRef.current && current && !completed && !locked) {
          inputs.find((input) => input.name === 'koji_exit_lesson')?.fire()
          wasAppearedRef.current = true
        } else if (current && !completed && !locked && !disappearing) {
          if (!wasAppearedRef.current) {
            inputs.find((input) => input.name === 'koji_appear')?.fire()
            wasAppearedRef.current = true
          }
        } else if (completed || locked) {
          if (wasAppearedRef.current) {
            inputs.find((input) => input.name === 'koji_disappear')?.fire()
            wasAppearedRef.current = false
          }
        }
        wasEnteringRef.current = entering
        wasDisappearingRef.current = disappearing
      } catch { /* ignore */ }
    })
    return () => window.cancelAnimationFrame(id)
  }, [completed, current, locked, selected, levelReview, entering, disappearing, color])

  return (
    <>
      <canvas
        ref={canvasRef}
        className="cmap-node-rive"
        aria-hidden="true"
        style={{ visibility: ready ? 'visible' : 'hidden' }}
        onPointerEnter={() => setInput(inputsRef.current, 'hover', true)}
        onPointerLeave={() => {
          setInput(inputsRef.current, 'hover', false)
          setInput(inputsRef.current, 'cursor_down', false)
        }}
        onPointerDown={() => setInput(inputsRef.current, 'cursor_down', true)}
        onPointerUp={() => setInput(inputsRef.current, 'cursor_down', false)}
      />
      {!ready && <img className="cmap-node-art" src={src} alt="" width={128} height={134} loading="lazy" />}
      {current && !ready && (
        <span className="cmap-node-mascot" aria-hidden="true">
          <PathMascot animation="idle" variant="tile" />
        </span>
      )}
    </>
  )
}
