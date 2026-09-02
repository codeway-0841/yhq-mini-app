import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import {
  Plus,
  Pencil,
  Trash2,
  Search,
  X,
  Loader2,
  AlertTriangle,
  RotateCw,
  Upload,
  Image as ImageIcon,
  CheckCircle2,
} from 'lucide-react'
import { api, type AdminDbQuestion, type DbTopic } from '../../../shared/api'
import { type SubjectId } from '../../../../shared/subjects'
import { SUBJECTS } from '../../../shared/config/subjects'
import { useQuestionsStore } from '../../../shared/store/useQuestionsStore'
import { haptics } from '../../../platform/haptics'
import BulkImportModal from './BulkImportModal'
import DialogOverlay from '../../../shared/components/DialogOverlay'

interface AdminQuestionsTabProps {
  lang: 'uz' | 'ru'
}

export default function AdminQuestionsTab({ lang }: AdminQuestionsTabProps) {
  const [selectedSubject, setSelectedSubject] = useState<SubjectId>('yhq')
  const [rows, setRows] = useState<AdminDbQuestion[]>([])
  const [topics, setTopics] = useState<DbTopic[]>([])
  const [meta, setMeta] = useState<{ total: number; withTopic: number } | null>(null)
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<AdminDbQuestion | null>(null)
  const [creating, setCreating] = useState(false)
  const [bulkImporting, setBulkImporting] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [deleteConfirm, setConfirm] = useState<AdminDbQuestion | null>(null)

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3500)
  }

  const currentSubjectObj = useMemo(() => {
    return SUBJECTS.find((s) => s.id === selectedSubject) ?? SUBJECTS[0]
  }, [selectedSubject])

  const loadAll = useCallback(async (subject: SubjectId) => {
    setLoading(true)
    try {
      const [qs, m, topList] = await Promise.all([
        api.getAdminQuestions(subject),
        api.getQuestionsMeta(subject),
        api.getAdminTopics(subject).catch(() => []),
      ])
      setRows(qs)
      setMeta(m)
      setTopics(topList)
    } catch {
      setRows([])
      setMeta({ total: 0, withTopic: 0 })
      setTopics([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadAll(selectedSubject)
  }, [loadAll, selectedSubject])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (q) {
      return rows.filter((x) =>
        String(x.id).includes(q) ||
        x.questionUz.toLowerCase().includes(q) ||
        x.questionRu.toLowerCase().includes(q),
      )
    }
    return [...rows].reverse()
  }, [rows, search])

  const topic = useCallback((topicId: number | null) => {
    if (topicId == null) return '——'
    const t: DbTopic | undefined = topics.find((x) => x.id === topicId)
    return t ? (lang === 'ru' ? t.nameRu : t.nameUz) : `#${topicId}`
  }, [topics, lang])

  const refresh = useCallback(async () => {
    setBusy(true)
    try {
      await loadAll(selectedSubject)
    } finally {
      setBusy(false)
    }
  }, [loadAll, selectedSubject])

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-pfg flex items-center gap-2">
            <currentSubjectObj.icon size={18} strokeWidth={1.75} style={{ color: currentSubjectObj.color }} />
            <span>Savollar boshqaruvi</span>
          </h2>
          <p className="text-xs text-pmuted">
            {lang === 'ru' ? currentSubjectObj.nameRu : currentSubjectObj.name} ({meta?.total ?? rows.length} ta savol)
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={refresh}
            disabled={busy}
            className="p-2.5 rounded-2xl bg-psurface text-pmuted hover:text-pfg active:scale-95 transition-transform shadow-xs"
            title="Yangilash"
          >
            <RotateCw size={14} className={busy ? 'motion-safe:animate-spin text-ppurple' : ''} />
          </button>
          <button
            onClick={() => setBulkImporting(true)}
            className="px-3 py-2.5 rounded-2xl bg-psurface text-xs font-semibold text-pfg hover:bg-pcard active:scale-95 transition-all flex items-center gap-1 shadow-xs"
            title="Ommaviy yuklash"
          >
            <Upload size={14} className="text-ppurple" />
            <span>Ommaviy</span>
          </button>
          <button
            onClick={() => setCreating(true)}
            className="bg-pprimary text-ponprimary font-semibold hover:brightness-[1.06] active:scale-[0.98] disabled:opacity-[0.42] disabled:pointer-events-none transition-[transform,filter] duration-[120ms] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pprimary focus-visible:ring-offset-2 flex items-center gap-1 px-3 py-2.5 rounded-2xl text-xs font-semibold"
          >
            <Plus size={14} />
            <span>Yangi</span>
          </button>
        </div>
      </div>

      {/* Subject Chips Selector */}
      <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
        {SUBJECTS.map((sub) => {
          const isSelected = selectedSubject === sub.id
          return (
            <button
              key={sub.id}
              type="button"
              onClick={() => {
                setSelectedSubject(sub.id)
                haptics.impact('light')
              }}
              className={`px-3.5 py-2.5 rounded-2xl text-xs font-semibold flex items-center gap-2 whitespace-nowrap transition-all flex-shrink-0 ${
                isSelected
                  ? 'text-white shadow-md scale-[1.02]'
                  : 'bg-psurface text-pmuted hover:text-pfg shadow-xs'
              }`}
              style={isSelected ? { backgroundColor: sub.color } : undefined}
            >
              <sub.icon size={14} strokeWidth={2} style={{ color: isSelected ? '#ffffff' : sub.color }} />
              <span>{lang === 'ru' ? sub.nameRu : sub.name}</span>
            </button>
          )
        })}
      </div>

      {/* Meta counters */}
      {meta && (
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-pcard p-3.5 shadow-xs">
            <span className="text-[11px] text-pmuted block font-medium">Ushbu fanda jami</span>
            <span className="text-xl font-semibold text-pfg">{meta.total} ta savol</span>
          </div>
          <div className="rounded-2xl bg-pcard p-3.5 shadow-xs">
            <span className="text-[11px] text-pmuted block font-medium">Mavzuga bog'langan</span>
            <span className="text-xl font-semibold text-pprimary">{meta.withTopic} ta</span>
          </div>
        </div>
      )}

      {/* Search Input */}
      <div className="relative">
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-pmuted" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={`${currentSubjectObj.name} savollaridan qidirish...`}
          className="w-full bg-card border border-pline rounded-2xl pl-10 pr-4 py-3 text-xs font-semibold text-pfg focus:outline-none focus:border-ppurple transition-all"
        />
      </div>

      {/* Questions list */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 text-pmuted">
          <Loader2 size={26} className="motion-safe:animate-spin mb-2 text-ppurple" />
          <p className="text-xs font-semibold">Savollar yuklanmoqda...</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((q) => (
            <div key={q.id} className="rounded-2xl bg-pcard p-3.5 shadow-xs">
              <div className="flex gap-3 items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] text-ppurple font-semibold bg-ppurple/10 px-2 py-0.5 rounded-md">
                      #{q.id}
                    </span>
                    <span className="text-[11px] text-pmuted font-semibold truncate">
                      {topic(q.topicId)}
                    </span>
                  </div>
                  <p className="text-[13px] text-pfg font-medium line-clamp-2 mb-1.5">
                    {lang === 'ru' ? q.questionRu : q.questionUz}
                  </p>
                  <p className="text-[11px] text-pmuted">
                    To'g'ri javob: <b className="text-pprimary font-semibold">{q.correctAnswer}</b>
                  </p>
                  {q.image && (
                    <div className="mt-2 flex items-center gap-2">
                      <img
                        src={q.image}
                        alt="Savol rasmi"
                        className="w-12 h-12 object-cover rounded-xl bg-psurface shadow-2xs"
                        onError={(e) => {
                          ;(e.target as HTMLElement).style.display = 'none'
                        }}
                      />
                      <span className="text-[11px] font-semibold text-ppurple flex items-center gap-1">
                        <ImageIcon size={12} />
                        <span>Rasm biriktirilgan</span>
                      </span>
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-1.5 flex-shrink-0">
                  <button
                    onClick={() => setEditing(q)}
                    className="p-2 bg-psurface rounded-xl active:scale-90 transition-transform shadow-xs"
                    title="Tahrirlash"
                  >
                    <Pencil size={13} className="text-pblue" />
                  </button>
                  <button
                    onClick={() => setConfirm(q)}
                    className="p-2 bg-psurface rounded-xl active:scale-90 transition-transform shadow-xs"
                    title="O'chirish"
                  >
                    <Trash2 size={13} className="text-pdanger" />
                  </button>
                </div>
              </div>
            </div>
          ))}

          {filtered.length === 0 && (
            <div className="rounded-2xl bg-pcard p-8 text-center shadow-xs">
              <p className="text-sm font-semibold text-pfg">Savol topilmadi</p>
              <p className="text-xs text-pmuted mt-1">
                {search ? "Boshqa so'z bilan qidiring" : "Ushbu fanga hali savollar qo'shilmagan"}
              </p>
              <button
                onClick={() => setCreating(true)}
                className="mt-3 bg-pprimary text-ponprimary font-semibold hover:brightness-[1.06] active:scale-[0.98] disabled:opacity-[0.42] disabled:pointer-events-none transition-[transform,filter] duration-[120ms] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pprimary focus-visible:ring-offset-2 px-4 py-2 rounded-xl text-xs font-semibold"
              >
                + Yangi savol qo'shish
              </button>
            </div>
          )}
        </div>
      )}

      {/* Question Create / Edit Form Modal */}
      {(creating || editing) && (
        <QuestionForm
          initial={editing ?? undefined}
          subjectName={currentSubjectObj.name}
          topics={topics}
          lang={lang}
          onCancel={() => { setCreating(false); setEditing(null) }}
          onSubmit={async (data) => {
            setBusy(true)
            try {
              if (editing) {
                await api.updateQuestion(editing.id, data)
              } else {
                await api.createQuestion({ ...data, subjectId: selectedSubject })
              }
              setCreating(false)
              setEditing(null)
              await refresh()
              // Synchronize client-side test questions store immediately!
              await useQuestionsStore.getState().reload().catch(() => {})
              showToast(editing ? "Savol muvaffaqiyatli yangilandi!" : "Yangi savol muvaffaqiyatli saqlandi!")
            } catch (e) {
              alert(e instanceof Error ? e.message : 'Xato')
            } finally {
              setBusy(false)
            }
          }}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <DialogOverlay onClose={() => setConfirm(null)} backdropClassName="bg-black/60 backdrop-blur-sm" labelId="delete-question-title">
          <div
            className="relative w-full bg-psurface rounded-t-sheet border-t border-pline p-5 pb-8"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1 bg-plineStrong rounded-full mx-auto mb-4" />
            <div className="flex flex-col items-center text-center">
              <div className="w-14 h-14 rounded-2xl bg-pdanger/15 border border-pdanger/40 flex items-center justify-center mb-3">
                <AlertTriangle size={28} className="text-pdanger" />
              </div>
              <p id="delete-question-title" className="text-[17px] font-semibold text-pfg mb-1">#{deleteConfirm.id} savolni o'chirish</p>
              <p className="text-[13px] text-pmuted mb-4">
                Bu amalni ortga qaytarib bo'lmaydi. Savol bazadan butunlay o'chiriladi.
              </p>
              <button
                disabled={busy}
                onClick={async () => {
                  setBusy(true)
                  try {
                    await api.deleteQuestion(deleteConfirm.id)
                    setConfirm(null)
                    await refresh()
                    await useQuestionsStore.getState().reload().catch(() => {})
                  } finally { setBusy(false) }
                }}
                className="font-semibold hover:brightness-[1.06] active:scale-[0.98] transition-[transform,background-color,filter] duration-[120ms] bg-pdanger w-full py-3.5 rounded-2xl text-[14px] text-white mb-2 disabled:opacity-50"
              >
                {busy ? <Loader2 size={16} className="motion-safe:animate-spin inline" /> : "Ha, o'chirish"}
              </button>
              <button
                onClick={() => setConfirm(null)}
                className="w-full py-3 rounded-2xl bg-psurface text-[13px] font-semibold text-pmuted"
              >
                Bekor qilish
              </button>
            </div>
          </div>
        </DialogOverlay>
      )}

      {/* Bulk Import Modal */}
      {bulkImporting && (
        <BulkImportModal
          subjectId={selectedSubject}
          subjectName={currentSubjectObj.name}
          subjectIcon={currentSubjectObj.icon}
          onClose={() => setBulkImporting(false)}
          onSuccess={async (count) => {
            showToast(`${count} ta savol muvaffaqiyatli yuklandi!`)
            await refresh()
            await useQuestionsStore.getState().reload().catch(() => {})
          }}
        />
      )}

      {/* Toast Alert */}
      {toast && (
        <div className="fixed bottom-[calc(1.5rem+var(--safe-bottom,0px))] left-4 right-4 rounded-2xl bg-pcard text-pfg text-xs font-semibold px-4 py-3 text-center z-50 shadow-2xl animate-fadeIn">
          {toast}
        </div>
      )}
    </div>
  )
}

