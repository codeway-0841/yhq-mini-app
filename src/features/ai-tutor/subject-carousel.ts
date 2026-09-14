/**
 * Kamera fan karuseli yordamchisi (SnapSolveHub).
 *
 * Karusel Snapchat/Instagram rejim tanlagichi kabi ishlaydi: foydalanuvchi
 * gorizontal suraganda (swipe) markazga kelgan fan AVTOMATIK tanlanadi —
 * har birini alohida bosish shart emas. `nearestCenterIndex` sof funksiya
 * (jsdom'da layout bo'lmagani uchun deterministik test shu orqali).
 */
export function nearestCenterIndex(centers: number[], viewportCenter: number): number {
  if (centers.length === 0) return -1
  let best = 0
  let bestDist = Math.abs(centers[0] - viewportCenter)
  for (let i = 1; i < centers.length; i++) {
    const d = Math.abs(centers[i] - viewportCenter)
    if (d < bestDist) {
      best = i
      bestDist = d
    }
  }
  return best
}
