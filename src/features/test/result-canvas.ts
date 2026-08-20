/**
 * Result Card Canvas Generator (FIXPLAN #48)
 *
 * Test/imtihon natijasini kvadrat (1080x1080) "story" formatdagi shareable
 * karta qilib chizadi — Telegram status/chatga rasm sifatida tashlash uchun.
 * Sertifikat (certificate-canvas.ts)dan farqi: bu RASM HAR QANDAY natijada
 * (o'tdi/o'tmadi), branding va virusli referal CTA markazda.
 */

export interface ResultCardData {
  userName: string
  subjectName: string
  correct: number
  wrong: number
  unanswered: number
  total: number
  percent: number
  passed: boolean
  streak: number
  date: string
  lang?: 'uz' | 'ru'
}

/** Sof share matni — Web Share va shareUrl fallback ikkalasida ham ishlatiladi. */
export function buildResultShareText(d: Pick<ResultCardData, 'correct' | 'total' | 'percent' | 'passed' | 'streak' | 'lang'>): string {
  const isRu = d.lang === 'ru'
  const emoji = d.passed ? '🏆' : '💪'
  const base = isRu
    ? `${emoji} Мой результат в KIWI: ${d.percent}% (правильно ${d.correct}/${d.total})`
    : `${emoji} KIWI'dagi natijam: ${d.percent}% (to'g'ri ${d.correct}/${d.total})`
  const streak = d.streak > 1
    ? (isRu ? `\n🔥 Серия: ${d.streak} дн. подряд!` : `\n🔥 Seriya: ${d.streak} kun ketma-ket!`)
    : ''
  const cta = isRu ? '\nПопробуй и ты:' : "\nSan ham sinab ko'r:"
  return base + streak + cta
}

const FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'

export function drawResultCard(canvas: HTMLCanvasElement, data: ResultCardData): void {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const isRu = data.lang === 'ru'

  const S = 1080
  canvas.width = S
  canvas.height = S

  // 1. Background — to'q radial gradient
  const bg = ctx.createRadialGradient(S / 2, S * 0.36, 80, S / 2, S / 2, 900)
  bg.addColorStop(0, '#16203a')
  bg.addColorStop(1, '#070b13')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, S, S)

  // 2. Dekorativ ramka
  ctx.strokeStyle = data.passed ? 'rgba(34, 197, 94, 0.45)' : 'rgba(245, 158, 11, 0.35)'
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.roundRect(36, 36, S - 72, S - 72, 40)
  ctx.stroke()

  // 3. Brand
  ctx.textAlign = 'center'
  ctx.fillStyle = '#fbbf24'
  ctx.font = `bold 30px ${FONT}`
  ctx.fillText('★  K I W I  ★', S / 2, 120)

  ctx.fillStyle = '#94a3b8'
  ctx.font = `500 26px ${FONT}`
  ctx.fillText(isRu ? 'МОЙ РЕЗУЛЬТАТ' : 'MENING NATIJAM', S / 2, 168)

  // 4. Donut — progress ring
  const cx = S / 2
  const cy = 420
  const r = 170
  const ringColor = data.passed ? '#22c55e' : data.percent >= 50 ? '#f59e0b' : '#ef4444'

  ctx.lineCap = 'round'
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.15)'
  ctx.lineWidth = 30
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.stroke()

  ctx.strokeStyle = ringColor
  ctx.beginPath()
  ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * data.percent) / 100)
  ctx.stroke()

  // Foiz markazda
  ctx.fillStyle = '#ffffff'
  ctx.font = `900 110px ${FONT}`
  ctx.fillText(`${data.percent}%`, cx, cy + 10)
  ctx.fillStyle = '#94a3b8'
  ctx.font = `bold 30px ${FONT}`
  ctx.fillText(`${data.correct}/${data.total}`, cx, cy + 62)

  // 5. Status pill
  const statusText = data.passed ? (isRu ? '✓ СДАНО' : '✓ TOPSHIRILDI') : (isRu ? 'ЕЩЁ РАЗ!' : 'YANA URINIB KO‘R!')
  ctx.fillStyle = ringColor
  ctx.font = `900 34px ${FONT}`
  ctx.fillText(statusText, cx, 700)

  // 6. Ism + fan
  ctx.fillStyle = '#ffffff'
  ctx.font = `bold 44px ${FONT}`
  const name = data.userName.trim() || (isRu ? 'Пользователь KIWI' : 'KIWI foydalanuvchisi')
  ctx.fillText(name.length > 26 ? `${name.slice(0, 25)}…` : name, cx, 790)

  ctx.fillStyle = '#cbd5e1'
  ctx.font = `500 30px ${FONT}`
  ctx.fillText(`« ${data.subjectName} »`, cx, 842)

  // 7. Stats uchligi
  const statY = 940
  const colW = 260
  const xs = [cx - colW, cx, cx + colW]
  const vals = [
    { n: data.correct, l: isRu ? 'верно' : "to'g'ri", c: '#22c55e' },
    { n: data.wrong, l: isRu ? 'ошибок' : 'xato', c: '#ef4444' },
    { n: data.unanswered, l: isRu ? 'пропущено' : 'javobsiz', c: '#94a3b8' },
  ]
  vals.forEach((v, i) => {
    ctx.fillStyle = v.c
    ctx.font = `900 52px ${FONT}`
    ctx.fillText(String(v.n), xs[i], statY)
    ctx.fillStyle = '#94a3b8'
    ctx.font = `500 24px ${FONT}`
    ctx.fillText(v.l, xs[i], statY + 38)
  })

  // 8. Streak pill (agar bor bo'lsa)
  if (data.streak > 1) {
    const txt = `🔥 ${data.streak} ${isRu ? 'дн. подряд' : 'kun ketma-ket'}`
    ctx.font = `bold 30px ${FONT}`
    const w = ctx.measureText(txt).width + 56
    ctx.fillStyle = 'rgba(245, 158, 11, 0.15)'
    ctx.strokeStyle = 'rgba(245, 158, 11, 0.5)'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.roundRect(cx - w / 2, 884, w, 56, 28)
    ctx.fill()
    ctx.stroke()
    ctx.fillStyle = '#fbbf24'
    ctx.textBaseline = 'middle'
    ctx.fillText(txt, cx, 913)
    ctx.textBaseline = 'alphabetic'
  }

  // 9. Footer — sana + referal CTA
  ctx.fillStyle = '#64748b'
  ctx.font = `24px ${FONT}`
  ctx.fillText(data.date, cx, S - 104)
  ctx.fillStyle = '#fbbf24'
  ctx.font = `bold 26px ${FONT}`
  ctx.fillText(isRu ? 'Проверь себя → t.me/kiwi_uz_bot' : 'O‘zingni sinab ko‘r → t.me/kiwi_uz_bot', cx, S - 62)
}
