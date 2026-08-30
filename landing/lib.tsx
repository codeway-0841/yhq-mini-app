/** Landing uchun umumiy UI utilitalar — reveal, spotlight, count-up, 3D tilt. */
import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type MouseEvent as ReactMouseEvent,
} from 'react'

/** Scroll'da bir marta ochiladigan reveal wrapper. */
export function Reveal({
  children,
  delay = 0,
  className = '',
}: {
  children: ReactNode
  delay?: number
  className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [on, setOn] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (typeof IntersectionObserver === 'undefined') {
      setOn(true)
      return
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setOn(true)
          io.disconnect()
        }
      },
      { threshold: 0.15, rootMargin: '0px 0px -8% 0px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  return (
    <div
      ref={ref}
      style={{ '--d': `${delay}ms` } as CSSProperties}
      className={`rv ${on ? 'on' : ''} ${className}`}
    >
      {children}
    </div>
  )
}

/** Spotlight kartalar uchun — kursor pozitsiyasini CSS var'ga yozadi. */
export function spot(e: ReactMouseEvent<HTMLElement>) {
  const el = e.currentTarget
  const r = el.getBoundingClientRect()
  el.style.setProperty('--mx', `${e.clientX - r.left}px`)
  el.style.setProperty('--my', `${e.clientY - r.top}px`)
}

/** Ko'rinib qolganda raqamni 0'dan target'gacha sanaydi (easeOutCubic). */
export function useCountUp(target: number, duration = 1400) {
  const ref = useRef<HTMLSpanElement>(null)
  const [val, setVal] = useState(0)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (typeof IntersectionObserver === 'undefined') {
      setVal(target)
      return
    }
    let raf = 0
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) return
        io.disconnect()
        const start = performance.now()
        const tick = (now: number) => {
          const p = Math.min(1, (now - start) / duration)
          const eased = 1 - Math.pow(1 - p, 3)
          setVal(Math.round(target * eased))
          if (p < 1) raf = requestAnimationFrame(tick)
        }
        raf = requestAnimationFrame(tick)
      },
      { threshold: 0.4 },
    )
    io.observe(el)
    return () => {
      io.disconnect()
      cancelAnimationFrame(raf)
    }
  }, [target, duration])

  return { ref, val }
}

/**
 * Hero telefon uchun sichqoncha-kuzatuvli 3D tilt.
 * Sichqoncha section ustida harakatlanganda obyekt rotateX/rotateY qiladi
 * (lerp bilan yumshatilgan). Touch qurilmalarda va reduced-motion'da no-op.
 */
export function useTilt(maxDeg = 9) {
  const sceneRef = useRef<HTMLDivElement>(null)
  const objRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const scene = sceneRef.current
    const obj = objRef.current
    if (!scene || !obj) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    if (window.matchMedia('(pointer: coarse)').matches) return

    let rx = 0
    let ry = 0
    let tx = 0
    let ty = 0
    let raf = 0

    const onMove = (e: MouseEvent) => {
      const r = scene.getBoundingClientRect()
      const px = (e.clientX - r.left) / r.width - 0.5
      const py = (e.clientY - r.top) / r.height - 0.5
      tx = px * maxDeg
      ty = -py * maxDeg
    }
    const onLeave = () => {
      tx = 0
      ty = 0
    }
    const loop = () => {
      rx += (ty - rx) * 0.07
      ry += (tx - ry) * 0.07
      obj.style.transform = `rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg)`
      raf = requestAnimationFrame(loop)
    }

    scene.addEventListener('mousemove', onMove)
    scene.addEventListener('mouseleave', onLeave)
    raf = requestAnimationFrame(loop)
    return () => {
      scene.removeEventListener('mousemove', onMove)
      scene.removeEventListener('mouseleave', onLeave)
      cancelAnimationFrame(raf)
    }
  }, [maxDeg])

  return { sceneRef, objRef }
}
