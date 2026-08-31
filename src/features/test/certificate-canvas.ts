/**
 * Certificate Canvas Generator (Item 39 & 48)
 *
 * Imtihonni muvaffaqiyatli topshirgan foydalanuvchilar uchun
 * yuqori sifatli (1200x850 retina) rasmiy sertifikat generatsiya qiladi.
 */

export interface CertificateData {
  userName: string
  subjectName: string
  score: number
  total: number
  percent: number
  date: string
  certId: string
  lang?: 'uz' | 'ru'
}

export function drawCertificate(canvas: HTMLCanvasElement, data: CertificateData): void {
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const W = 1200
  const H = 850
  canvas.width = W
  canvas.height = H

  // 1. Background gradient
  const bgGrad = ctx.createRadialGradient(W / 2, H / 2, 100, W / 2, H / 2, 700)
  bgGrad.addColorStop(0, '#151d30')
  bgGrad.addColorStop(1, '#090d16')
  ctx.fillStyle = bgGrad
  ctx.fillRect(0, 0, W, H)

  // 2. Luxury outer border (Gold)
  ctx.strokeStyle = '#d97706'
  ctx.lineWidth = 4
  ctx.strokeRect(30, 30, W - 60, H - 60)

  ctx.strokeStyle = '#f59e0b'
  ctx.lineWidth = 1.5
  ctx.strokeRect(40, 40, W - 80, H - 80)

  // Subtle inner panel
  ctx.fillStyle = 'rgba(255, 255, 255, 0.02)'
  ctx.fillRect(45, 45, W - 90, H - 90)

  // Corner ornaments
  const drawCorner = (x: number, y: number, angle: number) => {
    ctx.save()
    ctx.translate(x, y)
    ctx.rotate((angle * Math.PI) / 180)
    ctx.strokeStyle = '#fbbf24'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(0, 0)
    ctx.lineTo(25, 0)
    ctx.moveTo(0, 0)
    ctx.lineTo(0, 25)
    ctx.stroke()

    ctx.fillStyle = '#fbbf24'
    ctx.beginPath()
    ctx.arc(6, 6, 3, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }

  drawCorner(46, 46, 0)
  drawCorner(W - 46, 46, 90)
  drawCorner(W - 46, H - 46, 180)
  drawCorner(46, H - 46, 270)

  // 3. Top branding: KIVVI
  ctx.textAlign = 'center'
  ctx.fillStyle = '#fbbf24'
  ctx.font = 'bold 15px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  ctx.letterSpacing = '4px'
  ctx.fillText('★  KIVVI O‘QUV PLATFORMASI  ★', W / 2, 90)

  // 4. Main Certificate Title
  ctx.letterSpacing = '2px'
  ctx.font = '900 36px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  const titleGrad = ctx.createLinearGradient(W / 2 - 250, 0, W / 2 + 250, 0)
  titleGrad.addColorStop(0, '#fef08a')
  titleGrad.addColorStop(0.5, '#f59e0b')
  titleGrad.addColorStop(1, '#fef08a')
  ctx.fillStyle = titleGrad

  const isRu = data.lang === 'ru'
  const mainTitle = isRu ? 'СЕРТИФИКАТ УСПЕШНОЙ СДАЧИ' : 'RASMIY BILIM SERTIFIKATI'
  ctx.fillText(mainTitle, W / 2, 150)

  // Divider line under title
  ctx.strokeStyle = 'rgba(245, 158, 11, 0.4)'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(W / 2 - 180, 175)
  ctx.lineTo(W / 2 + 180, 175)
  ctx.stroke()

  // 5. "This certifies that" text
  ctx.letterSpacing = '0px'
  ctx.fillStyle = '#94a3b8'
  ctx.font = '500 17px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  ctx.fillText(isRu ? 'Настоящий сертификат подтверждает, что' : 'Ushbu sertifikat tasdiqlaydi,', W / 2, 230)

  // 6. Recipient Name
  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 44px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  const cleanName = data.userName?.trim() || (isRu ? 'Пользователь' : 'Haydovchi')
  ctx.fillText(cleanName, W / 2, 305)

  // Underline under user name
  ctx.strokeStyle = '#d97706'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(W / 2 - 220, 330)
  ctx.lineTo(W / 2 + 220, 330)
  ctx.stroke()

  // 7. Statement description
  ctx.fillStyle = '#cbd5e1'
  ctx.font = '19px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  const descLine1 = isRu
    ? `успешно завершил(а) курс и сдал(а) финальный экзамен по направлению:`
    : `bo'yicha o'quv dasturini yakunlab, yakuniy imtihon sinovini muvaffaqiyatli topshirdi:`
  ctx.fillText(descLine1, W / 2, 385)

  // Subject title pill
  ctx.fillStyle = '#22c55e'
  ctx.font = 'bold 28px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  ctx.fillText(`« ${data.subjectName.toUpperCase()} »`, W / 2, 435)

  // 8. Result Card / Stats Row
  const cardY = 490
  const cardW = 560
  const cardH = 80
  const cardX = (W - cardW) / 2

  ctx.fillStyle = 'rgba(255, 255, 255, 0.04)'
  ctx.strokeStyle = 'rgba(245, 158, 11, 0.3)'
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.roundRect(cardX, cardY, cardW, cardH, 16)
  ctx.fill()
  ctx.stroke()

  // Score stats inside card
  ctx.textAlign = 'left'
  ctx.fillStyle = '#94a3b8'
  ctx.font = '14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  ctx.fillText(isRu ? 'ТОЧНОСТЬ:' : 'NATIJA:', cardX + 30, cardY + 34)

  ctx.fillStyle = '#22c55e'
  ctx.font = 'bold 24px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  ctx.fillText(`${data.percent}% (${data.score}/${data.total})`, cardX + 30, cardY + 62)

  ctx.textAlign = 'right'
  ctx.fillStyle = '#94a3b8'
  ctx.font = '14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  ctx.fillText(isRu ? 'СТАТУС:' : 'HOLAT:', cardX + cardW - 30, cardY + 34)

  ctx.fillStyle = '#f59e0b'
  ctx.font = 'bold 22px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  ctx.fillText(isRu ? '✓ СДАНО' : '✓ TOPSHIRILDI', cardX + cardW - 30, cardY + 62)

  // 9. Golden Seal (Center bottom)
  const sealX = W / 2
  const sealY = 675
  const sealR = 48

  // Outer glowing seal
  ctx.strokeStyle = '#d97706'
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.arc(sealX, sealY, sealR, 0, Math.PI * 2)
  ctx.stroke()

  ctx.strokeStyle = '#fbbf24'
  ctx.lineWidth = 1.5
  ctx.setLineDash([4, 4])
  ctx.beginPath()
  ctx.arc(sealX, sealY, sealR - 6, 0, Math.PI * 2)
  ctx.stroke()
  ctx.setLineDash([])

  ctx.fillStyle = 'rgba(245, 158, 11, 0.12)'
  ctx.fill()

  ctx.textAlign = 'center'
  ctx.fillStyle = '#fbbf24'
  ctx.font = 'bold 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  ctx.fillText('★  ★  ★', sealX, sealY - 14)
  ctx.font = '900 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  ctx.fillText('TASDIQLANGAN', sealX, sealY + 6)
  ctx.font = 'bold 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  ctx.fillText('KIVVI VERIFIED', sealX, sealY + 22)

  // 10. Left: Date of issuance
  ctx.textAlign = 'left'
  ctx.fillStyle = '#64748b'
  ctx.font = '13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  ctx.fillText(isRu ? 'Дата выдачи:' : 'Berilgan sana:', 90, 680)

  ctx.fillStyle = '#cbd5e1'
  ctx.font = 'bold 16px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  ctx.fillText(data.date, 90, 706)

  // 11. Right: Certificate ID & Verification
  ctx.textAlign = 'right'
  ctx.fillStyle = '#64748b'
  ctx.font = '13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  ctx.fillText(isRu ? 'ID Сертификата:' : 'Sertifikat ID:', W - 90, 680)

  ctx.fillStyle = '#fbbf24'
  ctx.font = 'bold 15px monospace'
  ctx.fillText(data.certId, W - 90, 706)

  // 12. Bottom tiny disclaimer
  ctx.textAlign = 'center'
  ctx.fillStyle = '#475569'
  ctx.font = '12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  ctx.fillText(
    isRu
      ? 'Проверено цифровой системой KIVVI · t.me/kiwi_uz_bot'
      : 'KIVVI raqamli o‘quv tizimi orqali tasdiqlangan · t.me/kiwi_uz_bot',
    W / 2,
    785,
  )
}
