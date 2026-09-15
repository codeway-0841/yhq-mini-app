import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

/**
 * Kontrast TOKEN qo'riqchisi (axe e2e gate'ning unit jufti).
 *
 * 2026-09-05 UI audit'i oq-matn/ko'k-tugma 3.75:1 muammosini topgan, ammo
 * tuzatilmagan edi; axe buni qayta ushladi. Bu test default dark/light
 * temalarning KAFOLATLANGAN juftliklarini qo'riqlaydi (WCAG AA 4.5:1).
 *
 * Aksent temalar (13 ta) + psubtle tertiary — alohida backlog (keng
 * migratsiya, dizayner review bilan): ularni BU test qamrab olmaydi.
 */
function lum(hex: string): number {
  const c = hex
    .replace('#', '')
    .match(/../g)!
    .map((x) => parseInt(x, 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)))
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
}

function ratio(a: string, b: string): number {
  const x = lum(a)
  const y = lum(b)
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Bir selektorning BARCHA bloklarini kaskad tartibida merge qiladi
 *  (`:root` va light bloklar CSS'da bir necha joyda e'lon qilingan). */
function blockVars(css: string, selector: string): Record<string, string> {
  const vars: Record<string, string> = {}
  const re = new RegExp(`${escapeRe(selector)}\\s*\\{([^}]*)\\}`, 'g')
  for (const m of css.matchAll(re)) {
    for (const v of m[1].matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
      vars[v[1]] = v[2].trim()
    }
  }
  return vars
}

function hexOf(vars: Record<string, string>, name: string): string {
  const m = /^#[0-9a-fA-F]{6}$/.exec(vars[name] ?? '')
  if (!m) throw new Error(`token topilmadi yoki hex emas: ${name} = ${vars[name]}`)
  return m[0]
}

const css = fs.readFileSync(path.resolve(__dirname, '../../../src/index.css'), 'utf8')
// :root — default dark; body[data-theme='light'] — yorug' (birinchi uchrashuv).
const dark = blockVars(css, ':root')
const light = blockVars(css, "body[data-theme='light']")

describe('kontrast tokenlari (WCAG AA 4.5)', () => {
  it('oq matn asosiy CTA fonida (dark + light)', () => {
    expect(ratio('#ffffff', hexOf(dark, '--p-primary'))).toBeGreaterThanOrEqual(4.5)
    expect(ratio('#ffffff', hexOf(light, '--p-primary'))).toBeGreaterThanOrEqual(4.5)
  })

  it('primary link oq kartada (light)', () => {
    expect(ratio(hexOf(light, '--p-primary'), hexOf(light, '--p-card'))).toBeGreaterThanOrEqual(4.5)
    expect(ratio(hexOf(light, '--p-link'), hexOf(light, '--p-card'))).toBeGreaterThanOrEqual(4.5)
  })

  it('asosiy + ikkilamchi matn o‘z sirtida (dark + light)', () => {
    expect(ratio(hexOf(dark, '--p-fg'), hexOf(dark, '--p-canvas'))).toBeGreaterThanOrEqual(7)
    expect(ratio(hexOf(dark, '--p-muted'), hexOf(dark, '--p-card'))).toBeGreaterThanOrEqual(4.5)
    expect(ratio(hexOf(light, '--p-fg'), hexOf(light, '--p-canvas'))).toBeGreaterThanOrEqual(7)
    expect(ratio(hexOf(light, '--p-muted'), hexOf(light, '--p-card'))).toBeGreaterThanOrEqual(4.5)
  })

  it('oq matn aksent CTA fonida (obsidian/neo/claude/cupertino, dark+light)', () => {
    // 2026-09-0x o'lchov: bu 4 aksentda oq-on-primary 2.28–3.68 edi (tugmalar).
    for (const a of ['obsidian', 'neo', 'claude', 'cupertino'] as const) {
      const d = blockVars(css, `body[data-theme='dark'][data-accent='${a}']`)
      const l = blockVars(css, `body[data-theme='light'][data-accent='${a}']`)
      expect(ratio('#ffffff', hexOf(d, '--p-primary')), `${a} dark`).toBeGreaterThanOrEqual(4.5)
      expect(ratio('#ffffff', hexOf(l, '--p-primary')), `${a} light`).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('tertiary matn o‘z kartasida — BARCHA dark aksent + default (4.5)', () => {
    // 2026-09 o'lchov: 17 aksentdan 16 tasi 2.8–4.4 edi. Har bir blok o'z
    // --p-card'iga nisbatan tekshiriladi (aksent advertisedagidan farqli
    // bo'lsa, shu test ushlaydi).
    const blocks = [...css.matchAll(/body\[data-theme='dark'\]\[data-accent='([\w-]+)'\]\s*\{([^}]*)\}/g)]
    expect(blocks.length).toBeGreaterThan(10)
    for (const m of blocks) {
      const vars: Record<string, string> = {}
      for (const v of m[2].matchAll(/(--[\w-]+)\s*:\s*(#[0-9a-fA-F]{6})/g)) vars[v[1]] = v[2]
      if (!vars['--p-subtle'] || !vars['--p-card']) continue
      expect(
        ratio(vars['--p-subtle'], vars['--p-card']),
        `${m[1]} subtle/card`,
      ).toBeGreaterThanOrEqual(4.5)
    }
    expect(ratio(hexOf(dark, '--p-subtle'), hexOf(dark, '--p-card')), 'default').toBeGreaterThanOrEqual(4.5)
  })

  it('tertiary matn oq kartada — light-only aksentlar (sakura/arctic/claude/cupertino)', () => {
    // sakura/arctic — shartsiz `body[data-accent]` bloklari (light-only dizayn).
    const sel = (a: string) =>
      a === 'sakura' || a === 'arctic'
        ? `body[data-accent='${a}']`
        : `body[data-theme='light'][data-accent='${a}']`
    for (const a of ['sakura', 'arctic', 'claude', 'cupertino'] as const) {
      const l = blockVars(css, sel(a))
      const card = /^#[0-9a-fA-F]{6}$/.test(l['--p-card'] ?? '') ? l['--p-card'] : '#ffffff'
      expect(ratio(hexOf(l, '--p-subtle'), card), `${a} light`).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('--p-primary-rgb triplet --p-primary bilan sinxron', () => {    const rgbOf = (v: Record<string, string>) =>
      v['--p-primary-rgb'].trim().split(/\s+/).map(Number)
    for (const [name, v] of [['dark', dark], ['light', light]] as const) {
      const [r, g, b] = rgbOf(v)
      const hex =
        '#' + [r, g, b].map((n) => n.toString(16).padStart(2, '0')).join('')
      expect(hex, `${name} triplet`).toBe(hexOf(v, '--p-primary').toLowerCase())
    }
  })
})
