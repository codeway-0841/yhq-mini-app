/**
 * vercel.json CSP regression testi — `img-src` ichida `blob:` BO'LISHI SHART.
 *
 * 2026-08-26 incident: CSP hardening (fc21914) `img-src 'self' data: https:`
 * qilib yozilib, `blob:` TUSHIB QOLGAN. useAvatarUpload `URL.createObjectURL(file)`
 * → `<img src="blob:...">` prod'da CSP tomonidan BLOKLANDI (img.onerror) —
 * natijada HAR QANDAY rasm "format qo'llab-quvvatlanmaydi" xatosiga urildi.
 * Lokal dev server CSP yubormagani uchun lokal ishlayverdi — faqat prod sinibdi
 * (2 kun davomida barcha userlarda avatar yuklash o'lgan).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

interface VercelHeader { source: string; headers: Array<{ key: string; value: string }> }

function readCsp(): string {
  const vercel = JSON.parse(readFileSync(resolve(__dirname, '../../../vercel.json'), 'utf8')) as {
    headers: VercelHeader[]
  }
  const global = vercel.headers.find((h) => h.source === '/(.*)')
  const csp = global?.headers.find((h) => h.key === 'Content-Security-Policy')?.value
  if (!csp) throw new Error('vercel.json da global CSP topilmadi')
  return csp
}

describe('config/csp — vercel.json Content-Security-Policy', () => {
  it("img-src blob:'ni o'z ichiga oladi (avatar upload blob: object URL'ga tayanadi)", () => {
    const imgSrc = readCsp().split(';').map((d) => d.trim()).find((d) => d.startsWith('img-src'))
    expect(imgSrc).toBeTruthy()
    expect(imgSrc).toContain('blob:')
  })
})
