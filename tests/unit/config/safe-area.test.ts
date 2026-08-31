/**
 * Safe-area CONSISTENCY testi (2026-09-01 APK/TG fullscreen incident).
 *
 * Muammo: APK edge-to-edge (targetSdk 36) va Telegram fullscreen'da WebView
 * tizim status bar + TG floating tugmalari ostiga chiziladi. `body` padding-top
 * (--safe-top-body) oddiy sahifalarni qoplaydi, lekin FIXED/STICKY TEPA
 * elementlar viewport'ga nisbatan joylashadi — ular alohida --safe-top
 * ishlatishi SHART. `.safe-top` class'i bir paytlar index.css'da YARATILMAY
 * qolgan edi (o'lik class) — ModesSheet/AchievementsScreen headerlari
 * status bar ostida qolib ketdi.
 *
 * Qoidalar:
 *  1. `fixed`/`sticky` bilan bir qatorda LITERAL `top-N` (top-0, top-4, ...)
 *     ishlatish TAQIQLANADI — `top-[var(--safe-top...)]` / `top-[calc(...safe-top...)]`
 *     ishlating (literal top-N env/TG inset'ni hisobga olmaydi).
 *  2. index.css'da `--safe-top`, `--safe-top-body` va `.safe-top` class'i
 *     MAVJUD bo'lishi shart (o'lik class regression himoyasi).
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const SRC = path.resolve(__dirname, '../../../src')

function* walk(dir: string): Generator<string> {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) yield* walk(p)
    else if (/\.(ts|tsx)$/.test(e.name)) yield p
  }
}

const violations: string[] = []

for (const f of walk(SRC)) {
  const lines = fs.readFileSync(f, 'utf8').split('\n')
  lines.forEach((line, i) => {
    if (!/\b(?:fixed|sticky)\b/.test(line)) return
    // Literal top-N utility (top-0, top-2, top-4...) — top-1/2 (fraction) va
    // top-[...] (arbitrary, safe-top'li) o'tib ketadi
    if (/\btop-\d+\b/.test(line) && !line.includes('safe-top')) {
      violations.push(`${path.relative(SRC, f)}:${i + 1}: ${line.trim().slice(0, 100)}`)
    }
  })
}

describe('safe-area qoidalari (APK edge-to-edge + TG fullscreen)', () => {
  it('fixed/sticky tepa elementlarda literal top-N yo\'q (var(--safe-top) shart)', () => {
    expect(violations, violations.join('\n')).toEqual([])
  })

  it('index.css\'da --safe-top tizimi MAVJUD (o\'lik .safe-top class regression)', () => {
    const css = fs.readFileSync(path.join(SRC, 'index.css'), 'utf8')
    expect(css).toContain('--safe-top:')
    expect(css).toContain('--safe-top-body:')
    expect(css).toMatch(/\.safe-top\s*\{/)
    expect(css).toContain('body { padding-top: var(--safe-top-body')
  })
})
