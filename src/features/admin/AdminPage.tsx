import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { goBack } from '../../lib/navigation'
import { Plus, Pencil, Trash2, Search, X, Loader2, AlertTriangle } from 'lucide-react'
import { useAppStore } from '../../shared/store/useAppStore'
import { useQuestionsStore, getRawQuestions } from '../../store/useQuestionsStore'
import { api, type DbQuestion, type DbTopic, type Question } from '../../lib/api'


/** Faqat isAdmin foydalanuvchilariga ko'rinadigan sahifa.
    Slash /profil'dan kiriladi (keltiriladi). */

export default function AdminPage() {
  const navigate  = useNavigate()
  const user      = useAppStore((s) => s.user)
  const settings  = useAppStore((s) => s.settings)
  const lang      = settings?.language ?? 'uz'

  const questions = useQuestionsStore((s) => s.questions)
  const topics    = useQuestionsStore((s) => s.topics)

  const [meta, setMeta]           = useState<{ total: number; withTopic: number } | null>(null)
  const [search, setSearch]       = useState('')
  const [editing, setEditing]     = useState<DbQuestion | null>(null)
  const [creating, setCreating]   = useState(false)
  const [busy, setBusy]           = useState(false)
  const [deleteConfirm, setConfirm] = useState<Question | null>(null)

  /** Tahrirlash uchun RAW (DbQuestion) topish — store'dagi mapping lang'da emas */
  const findRaw = useCallback((id: number): DbQuestion | null =>
    getRawQuestions().find((r) => r.id === id) ?? null, [])

  // Kirishni tekshirish + store yuklash (Admin mustaqil ochilsa store bo'sh bo'ladi)
  useEffect(() => {
    if (!user?.isAdmin) {
      navigate('/profil', { replace: true })
      return
    }
    void useQuestionsStore.getState().load(lang)
    void api.getQuestionsMeta()
      .then(setMeta)
      .catch(() => setMeta({ total: 0, withTopic: 0 }))
  }, [user?.isAdmin, navigate, lang])

  // Savollar store'dan (cache). doimiy filter
  const filtered = useMemo(() => {
    if (!search.trim()) return questions.slice(0, 20) // dastlabki 20 ta
    const q = search.toLowerCase()
    return questions.filter((x) =>
      String(x.id).includes(q) ||
      x.text.toLowerCase().includes(q),
    ).slice(0, 50)
  }, [questions, search])

  const topic = useCallback((topicId: number | null) => {
    if (topicId == null) return '——'
    const t: DbTopic | undefined = topics.find((x) => x.id === topicId)
    return t ? (lang === 'ru' ? t.nameRu : t.nameUz) : `#${topicId}`
  }, [topics, lang])

  const refresh = useCallback(async () => {
    setBusy(true)
    try {
      const m = await api.getQuestionsMeta()
      setMeta(m)
      // Store'ni qayta yuklash — savollar DB'da o'zgardi
      await useQuestionsStore.getState().reload()
    } finally {
      setBusy(false)
    }
  }, [])

  if (!user?.isAdmin) return null

  return (
    <div className="min-h-screen bg-bg pb-20">
      <div className="flex items-center justify-between p-4 border-b border-line sticky top-0 bg-bg z-10">
        <button onClick={() => { goBack(navigate) }} className="p-2">
          <X size={20} className="text-muted" />
        </button>
        <h1 className="font-black text-fg">Admin savollar</h1>
        <button
          onClick={() => setCreating(true)}
          className="bg-duo-green text-white py-2 px-3 rounded-xl text-[12px] font-bold flex items-center gap-1.5 active:scale-95 transition-transform"
        >
          <Plus size={14} /> Yangi
        </button>
      </div>

      {meta && (
        <div className="p-4 mx-4 mt-4 bg-surface rounded-2xl border border-line text-[13px]">
          <p>Jami savollar: <b>{meta.total}</b></p>
          <p>Mavzuga bog'langan: <b>{meta.withTopic}</b></p>
        </div>
      )}

      <div className="p-4">
        <div className="relative mb-4">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Savol ID yoki matn bo'yicha qidirish..."
            className="w-full bg-surface border border-line rounded-xl pl-9 pr-4 py-2.5 text-[13px] text-fg placeholder:text-muted outline-none focus:border-duo-green"
          />
        </div>

        {filtered.map((q) => (
          <div key={q.id} className="bg-surface border border-line rounded-xl p-3 mb-2">
            <div className="flex gap-3 items-start justify-between">
              <div className="flex-1 min-w-0">
                <p className="text-[10px] text-muted font-bold uppercase tracking-wide mb-1">#{q.id} · {topic(q.topicId)}</p>
                <p className="text-[13px] text-fg font-medium line-clamp-2 mb-1">{(q as { text: string }).text}</p>
                <p className="text-[12px] text-muted">
                  T.J: <b className="text-duo-green">{(q as { correct: string }).correct}</b>
                </p>
              </div>
              <div className="flex flex-col gap-1.5 flex-shrink-0">
                <button
                  onClick={() => { const raw = findRaw(q.id); if (raw) setEditing(raw) }}
                  className="p-2 bg-elevated rounded-lg active:scale-90 transition-transform"
                  title="Tahrirlash"
                >
                  <Pencil size={13} className="text-duo-blue" />
                </button>
                <button
                  onClick={() => setConfirm(q)}
                  className="p-2 bg-elevated rounded-lg active:scale-90 transition-transform"
                  title="O'chirish"
                >
                  <Trash2 size={13} className="text-duo-red" />
                </button>
              </div>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <p className="text-center text-muted text-sm py-8">Hech narsa topilmadi</p>
        )}
      </div>

      {/* Yaratish / tahrirlash modali */}
      {(creating || editing) && (
        <QuestionForm
          initial={editing ?? undefined}
          topics={topics}
          lang={lang}
          onCancel={() => { setCreating(false); setEditing(null) }}
          onSubmit={async (data) => {
            setBusy(true)
            try {
              if (editing) {
                await api.updateQuestion(editing.id, data)
              } else {
                await api.createQuestion(data)
              }
              setCreating(false); setEditing(null)
              await refresh()
            } catch (e) {
              alert(e instanceof Error ? e.message : 'Xato')
            } finally { setBusy(false) }
          }}
        />
      )}

      {/* O'chirish tasdiqlashi */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-end" onClick={() => setConfirm(null)}>
          <div className="absolute inset-0 bg-black/60" />
          <div className="relative w-full bg-surface rounded-t-3xl border-t border-line p-5 pb-8"
            onClick={(e) => e.stopPropagation()}>
            <div className="w-10 h-1 bg-line rounded-full mx-auto mb-4" />
            <div className="flex flex-col items-center text-center">
              <div className="w-14 h-14 rounded-2xl bg-duo-red/15 border border-duo-red/40 flex items-center justify-center mb-3">
                <AlertTriangle size={28} className="text-duo-red" />
              </div>
              <p className="text-[17px] font-black text-fg mb-1">#{deleteConfirm.id} ni o'chirish</p>
              <p className="text-[13px] text-muted mb-4">Bu amalni ortga qaytarib bo'lmaydi. Barcha bog'liq ma'lumotlar (saqlangan, tushuntirish) ham o'chadi.</p>
              <button
                disabled={busy}
                onClick={async () => {
                  setBusy(true)
                  try {
                    await api.deleteQuestion(deleteConfirm.id)
                    setConfirm(null)
                    await refresh()
                  } finally { setBusy(false) }
                }}
                className="btn-neon bg-duo-red w-full py-3.5 rounded-2xl font-black text-[14px] text-white mb-2 disabled:opacity-50"
              >
                {busy ? <Loader2 size={16} className="animate-spin inline" /> : "Ha, o'chirish"}
              </button>
              <button onClick={() => setConfirm(null)}
                className="w-full py-3 rounded-2xl bg-elevated text-[13px] font-bold text-muted"
                >
                Bekor qilish
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Savol shakli (yaratish/tahrirlash) ───────────────────────────────────
function QuestionForm({
  initial,
  topics,
  lang,
  onCancel,
  onSubmit,
}: {
  initial?: DbQuestion & { text?: string }
  topics: DbTopic[]
  lang: 'uz' | 'ru'
  onCancel: () => void
  onSubmit: (data: Omit<DbQuestion, 'id'>) => Promise<void>
}) {
  const [form, setForm] = useState({
    questionUz: initial?.questionUz ?? '',
    questionRu: initial?.questionRu ?? '',
    optionsUz: initial ? JSON.stringify(initial.optionsUz, null, 2) : '{\n  "F1": "",\n  "F2": "",\n  "F3": "",\n  "F4": ""\n}',
    optionsRu: initial ? JSON.stringify(initial.optionsRu, null, 2) : '{\n  "F1": "",\n  "F2": "",\n  "F3": "",\n  "F4": ""\n}',
    correctAnswer: initial?.correctAnswer ?? 'F2',
    image: initial?.image ?? '',
    topicId: initial?.topicId ?? null as number | null,
  })
  const [busy, setBusy] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const uz = JSON.parse(form.optionsUz)
      const ru = JSON.parse(form.optionsRu)
      if (!uz[form.correctAnswer]) { alert(`correctAnswer="${form.correctAnswer}" variant kalitlar ichida yo'q`); return }
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
    } finally { setBusy(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end">
      <div className="absolute inset-0 bg-black/70" onClick={onCancel} />
      <div className="relative w-full bg-surface rounded-t-3xl border-t border-line p-4 pb-8 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}>
        <div className="w-10 h-1 bg-line rounded-full mx-auto mb-3" />
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-black text-fg">{initial ? `Tahrirlash #${initial.id}` : 'Yangi savol'}</h2>
          <button onClick={onCancel} className="p-1.5"><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="text-[11px] font-bold text-muted uppercase">Savol (UZ)</label>
            <textarea required value={form.questionUz} onChange={(e) => setForm({ ...form, questionUz: e.target.value })}
              rows={3} className="w-full bg-elevated rounded-xl p-2.5 text-[13px] text-fg border border-line" />
          </div>
          <div>
            <label className="text-[11px] font-bold text-muted uppercase">Savol (RU)</label>
            <textarea required value={form.questionRu} onChange={(e) => setForm({ ...form, questionRu: e.target.value })}
              rows={3} className="w-full bg-elevated rounded-xl p-2.5 text-[13px] text-fg border border-line" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[11px] font-bold text-muted uppercase">Variantlar UZ (JSON)</label>
              <textarea required value={form.optionsUz} onChange={(e) => setForm({ ...form, optionsUz: e.target.value })}
                rows={6} className="w-full bg-elevated rounded-xl p-2 font-mono text-[11px] text-fg border border-line" />
            </div>
            <div>
              <label className="text-[11px] font-bold text-muted uppercase">Variantlar RU (JSON)</label>
              <textarea required value={form.optionsRu} onChange={(e) => setForm({ ...form, optionsRu: e.target.value })}
                rows={6} className="w-full bg-elevated rounded-xl p-2 font-mono text-[11px] text-fg border border-line" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[11px] font-bold text-muted uppercase">To'g'ri javob</label>
              <select value={form.correctAnswer} onChange={(e) => setForm({ ...form, correctAnswer: e.target.value })}
                className="w-full bg-elevated rounded-xl p-2.5 text-[13px] text-fg border border-line">
                <option>F1</option><option>F2</option><option>F3</option><option>F4</option>
              </select>
            </div>
            <div>
              <label className="text-[11px] font-bold text-muted uppercase">Mavzu</label>
              <select value={form.topicId ?? ''} onChange={(e) => setForm({ ...form, topicId: e.target.value ? Number(e.target.value) : null })}
                className="w-full bg-elevated rounded-xl p-2.5 text-[13px] text-fg border border-line">
                <option value="">——</option>
                {topics.map((t) => (
                  <option key={t.id} value={t.id}>{lang === 'ru' ? t.nameRu : t.nameUz}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="text-[11px] font-bold text-muted uppercase">Rasm URL (ixtiyoriy)</label>
            <input value={form.image} onChange={(e) => setForm({ ...form, image: e.target.value })}
              placeholder="https://..." className="w-full bg-elevated rounded-xl p-2.5 text-[13px] text-fg border border-line" />
          </div>

          <button type="submit" disabled={busy}
            className="btn-neon w-full py-3.5 rounded-2xl font-black text-[14px] text-white disabled:opacity-50">
            {busy ? <Loader2 size={16} className="animate-spin inline" /> : 'Saqlash'}
          </button>
        </form>
      </div>
    </div>
  )
}
