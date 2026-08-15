import { useState, useRef } from 'react'
import {
  Sparkles,
  FileText,
  Lightbulb,
  CheckCircle2,
  Loader2,
  Trash2,
  Plus,
  Save,
  Image as ImageIcon,
  Check,
  RotateCw,
  HelpCircle,
} from 'lucide-react'
import { SUBJECTS } from '../../../shared/config/subjects'
import { api } from '../../../shared/api'
import { playSound } from '../../../shared/lib/sounds'
import { haptics } from '../../../platform/haptics'
import Confetti from '../../../shared/components/Confetti'

interface EditableQuestion {
  id: string
  questionUz: string
  questionRu: string
  optionsUz: Array<{ id: string; text: string }>
  optionsRu: Array<{ id: string; text: string }>
  correctAnswer: string // e.g. "A1"
  explanation?: string
  image?: string | null
}

const DIFFICULTY_LABELS = {
  easy: 'Oson',
  medium: "O'rtacha",
  hard: 'Qiyin',
  mixed: 'Aralash',
} as const

const SAMPLE_TOPICS: Record<string, string[]> = {
  yhq: [
    'Chorrahada burilish va harakatlanish ustunligi qoidalari',
    'Svetofor va tartibga soluvchining ishoralari',
    'Avtomagistralda va turar-joy dahalarida harakatlanish tezligi',
    'Quvib o\'tish va yo\'l berish qoidalari',
  ],
  fizika: [
    'Nyutonning dinamika qonunlari va jism harakati',
    'Arximed kuchi va jismlarning suzish shartlari',
    'Om qonuni va elektr zanjiri hisoblari',
  ],
  matematika: [
    'Kvadrat tenglamalar va Viyet teoremasi',
    'Foizlar va proporsiyaga oid amaliy masalalar',
    'Uchburchak burchaklari va trigonometrik funksiyalar',
  ],
  ingliz: [
    'Present Perfect vs Past Simple tenses usage',
    'Conditional Sentences (Type 1, 2 and 3)',
    'Passive Voice in English Grammar',
  ],
  rus: [
    'Спряжение глаголов и правописание окончаний',
    'Падежи имен существительных и предлоги',
    'Правописание НЕ с различными частями речи',
  ],
}

