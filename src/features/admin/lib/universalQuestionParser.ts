/**
 * Universal Bulletproof Question Parser Engine for KIWI Admin
 * Supports:
 *   1. CSV / TSV with quotes, multi-line cells, auto-delimiter detection (;, \t, ,)
 *   2. Flexible Column Headers (Uzbek, Russian, English, positional)
 *   3. JSON arrays, nested objects, array options, flat options, index answers
 *   4. Smart AI / Word / TXT Question Parser with flexible numbering & answer markers
 */

export interface ParsedQuestion {
  id_temp: string
  questionUz: string
  questionRu: string
  optionsUz: Record<string, string>
  optionsRu: Record<string, string>
  correctAnswer: string
  image?: string | null
  topicId?: number | null
  isValid: boolean
  errorReason?: string
}

// ── 1. ROBUST CSV LEXER & PARSER ──────────────────────────────────────────

/** Full RFC-4180 compliant CSV / TSV tokenizer that handles quotes & multi-lines */
export function tokenizeCSV(raw: string): string[][] {
  const clean = raw.replace(/^\uFEFF/, '') // remove BOM
  if (!clean.trim()) return []

  // Auto-detect delimiter: check first non-empty line for tabs, semicolons, commas
  const firstLine = clean.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)[0] || ''
  let delimiter = ','
  const semicolons = (firstLine.match(/;/g) || []).length
  const commas = (firstLine.match(/,/g) || []).length
  const tabs = (firstLine.match(/\t/g) || []).length
  if (tabs > commas && tabs > semicolons) delimiter = '\t'
  else if (semicolons > commas) delimiter = ';'

  const rows: string[][] = []
  let currentRow: string[] = []
  let currentCell = ''
  let inQuotes = false

  for (let i = 0; i < clean.length; i++) {
    const char = clean[i]
    const nextChar = clean[i + 1]

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentCell += '"'
        i++ // skip escaped quote
      } else {
        inQuotes = !inQuotes
      }
    } else if (char === delimiter && !inQuotes) {
      currentRow.push(currentCell.trim())
      currentCell = ''
    } else if ((char === '\r' || char === '\n') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') i++ // skip \r\n
      currentRow.push(currentCell.trim())
      if (currentRow.some((c) => c.length > 0)) {
        rows.push(currentRow)
      }
      currentRow = []
      currentCell = ''
    } else {
      currentCell += char
    }
  }

  if (currentCell.length > 0 || currentRow.length > 0) {
    currentRow.push(currentCell.trim())
    if (currentRow.some((c) => c.length > 0)) {
      rows.push(currentRow)
    }
  }

  return rows
}

/** Normalize option key: 'A', 'a', '1', 'opt_a' -> 'F1' */
export function normalizeOptionKey(key: string | number): string {
  const str = String(key).trim().toUpperCase()
  if (str === 'A' || str === '1' || str === '0' || str === 'F1' || str === 'OPTIONA') return 'F1'
  if (str === 'B' || str === '2' || str === 'F2' || str === 'OPTIONB') return 'F2'
  if (str === 'C' || str === '3' || str === 'F3' || str === 'OPTIONC') return 'F3'
  if (str === 'D' || str === '4' || str === 'F4' || str === 'OPTIOND') return 'F4'
  if (str.startsWith('F') && /^[F]\d+$/.test(str)) return str
  return 'F1'
}

