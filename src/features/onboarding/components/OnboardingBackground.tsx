import { useEffect, useRef } from 'react'
import { initWaveGrid } from '../wave-grid'

/**
 * Onboarding foni — 2026-10 qarori: **splash palitrasi** (brend elektr ko'k
 * radial gradient) + splash bilan bir xil animatsiyali to'lqinli to'r.
 *
 * Shu tufayli launch → onboarding bitta sahnada davom etadi: rang sakrashi
 * yo'q, to'r to'xtamaydi (canvas #root'dan tashqarida ham shu lib bilan
 * chiziladi), faqat mazmun almashadi.
 *
 * `dim` — sync bosqichida ekran biroz chuqurlashadi.
 * `grid` — tanlov ekranlarida to'r va RAF o'chadi (matn tiqinligi/batareya).
 */
export function OnboardingBackground({
  dim = false,
  grid = false,
}: {
  dim?: boolean
  grid?: boolean
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !grid) return
    const cleanup = initWaveGrid(canvas)
    return cleanup
  }, [grid])

  return (
    <div
      className="ob-bg"
      data-dim={dim ? 'true' : 'false'}
      data-grid={grid ? 'true' : 'false'}
      aria-hidden="true"
    >
      <div className="ob-bg-wave">
        <canvas ref={canvasRef} className="block size-full" />
      </div>
      <div className="ob-bg-dim" />
    </div>
  )
}
