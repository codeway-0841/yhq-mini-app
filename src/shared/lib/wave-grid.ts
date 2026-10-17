/**
 * KIVVI — Organic Wavy Mesh Grid (Canvas 2D).
 *
 * Referens (video): ilova splash ekrani va dashboard progress kartasida
 * elektr-ko'k fon ustidagi to'r kataklar suv to'lqini / 3D elastik mato kabi
 * silliq, mayin va organik to'lqinlanadi.
 *
 * Arxitektura va Invariantlar:
 * - 60 FPS silliqlik: to'g'ri chiziqlar o'rniga midpoint quadratic Bezier egri chiziqlari.
 * - Retina / High-DPR: canvas o'lchami dpr bilan masshtablanadi (max 2.5).
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
    const winW = typeof window !== 'undefined' ? window.innerWidth : 390
    const winH = typeof window !== 'undefined' ? window.innerHeight : 844
    width = Math.max(rect.width || winW, 1)
    height = Math.max(rect.height || winH, 1)
    dpr = Math.min(window.devicePixelRatio || 1, 2.5)

    canvas.width = Math.round(width * dpr)
    canvas.height = Math.round(height * dpr)
  }

  resize()

  function drawFrame(elapsedSec: number) {
    if (!ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.save()
    ctx.scale(dpr, dpr)

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

        // Tabiiy, mayin va muvozanatli 3D to'lqin fizikasi
        // Asosiy to'lqin: diagonal oqim
        const th1 = x0 * 0.014 + y0 * 0.016 - elapsedSec * 1.2
        const s1 = Math.sin(th1)
        const c1 = Math.cos(th1)

        // Ikkilamchi mayin to'lqin: ko'ndalang oqim
        const th2 = -x0 * 0.016 + y0 * 0.012 + elapsedSec * 0.95
        const s2 = Math.sin(th2)
        const c2 = Math.cos(th2)

        // Markaziy mayin radial tarqalish
        const dxCenter = x0 - cx
        const dyCenter = y0 - cy
        const dist = Math.hypot(dxCenter, dyCenter)
        const th3 = dist * 0.012 - elapsedSec * 1.1
        const s3 = Math.sin(th3) * 3.5

        const normFactor = dist > 1 ? 1 / dist : 0

        // Gorizontal va vertikal chiziqlar BIR XIL kuchda va silliqlikda to'lqinlanadi
        const px = x0 + s1 * 6.5 + c2 * 4.5 + dxCenter * normFactor * s3
        const py = y0 + c1 * 6.5 + s2 * 4.5 + dyCenter * normFactor * s3

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
    ctx.lineWidth = 1.35
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.stroke()

    ctx.restore()
  }

  // Birinchi kadrni birdanoq sinxron chizib qo'yish
  drawFrame((performance.now() - startTimeMs) / 1000)

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