/** Parse CSV with Header Auto-Discovery or Positional Fallback */
export function parseCSVQuestions(csvContent: string): ParsedQuestion[] {
  const rows = tokenizeCSV(csvContent)
  if (rows.length === 0) return []

  const headerRow = rows[0].map((h) => h.toLowerCase().replace(/[^a-z0-9а-яёўқғҳ_]/gi, '').trim())
  
  // A row is a header if at least 2 rows exist and the first row has short header keywords (<= 20 chars)
  const isHeaderKeyword = (h: string) =>
    h.length <= 20 &&
    ['question', 'savol', 'vopros', 'вопрос', 'matn', 'q', 'opta', 'opt_a', 'varianta', 'variant_a', 'variant1', 'answer', 'javob', 'otvet', 'ответ', 'correct', 'correctanswer'].some(
      (kw) => h === kw || h === `option${kw}` || h.startsWith('variant') || h.startsWith('opt')
    )

  const hasHeader = rows.length > 1 && headerRow.filter(isHeaderKeyword).length >= 2

  const dataRows = hasHeader ? rows.slice(1) : rows
  const result: ParsedQuestion[] = []

  // Header column index finder
  const findCol = (keywords: string[]): number => {
    return headerRow.findIndex((h) => keywords.some((kw) => h === kw || h === `option${kw}` || h.startsWith(kw)))
  }

  const qUzIdx = hasHeader ? findCol(['questionuz', 'savol', 'question', 'matn', 'вопрос', 'vopros', 'q']) : 0
  const qRuIdx = hasHeader ? findCol(['questionru', 'savolru', 'вопросru', 'voprosru', 'question_ru']) : -1

  const optAIdx = hasHeader ? findCol(['optionauz', 'optau', 'opta', 'variant_a', 'varianta', 'variant1', 'a', 'f1', '1']) : 1
  const optBIdx = hasHeader ? findCol(['optionbuz', 'optbu', 'optb', 'variant_b', 'variantb', 'variant2', 'b', 'f2', '2']) : 2
  const optCIdx = hasHeader ? findCol(['optioncuz', 'optcu', 'optc', 'variant_c', 'variantc', 'variant3', 'c', 'f3', '3']) : 3
  const optDIdx = hasHeader ? findCol(['optionduz', 'optdu', 'optd', 'variant_d', 'variantd', 'variant4', 'd', 'f4', '4']) : 4

  const ansIdx = hasHeader ? findCol(['correctanswer', 'correct', 'answer', 'javob', 'togri', 'ответ', 'ans', 'tj']) : -1
  const imgIdx = hasHeader ? findCol(['image', 'rasm', 'img', 'photo', 'picture', 'url']) : -1

  dataRows.forEach((row, idx) => {
    if (!row || row.length === 0) return

    let qUz = ''
    let qRu = ''
    const optionsUz: Record<string, string> = {}
    const optionsRu: Record<string, string> = {}
    let rawAns = 'F1'
    let image: string | null = null

    if (hasHeader && qUzIdx >= 0) {
      qUz = row[qUzIdx] || ''
      qRu = qRuIdx >= 0 && row[qRuIdx] ? row[qRuIdx] : qUz

      if (optAIdx >= 0 && row[optAIdx]) optionsUz.F1 = optionsRu.F1 = row[optAIdx]
      if (optBIdx >= 0 && row[optBIdx]) optionsUz.F2 = optionsRu.F2 = row[optBIdx]
      if (optCIdx >= 0 && row[optCIdx]) optionsUz.F3 = optionsRu.F3 = row[optCIdx]
      if (optDIdx >= 0 && row[optDIdx]) optionsUz.F4 = optionsRu.F4 = row[optDIdx]

      if (ansIdx >= 0 && row[ansIdx]) rawAns = normalizeOptionKey(row[ansIdx])
      if (imgIdx >= 0 && row[imgIdx]) image = row[imgIdx]
    } else {
      // Positional fallback:
      // Standard 12-col detailed format
      if (row.length >= 11) {
        qUz = row[0] || ''
        qRu = row[1] || qUz
        if (row[2]) optionsUz.F1 = row[2]
        if (row[3]) optionsRu.F1 = row[3]
        if (row[4]) optionsUz.F2 = row[4]
        if (row[5]) optionsRu.F2 = row[5]
        if (row[6]) optionsUz.F3 = row[6]
        if (row[7]) optionsRu.F3 = row[7]
        if (row[8]) optionsUz.F4 = row[8]
        if (row[9]) optionsRu.F4 = row[9]
        rawAns = normalizeOptionKey(row[10] || 'A')
        image = row[11] || null
      } else if (row.length >= 4) {
        // Simple: Question, OptA, OptB, [OptC], [OptD], Answer
        qUz = row[0] || ''
        qRu = qUz
        optionsUz.F1 = optionsRu.F1 = row[1] || ''
        optionsUz.F2 = optionsRu.F2 = row[2] || ''

        if (row.length === 4) {
          rawAns = normalizeOptionKey(row[3] || 'A')
        } else if (row.length === 5) {
          optionsUz.F3 = optionsRu.F3 = row[3] || ''
          rawAns = normalizeOptionKey(row[4] || 'A')
        } else if (row.length >= 6) {
          optionsUz.F3 = optionsRu.F3 = row[3] || ''
          optionsUz.F4 = optionsRu.F4 = row[4] || ''
          rawAns = normalizeOptionKey(row[5] || 'A')
          if (row[6]) image = row[6]
        }
      }
    }

    // Validation
    let isValid = true
    let errorReason = ''

    if (!qUz || qUz.length < 2) {
      isValid = false
      errorReason = "Savol matni bo'sh"
    } else if (Object.keys(optionsUz).length < 2) {
      isValid = false
      errorReason = 'Kamida 2 ta variant kerak'
    } else if (!optionsUz[rawAns]) {
      // If raw answer is not in options, fallback to first available option key
      const firstKey = Object.keys(optionsUz)[0]
      if (firstKey) {
        rawAns = firstKey
      } else {
        isValid = false
        errorReason = "To'g'ri javob topilmadi"
      }
    }

    result.push({
      id_temp: `csv_${idx + 1}`,
      questionUz: qUz,
      questionRu: qRu || qUz,
      optionsUz,
      optionsRu: Object.keys(optionsRu).length ? optionsRu : optionsUz,
      correctAnswer: rawAns,
      image,
      isValid,
      errorReason,
    })
  })

  return result
}

