/**
 * Spike dataset integrity (Faza 0): 100 namuna, 5 kategoriya x 20,
 * id unikal, HAMMA ascii engine'da parse bo'ladi (ground truth yaroqli).
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { parseStep } from '../../../src/shared/math-engine'

const DATASET = path.resolve(__dirname, '../../../spike/math-board/dataset.json')

interface Item {
  id: string
  category: string
  ascii: string
  latex: string
}

function load(): Item[] {
  const raw = fs.readFileSync(DATASET, 'utf8')
  const parsed = JSON.parse(raw) as { items: Item[] }
  return parsed.items
}

describe('spike dataset integrity', () => {
  it('100 namuna, kategoriya balansi 5x20', () => {
    const items = load()
    expect(items).toHaveLength(100)
    const byCat: Record<string, number> = {}
    for (const it of items) byCat[it.category] = (byCat[it.category] ?? 0) + 1
    expect(byCat).toEqual({ algebra: 20, fraction: 20, root: 20, power: 20, logarithm: 20 })
  })

  it('id unikal, maydonlar to‘liq', () => {
    const items = load()
    const ids = new Set(items.map((i) => i.id))
    expect(ids.size).toBe(100)
    for (const it of items) {
      expect(it.ascii.trim().length).toBeGreaterThan(0)
      expect(it.latex.trim().length).toBeGreaterThan(0)
    }
  })

  it('hamma ascii ground truth engine parse qiladi', () => {
    const bad: string[] = []
    for (const it of load()) {
      try {
        parseStep(it.ascii)
      } catch {
        bad.push(`${it.id}: ${it.ascii}`)
      }
    }
    expect(bad, bad.join('\n')).toEqual([])
  })
})
