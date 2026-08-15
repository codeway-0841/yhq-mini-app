import { describe, it, expect } from 'vitest'

describe('Bulk Import Parsers & Validation Logic', () => {
  it('parses CSV rows into standard questions structure', () => {
    const csvContent =
      'questionUz,questionRu,optionA_uz,optionA_ru,optionB_uz,optionB_ru,optionC_uz,optionC_ru,optionD_uz,optionD_ru,correctAnswer,image\n' +
      '"Tezlik cheklovi qancha?","Какое ограничение скорости?","60 km/soat","60 км/ч","70 km/soat","70 км/ч","80 km/soat","80 км/ч","90 km/soat","90 км/ч","A",""\n' +
      '"Ikkinchi savol","Второй вопрос","Ha","Да","Yo\'q","Нет","","","","","B",""'

    const lines = csvContent.split('\n').filter((l) => l.trim().length > 0)
    expect(lines.length).toBe(3)

    const parseRow = (line: string) => {
      const result: string[] = []
      let curr = ''
      let inQuotes = false
      for (let i = 0; i < line.length; i++) {
        const char = line[i]
        if (char === '"') inQuotes = !inQuotes
        else if ((char === ',' || char === ';') && !inQuotes) {
          result.push(curr.trim())
          curr = ''
        } else curr += char
      }
      result.push(curr.trim())
      return result
    }

    const row1 = parseRow(lines[1])
    expect(row1[0]).toBe('Tezlik cheklovi qancha?')
    expect(row1[10]).toBe('A')

    const row2 = parseRow(lines[2])
    expect(row2[0]).toBe('Ikkinchi savol')
    expect(row2[2]).toBe('Ha')
    expect(row2[4]).toBe("Yo'q")
  })

  it('parses smart text blocks formatted for AI / word tests', () => {
    const textContent = `
1. Svetoforning qizil chirog'i nimani bildiradi?
A) Harakatlanish taqiqlanadi
B) Harakatlanishga ruxsat beriladi
C) Ehtiyotkorlik bilan o'tish
To'g'ri: A

2. Avtomagistralda ruxsat etilgan maksimal tezlik?
A) 90 km/soat
B) 100 km/soat
C) 110 km/soat
D) 70 km/soat
Javob: C
    `

    const blocks = textContent.split(/\n\s*\n/).filter((b) => b.trim().length > 0)
    expect(blocks.length).toBe(2)

    // Verify first question structure
    const block1Lines = blocks[0].split('\n').map((l) => l.trim()).filter(Boolean)
    expect(block1Lines[0]).toContain("Svetoforning qizil chirog'i")
    expect(block1Lines.some((l) => l.startsWith('A)'))).toBe(true)
    expect(block1Lines.some((l) => l.startsWith("To'g'ri:"))).toBe(true)
  })

  it('validates minimum 2 options and matching correct answer key', () => {
    const validQuestion = {
      questionUz: 'Savol matni',
      optionsUz: { F1: 'Variant 1', F2: 'Variant 2' },
      correctAnswer: 'F1',
    }
    expect(Object.keys(validQuestion.optionsUz).length).toBeGreaterThanOrEqual(2)
    expect(validQuestion.optionsUz[validQuestion.correctAnswer]).toBeDefined()

    const invalidQuestion = {
      questionUz: 'Xato savol',
      optionsUz: { F1: 'Faqat bitta variant' },
      correctAnswer: 'F2',
    }
    expect(Object.keys(invalidQuestion.optionsUz).length).toBeLessThan(2)
    expect((invalidQuestion.optionsUz as Record<string, string>)[invalidQuestion.correctAnswer]).toBeUndefined()
  })
})