// ── 2. UNIVERSAL JSON NORMALIZER ──────────────────────────────────────────

export function parseJSONQuestions(rawJson: string): ParsedQuestion[] {
  try {
    let parsed = JSON.parse(rawJson)
    if (!parsed) return []

    // If wrapped inside { questions: [...] } or { data: [...] } or { items: [...] }
    if (!Array.isArray(parsed) && typeof parsed === 'object') {
      const arrayProp = Object.values(parsed).find((val) => Array.isArray(val))
      if (arrayProp && Array.isArray(arrayProp)) {
        parsed = arrayProp
      } else {
        parsed = Object.values(parsed)
      }
    }

    if (!Array.isArray(parsed)) return []

    const result: ParsedQuestion[] = []

    parsed.forEach((item: any, idx: number) => {
      if (!item || typeof item !== 'object') return

      const qUz = String(item.questionUz || item.question || item.text || item.title || item.savol || item.vopros || '').trim()
      const qRu = String(item.questionRu || item.question_ru || qUz).trim()

      const optionsUz: Record<string, string> = {}
      const optionsRu: Record<string, string> = {}

      // Case 1: Options is an Array ['Variant 1', 'Variant 2', ...]
      const rawOptions = item.optionsUz || item.options || item.variants || item.choices || item.variantlar || item.answers
      if (Array.isArray(rawOptions)) {
        rawOptions.forEach((optText, optIdx) => {
          const key = `F${optIdx + 1}`
          optionsUz[key] = String(optText).trim()
          optionsRu[key] = String(optText).trim()
        })
      } else if (rawOptions && typeof rawOptions === 'object') {
        // Case 2: Options is an Object { A: '...', B: '...' } or { F1: '...', F2: '...' }
        Object.entries(rawOptions).forEach(([k, v]) => {
          const normalizedKey = normalizeOptionKey(k)
          optionsUz[normalizedKey] = String(v).trim()
          optionsRu[normalizedKey] = String(v).trim()
        })
      } else {
        // Case 3: Flat properties { a: '...', b: '...', c: '...', d: '...' }
        if (item.a || item.optionA || item.variantA) optionsUz.F1 = optionsRu.F1 = String(item.a || item.optionA || item.variantA).trim()
        if (item.b || item.optionB || item.variantB) optionsUz.F2 = optionsRu.F2 = String(item.b || item.optionB || item.variantB).trim()
        if (item.c || item.optionC || item.variantC) optionsUz.F3 = optionsRu.F3 = String(item.c || item.optionC || item.variantC).trim()
        if (item.d || item.optionD || item.variantD) optionsUz.F4 = optionsRu.F4 = String(item.d || item.optionD || item.variantD).trim()
      }

      // Check if separate Russian options exist
      if (item.optionsRu && typeof item.optionsRu === 'object') {
        Object.entries(item.optionsRu).forEach(([k, v]) => {
          optionsRu[normalizeOptionKey(k)] = String(v).trim()
        })
      }

      // Answer resolution
      let rawAns = String(item.correctAnswer || item.answer || item.correct || item.javob || item.ans || item.right || 'F1').trim()
      if (/^\d+$/.test(rawAns)) {
        // If 0-indexed or 1-indexed number
        const num = Number(rawAns)
        rawAns = num === 0 ? 'F1' : `F${num}`
      } else {
        rawAns = normalizeOptionKey(rawAns)
      }

      // If rawAns still doesn't match keys, check if answer was the full option text
      if (!optionsUz[rawAns]) {
        const matchingEntry = Object.entries(optionsUz).find(([, v]) => v.toLowerCase() === String(item.correctAnswer || item.answer).toLowerCase())
        if (matchingEntry) {
          rawAns = matchingEntry[0]
        } else {
          rawAns = Object.keys(optionsUz)[0] || 'F1'
        }
      }

      let isValid = true
      let errorReason = ''

      if (!qUz || qUz.length < 2) {
        isValid = false
        errorReason = "Savol matni bo'sh"
      } else if (Object.keys(optionsUz).length < 2) {
        isValid = false
        errorReason = 'Kamida 2 ta variant kerak'
      } else if (!optionsUz[rawAns]) {
        isValid = false
        errorReason = "To'g'ri javob variantlarda topilmadi"
      }

      result.push({
        id_temp: `json_${idx + 1}`,
        questionUz: qUz,
        questionRu: qRu || qUz,
        optionsUz,
        optionsRu: Object.keys(optionsRu).length ? optionsRu : optionsUz,
        correctAnswer: rawAns,
        image: item.image || item.img || item.photo || null,
        topicId: item.topicId ? Number(item.topicId) : null,
        isValid,
        errorReason,
      })
    })

    return result
  } catch {
    return []
  }
}

