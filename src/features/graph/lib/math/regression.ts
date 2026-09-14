/**
 * Eng kichik kvadratlar — chiziqli regression (lab rejimi).
 *
 * Nuqtalar o'lchov natijalari sifatida kiritiladi; qiyalik (k) fizikada
 * ko'pincha izlanayotgan kattalik (masalan v = s/t grafigidagi tezlik).
 * Vertikal holat (barcha x bir xil) alohida belgilanadi.
 */
export interface RegressionResult {
  slope: number
  intercept: number
  /** Determinatsiya koeffitsienti (0..1); hisoblab bo'lmasa NaN */
  r2: number
  /** Barcha x bir xil — vertikal chiziq (x = intercept) */
  vertical: boolean
  n: number
}

export function linearRegression(points: { x: number; y: number }[]): RegressionResult | null {
  const pts = points.filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y))
  const n = pts.length
  if (n < 2) return null

  const meanX = pts.reduce((s, p) => s + p.x, 0) / n
  const meanY = pts.reduce((s, p) => s + p.y, 0) / n

  let sxx = 0
  let syy = 0
  let sxy = 0
  for (const p of pts) {
    const dx = p.x - meanX
    const dy = p.y - meanY
    sxx += dx * dx
    syy += dy * dy
    sxy += dx * dy
  }

  if (sxx <= 1e-12 * Math.max(1, syy)) {
    return { slope: Infinity, intercept: meanX, r2: NaN, vertical: true, n }
  }

  const slope = sxy / sxx
  const intercept = meanY - slope * meanX
  const r2 = syy <= 1e-12 ? (sxy === 0 ? 1 : NaN) : (sxy * sxy) / (sxx * syy)

  return { slope, intercept, r2, vertical: false, n }
}

/** Regression to'g'ri chizig'idan bashorat */
export function forecast(result: RegressionResult, x: number): number {
  if (result.vertical) return NaN
  return result.slope * x + result.intercept
}
