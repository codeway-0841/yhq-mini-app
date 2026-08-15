import { describe, it, expect } from 'vitest'
import {
  tokenizeCSV,
  parseCSVQuestions,
  parseJSONQuestions,
  parseSmartTextQuestions,
} from '../../../src/features/admin/lib/universalQuestionParser'

describe('Universal Bulletproof Question Parser Engine', () => {
  it('correctly tokenizes CSV with quotes, newlines, and semicolons', () => {
    const csvContent =
      'Savol;Variant A;Variant B;To\'g\'ri\n' +
      '"Ushbu belgi\n(qizil doira) nimani bildiradi?";"To\'xtash\ntaqiqlanadi";"Ruxsat berilgan";"A"\n' +
      '"Ikkinchi savol";"A variant";"B variant";"B"'

    const rows = tokenizeCSV(csvContent)
    expect(rows.length).toBe(3)
    expect(rows[1][0]).toContain('(qizil doira)')
    expect(rows[1][1]).toContain('To\'xtash')
    expect(rows[1][3]).toBe('A')
    expect(rows[2][0]).toBe('Ikkinchi savol')
  })

  it('parses CSV with various headers and positional fallbacks', () => {
    // 1. Uzbek headers with semicolons
    const csvUz = `
      savol;variant_a;variant_b;variant_c;javob
      "Qaysi belgi xavfli?";"1-belgi";"2-belgi";"3-belgi";"B"
    `
    const parsedUz = parseCSVQuestions(csvUz)
    expect(parsedUz.length).toBe(1)
    expect(parsedUz[0].questionUz).toBe('Qaysi belgi xavfli?')
    expect(parsedUz[0].optionsUz.F2).toBe('2-belgi')
    expect(parsedUz[0].correctAnswer).toBe('F2')
    expect(parsedUz[0].isValid).toBe(true)

    // 2. Simple 4-column CSV without headers
    const csvSimple = `"Boshqa savol","Ha","Yo'q","A"`
    const parsedSimple = parseCSVQuestions(csvSimple)
    expect(parsedSimple.length).toBe(1)
    expect(parsedSimple[0].questionUz).toBe('Boshqa savol')
    expect(parsedSimple[0].optionsUz.F1).toBe('Ha')
    expect(parsedSimple[0].optionsUz.F2).toBe("Yo'q")
    expect(parsedSimple[0].correctAnswer).toBe('F1')
  })

  it('parses complex JSON structures (array, wrapped object, array options)', () => {
    // 1. JSON wrapped in object with array options
    const json1 = JSON.stringify({
      data: [
        {
          question: "Fizika qonuni qanday nomlanadi?",
          options: ["Nyuton 1-qonuni", "Nyuton 2-qonuni", "Paskal qonuni"],
          answer: "B",
        },
        {
          savol: "Matematika savoli",
          a: "10",
          b: "20",
          c: "30",
          d: "40",
          javob: "C",
        },
      ],
    })

    const parsed1 = parseJSONQuestions(json1)
    expect(parsed1.length).toBe(2)
    expect(parsed1[0].questionUz).toBe('Fizika qonuni qanday nomlanadi?')
    expect(parsed1[0].optionsUz.F1).toBe('Nyuton 1-qonuni')
    expect(parsed1[0].optionsUz.F2).toBe('Nyuton 2-qonuni')
    expect(parsed1[0].correctAnswer).toBe('F2')
    expect(parsed1[0].isValid).toBe(true)

    expect(parsed1[1].questionUz).toBe('Matematika savoli')
    expect(parsed1[1].optionsUz.F3).toBe('30')
    expect(parsed1[1].correctAnswer).toBe('F3')
  })

  it('parses AI/Word raw text with numbered questions and answer markers', () => {
    const rawText = `
1. Svetoforning sariq chirog'i nimani bildiradi?
A) Tayyorlanish
*B) Diqqat, harakat to'xtatilsin
C) O'tish mumkin

Savol 2: Yo'l belgilarining nechta guruhi bor?
1) 5 ta
2) 7 ta
3) 8 ta
Javob: 2
    `

    const parsedText = parseSmartTextQuestions(rawText)
    expect(parsedText.length).toBe(2)

    expect(parsedText[0].questionUz).toContain("Svetoforning sariq chirog'i")
    expect(parsedText[0].optionsUz.F1).toBe('Tayyorlanish')
    expect(parsedText[0].optionsUz.F2).toContain('Diqqat')
    expect(parsedText[0].correctAnswer).toBe('F2') // asterisk marked

    expect(parsedText[1].questionUz).toContain("Yo'l belgilarining nechta guruhi bor?")
    expect(parsedText[1].optionsUz.F1).toBe('5 ta')
    expect(parsedText[1].optionsUz.F2).toBe('7 ta')
    expect(parsedText[1].correctAnswer).toBe('F2')
  })
})
