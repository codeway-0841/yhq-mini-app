/**
 * MathText USAGE regression (2026-09-19 "xom LaTeX" incident).
 *
 * Muammo: bank savollarida LaTeX (`^{2}`, `\frac`, ...) bor. Savol/variant
 * matnini MathText'SIZ chizgan ekranlarda (`<p>{q.text}</p>`,
 * `<span>{opt.text}</span>`) formulalar xom kod holida ko'rinadi
 * ("(a^{2} + b^{2})^{3} ..."). Topildi: AdaptivePage (Aqlli takrorlash),
 * XatolarPage, Octagon RoundScreen (duel), SpeedPage.
 *
 * Qoida: bank savol/variant matni FAQAT MathText orqali chiziladi.
 * Bu test 4 ta tuzatilgan faylda xom render qoldig'i yo'qligini tekshiradi.
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const SRC = path.resolve(__dirname, '../../../src')

const COVERED = [
  'features/adaptive/AdaptivePage.tsx',
  'features/mistakes/XatolarPage.tsx',
  'features/octagon/components/RoundScreen.tsx',
  'features/speed/SpeedPage.tsx',
]

// JSX matn-farzand sifatida xom savol/variant: >{q.text}<, >{opt.text}<,
// >{text}< (AdaptivePage lokal Option), >{currentQuestion.text}<
const RAW_PATTERNS = [
  />\{(q\.text|opt\.text|option\.text|text|currentQuestion\.text)\}</,
]

describe('MathText usage — bank matni xom chizilmaydi', () => {
  for (const rel of COVERED) {
    it(`${rel} MathText ishlatadi`, () => {
      const full = path.join(SRC, rel)
      expect(fs.existsSync(full)).toBe(true)
      const src = fs.readFileSync(full, 'utf8')
      expect(src).toMatch(/import MathText from ['"]/)
      for (const re of RAW_PATTERNS) {
        const bad = src.split('\n').filter((l) => re.test(l))
        expect(bad, `Xom render qoldi: ${bad.join(' | ').slice(0, 200)}`).toHaveLength(0)
      }
    })
  }
})
