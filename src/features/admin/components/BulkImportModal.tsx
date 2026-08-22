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
  Pencil,
  Check,
  Lightbulb,
  type LucideIcon,
} from 'lucide-react'
import { api } from '../../../shared/api'
import { playSound } from '../../../shared/lib/sounds'
import { haptics } from '../../../platform/haptics'
import {
  parseCSVQuestions,
  parseJSONQuestions,
  parseSmartTextQuestions,
  type ParsedQuestion,
} from '../lib/universalQuestionParser'
import DialogOverlay from '../../../shared/components/DialogOverlay'

interface BulkImportModalProps {
  subjectId: string
  subjectName: string
  subjectIcon: LucideIcon
  onClose: () => void
  onSuccess: (count: number) => void
}

type ImportTab = 'csv' | 'text' | 'json'
type FilterTab = 'all' | 'valid' | 'invalid'

export default function BulkImportModal({
  subjectId,
  subjectName,
  subjectIcon: SubjectIcon,
  onClose,
  onSuccess,
}: BulkImportModalProps) {
  const [activeTab, setActiveTab] = useState<ImportTab>('csv')
  const [filterTab, setFilterTab] = useState<FilterTab>('all')
  const [parsedList, setParsedList] = useState<ParsedQuestion[]>([])
  const [csvText, setCsvText] = useState('')
  const [textInput, setTextInput] = useState('')
  const [jsonInput, setJsonInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [importing, setImporting] = useState(false)
  const [fileName, setFileName] = useState<string | null>(null)
  const [editingItem, setEditingItem] = useState<ParsedQuestion | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  // ── File Upload Handler ───────────────────────────────────────────────────
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setFileName(file.name)
    setLoading(true)

    const reader = new FileReader()
    reader.onload = (evt) => {
      const content = String(evt.target?.result || '')
      if (file.name.endsWith('.json')) {
        setJsonInput(content)
        setParsedList(parseJSONQuestions(content))
        setActiveTab('json')
      } else {
        setCsvText(content)
        setParsedList(parseCSVQuestions(content))
        setActiveTab('csv')
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

  // ── Template Downloads ───────────────────────────────────────────────────
  const downloadTemplate = (type: 'csv' | 'json') => {
    haptics.impact('light')
    if (type === 'csv') {
      const csvContent =
        'Savol matni (UZ),Savol matni (RU),Variant A,Variant B,Variant C,Variant D,To\'g\'ri javob,Rasm URL\n' +
        '"Ushbu belgi nimani bildiradi?","Что означает этот знак?","To\'xtash taqiqlangan","To\'xtab turish taqiqlangan","Harakatlanish taqiqlangan","Boshqa yo\'l","A",""\n' +
        '"Ikkinchi savol matni...","Текст второго вопроса...","Variant 1","Variant 2","Variant 3","Variant 4","B",""'

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `shablon_${subjectId}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } else {
      const jsonContent = JSON.stringify(
        [
          {
            questionUz: 'Ushbu belgi nimani bildiradi?',
            questionRu: 'Что означает этот знак?',
            options: ['To\'xtash taqiqlangan', 'To\'xtab turish taqiqlangan', 'Harakatlanish taqiqlangan', 'Boshqa yo\'l'],
            answer: 'A',
            image: null,
          },
          {
            questionUz: 'Ikkinchi savol matni...',
            options: {
              F1: 'Variant A',
              F2: 'Variant B',
              F3: 'Variant C',
              F4: 'Variant D',
            },
            correctAnswer: 'F2',
          },
        ],
        null,
        2
      )

      const blob = new Blob([jsonContent], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `shablon_${subjectId}.json`
      a.click()
      URL.revokeObjectURL(url)
    }
  }

  // ── In-Place Quick Edit ───────────────────────────────────────────────────
  const updateQuestionAnswer = (id_temp: string, newAns: string) => {
    setParsedList((prev) =>
      prev.map((q) => {
        if (q.id_temp !== id_temp) return q
        const isValid = Boolean(q.questionUz && Object.keys(q.optionsUz).length >= 2 && q.optionsUz[newAns])
        return {
          ...q,
          correctAnswer: newAns,
          isValid,
          errorReason: isValid ? undefined : q.errorReason,
        }
      })
    )
    haptics.impact('light')
  }

  const deleteParsedItem = (id_temp: string) => {
    setParsedList((prev) => prev.filter((q) => q.id_temp !== id_temp))
    haptics.impact('light')
  }

  const saveEditedItem = (updated: ParsedQuestion) => {
    const isValid = Boolean(
      updated.questionUz.trim().length >= 2 &&
        Object.keys(updated.optionsUz).length >= 2 &&
        updated.optionsUz[updated.correctAnswer]
    )
    setParsedList((prev) =>
      prev.map((q) =>
        q.id_temp === updated.id_temp
          ? {
              ...updated,
              isValid,
              errorReason: isValid ? undefined : "Kamida 2 ta variant va to'g'ri javob kerak",
            }
          : q
      )
    )
    setEditingItem(null)
    haptics.notify('success')
  }

  // ── Import Submission ─────────────────────────────────────────────────────
  const handleImport = async () => {
    const validItems = parsedList.filter((q) => q.isValid)
    if (validItems.length === 0) {
      alert("Yuklash uchun yaroqli savollar mavjud emas")
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

  const displayList = parsedList.filter((q) => {
    if (filterTab === 'valid') return q.isValid
    if (filterTab === 'invalid') return !q.isValid
    return true
  })

  return (
    <DialogOverlay onClose={onClose} position="center" labelId="bulk-import-title" className="animate-premiumIn" backdropClassName="bg-black/80 backdrop-blur-md">
      <div className="relative w-full max-w-lg rounded-container bg-psurface border border-pline p-5 shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-pline">
          <div>
            <h2 id="bulk-import-title" className="text-base font-semibold text-pfg flex items-center gap-2">
              <Upload size={18} className="text-ppurple" />
              Mukammal Savollar Importi
            </h2>
            <p className="text-xs text-pmuted flex items-center gap-1.5 mt-0.5">
              <SubjectIcon size={13} strokeWidth={1.75} />
              <span className="font-semibold text-pfg">{subjectName}</span> fani uchun
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Yopish"
            className="w-8 h-8 rounded-full bg-psurface border border-pline flex items-center justify-center text-pmuted hover:text-pfg"
          >
            <X size={16} />
          </button>
        </div>

        {/* Download Template Bar */}
        <div className="flex items-center justify-between p-2.5 my-2.5 bg-psurface rounded-container border border-pline text-xs">
          <span className="font-semibold text-pmuted text-[11px] flex items-center gap-1.5">
            <Download size={14} className="text-pprimary" />
            Shablonlar:
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => downloadTemplate('csv')}
              className="flex items-center gap-1 px-2.5 py-1 rounded-control bg-psurface border border-pline text-[11px] font-semibold text-pfg hover:border-ppurple active:scale-95 transition-all"
            >
              <FileSpreadsheet size={12} strokeWidth={1.75} />
              CSV (.csv)
            </button>
            <button
              onClick={() => downloadTemplate('json')}
              className="flex items-center gap-1 px-2.5 py-1 rounded-control bg-psurface border border-pline text-[11px] font-semibold text-pfg hover:border-ppurple active:scale-95 transition-all"
            >
              <FileCode size={12} strokeWidth={1.75} />
              JSON (.json)
            </button>
          </div>
        </div>

        {/* Tab Selector */}
        <div className="grid grid-cols-3 gap-1 p-1 bg-psurface rounded-container border border-pline mb-3">
          <button
            type="button"
            onClick={() => setActiveTab('csv')}
            className={`py-2 rounded-control text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'csv' ? 'bg-ppurple text-ponprimary shadow-md' : 'text-pmuted hover:text-pfg'
            }`}
          >
            <FileSpreadsheet size={14} />
            Excel / CSV
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('text')}
            className={`py-2 rounded-control text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'text' ? 'bg-ppurple text-ponprimary shadow-md' : 'text-pmuted hover:text-pfg'
            }`}
          >
            <FileText size={14} />
            Matn / AI
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('json')}
            className={`py-2 rounded-control text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'json' ? 'bg-ppurple text-ponprimary shadow-md' : 'text-pmuted hover:text-pfg'
            }`}
          >
            <FileCode size={14} />
            JSON
          </button>
        </div>

        {/* Tab Inputs */}
        <div className="overflow-y-auto flex-1 space-y-3 pr-1">
          {activeTab === 'csv' && (
            <div className="space-y-2">
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.tsv,.txt,.json"
                onChange={handleFileUpload}
                className="hidden"
              />
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-pline hover:border-ppurple/60 rounded-container p-5 text-center cursor-pointer bg-card transition-all active:scale-[0.99]"
              >
                <FileSpreadsheet size={28} className="mx-auto text-ppurple mb-1.5" />
                <p className="text-xs font-semibold text-pfg">
                  {fileName ? fileName : 'CSV, TSV yoki Excel faylni yuklang'}
                </p>
                <p className="text-[10px] text-pmuted mt-0.5">
                  Vergul (,), nuqta-vergul (;) yoki Tab bilan ajratilgan fayllar to'liq qo'llab-quvvatlanadi
                </p>
              </div>

              <details className="text-[11px] text-pmuted">
                <summary className="cursor-pointer font-semibold hover:text-pfg">
                  Yoki CSV matnini to'g'ridan-to'g'ri tashlash
                </summary>
                <textarea
                  value={csvText}
                  onChange={(e) => {
                    setCsvText(e.target.value)
                    setParsedList(parseCSVQuestions(e.target.value))
                  }}
                  rows={4}
                  placeholder={`Savol,Variant A,Variant B,Variant C,To'g'ri\n"1-savol","A","B","C","A"`}
                  className="w-full mt-1.5 bg-card border border-pline rounded-container p-2.5 text-xs text-pfg font-mono focus:outline-none focus:border-ppurple transition-all"
                />
              </details>
            </div>
          )}

          {activeTab === 'text' && (
            <div className="space-y-2">
              <textarea
                value={textInput}
                onChange={(e) => {
                  setTextInput(e.target.value)
                  setParsedList(parseSmartTextQuestions(e.target.value))
                }}
                rows={6}
                placeholder={`1. Avtomobilning maksimal tezligi qancha?\nA) 70 km/soat\nB) 90 km/soat\nC) 110 km/soat\nTo'g'ri: B\n\n2. Keyingi savol matni...\nA) Variant 1\nB) Variant 2\nJavob: A`}
                className="w-full bg-card border border-pline rounded-container p-3 text-xs text-pfg font-mono focus:outline-none focus:border-ppurple transition-all"
              />
              <p className="text-[10px] text-pmuted flex items-start gap-1">
                <Lightbulb size={11} strokeWidth={1.75} className="mt-px flex-none" />
                ChatGPT, Word yoki test to'plamlaridan nusxalangan matnlarni to'g'ridan-to'g'ri qo'yishingiz mumkin.
              </p>
            </div>
          )}

          {activeTab === 'json' && (
            <div className="space-y-2">
              <textarea
                value={jsonInput}
                onChange={(e) => {
                  setJsonInput(e.target.value)
                  setParsedList(parseJSONQuestions(e.target.value))
                }}
                rows={6}
                placeholder={`[\n  {\n    "question": "Savol matni?",\n    "options": ["Variant A", "Variant B", "Variant C"],\n    "answer": "A"\n  }\n]`}
                className="w-full bg-card border border-pline rounded-container p-3 text-xs text-pfg font-mono focus:outline-none focus:border-ppurple transition-all"
              />
            </div>
          )}

          {/* Parsed Summary & Filter Badges */}
          {loading ? (
            <div className="py-8 text-center text-pmuted">
              <Loader2 size={24} className="motion-safe:animate-spin mx-auto mb-2 text-ppurple" />
              <p className="text-xs font-semibold">Tahlil qilinmoqda...</p>
            </div>
          ) : parsedList.length > 0 ? (
            <div className="space-y-2.5 pt-2 border-t border-pline">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setFilterTab('all')}
                    className={`px-2.5 py-1 rounded-control text-[11px] font-semibold transition-all ${
                      filterTab === 'all'
                        ? 'bg-fg text-bg'
                        : 'bg-psurface border border-pline text-pmuted hover:text-pfg'
                    }`}
                  >
                    Barchasi ({parsedList.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterTab('valid')}
                    className={`px-2.5 py-1 rounded-control text-[11px] font-semibold flex items-center gap-1 transition-all ${
                      filterTab === 'valid'
                        ? 'bg-pprimary text-ponprimary'
                        : 'bg-pprimary/10 border border-pprimary/30 text-pprimary'
                    }`}
                  >
                    <CheckCircle2 size={12} /> {validCount}
                  </button>
                  {invalidCount > 0 && (
                    <button
                      type="button"
                      onClick={() => setFilterTab('invalid')}
                      className={`px-2.5 py-1 rounded-control text-[11px] font-semibold flex items-center gap-1 transition-all ${
                        filterTab === 'invalid'
                          ? 'bg-pdanger text-white'
                          : 'bg-pdanger/10 border border-pdanger/30 text-pdanger'
                      }`}
                    >
                      <AlertCircle size={12} /> {invalidCount} xato
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setParsedList([])
                    setFileName(null)
                    setTextInput('')
                    setJsonInput('')
                    setCsvText('')
                  }}
                  className="p-1 text-pmuted hover:text-pdanger"
                  title="Tozalash"
                >
                  <Trash2 size={14} />
                </button>
              </div>

              {/* Parsed Interactive Questions List */}
              <div className="max-h-56 overflow-y-auto space-y-2 pr-1">
                {displayList.map((q, idx) => (
                  <div
                    key={q.id_temp}
                    className={`p-3 rounded-container border text-xs transition-all ${
                      q.isValid ? 'bg-card border-pline' : 'bg-pdanger/10 border-pdanger/30'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <p className="font-semibold text-pfg line-clamp-2">
                        #{idx + 1}. {q.questionUz}
                      </p>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          onClick={() => setEditingItem(q)}
                          className="p-1 text-pmuted hover:text-pblue"
                          title="Tahrirlash"
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          onClick={() => deleteParsedItem(q.id_temp)}
                          className="p-1 text-pmuted hover:text-pdanger"
                          title="O'chirish"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>

                    {/* Options list with click-to-change correct answer */}
                    <div className="grid grid-cols-2 gap-1.5 mt-2">
                      {Object.entries(q.optionsUz).map(([optKey, optVal]) => {
                        const isCorrect = q.correctAnswer === optKey
                        return (
                          <button
                            key={optKey}
                            type="button"
                            onClick={() => updateQuestionAnswer(q.id_temp, optKey)}
                            className={`p-1.5 rounded-control border text-left text-[11px] truncate flex items-center gap-1.5 transition-all ${
                              isCorrect
                                ? 'bg-pprimary/20 border-pprimary/50 text-pfg font-semibold'
                                : 'bg-psurface/60 border-pline/60 text-pmuted hover:text-pfg'
                            }`}
                            title="To'g'ri javob qilish uchun bosing"
                          >
                            <span
                              className={`w-4 h-4 rounded-md flex items-center justify-center text-[9px] font-semibold ${
                                isCorrect ? 'bg-pprimary text-ponprimary' : 'bg-psurface'
                              }`}
                            >
                              {optKey}
                            </span>
                            <span className="truncate">{optVal}</span>
                          </button>
                        )
                      })}
                    </div>

                    {!q.isValid && (
                      <p className="text-[10px] text-pdanger font-semibold mt-1.5 flex items-center gap-1">
                        <AlertCircle size={11} /> {q.errorReason}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-pline mt-2 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 rounded-container bg-psurface text-xs font-semibold text-pmuted hover:text-pfg active:scale-95 transition-all"
          >
            Bekor qilish
          </button>
          <button
            type="button"
            disabled={validCount === 0 || importing}
            onClick={handleImport}
            className="flex-1 bg-pprimary text-ponprimary font-semibold hover:brightness-[1.06] active:scale-[0.98] disabled:opacity-[0.42] disabled:pointer-events-none transition-[transform,filter] duration-[120ms] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pprimary focus-visible:ring-offset-2 py-3 rounded-container text-xs font-semibold flex items-center justify-center gap-1.5 disabled:opacity-40"
          >
            {importing ? (
              <>
                <Loader2 size={15} className="motion-safe:animate-spin" />
                <span>Yuklanmoqda...</span>
              </>
            ) : (
              <span>{validCount} ta savolni yuklash</span>
            )}
          </button>
        </div>
      </div>

      {/* In-Modal Single Question Edit Popup (nested overlay: Escape faqat shuni yopadi) */}
      {editingItem && (
        <DialogOverlay onClose={() => setEditingItem(null)} position="center" zIndex={60} labelId="bulk-edit-title" backdropClassName="bg-black/85 backdrop-blur-md">
          <div className="w-full max-w-sm rounded-container bg-psurface border border-pline p-5 space-y-3 shadow-2xl relative">
            <div className="flex items-center justify-between">
              <h3 id="bulk-edit-title" className="text-sm font-semibold text-pfg">Savolni tahrirlash</h3>
              <button onClick={() => setEditingItem(null)} aria-label="Yopish" className="p-1 text-pmuted">
                <X size={16} />
              </button>
            </div>

            <div>
              <label className="text-[11px] text-pmuted font-semibold block mb-1">Savol matni</label>
              <textarea
                value={editingItem.questionUz}
                onChange={(e) =>
                  setEditingItem({
                    ...editingItem,
                    questionUz: e.target.value,
                    questionRu: e.target.value,
                  })
                }
                rows={3}
                className="w-full bg-psurface border border-pline rounded-control p-2 text-xs text-pfg"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] text-pmuted font-semibold block">Variantlar</label>
              {['F1', 'F2', 'F3', 'F4'].map((key) => (
                <div key={key} className="flex items-center gap-2">
                  <span className="text-[11px] font-mono font-semibold text-pmuted w-5">{key}</span>
                  <input
                    type="text"
                    value={editingItem.optionsUz[key] || ''}
                    onChange={(e) => {
                      const newOpts = { ...editingItem.optionsUz, [key]: e.target.value }
                      if (!e.target.value.trim()) delete newOpts[key]
                      setEditingItem({
                        ...editingItem,
                        optionsUz: newOpts,
                        optionsRu: newOpts,
                      })
                    }}
                    placeholder={`Variant ${key}`}
                    className="flex-1 bg-psurface border border-pline rounded-control px-2.5 py-1.5 text-xs text-pfg"
                  />
                  <button
                    type="button"
                    onClick={() => setEditingItem({ ...editingItem, correctAnswer: key })}
                    className={`p-1.5 rounded-control border text-[10px] font-semibold ${
                      editingItem.correctAnswer === key
                        ? 'bg-pprimary text-ponprimary border-pprimary'
                        : 'bg-psurface border-pline text-pmuted'
                    }`}
                    title="To'g'ri javob qilish"
                  >
                    <Check size={12} />
                  </button>
                </div>
              ))}
            </div>

            <button
              onClick={() => saveEditedItem(editingItem)}
              className="bg-pprimary text-ponprimary font-semibold hover:brightness-[1.06] active:scale-[0.98] disabled:opacity-[0.42] disabled:pointer-events-none transition-[transform,filter] duration-[120ms] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pprimary focus-visible:ring-offset-2 w-full py-2.5 rounded-control text-xs font-semibold"
            >
              Saqlash
            </button>
          </div>
        </DialogOverlay>
      )}
    </DialogOverlay>
  )
}