export default function AdminAiStudioTab() {
  const [mode, setMode] = useState<'custom_text' | 'topic'>('custom_text')
  const [selectedSubject, setSelectedSubject] = useState(SUBJECTS[0]?.id || 'yhq')
  const [promptText, setPromptText] = useState('')
  const [count, setCount] = useState<number>(5)
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard' | 'mixed'>('medium')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [confetti, setConfetti] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [activeLangTab, setActiveLangTab] = useState<'uz' | 'ru'>('uz')

  const [questions, setQuestions] = useState<EditableQuestion[]>([])

  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({})

  const currentSubjectObj = SUBJECTS.find((s) => s.id === selectedSubject) || SUBJECTS[0]

  // ── Handle AI Generation ─────────────────────────────────────────────────
  const handleGenerate = async () => {
    if (!promptText.trim()) {
      alert(
        mode === 'custom_text'
          ? 'Iltimos, savol tuzish uchun matn yoki darslik konspektini kiriting!'
          : 'Iltimos, mavzu nomini kiriting!'
      )
      return
    }

    setLoading(true)
    setSuccessMessage(null)
    try {
      const res = await api.generateAiQuestions({
        mode,
        subjectId: selectedSubject,
        subjectName: currentSubjectObj.name,
        promptText: promptText.trim(),
        count,
        difficulty,
        language: 'both',
      })

      if (res.ok && res.questions?.length > 0) {
        const editableList: EditableQuestion[] = res.questions.map((q, idx) => ({
          id: `q_${Date.now()}_${idx}`,
          questionUz: q.questionUz,
          questionRu: q.questionRu,
          optionsUz: q.optionsUz,
          optionsRu: q.optionsRu,
          correctAnswer: q.correctAnswer || 'A1',
          explanation: q.explanation || '',
          image: null,
        }))

        setQuestions(editableList)
        playSound('win')
        haptics.notify('success')
        setSuccessMessage(`✨ AI ${editableList.length} ta savolni muvaffaqiyatli tayyorladi! Ularni tekshirib, bazaga saqlashingiz mumkin.`)
        setTimeout(() => setSuccessMessage(null), 5000)
      }
    } catch (err: any) {
      let msg = err?.message || 'AI savol generatsiyasida xatolik yuz berdi'
      if (msg.includes('503') || msg.includes('GEMINI_API_KEY')) {
        msg = "AI xizmati uchun GEMINI_API_KEY sozlanmagan. Iltimos, server .env faylida GEMINI_API_KEY kalitini kiriting."
      }
      alert(msg)
    } finally {
      setLoading(false)
    }
  }

  // ── Handle Image File Compression for a Question ─────────────────────────
  const handleImageSelect = (qId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (evt) => {
      const rawDataUrl = String(evt.target?.result || '')
      const img = new Image()
      img.onload = () => {
        const maxDim = 1280
        let width = img.width
        let height = img.height
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width)
            width = maxDim
          } else {
            width = Math.round((width * maxDim) / height)
            height = maxDim
          }
        }

        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height)
          const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.82)
          updateQuestion(qId, { image: compressedDataUrl })
        }
      }
      img.src = rawDataUrl
    }
    reader.readAsDataURL(file)
  }

  // ── Question Update Helpers ──────────────────────────────────────────────
  const updateQuestion = (id: string, patch: Partial<EditableQuestion>) => {
    setQuestions((prev) => prev.map((q) => (q.id === id ? { ...q, ...patch } : q)))
  }

  const updateOptionText = (
    qId: string,
    optId: string,
    lang: 'uz' | 'ru',
    text: string
  ) => {
    setQuestions((prev) =>
      prev.map((q) => {
        if (q.id !== qId) return q
        if (lang === 'uz') {
          return {
            ...q,
            optionsUz: q.optionsUz.map((o) => (o.id === optId ? { ...o, text } : o)),
          }
        } else {
          return {
            ...q,
            optionsRu: q.optionsRu.map((o) => (o.id === optId ? { ...o, text } : o)),
          }
        }
      })
    )
  }

  const handleDeleteQuestion = (id: string) => {
    setQuestions((prev) => prev.filter((q) => q.id !== id))
  }

  const handleAddBlankQuestion = () => {
    const newQ: EditableQuestion = {
      id: `q_${Date.now()}_custom`,
      questionUz: '',
      questionRu: '',
      optionsUz: [
        { id: 'A1', text: '' },
        { id: 'A2', text: '' },
        { id: 'A3', text: '' },
        { id: 'A4', text: '' },
      ],
      optionsRu: [
        { id: 'A1', text: '' },
        { id: 'A2', text: '' },
        { id: 'A3', text: '' },
        { id: 'A4', text: '' },
      ],
      correctAnswer: 'A1',
      explanation: '',
      image: null,
    }
    setQuestions((prev) => [...prev, newQ])
  }

  // ── Save All Questions to Database ───────────────────────────────────────
  const handleSaveAll = async () => {
    if (questions.length === 0) return

    // Validation check
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i]
      if (!q.questionUz.trim() && !q.questionRu.trim()) {
        alert(`${i + 1}-savol matni bo'sh! Iltimos, savol matnini kiriting.`)
        return
      }
      const emptyOptUz = q.optionsUz.find((o) => !o.text.trim())
      if (emptyOptUz) {
        alert(`${i + 1}-savolning "${emptyOptUz.id}" varianti to'ldirilmagan!`)
        return
      }
    }

    setSaving(true)
    try {
      const items = questions.map((q) => ({
        questionUz: q.questionUz.trim() || q.questionRu.trim(),
        questionRu: q.questionRu.trim() || q.questionUz.trim(),
        optionsUz: q.optionsUz.map((o) => ({ id: o.id, text: o.text.trim() })),
        optionsRu: q.optionsRu.map((o) => ({ id: o.id, text: o.text.trim() })),
        correctAnswer: q.correctAnswer,
        image: q.image || null,
      }))

      const res = await api.bulkImportQuestions({
        subjectId: selectedSubject,
        items,
      })

      if (res.ok) {
        playSound('win')
        haptics.notify('success')
        setConfetti(true)
        alert(`✅ ${items.length} ta savol muvaffaqiyatli bazaga qo'shildi!`)
        setQuestions([])
        setPromptText('')
        setTimeout(() => setConfetti(false), 5000)
      }
    } catch (err: any) {
      alert(err?.message || 'Savollarni saqlashda xatolik yuz berdi')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-4 space-y-5">
      {confetti && <Confetti />}

      {/* Header */}
      <div>
        <h2 className="text-base font-black text-fg flex items-center gap-2">
          <Sparkles size={18} className="text-duo-yellow" />
          <span>✨ AI Savol Generatori & Matn Studiyasi</span>
        </h2>
        <p className="text-xs text-muted mt-0.5">
          Admin o'zi yozgan matn yoki mavzu asosida professional test savollarini avtomatik shakllantirish
        </p>
      </div>

      {/* Mode Selector */}
      <div className="grid grid-cols-2 gap-2 p-1 bg-elevated rounded-2xl border border-line">
        <button
          type="button"
          onClick={() => setMode('custom_text')}
          className={`py-2.5 px-3 rounded-xl text-xs font-black flex items-center justify-center gap-2 transition-all ${
            mode === 'custom_text'
              ? 'bg-duo-purple text-ponprimary shadow-md'
              : 'text-muted hover:text-fg'
          }`}
        >
          <FileText size={15} />
          <span>Matn yozish / Konspekt</span>
        </button>

        <button
          type="button"
          onClick={() => setMode('topic')}
          className={`py-2.5 px-3 rounded-xl text-xs font-black flex items-center justify-center gap-2 transition-all ${
            mode === 'topic'
              ? 'bg-duo-purple text-ponprimary shadow-md'
              : 'text-muted hover:text-fg'
          }`}
        >
          <Lightbulb size={15} />
          <span>Mavzu / Qoida bo'yicha</span>
        </button>
      </div>

      {/* Subject Selector Badges */}
      <div className="space-y-1.5">
        <label className="text-xs font-bold text-fg">Fanni tanlang</label>
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
          {SUBJECTS.map((s) => {
            const isSelected = selectedSubject === s.id
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setSelectedSubject(s.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 whitespace-nowrap transition-all border ${
                  isSelected
                    ? 'bg-surface border-duo-purple text-fg shadow-sm'
                    : 'bg-card border-line text-muted hover:text-fg'
                }`}
              >
                <s.icon size={13} style={{ color: s.color }} />
                <span>{s.name}</span>
                {isSelected && <Check size={12} className="text-duo-purple" />}
              </button>
            )
          })}
        </div>
      </div>

      {/* Prompt Input Form */}
      <div className="rounded-2xl bg-surface border border-line p-4 space-y-4 shadow-sm">
        {mode === 'custom_text' ? (
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-bold text-fg">Darslik matni, qoidalar yoki konspekt</label>
              <span className="text-[10px] text-muted">{promptText.length} / 15 000 belgi</span>
            </div>
            <textarea
              value={promptText}
              onChange={(e) => setPromptText(e.target.value)}
              rows={6}
              placeholder="O'zingiz yozgan qoidalar, darslikdan parcha yoki qonun moddalarini kiriting..."
              className="w-full bg-card border border-line rounded-2xl p-3 text-xs text-fg focus:outline-none focus:border-duo-purple transition-all"
            />
          </div>
        ) : (
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-bold text-fg">Mavzu nomi yoki qoida sarlavhasi</label>
            </div>
            <input
              type="text"
              value={promptText}
              onChange={(e) => setPromptText(e.target.value)}
              placeholder="Masalan: Chorrahada burilish qoidalari..."
              className="w-full bg-card border border-line rounded-2xl px-3 py-2.5 text-xs text-fg focus:outline-none focus:border-duo-purple transition-all"
            />

            {/* Sample Topics Suggestions */}
            {SAMPLE_TOPICS[selectedSubject]?.length > 0 && (
              <div className="mt-2.5">
                <span className="text-[10px] text-muted block mb-1 font-bold">Namunaviy mavzular:</span>
                <div className="flex flex-wrap gap-1.5">
                  {SAMPLE_TOPICS[selectedSubject].map((topic, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setPromptText(topic)}
                      className="px-2 py-1 rounded-lg bg-elevated border border-line text-[10px] text-muted hover:text-fg active:scale-95 transition-all text-left"
                    >
                      💡 {topic}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Parameters: Count & Difficulty */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-line">
          {/* Savollar soni */}
          <div>
            <label className="text-[11px] font-bold text-fg block mb-1.5">Savollar soni</label>
            <div className="grid grid-cols-5 gap-1">
              {[3, 5, 10, 15, 20].map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCount(c)}
                  className={`py-1.5 rounded-xl text-xs font-black transition-all border ${
                    count === c
                      ? 'bg-duo-purple text-ponprimary border-duo-purple shadow-sm'
                      : 'bg-card border-line text-muted hover:text-fg'
                  }`}
                >
                  {c} ta
                </button>
              ))}
            </div>
          </div>

          {/* Qiyinchilik darajasi */}
          <div>
            <label className="text-[11px] font-bold text-fg block mb-1.5">Qiyinchilik</label>
            <div className="grid grid-cols-4 gap-1">
              {(['easy', 'medium', 'hard', 'mixed'] as const).map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDifficulty(d)}
                  className={`py-1.5 rounded-xl text-[11px] font-bold transition-all border ${
                    difficulty === d
                      ? 'bg-duo-purple text-ponprimary border-duo-purple shadow-sm'
                      : 'bg-card border-line text-muted hover:text-fg'
                  }`}
                >
                  {DIFFICULTY_LABELS[d]}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Generate Action Button */}
        <button
          type="button"
          disabled={loading || !promptText.trim()}
          onClick={handleGenerate}
          className="w-full btn-premium py-3 rounded-2xl text-xs font-black flex items-center justify-center gap-2 shadow-lg disabled:opacity-40"
        >
          {loading ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              <span>AI savollarni tayyorlamoqda (~5-10s)...</span>
            </>
          ) : (
            <>
              <Sparkles size={16} />
              <span>✨ {count} ta savolni generatsiya qilish</span>
            </>
          )}
        </button>
      </div>

      {successMessage && (
        <div className="p-3.5 rounded-2xl bg-psuccess/10 border border-psuccess/30 text-psuccess text-xs font-bold flex items-center gap-2 shadow-sm animate-premiumIn">
          <CheckCircle2 size={18} className="flex-none" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* ── GENERATED QUESTIONS STUDIO LIST ── */}
      {questions.length > 0 && (
        <div className="space-y-4 pt-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-black text-fg">Tayyorlangan Savollar ({questions.length} ta)</h3>
            </div>

            {/* Language Switcher for Questions View */}
            <div className="flex items-center gap-1 bg-elevated p-0.5 rounded-xl border border-line text-[10px] font-bold">
              <button
                type="button"
                onClick={() => setActiveLangTab('uz')}
                className={`px-2.5 py-1 rounded-lg transition-all ${
                  activeLangTab === 'uz' ? 'bg-duo-purple text-ponprimary shadow-xs' : 'text-muted hover:text-fg'
                }`}
              >
                🇺🇿 O'zbekcha
              </button>
              <button
                type="button"
                onClick={() => setActiveLangTab('ru')}
                className={`px-2.5 py-1 rounded-lg transition-all ${
                  activeLangTab === 'ru' ? 'bg-duo-purple text-ponprimary shadow-xs' : 'text-muted hover:text-fg'
                }`}
              >
                🇷🇺 Русский
              </button>
            </div>
          </div>

          {/* Question Cards */}
          <div className="space-y-4">
            {questions.map((q, qIndex) => {
              const currentQuestionText = activeLangTab === 'uz' ? q.questionUz : q.questionRu
              const currentOptions = activeLangTab === 'uz' ? q.optionsUz : q.optionsRu

              return (
                <div
                  key={q.id}
                  className="rounded-3xl bg-surface border border-line p-4 space-y-3.5 shadow-sm relative group"
                >
                  {/* Card Top */}
                  <div className="flex items-center justify-between border-b border-line pb-2.5">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-lg bg-duo-purple/15 text-duo-purple text-xs font-black flex items-center justify-center">
                        {qIndex + 1}
                      </span>
                      <span className="text-xs font-bold text-fg">Savol #{qIndex + 1}</span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleDeleteQuestion(q.id)}
                      className="text-muted hover:text-duo-red p-1 rounded-lg hover:bg-duo-red/10 transition-colors"
                      title="Savolni o'chirish"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>

                  {/* Question Textarea */}
                  <div>
                    <label className="text-[11px] font-bold text-fg block mb-1">
                      Savol matni ({activeLangTab.toUpperCase()}):
                    </label>
                    <textarea
                      value={currentQuestionText}
                      onChange={(e) => {
                        const val = e.target.value
                        if (activeLangTab === 'uz') updateQuestion(q.id, { questionUz: val })
                        else updateQuestion(q.id, { questionRu: val })
                      }}
                      rows={2}
                      className="w-full bg-card border border-line rounded-xl p-2.5 text-xs text-fg focus:outline-none focus:border-duo-purple transition-all"
                    />
                  </div>

                  {/* Options List */}
                  <div className="space-y-2">
                    <label className="text-[11px] font-bold text-fg block">
                      Variantlar (To'g'ri javobni radio bilan tanlang):
                    </label>
                    <div className="space-y-1.5">
                      {currentOptions.map((opt) => {
                        const isCorrect = q.correctAnswer === opt.id
                        return (
                          <div
                            key={opt.id}
                            className={`flex items-center gap-2 p-2 rounded-xl border transition-all ${
                              isCorrect ? 'bg-psuccess/10 border-psuccess/40' : 'bg-card border-line'
                            }`}
                          >
                            <input
                              type="radio"
                              name={`correct_${q.id}`}
                              checked={isCorrect}
                              onChange={() => updateQuestion(q.id, { correctAnswer: opt.id })}
                              className="accent-duo-green w-4 h-4 cursor-pointer"
                            />
                            <span className="text-[11px] font-black text-muted w-5 flex-none">{opt.id}.</span>
                            <input
                              type="text"
                              value={opt.text}
                              onChange={(e) => updateOptionText(q.id, opt.id, activeLangTab, e.target.value)}
                              placeholder={`Variant ${opt.id}...`}
                              className="flex-1 bg-transparent border-0 text-xs text-fg focus:outline-none"
                            />
                            {isCorrect && (
                              <span className="text-[10px] font-black text-psuccess bg-psuccess/20 px-1.5 py-0.5 rounded-md flex-none">
                                To'g'ri ✓
                              </span>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  {/* Explanation */}
                  <div>
                    <label className="text-[11px] font-bold text-fg flex items-center gap-1 mb-1">
                      <HelpCircle size={13} className="text-duo-yellow" />
                      <span>Tushuntirish (Explanation):</span>
                    </label>
                    <input
                      type="text"
                      value={q.explanation || ''}
                      onChange={(e) => updateQuestion(q.id, { explanation: e.target.value })}
                      placeholder="Nega aynan shu javob to'g'ri ekanligi tushuntirishi..."
                      className="w-full bg-card border border-line rounded-xl px-3 py-2 text-xs text-fg focus:outline-none focus:border-duo-purple transition-all"
                    />
                  </div>

                  {/* Image Attachment */}
                  <div className="pt-1">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-bold text-fg flex items-center gap-1">
                        <ImageIcon size={13} className="text-duo-blue" />
                        <span>Rasm (ixtiyoriy)</span>
                      </label>
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        ref={(el) => {
                          fileInputRefs.current[q.id] = el
                        }}
                        onChange={(e) => handleImageSelect(q.id, e)}
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={() => fileInputRefs.current[q.id]?.click()}
                        className="text-[11px] font-bold text-duo-purple hover:underline flex items-center gap-1"
                      >
                        <RotateCw size={12} />
                        <span>{q.image ? 'Rasmni almashtirish' : 'Rasm yuklash'}</span>
                      </button>
                    </div>

                    {q.image && (
                      <div className="mt-2 relative inline-block">
                        <img
                          src={q.image}
                          alt="Savol rasmi"
                          className="h-24 w-auto rounded-xl border border-line object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => updateQuestion(q.id, { image: null })}
                          className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full bg-duo-red text-white flex items-center justify-center text-xs shadow-md"
                        >
                          ✕
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Bottom Action Controls */}
          <div className="flex flex-col sm:flex-row gap-2 pt-2">
            <button
              type="button"
              onClick={handleAddBlankQuestion}
              className="py-3 px-4 rounded-2xl bg-elevated border border-line text-xs font-bold text-fg hover:border-duo-purple flex items-center justify-center gap-1.5 transition-all"
            >
              <Plus size={16} />
              <span>Yangi bo'sh savol qo'shish</span>
            </button>

            <button
              type="button"
              disabled={saving || questions.length === 0}
              onClick={handleSaveAll}
              className="flex-1 btn-premium py-3 rounded-2xl text-xs font-black flex items-center justify-center gap-2 shadow-lg disabled:opacity-40"
            >
              {saving ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Bazaga saqlanmoqda...</span>
                </>
              ) : (
                <>
                  <Save size={16} />
                  <span>💾 Barcha {questions.length} ta savolni Bazaga Saqlash</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
