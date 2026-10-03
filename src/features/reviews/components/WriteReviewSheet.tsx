import { useState, useMemo } from 'react'
import { Star, X, Check } from 'lucide-react'
import { api } from '@/shared/api'
import { haptics } from '@/platform/haptics'
import { useAppStore } from '@/shared/store/useAppStore'
import { useT } from '@/shared/i18n'
import { SUBJECTS } from '@/shared/config/subjects'
import { useToast } from '@/shared/components/ToastContainer'

interface Props {
  onClose: () => void
  onSubmitted: () => void
}

const RATING_LABELS_UZ: Record<number, string> = {
  5: "A'lo darajada! 🌟",
  4: 'Yaxshi 👍',
  3: "O'rtacha 😐",
  2: 'Qoniqarsiz 👎',
  1: 'Juda yomon ⚠️',
}

const RATING_LABELS_RU: Record<number, string> = {
  5: 'Отлично! 🌟',
  4: 'Хорошо 👍',
  3: 'Средне 😐',
  2: 'Плохо 👎',
  1: 'Ужасно ⚠️',
}

export default function WriteReviewSheet({ onClose, onSubmitted }: Props) {
  const settings = useAppStore((s) => s.settings)
  const lang = settings.language
  const tt = useT(lang)
  const { info, error: showError } = useToast()

  const [rating, setRating] = useState(5) // default 5 stars
  const [subjectId, setSubjectId] = useState<string>('') // empty = umumiy platforma
  const [title, setTitle] = useState('')
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const activeSubjects = useMemo(() => SUBJECTS.filter((s) => s.available), [])
  const selectedSubject = useMemo(
    () => (subjectId ? activeSubjects.find((s) => s.id === subjectId) : null),
    [subjectId, activeSubjects],
  )

  const canSubmit = rating > 0 && title.trim().length >= 1 && comment.trim().length >= 3

  const handleSubmit = async () => {
    if (!canSubmit || submitting) return
    haptics.impact('medium')
    setSubmitting(true)
    try {
      await api.createReview({
        rating,
        subjectId: subjectId || undefined,
        title: title.trim(),
        comment: comment.trim(),
      })
      haptics.success()
      info(tt('reviewsSubmitSuccess'))
      onSubmitted()
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Xatolik yuz berdi'
      showError(msg)
    } finally {
      setSubmitting(false)
    }
  }

  const ratingCaption = lang === 'ru' ? RATING_LABELS_RU[rating] : RATING_LABELS_UZ[rating]

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={onClose}>
      {/* Orqa qorong'ulatish */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-in fade-in" />

      {/* Sheet kartasi */}
      <div
        className="relative w-full max-w-lg bg-white dark:bg-card rounded-t-[32px] px-5 pb-9 pt-3 animate-in slide-in-from-bottom duration-300 max-h-[90vh] overflow-y-auto no-scrollbar shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Yuqori drag-handle */}
        <div className="w-10 h-1.5 bg-slate-200 dark:bg-white/20 rounded-full mx-auto mb-4" />

        {/* Header satri */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-extrabold text-slate-900 dark:text-foreground tracking-tight">
              {tt('reviewsWriteTitle')}
            </h2>
            <p className="text-xs text-slate-400 dark:text-muted-foreground mt-0.5">
              {lang === 'ru' ? 'Поделитесь вашим честным опытом' : 'Platforma haqida samimiy fikringiz'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 dark:bg-white/10 flex items-center justify-center text-slate-600 dark:text-slate-300 active:scale-90 transition-transform"
          >
            <X size={16} />
          </button>
        </div>

        {/* ── 1. Yulduzli Baholash (Interactive 5 Stars) ───────────────────── */}
        <div className="bg-slate-50 dark:bg-white/5 rounded-2xl p-4 mb-4 text-center border border-slate-100 dark:border-white/5">
          <div className="flex justify-center items-center gap-2 mb-2">
            {[1, 2, 3, 4, 5].map((n) => {
              const filled = n <= rating
              return (
                <button
                  key={n}
                  type="button"
                  onClick={() => {
                    haptics.impact('light')
                    setRating(n)
                  }}
                  className="p-1 active:scale-125 transition-transform"
                >
                  <Star
                    size={38}
                    className={`transition-all duration-200 ${
                      filled
                        ? 'fill-[#c7820a] text-[#c7820a] drop-shadow-[0_2px_8px_rgba(199,130,10,0.35)]'
                        : 'fill-slate-200 text-slate-200 dark:fill-slate-700 dark:text-slate-700'
                    }`}
                  />
                </button>
              )
            })}
          </div>
          <span className="text-xs font-bold text-amber-600 dark:text-amber-400">
            {ratingCaption}
          </span>
        </div>

        {/* ── 2. Fan Tanlash (Professional Apple-grade Horizontal Carousel) ── */}
        <div className="mb-4">
          <div className="flex items-center justify-between px-1 mb-2">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-muted-foreground">
              {lang === 'ru' ? 'О каком предмете отзыв?' : 'Qaysi fan haqida fikr?'}
            </label>
            <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">
              {selectedSubject
                ? lang === 'ru'
                  ? selectedSubject.nameRu
                  : selectedSubject.name
                : lang === 'ru'
                  ? 'Вся платформа KIVVI'
                  : 'Umumiy KIVVI'}
            </span>
          </div>

          {/* Gorizontal svayp qilinadigan fanlar ro'yxati (toza matnli pill, iconsiz) */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1 px-1">
            {/* 1-variant: Umumiy KIVVI platformasi */}
            <button
              type="button"
              onClick={() => {
                haptics.selection()
                setSubjectId('')
              }}
              className={`shrink-0 px-4 py-2 rounded-full border text-xs font-bold transition-all active:scale-95 flex items-center gap-1.5 ${
                subjectId === ''
                  ? 'bg-blue-600 border-blue-600 text-white shadow-xs'
                  : 'bg-white dark:bg-card border-slate-200/80 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:bg-slate-50'
              }`}
            >
              <span>{lang === 'ru' ? 'Вся платформа' : 'Umumiy KIVVI'}</span>
              {subjectId === '' && <Check size={13} className="text-white stroke-[2.5]" />}
            </button>

            {/* Barcha faol fanlar — FAQAT TOZA MATN (iconsiz) */}
            {activeSubjects.map((s) => {
              const isSelected = subjectId === s.id
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => {
                    haptics.selection()
                    setSubjectId(s.id)
                  }}
                  className={`shrink-0 px-4 py-2 rounded-full border text-xs font-bold transition-all active:scale-95 flex items-center gap-1.5 ${
                    isSelected
                      ? 'bg-blue-600 border-blue-600 text-white shadow-xs'
                      : 'bg-white dark:bg-card border-slate-200/80 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <span>{lang === 'ru' ? s.nameRu : s.name}</span>
                  {isSelected && <Check size={13} className="text-white stroke-[2.5]" />}
                </button>
              )
            })}
          </div>
        </div>

        {/* ── 3. Sarlavha Kiritish (Title Input) ────────────────────────────── */}
        <div className="mb-3">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={
              lang === 'ru'
                ? 'Краткий заголовок (например, "Очень помогло!")'
                : 'Qisqa sarlavha (masalan: "Juda foydali bo\'ldi!")'
            }
            maxLength={100}
            className="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200/80 dark:border-white/10 text-sm font-semibold text-slate-900 dark:text-foreground placeholder:text-slate-400 dark:placeholder:text-muted-foreground outline-none focus:border-blue-500 focus:bg-white dark:focus:bg-card transition-all"
          />
        </div>

        {/* ── 4. Sharh Matni (Comment Textarea) ────────────────────────────── */}
        <div className="mb-4">
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder={
              lang === 'ru'
                ? 'Напишите подробнее, что вам понравилось, а что можно улучшить...'
                : "Batafsil fikringiz: nimalar yoqdi va yana nimalarni qo'shish kerak..."
            }
            maxLength={1000}
            rows={4}
            className="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200/80 dark:border-white/10 text-sm font-normal text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-muted-foreground outline-none focus:border-blue-500 focus:bg-white dark:focus:bg-card transition-all resize-none leading-relaxed"
          />
          <div className="flex justify-between items-center px-1 text-[11px] text-slate-400">
            <span>{comment.length >= 3 ? '✓ Yetarli uzunlik' : 'Kamida 3 ta belgi'}</span>
            <span>{comment.length}/1000</span>
          </div>
        </div>

        {/* ── 5. Yuborish Tugmasi ───────────────────────────────────────────── */}
        <button
          onClick={handleSubmit}
          disabled={!canSubmit || submitting}
          className="w-full py-4 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-base disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98] transition-all shadow-md shadow-blue-500/20"
        >
          {submitting
            ? lang === 'ru'
              ? 'Отправка...'
              : 'Yuborilmoqda...'
            : lang === 'ru'
              ? 'Опубликовать отзыв'
              : 'Fikrni yuborish'}
        </button>
      </div>
    </div>
  )
}