function QuestionForm({
  initial,
  subjectName,
  topics,
  lang,
  onCancel,
  onSubmit,
}: {
  initial?: AdminDbQuestion
  subjectName: string
  topics: DbTopic[]
  lang: 'uz' | 'ru'
  onCancel: () => void
  onSubmit: (data: Omit<AdminDbQuestion, 'id'>) => Promise<void>
}) {
  const [form, setForm] = useState({
    questionUz: initial?.questionUz ?? '',
    questionRu: initial?.questionRu ?? '',
    optionsUz: initial ? JSON.stringify(initial.optionsUz, null, 2) : '{\n  "F1": "",\n  "F2": "",\n  "F3": "",\n  "F4": ""\n}',
    optionsRu: initial ? JSON.stringify(initial.optionsRu, null, 2) : '{\n  "F1": "",\n  "F2": "",\n  "F3": "",\n  "F4": ""\n}',
    correctAnswer: initial?.correctAnswer ?? 'F1',
    image: initial?.image ?? '',
    topicId: initial?.topicId ?? null as number | null,
  })
  const [imageMode, setImageMode] = useState<'upload' | 'url'>(
    initial?.image && initial.image.startsWith('http') ? 'url' : 'upload'
  )
  const [imageFileName, setImageFileName] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [busy, setBusy] = useState(false)

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setImageFileName(file.name)
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
          const compressed = canvas.toDataURL('image/jpeg', 0.85)
          setForm((prev) => ({ ...prev, image: compressed }))
        } else {
          setForm((prev) => ({ ...prev, image: rawDataUrl }))
        }
        haptics.impact('light')
      }
      img.src = rawDataUrl
    }
    reader.readAsDataURL(file)
  }

  const removeImage = () => {
    setForm((prev) => ({ ...prev, image: '' }))
    setImageFileName(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
    haptics.impact('light')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const uz = JSON.parse(form.optionsUz)
      const ru = JSON.parse(form.optionsRu)
      if (!uz[form.correctAnswer]) {
        alert(`correctAnswer="${form.correctAnswer}" variant kalitlar ichida yo'q`)
        return
      }
      setBusy(true)
      await onSubmit({
        questionUz: form.questionUz,
        questionRu: form.questionRu,
        optionsUz: uz,
        optionsRu: ru,
        correctAnswer: form.correctAnswer,
        image: form.image || null,
        topicId: form.topicId ?? null,
      })
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Kirish xatosi')
    } finally {
      setBusy(false)
    }
  }

  return (
    <DialogOverlay onClose={onCancel} labelId="question-editor-title">
      <div
        className="relative w-full bg-psurface rounded-t-sheet border-t border-pline p-4 pb-8 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1 bg-plineStrong rounded-full mx-auto mb-3" />
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 id="question-editor-title" className="font-semibold text-pfg">{initial ? `Tahrirlash #${initial.id}` : 'Yangi savol'}</h2>
            <span className="text-[11px] text-ppurple font-semibold">Fan: {subjectName}</span>
          </div>
          <button onClick={onCancel} className="p-1.5"><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="text-[11px] font-semibold text-pmuted uppercase">Savol matni (UZ)</label>
            <textarea required value={form.questionUz} onChange={(e) => setForm({ ...form, questionUz: e.target.value })}
              rows={3} className="w-full bg-psurface rounded-xl p-2.5 text-[13px] text-pfg shadow-2xs focus:ring-1 focus:ring-ppurple outline-none" />
          </div>
          <div>
            <label className="text-[11px] font-semibold text-pmuted uppercase">Savol matni (RU)</label>
            <textarea required value={form.questionRu} onChange={(e) => setForm({ ...form, questionRu: e.target.value })}
              rows={3} className="w-full bg-psurface rounded-xl p-2.5 text-[13px] text-pfg shadow-2xs focus:ring-1 focus:ring-ppurple outline-none" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[11px] font-semibold text-pmuted uppercase">Variantlar UZ (JSON)</label>
              <textarea required value={form.optionsUz} onChange={(e) => setForm({ ...form, optionsUz: e.target.value })}
                rows={6} className="w-full bg-psurface rounded-xl p-2 font-mono text-[11px] text-pfg shadow-2xs focus:ring-1 focus:ring-ppurple outline-none" />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-pmuted uppercase">Variantlar RU (JSON)</label>
              <textarea required value={form.optionsRu} onChange={(e) => setForm({ ...form, optionsRu: e.target.value })}
                rows={6} className="w-full bg-psurface rounded-xl p-2 font-mono text-[11px] text-pfg shadow-2xs focus:ring-1 focus:ring-ppurple outline-none" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[11px] font-semibold text-pmuted uppercase">To'g'ri javob</label>
              <select value={form.correctAnswer} onChange={(e) => setForm({ ...form, correctAnswer: e.target.value })}
                className="w-full bg-psurface rounded-xl p-2.5 text-[13px] text-pfg shadow-2xs focus:ring-1 focus:ring-ppurple outline-none">
                <option>F1</option><option>F2</option><option>F3</option><option>F4</option>
              </select>
            </div>
            <div>
              <label className="text-[11px] font-semibold text-pmuted uppercase">Mavzu</label>
              <select value={form.topicId ?? ''} onChange={(e) => setForm({ ...form, topicId: e.target.value ? Number(e.target.value) : null })}
                className="w-full bg-psurface rounded-xl p-2.5 text-[13px] text-pfg shadow-2xs focus:ring-1 focus:ring-ppurple outline-none">
                <option value="">——</option>
                {topics.map((t) => (
                  <option key={t.id} value={t.id}>{lang === 'ru' ? t.nameRu : t.nameUz}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Question Image Section */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-semibold text-pmuted uppercase flex items-center gap-1">
                <ImageIcon size={13} className="text-pblue" />
                <span>Savol rasmi (ixtiyoriy)</span>
              </label>
              <div className="flex items-center gap-1 bg-psurface p-0.5 rounded-lg text-[10px] font-semibold shadow-2xs">
                <button
                  type="button"
                  onClick={() => setImageMode('upload')}
                  className={`px-2 py-0.5 rounded-md transition-all ${
                    imageMode === 'upload' ? 'bg-ppurple text-ponprimary' : 'text-pmuted hover:text-pfg'
                  }`}
                >
                  Fayl
                </button>
                <button
                  type="button"
                  onClick={() => setImageMode('url')}
                  className={`px-2 py-0.5 rounded-md transition-all ${
                    imageMode === 'url' ? 'bg-ppurple text-ponprimary' : 'text-pmuted hover:text-pfg'
                  }`}
                >
                  URL
                </button>
              </div>
            </div>

            {imageMode === 'upload' ? (
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageSelect}
                  className="hidden"
                />

                {form.image ? (
                  <div className="flex items-center justify-between p-2.5 rounded-2xl bg-psurface border border-ppurple/40">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <img
                        src={form.image}
                        alt="Question preview"
                        className="w-12 h-12 rounded-xl object-cover border border-pline flex-shrink-0"
                      />
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-pfg truncate">
                          {imageFileName || 'Tanlangan rasm'}
                        </p>
                        <span className="text-[10px] text-pprimary font-semibold flex items-center gap-1 mt-0.5">
                          <CheckCircle2 size={11} /> Tayyor
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="p-2 rounded-xl bg-psurface text-pmuted hover:text-pfg active:scale-95 transition-all shadow-2xs"
                        title="Boshqa rasm tanlash"
                      >
                        <RotateCw size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={removeImage}
                        className="p-2 rounded-xl bg-pdanger/10 border border-pdanger/30 text-pdanger hover:bg-pdanger/20 active:scale-95 transition-all"
                        title="O'chirish"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-pline hover:border-ppurple/60 rounded-2xl p-3.5 text-center cursor-pointer bg-psurface transition-all active:scale-[0.99] flex flex-col items-center justify-center gap-1"
                  >
                    <Upload size={18} className="text-ppurple" />
                    <p className="text-xs font-semibold text-pfg">Rasmni yuklash uchun bosing</p>
                    <p className="text-[10px] text-pmuted">JPG, PNG yoki WEBP</p>
                  </div>
                )}
              </div>
            ) : (
              <input
                type="text"
                value={form.image}
                onChange={(e) => setForm({ ...form, image: e.target.value })}
                placeholder="https://... yoki images/q001.jpg"
                className="w-full bg-psurface rounded-xl p-2.5 text-[13px] text-pfg shadow-2xs focus:ring-1 focus:ring-ppurple outline-none"
              />
            )}
          </div>

          <button type="submit" disabled={busy}
            className="bg-pprimary text-ponprimary font-semibold hover:brightness-[1.06] active:scale-[0.98] disabled:opacity-[0.42] disabled:pointer-events-none transition-[transform,filter] duration-[120ms] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pprimary focus-visible:ring-offset-2 w-full py-3.5 rounded-2xl text-[14px] disabled:opacity-50">
            {busy ? <Loader2 size={16} className="motion-safe:animate-spin inline" /> : 'Saqlash'}
          </button>
        </form>
      </div>
    </DialogOverlay>
  )
}
