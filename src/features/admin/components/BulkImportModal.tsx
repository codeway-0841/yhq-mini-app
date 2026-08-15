import { useState, useRef } from 'react'
import {
  X,
  Upload,
  FileSpreadsheet,
  FileCode,
  FileText,
  Download,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Trash2,
} from 'lucide-react'
import { api } from '../../../shared/api'
import { playSound } from '../../../shared/lib/sounds'
import { haptics } from '../../../platform/haptics'

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

interface BulkImportModalProps {
  subjectId: string
  subjectName: string
  subjectIcon: string
  onClose: () => void
  onSuccess: (count: number) => void
}

type ImportTab = 'csv' | 'text' | 'json'

export default function BulkImportModal({
  subjectId,
  subjectName,
  subjectIcon,
  onClose,
  onSuccess,
}: BulkImportModalProps) {
  const [activeTab, setActiveTab] = useState<ImportTab>('csv')
  const [parsedList, setParsedList] = useState<ParsedQuestion[]>([])
  const [textInput, setTextInput] = useState('')
  const [jsonInput, setJsonInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [importing, setImporting] = useState(false)
  const [fileName, setFileName] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  // ── CSV Parser ───────────────────────────────────────────────────────────
  const parseCSV = (content: string): ParsedQuestion[] => {
    const lines = content.split(/\r?\n/).filter((l) => l.trim().length > 0)
    if (lines.length <= 1) return []

    // Helper to parse CSV row accounting for quotes
    const parseRow = (line: string): string[] => {
      const result: string[] = []
      let curr = ''
      let inQuotes = false

      for (let i = 0; i < line.length; i++) {
        const char = line[i]
        if (char === '"') {
          inQuotes = !inQuotes
        } else if ((char === ',' || char === ';') && !inQuotes) {
          result.push(curr.trim())
          curr = ''
        } else {
          curr += char
        }
      }
      result.push(curr.trim())
      return result
    }

    const rows = lines.slice(1).map(parseRow)
    const result: ParsedQuestion[] = []

    rows.forEach((cols, idx) => {
      if (cols.length < 5) return

      // Expected columns:
      // 0: questionUz, 1: questionRu,
      // 2: optA_uz, 3: optA_ru, 4: optB_uz, 5: optB_ru,
      // 6: optC_uz, 7: optC_ru, 8: optD_uz, 9: optD_ru,
      // 10: correctAnswer (A, B, C, D or F1, F2...), 11: image
      const qUz = cols[0] || ''
      const qRu = cols[1] || qUz
      const optAUz = cols[2] || ''
      const optARu = cols[3] || optAUz
      const optBUz = cols[4] || ''
      const optBRu = cols[5] || optBUz
      const optCUz = cols[6] || ''
      const optCRu = cols[7] || optCUz
      const optDUz = cols[8] || ''
      const optDRu = cols[9] || optDUz

      let rawAns = (cols[10] || 'A').toUpperCase().trim()
      if (rawAns === 'A' || rawAns === '1') rawAns = 'F1'
      else if (rawAns === 'B' || rawAns === '2') rawAns = 'F2'
      else if (rawAns === 'C' || rawAns === '3') rawAns = 'F3'
      else if (rawAns === 'D' || rawAns === '4') rawAns = 'F4'

      const optionsUz: Record<string, string> = { F1: optAUz, F2: optBUz }
      const optionsRu: Record<string, string> = { F1: optARu, F2: optBRu }
      if (optCUz) {
        optionsUz.F3 = optCUz
        optionsRu.F3 = optCRu
      }
      if (optDUz) {
        optionsUz.F4 = optDUz
        optionsRu.F4 = optDRu
      }

      const img = cols[11] || null

      let isValid = true
      let errorReason = ''

      if (!qUz || qUz.length < 3) {
        isValid = false
        errorReason = "Savol matni juda qisqa"
      } else if (!optAUz || !optBUz) {
        isValid = false
        errorReason = "Kamida 2 ta variant bo'lishi shart"
      } else if (!optionsUz[rawAns]) {
        isValid = false
        errorReason = `To'g'ri javob "${rawAns}" variantlar ichida yo'q`
      }

      result.push({
        id_temp: `csv_${idx + 1}`,
        questionUz: qUz,
        questionRu: qRu,
        optionsUz,
        optionsRu,
        correctAnswer: rawAns,
        image: img,
        isValid,
        errorReason,
      })
    })

    return result
  }

  // ── Smart Text / AI Paste Parser ───────────────────────────────────────────
  const parseSmartText = (text: string): ParsedQuestion[] => {
    const blocks = text.split(/\n\s*\n/).filter((b) => b.trim().length > 0)
    const result: ParsedQuestion[] = []

    blocks.forEach((block, idx) => {
      const lines = block
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean)
      if (lines.length < 3) return

      let questionUz = ''
      let questionRu = ''
      const optionsUz: Record<string, string> = {}
      const optionsRu: Record<string, string> = {}
      let correctAnswer = 'F1'

      lines.forEach((line) => {
        // Check for question line: 1. or 1)
        const qMatch = line.match(/^(\d+[\.\)]|\#\d+)\s*(.+)/)
        if (qMatch && !questionUz) {
          questionUz = qMatch[2].trim()
          return
        }

        // Check for Option: A), B), C), D) or A., B., C., D.
        const optMatch = line.match(/^([A-Da-dFf\d])[\)\.:\-]\s*(.+)/)
        if (optMatch) {
          let letter = optMatch[1].toUpperCase()
          if (letter === 'A' || letter === '1') letter = 'F1'
          else if (letter === 'B' || letter === '2') letter = 'F2'
          else if (letter === 'C' || letter === '3') letter = 'F3'
          else if (letter === 'D' || letter === '4') letter = 'F4'

          const optText = optMatch[2].trim()
          optionsUz[letter] = optText
          optionsRu[letter] = optText
          return
        }

        // Check for Correct Answer: To'g'ri: A or Javob: B or Correct: C
        const ansMatch = line.match(/(?:to'?g'?ri|javob|ответ|correct|ans)\s*[:=-]?\s*([A-Da-dFf\d])/i)
        if (ansMatch) {
          let letter = ansMatch[1].toUpperCase()
          if (letter === 'A' || letter === '1') letter = 'F1'
          else if (letter === 'B' || letter === '2') letter = 'F2'
          else if (letter === 'C' || letter === '3') letter = 'F3'
          else if (letter === 'D' || letter === '4') letter = 'F4'
          correctAnswer = letter
          return
        }

        // If line is not option and not answer and question is not set, set as question
        if (!questionUz) {
          questionUz = line
        }
      })

      questionRu = questionUz

      let isValid = true
      let errorReason = ''

      if (!questionUz || questionUz.length < 3) {
        isValid = false
        errorReason = "Savol matni topilmadi"
      } else if (Object.keys(optionsUz).length < 2) {
        isValid = false
        errorReason = "Kamida 2 ta variant (A, B) kerak"
      } else if (!optionsUz[correctAnswer]) {
        isValid = false
        errorReason = `To'g'ri javob "${correctAnswer}" variantlar ichida yo'q`
      }

      result.push({
        id_temp: `text_${idx + 1}`,
        questionUz,
        questionRu,
        optionsUz,
        optionsRu,
        correctAnswer,
        isValid,
        errorReason,
      })
    })

    return result
  }

  // ── JSON Parser ───────────────────────────────────────────────────────────
  const parseJSON = (raw: string): ParsedQuestion[] => {
    try {
      const data = JSON.parse(raw)
      if (!Array.isArray(data)) return []

      return data.map((item, idx) => {
        const qUz = String(item.questionUz || item.question || '').trim()
        const qRu = String(item.questionRu || qUz).trim()
        const optionsUz = item.optionsUz || item.options || {}
        const optionsRu = item.optionsRu || optionsUz
        const ans = String(item.correctAnswer || item.answer || 'F1').trim()

        let isValid = true
        let errorReason = ''

        if (!qUz || qUz.length < 3) {
          isValid = false
          errorReason = "Savol matni yo'q"
        } else if (Object.keys(optionsUz).length < 2) {
          isValid = false
          errorReason = "Kamida 2 ta variant kerak"
        } else if (!optionsUz[ans]) {
          isValid = false
          errorReason = `To'g'ri javob "${ans}" variantlarda yo'q`
        }

        return {
          id_temp: `json_${idx + 1}`,
          questionUz: qUz,
          questionRu: qRu,
          optionsUz,
          optionsRu,
          correctAnswer: ans,
          image: item.image || null,
          topicId: item.topicId || null,
          isValid,
          errorReason,
        }
      })
    } catch {
      return []
    }
  }

  // ── File Upload Handler ───────────────────────────────────────────────────
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setFileName(file.name)
    setLoading(true)

    const reader = new FileReader()
    reader.onload = (evt) => {
      const text = String(evt.target?.result || '')
      if (file.name.endsWith('.json')) {
        setParsedList(parseJSON(text))
      } else {
        setParsedList(parseCSV(text))
      }
      setLoading(false)
      haptics.impact('medium')
    }
    reader.onerror = () => {
      setLoading(false)
      alert("Faylni o'qishda xatolik yuz berdi")
    }
    reader.readAsText(file)
  }

  // ── Download Sample Templates ─────────────────────────────────────────────
  const downloadTemplate = (type: 'csv' | 'json') => {
    haptics.impact('light')
    if (type === 'csv') {
      const csvContent =
        'questionUz,questionRu,optionA_uz,optionA_ru,optionB_uz,optionB_ru,optionC_uz,optionC_ru,optionD_uz,optionD_ru,correctAnswer,image\n' +
        '"Ushbu belgi nimani bildiradi?","Что означает этот знак?","To\'xtash taqiqlangan","Остановка запрещена","To\'xtab turish taqiqlangan","Стоянка запрещена","Harakatlanish taqiqlangan","Движение запрещено","Boshqa yo\'l","Другая дорога","F1",""\n' +
        '"Ikkinchi savol matni...","Текст второго вопроса...","Variant A","Вариант A","Variant B","Вариант B","Variant C","Вариант C","Variant D","Вариант D","F2",""'

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `savollar_shablon_${subjectId}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } else {
      const jsonContent = JSON.stringify(
        [
          {
            questionUz: 'Ushbu belgi nimani bildiradi?',
            questionRu: 'Что означает этот знак?',
            optionsUz: {
              F1: "To'xtash taqiqlangan",
              F2: "To'xtab turish taqiqlangan",
              F3: 'Harakatlanish taqiqlangan',
              F4: "Boshqa yo'l",
            },
            optionsRu: {
              F1: 'Остановка запрещена',
              F2: 'Стоянка запрещена',
              F3: 'Движение запрещено',
              F4: 'Другая дорога',
            },
            correctAnswer: 'F1',
            image: null,
          },
        ],
        null,
        2
      )

      const blob = new Blob([jsonContent], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `savollar_shablon_${subjectId}.json`
      a.click()
      URL.revokeObjectURL(url)
    }
  }

  // ── Import Execution ──────────────────────────────────────────────────────
  const handleImport = async () => {
    const validItems = parsedList.filter((q) => q.isValid)
    if (validItems.length === 0) {
      alert("Yuklash uchun yaroqli savollar topilmadi")
      return
    }

    setImporting(true)
    try {
      const res = await api.bulkImportQuestions({
        subjectId,
        items: validItems.map((q) => ({
          questionUz: q.questionUz,
          questionRu: q.questionRu,
          optionsUz: q.optionsUz,
          optionsRu: q.optionsRu,
          correctAnswer: q.correctAnswer,
          image: q.image || null,
          topicId: q.topicId || null,
        })),
      })

      playSound('win')
      haptics.notify('success')
      onSuccess(res.count)
      onClose()
    } catch (err: any) {
      alert(err?.message || "Yuklashda xatolik yuz berdi")
    } finally {
      setImporting(false)
    }
  }

  const validCount = parsedList.filter((q) => q.isValid).length
  const invalidCount = parsedList.length - validCount

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-premiumIn">
      <div className="relative w-full max-w-lg rounded-3xl bg-surface border border-line p-5 shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
        {/* Top Header */}
        <div className="flex items-center justify-between pb-3 border-b border-line">
          <div>
            <h2 className="text-base font-black text-fg flex items-center gap-2">
              <Upload size={18} className="text-duo-purple" />
              Ommaviy Savollar Yuklash
            </h2>
            <p className="text-xs text-muted flex items-center gap-1.5 mt-0.5">
              <span>{subjectIcon}</span>
              <span className="font-bold text-fg">{subjectName}</span> fani uchun
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-elevated border border-line flex items-center justify-center text-muted hover:text-fg"
          >
            <X size={16} />
          </button>
        </div>

        {/* Templates Download Bar */}
        <div className="flex items-center justify-between p-2.5 my-3 bg-elevated rounded-2xl border border-line text-xs">
          <span className="font-bold text-muted text-[11px] flex items-center gap-1.5">
            <Download size={14} className="text-duo-green" />
            Namunaviy shablonlar:
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => downloadTemplate('csv')}
              className="px-2.5 py-1 rounded-xl bg-surface border border-line text-[11px] font-bold text-fg hover:border-duo-purple active:scale-95 transition-all"
            >
              📄 CSV (.csv)
            </button>
            <button
              onClick={() => downloadTemplate('json')}
              className="px-2.5 py-1 rounded-xl bg-surface border border-line text-[11px] font-bold text-fg hover:border-duo-purple active:scale-95 transition-all"
            >
              💻 JSON (.json)
            </button>
          </div>
        </div>

        {/* Tab Selection */}
        <div className="grid grid-cols-3 gap-1 p-1 bg-elevated rounded-2xl border border-line mb-3">
          <button
            type="button"
            onClick={() => setActiveTab('csv')}
            className={`py-2 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'csv'
                ? 'bg-duo-purple text-ponprimary shadow-md'
                : 'text-muted hover:text-fg'
            }`}
          >
            <FileSpreadsheet size={14} />
            Fayl (CSV)
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('text')}
            className={`py-2 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'text'
                ? 'bg-duo-purple text-ponprimary shadow-md'
                : 'text-muted hover:text-fg'
            }`}
          >
            <FileText size={14} />
            Matn (AI)
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('json')}
            className={`py-2 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'json'
                ? 'bg-duo-purple text-ponprimary shadow-md'
                : 'text-muted hover:text-fg'
            }`}
          >
            <FileCode size={14} />
            JSON
          </button>
        </div>

        {/* Input Area by Tab */}
        <div className="overflow-y-auto flex-1 space-y-3 pr-1">
          {activeTab === 'csv' && (
            <div className="space-y-3">
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.txt,.json"
                onChange={handleFileUpload}
                className="hidden"
              />
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-line hover:border-duo-purple/60 rounded-3xl p-6 text-center cursor-pointer bg-card transition-all active:scale-[0.99]"
              >
                <FileSpreadsheet size={32} className="mx-auto text-duo-purple mb-2" />
                <p className="text-xs font-bold text-fg">
                  {fileName ? fileName : 'CSV yoki JSON faylni tanlang'}
                </p>
                <p className="text-[11px] text-muted mt-1">
                  Excel (.csv) yoki JSON formatidagi fayllar qabul qilinadi
                </p>
              </div>
            </div>
          )}

          {activeTab === 'text' && (
            <div className="space-y-2">
              <textarea
                value={textInput}
                onChange={(e) => {
                  setTextInput(e.target.value)
                  setParsedList(parseSmartText(e.target.value))
                }}
                rows={6}
                placeholder={`1. Savol matni?\nA) Variant 1\nB) Variant 2\nC) Variant 3\nTo'g'ri: A\n\n2. Keyingi savol...`}
                className="w-full bg-card border border-line rounded-2xl p-3 text-xs text-fg font-mono focus:outline-none focus:border-duo-purple transition-all"
              />
              <p className="text-[10px] text-muted">
                💡 Maslahat: ChatGPT yoki Clodedan olingan testlarni to'g'ridan-to'g'ri tashlashingiz mumkin.
              </p>
            </div>
          )}

          {activeTab === 'json' && (
            <div className="space-y-2">
              <textarea
                value={jsonInput}
                onChange={(e) => {
                  setJsonInput(e.target.value)
                  setParsedList(parseJSON(e.target.value))
                }}
                rows={6}
                placeholder={`[\n  {\n    "questionUz": "Savol?",\n    "optionsUz": { "F1": "A", "F2": "B" },\n    "correctAnswer": "F1"\n  }\n]`}
                className="w-full bg-card border border-line rounded-2xl p-3 text-xs text-fg font-mono focus:outline-none focus:border-duo-purple transition-all"
              />
            </div>
          )}

          {/* Parsed Summary & Preview */}
          {loading ? (
            <div className="py-8 text-center text-muted">
              <Loader2 size={24} className="animate-spin mx-auto mb-2 text-duo-purple" />
              <p className="text-xs">Fayl tahlil qilinmoqda...</p>
            </div>
          ) : parsedList.length > 0 ? (
            <div className="space-y-2 pt-2 border-t border-line">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-fg">
                  Tahlil natijasi: {parsedList.length} ta savol
                </span>
                <div className="flex items-center gap-2 text-[11px] font-bold">
                  <span className="text-duo-green flex items-center gap-1">
                    <CheckCircle2 size={13} /> {validCount} ta to'g'ri
                  </span>
                  {invalidCount > 0 && (
                    <span className="text-duo-red flex items-center gap-1">
                      <AlertCircle size={13} /> {invalidCount} ta xato
                    </span>
                  )}
                  <button
                    onClick={() => {
                      setParsedList([])
                      setFileName(null)
                      setTextInput('')
                      setJsonInput('')
                    }}
                    className="p-1 text-muted hover:text-duo-red ml-1"
                    title="Tozalash"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>

              {/* List of parsed questions */}
              <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                {parsedList.map((q, idx) => (
                  <div
                    key={q.id_temp}
                    className={`p-2.5 rounded-2xl border text-xs ${
                      q.isValid
                        ? 'bg-card border-line'
                        : 'bg-duo-red/10 border-duo-red/30'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <p className="font-bold text-fg truncate">
                        #{idx + 1}. {q.questionUz}
                      </p>
                      {q.isValid ? (
                        <span className="text-[10px] text-duo-green font-black bg-duo-green/15 px-2 py-0.5 rounded-md flex-shrink-0">
                          To'g'ri: {q.correctAnswer}
                        </span>
                      ) : (
                        <span className="text-[10px] text-duo-red font-black bg-duo-red/20 px-2 py-0.5 rounded-md flex-shrink-0">
                          {q.errorReason}
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-muted truncate">
                      Variantlar: {Object.entries(q.optionsUz).map(([k, v]) => `${k}) ${v}`).join(' · ')}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        {/* Footer Actions */}
        <div className="pt-3 border-t border-line mt-2 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 rounded-2xl bg-elevated text-xs font-bold text-muted hover:text-fg active:scale-95 transition-all"
          >
            Bekor qilish
          </button>
          <button
            type="button"
            disabled={validCount === 0 || importing}
            onClick={handleImport}
            className="flex-1 btn-premium py-3 rounded-2xl text-xs font-black flex items-center justify-center gap-1.5 disabled:opacity-40"
          >
            {importing ? (
              <>
                <Loader2 size={15} className="animate-spin" />
                <span>Yuklanmoqda...</span>
              </>
            ) : (
              <span>{validCount} ta savolni yuklash</span>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
