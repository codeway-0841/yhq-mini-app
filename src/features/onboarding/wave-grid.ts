/**
 * KIVVI — Organic Wavy Mesh Grid (Canvas 2D).
 *
 * Referens (video): ilova splash ekranida ko'k fon ustidagi to'r kataklar
 * suv to'lqini / 3D mato kabi elastik, silliq va organik to'lqinlanadi.
 *
 * Arxitektura va Invariantlar:
 * - 60 FPS silliqlik: to'g'ri chiziqlar o'rniga midpoint quadratic Bezier egri chiziqlari.
 * - Retina / High-DPR: canvas o'lchami dpr bilan masshtablanadi (max 2.5 — batareyani tejash).
 * - Boshlang'ich siljish (elapsedMs): HTML loader boshlagan vaqt bilan uzluksiz sinxronlashadi.
 * - Prefers-reduced-motion: harakat cheklangan bo'lsa bitta statik nafis kadr chizib to'xtaydi.
 * - Xotira va batareya: document yashiringanda loop to'xtaydi, unmount'da raf to'liq tozalanadi.
 */

export interface WaveGridOptions {
  startTimeMs?: number
  reducedMotion?: boolean
}

export function initWaveGrid(canvas: HTMLCanvasElement, options: WaveGridOptions = {}): () => void {
  const ctx = canvas.getContext('2d')
  if (!ctx) return () => {}

  let rafId = 0
  let isRunning = true
  let width = 0
  let height = 0
  let dpr = 1

  const startTimeMs = typeof options.startTimeMs === 'number' && Number.isFinite(options.startTimeMs)
    ? options.startTimeMs
    : performance.now()

  const reducedMotion = options.reducedMotion ?? (
    typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )

  function resize() {
    const rect = canvas.getBoundingClientRect()
    width = Math.max(rect.width, 1)
    height = Math.max(rect.height, 1)
    dpr = Math.min(window.devicePixelRatio || 1, 2.5)

    canvas.width = Math.floor(width * dpr)
    canvas.height = Math.floor(height * dpr)
  }

  resize()

  let ro: ResizeObserver | null = null
  if (typeof ResizeObserver !== 'undefined') {
    ro = new ResizeObserver(() => {
      resize()
      if (reducedMotion) drawFrame(0)
    })
    ro.observe(canvas)
  } else {
    window.addEventListener('resize', resize)
  }

  function drawFrame(elapsedSec: number) {
    if (!ctx) return
    ctx.save()
    ctx.scale(dpr, dpr)
    ctx.clearRect(0, 0, width, height)

    // Mobil ekranda ~7-8 ta ustun (48px - 54px qadami)
    const step = Math.max(46, Math.min(54, width / 7.5))
    const pad = step * 1.5

    const cols = Math.ceil((width + pad * 2) / step) + 1
    const rows = Math.ceil((height + pad * 2) / step) + 1
    const startX = -pad
    const startY = -pad

    // 2D nuqtalar massivi
    const pts: { x: number; y: number }[][] = new Array(rows)

    const cx = width * 0.5
    const cy = height * 0.45

    for (let j = 0; j < rows; j++) {
      const row = new Array(cols)
      const y0 = startY + j * step
      for (let i = 0; i < cols; i++) {
        const x0 = startX + i * step

        // 3D garmonik to'lqin formulasi
        // To'lqin 1: diagonal yo'nalishli asosiy to'lqin
        const th1 = x0 * 0.016 + y0 * 0.011 - elapsedSec * 1.65
        const w1 = Math.sin(th1) * 8.5

        // To'lqin 2: qarama-qarshi o'zaro ta'sir rippli
        const th2 = -x0 * 0.012 + y0 * 0.019 + elapsedSec * 1.25
        const w2 = Math.cos(th2) * 5.5

        // To'lqin 3: markazdan tarqaluvchi radial pulsatsiya
        const dxCenter = x0 - cx
        const dyCenter = y0 - cy
        const dist = Math.hypot(dxCenter, dyCenter)
        const th3 = dist * 0.015 - elapsedSec * 1.9
        const w3 = Math.sin(th3) * 4.0

        const normFactor = dist > 1 ? 1 / dist : 0
        const px = x0 + Math.cos(x0 * 0.009 + elapsedSec * 1.1) * (w1 * 0.35) + dxCenter * normFactor * w3
        const py = y0 + w1 + w2 + dyCenter * normFactor * w3

        row[i] = { x: px, y: py }
      }
      pts[j] = row
    }

    ctx.beginPath()

    // Gorizontal egri chiziqlar (C1-smooth quadratic splines)
    for (let j = 0; j < rows; j++) {
      const row = pts[j]
      ctx.moveTo(row[0].x, row[0].y)
      for (let i = 0; i < cols - 1; i++) {
        const curr = row[i]
        const next = row[i + 1]
        const mx = (curr.x + next.x) * 0.5
        const my = (curr.y + next.y) * 0.5
        ctx.quadraticCurveTo(curr.x, curr.y, mx, my)
      }
      const last = row[cols - 1]
      ctx.lineTo(last.x, last.y)
    }

    // Vertikal egri chiziqlar (C1-smooth quadratic splines)
    for (let i = 0; i < cols; i++) {
      ctx.moveTo(pts[0][i].x, pts[0][i].y)
      for (let j = 0; j < rows - 1; j++) {
        const curr = pts[j][i]
        const next = pts[j + 1][i]
        const mx = (curr.x + next.x) * 0.5
        const my = (curr.y + next.y) * 0.5
        ctx.quadraticCurveTo(curr.x, curr.y, mx, my)
      }
      const last = pts[rows - 1][i]
      ctx.lineTo(last.x, last.y)
    }

    // Chiziq rangi va qalinligi (videodagi yarim shaffof oq)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)'
    ctx.lineWidth = 1.25
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.stroke()

    ctx.restore()
  }

  if (reducedMotion) {
    drawFrame(0)
    return () => {
      isRunning = false
      if (ro) ro.disconnect()
      else window.removeEventListener('resize', resize)
    }
  }

  function loop(now: number) {
    if (!isRunning) return
    const elapsedSec = (now - startTimeMs) / 1000
    drawFrame(elapsedSec)
    rafId = requestAnimationFrame(loop)
  }

  function handleVisibilityChange() {
    if (document.hidden) {
      cancelAnimationFrame(rafId)
    } else if (isRunning) {
      rafId = requestAnimationFrame(loop)
    }
  }

  document.addEventListener('visibilitychange', handleVisibilityChange)
  rafId = requestAnimationFrame(loop)

  return () => {
    isRunning = false
    cancelAnimationFrame(rafId)
    document.removeEventListener('visibilitychange', handleVisibilityChange)
    if (ro) ro.disconnect()
    else window.removeEventListener('resize', resize)
  }
}
