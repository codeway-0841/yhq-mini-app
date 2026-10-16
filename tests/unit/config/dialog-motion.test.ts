import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const css = fs.readFileSync(path.resolve(__dirname, '../../../src/index.css'), 'utf8')

describe('Claude-mobile modal motion va geometriya', () => {
  it('bottom-sheet tepa radiusini oddiy karta radiusidan alohida saqlaydi', () => {
    expect(css).toContain('--radius-dialog-sheet: 30px')
    expect(css).toMatch(/\.dialog-sheet-motion\s*>\s*:first-child\s*\{[\s\S]*?border-top-left-radius:\s*var\(--radius-dialog-sheet\)/)
    expect(css).toMatch(/\.dialog-sheet-motion\s*>\s*:first-child\s*\{[\s\S]*?border-top-right-radius:\s*var\(--radius-dialog-sheet\)/)
  })

  it('backdrop va sheet faqat transform/opacity bilan silliq kiradi', () => {
    expect(css).toContain('@keyframes dialogBackdropIn')
    expect(css).toContain('@keyframes dialogSheetIn')
    expect(css).toMatch(/dialogSheetIn[\s\S]*?translate3d\(0, 28px, 0\)[\s\S]*?scale\(0\.985\)/)
  })

  it('drag gesture zonasi bo\'lgan header va title geometriyasini buzmaydi', () => {
    expect(css).toContain('.dialog-sheet-motion div[data-drag-handle]:empty')
    expect(css).not.toMatch(/\.dialog-sheet-motion\s+\[data-drag-handle\]\s*,/)
  })

  it('OS va ilova reduced-motion tanlovini hurmat qiladi', () => {
    expect(css).toMatch(/body\[data-no-animation='true'\][\s\S]*?\.dialog-sheet-motion\s*>\s*:first-child/)
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.dialog-backdrop-motion/)
  })
})
