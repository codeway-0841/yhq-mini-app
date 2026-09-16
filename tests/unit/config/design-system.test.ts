import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'

function getSourceFiles(dir: string): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  const files: string[] = []

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...getSourceFiles(fullPath))
    } else if (/\.(tsx|ts)$/.test(entry.name) && !entry.name.endsWith('.d.ts')) {
      files.push(fullPath)
    }
  }

  return files
}

describe('Design System SSOT Guard (Rule 14)', () => {
  const srcDir = path.resolve(__dirname, '../../../src')
  const srcFiles = getSourceFiles(srcDir)

  it('no legacy rounded-control tokens should exist in src/', () => {
    const violations: { file: string; line: number }[] = []

    for (const file of srcFiles) {
      const content = fs.readFileSync(file, 'utf-8')
      const lines = content.split('\n')
      lines.forEach((line, idx) => {
        if (line.includes('rounded-control') && !line.trim().startsWith('//') && !line.trim().startsWith('*')) {
          violations.push({ file: path.relative(srcDir, file), line: idx + 1 })
        }
      })
    }

    expect(violations).toEqual([])
  })

  it('no legacy rounded-container tokens should exist in src/', () => {
    const violations: { file: string; line: number }[] = []

    for (const file of srcFiles) {
      const content = fs.readFileSync(file, 'utf-8')
      const lines = content.split('\n')
      lines.forEach((line, idx) => {
        if (line.includes('rounded-container') && !line.trim().startsWith('//') && !line.trim().startsWith('*')) {
          violations.push({ file: path.relative(srcDir, file), line: idx + 1 })
        }
      })
    }

    expect(violations).toEqual([])
  })

  it('no arbitrary container pixel roundings should exist in src/', () => {
    const arbitraryPattern = /rounded-\[(16|20|22|24|26|28)px\]/
    const violations: { file: string; line: number; match: string }[] = []

    for (const file of srcFiles) {
      const content = fs.readFileSync(file, 'utf-8')
      const lines = content.split('\n')
      lines.forEach((line, idx) => {
        const match = line.match(arbitraryPattern)
        if (match && !line.trim().startsWith('//') && !line.trim().startsWith('*')) {
          violations.push({ file: path.relative(srcDir, file), line: idx + 1, match: match[0] })
        }
      })
    }

    expect(violations).toEqual([])
  })

  it('no wireframe borders on cards (rounded-2xl border border-pline bg-pcard/bg-psurface) should exist in src/features/', () => {
    const featuresDir = path.resolve(srcDir, 'features')
    const featureFiles = getSourceFiles(featuresDir)
    const violations: { file: string; line: number }[] = []

    for (const file of featureFiles) {
      const content = fs.readFileSync(file, 'utf-8')
      const lines = content.split('\n')
      lines.forEach((line, idx) => {
        const isCard = line.includes('bg-pcard') || line.includes('bg-psurface')
        if (isCard && line.includes('border border-pline') && !line.trim().startsWith('//') && !line.trim().startsWith('*')) {
          violations.push({ file: path.relative(srcDir, file), line: idx + 1 })
        }
      })
    }

    expect(violations).toEqual([])
  })

  it('no dead opacity modifiers on HEX --p-* tokens (use rgb triplet instead)', () => {
    // 2026-09-16 Wave 1: `bg-pcard/95`, `ring-pprimary/20` kabi klasslar nol CSS
    // generatsiya qiladi (--p-* HEX saqlaydi, Tailwind v3 /N ni var() da qo'llay
    // olmaydi) — dock shaffof, answer wash'lar ko'rinmas edi. To'g'ri sintaksis:
    // `bg-[rgb(var(--p-card-rgb)/0.95)]` (tripletlar index.css SSOT).
    const deadPattern = /(?:^|[\s"'`:(])(?:bg|text|border|ring|shadow|divide|placeholder|caret|fill|stroke|accent)-(?:pcanvas|pcard|psurface|pline|pfg|pmuted|ponprimary|pprimary|psuccess|pwarning|pdanger|ppurple|pblue|pgold)\/\d+(?![\w/])/
    const violations: { file: string; line: number; match: string }[] = []

    for (const file of srcFiles) {
      const content = fs.readFileSync(file, 'utf-8')
      const lines = content.split('\n')
      lines.forEach((line, idx) => {
        const trimmed = line.trim()
        if (trimmed.startsWith('//') || trimmed.startsWith('*')) return
        const match = line.match(deadPattern)
        if (match) {
          violations.push({ file: path.relative(srcDir, file), line: idx + 1, match: match[0].trim() })
        }
      })
    }

    expect(violations).toEqual([])
  })
})