// ── 3. SMART TEXT / AI PASTE PARSER ──────────────────────────────────────────

export function parseSmartTextQuestions(rawText: string): ParsedQuestion[] {
  if (!rawText.trim()) return []

  const questionBlocks: string[][] = []

  // Check if text has double newlines
  const dblBlocks = rawText.split(/\n\s*\n/).filter((b) => b.trim().length > 0)
  if (dblBlocks.length > 1) {
    dblBlocks.forEach((db) => {
      const blockLines = db.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
      if (blockLines.length > 0) {
        questionBlocks.push(blockLines)
      }
    })
  } else {
    // Single block or no double newlines: split by Question start markers
    const lines = rawText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
    let currentBlock: string[] = []

    const isQuestionStart = (line: string): boolean => {
      return /^(\d+\.|\#\d+|№\d+|\d+\s*[-–—]|savol\s*\d+|вопрос\s*\d+|q\d+[:\.\)])/i.test(line)
    }

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      if (isQuestionStart(line) && currentBlock.length > 0) {
        questionBlocks.push(currentBlock)
        currentBlock = [line]
      } else {
        currentBlock.push(line)
      }
    }
    if (currentBlock.length > 0) {
      questionBlocks.push(currentBlock)
    }
  }

  const result: ParsedQuestion[] = []

  questionBlocks.forEach((block, idx) => {
    if (block.length < 2) return

    let questionUz = ''
    const optionsUz: Record<string, string> = {}
    let correctAnswer = 'F1'
    let image: string | null = null

    block.forEach((line) => {
      // 1. Check for option line:
      // - Letter options: A), B), C), D) or A., B., *A), +A)
      // - Numeric options: 1), 2), 3) only if questionUz is already non-empty!
      const isLetterOpt = /^([\*\+]?\s*[A-Da-dFf])[\)\.\:\-]\s*(.+)/.test(line)
      const isNumericOpt = Boolean(questionUz) && /^([\*\+]?\s*[1-9])[\)\.\:\-]\s*(.+)/.test(line)

      if (isLetterOpt || isNumericOpt) {
        const optMatch = line.match(/^([\*\+]?\s*[A-Da-dFf\d])[\)\.\:\-]\s*(.+)/)
        if (optMatch) {
          const rawKey = optMatch[1].replace(/[\*\+]/g, '').trim()
          const isMarkedCorrect = optMatch[1].includes('*') || optMatch[1].includes('+')
          const optKey = normalizeOptionKey(rawKey)
          const optText = optMatch[2].trim()

          optionsUz[optKey] = optText
          if (isMarkedCorrect) {
            correctAnswer = optKey
          }
          return
        }
      }

      // 2. Check for Correct Answer: "To'g'ri: A", "Javob: B", "Ответ: C", "Correct: D"
      const ansMatch = line.match(/(?:to'?g'?ri|javob|ответ|correct|ans|tj)\s*[:=-]?\s*([A-Da-dFf\d])/i)
      if (ansMatch) {
        correctAnswer = normalizeOptionKey(ansMatch[1])
        return
      }

      // 3. Check for Image URL
      const imgMatch = line.match(/(?:rasm|img|image|photo)\s*[:=-]?\s*(https?:\/\/\S+|\S+\.(?:jpg|png|jpeg|webp))/i)
      if (imgMatch) {
        image = imgMatch[1]
        return
      }

      // 4. Otherwise, it's question text line
      if (!questionUz) {
        // Strip leading number like "1.", "1)", "Savol 1:"
        questionUz = line.replace(/^(\d+[\.\)]|\#\d+|\d+\s*[-–—]|savol\s*\d+[:\.]?|вопрос\s*\d+[:\.]?)\s*/i, '').trim()
      } else {
        // Append multi-line question text
        questionUz += ' ' + line
      }
    })

    // If correctAnswer wasn't found or invalid, use first option key
    if (!optionsUz[correctAnswer]) {
      correctAnswer = Object.keys(optionsUz)[0] || 'F1'
    }

    let isValid = true
    let errorReason = ''

    if (!questionUz || questionUz.length < 2) {
      isValid = false
      errorReason = 'Savol matni topilmadi'
    } else if (Object.keys(optionsUz).length < 2) {
      isValid = false
      errorReason = 'Kamida 2 ta variant (A, B) kerak'
    }

    result.push({
      id_temp: `text_${idx + 1}`,
      questionUz,
      questionRu: questionUz,
      optionsUz,
      optionsRu: optionsUz,
      correctAnswer,
      image,
      isValid,
      errorReason,
    })
  })

  return result
}
