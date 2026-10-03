import { useState, useMemo } from 'react'
import { Star, Check } from 'lucide-react'
import { api } from '@/shared/api'
import { haptics } from '@/platform/haptics'
import { useAppStore } from '@/shared/store/useAppStore'
import { useT } from '@/shared/i18n'
import { SUBJECTS } from '@/shared/config/subjects'
import { useToast } from '@/shared/components/ToastContainer'
import DialogOverlay from '@/shared/components/DialogOverlay'
import ModalMathGrid from '@/shared/components/ModalMathGrid'
import ModalHeaderRow from '@/shared/components/ModalHeaderRow'

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
    <DialogOverlay
      onClose={onClose}
      labelId="write-review-title"
      swipeToDismiss
      backdropClassName="bg-black/60"
    >
      <div
        className="relative w-full max-w-lg mx-auto bg-psurface rounded-t-sheet px-5 pt-3 pb-[calc(1.75rem+var(--safe-bottom,0px))] shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto no-scrollbar"
        onClick={(e) => e.stopPropagation()}
      >
        <ModalMathGrid glow={false} height={360} />

        {/* Sensorda surish uchun tepa drag handle */}
        <div
          data-drag-handle
          className="w-10 h-1 bg-gray-300 dark:bg-white/20 rounded-full mx-auto mb-2 cursor-grab active:cursor-grabbing touch-none relative z-10"
        />

        {/* Global modal header (X tugmasi chapda, sarlavha o'rtada) */}
        <ModalHeaderRow onClose={onClose} label={lang === 'ru' ? 'Закрыть' : 'Yopish'}>
          <div data-drag-handle className="select-none">
            <h2 id="write-review-title" className="text-lg font-bold text-pfg tracking-tight">
              {tt('reviewsWriteTitle')}
            </h2>
            <p className="text-[11.5px] text-pmuted mt-0.5">
              {lang === 'ru' ? 'Поделитесь вашим честным опытом' : 'Platforma haqida samimiy fikringiz'}
            </p>
          </div>
        </ModalHeaderRow>

        {/* ── 1. Yulduzli Baholash (Interactive 5 Stars) ───────────────────── */}
        <div className="bg-pcard rounded-2xl p-3.5 mb-3.5 text-center border border-pline shadow-2xs relative z-10">
          <div className="flex justify-center items-center gap-2 mb-1.5">
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
                  className="p-1 active:scale-125 transition-transform cursor-pointer"
                >
                  <Star
                    size={36}
                    className={`transition-all duration-200 ${
                      filled
                        ? 'fill-[#c7820a] text-[#c7820a] drop-shadow-[0_2px_8px_rgba(199,130,10,0.35)]'
                        : 'fill-slate-200 text-slate-200 dark:fill-white/10 dark:text-white/10'
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

        {/* ── 2. Fan Tanlash (Toza matnli gorizontal pilla, iconsiz) ────────── */}
        <div className="mb-3.5 relative z-10">
          <div className="flex items-center justify-between px-1 mb-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-psubtle">
              {lang === 'ru' ? 'О каком предмете отзыв?' : 'Qaysi fan haqida fikr?'}
            </label>
            <span className="text-xs font-semibold text-pprimary">
              {selectedSubject
                ? lang === 'ru'
                  ? selectedSubject.nameRu
                  : selectedSubject.name
                : lang === 'ru'
                  ? 'Вся платформа KIVVI'
                  : 'Umumiy KIVVI'}
            </span>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
            {/* 1-variant: Umumiy KIVVI platformasi */}
            <button
              type="button"
              onClick={() => {
                haptics.selection()
                setSubjectId('')
              }}
              className={`shrink-0 px-3.5 py-1.5 rounded-full border text-xs font-bold transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer ${
                subjectId === ''
                  ? 'bg-blue-600 border-blue-600 text-white shadow-xs'
                  : 'bg-pcard border-pline text-pfg hover:bg-psurface'
              }`}
            >
              <span>{lang === 'ru' ? 'Вся платформа' : 'Umumiy KIVVI'}</span>
              {subjectId === '' && <Check size={12} className="text-white stroke-[2.5]" />}
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
                  className={`shrink-0 px-3.5 py-1.5 rounded-full border text-xs font-bold transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer ${
                    isSelected
                      ? 'bg-blue-600 border-blue-600 text-white shadow-xs'
                      : 'bg-pcard border-pline text-pfg hover:bg-psurface'
                  }`}
                >
                  <span>{lang === 'ru' ? s.nameRu : s.name}</span>
                  {isSelected && <Check size={12} className="text-white stroke-[2.5]" />}
                </button>
              )
            })}
          </div>
        </div>

        {/* ── 3. Sarlavha Kiritish (Title Input) ────────────────────────────── */}
        <div className="mb-2.5 relative z-10">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={
              lang === 'ru'
                ? 'Краткий заголовок (например, "Очень помогло!")'
                : 'Qisqa sarlavha (masalan: "Juda foydali bo\'ldi!")'
            }
            maxLength={100}
            className="w-full px-4 py-2.5 rounded-2xl bg-pcard border border-pline text-sm font-semibold text-pfg placeholder:text-psubtle outline-none focus:border-pprimary transition-all"
          />
        </div>

        {/* ── 4. Sharh Matni (Comment Textarea) ────────────────────────────── */}
        <div className="mb-3.5 relative z-10">
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
            className="w-full px-4 py-2.5 rounded-2xl bg-pcard border border-pline text-sm font-normal text-pfg placeholder:text-psubtle outline-none focus:border-pprimary transition-all resize-none leading-relaxed"
          />
          <div className="flex justify-between items-center px-1 text-[11px] text-psubtle mt-1">
            <span>{comment.length >= 3 ? '✓ Yetarli uzunlik' : 'Kamida 3 ta belgi'}</span>
            <span>{comment.length}/1000</span>
          </div>
        </div>

        {/* ── 5. Yuborish Tugmasi ───────────────────────────────────────────── */}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canSubmit || submitting}
          className="w-full py-3.5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98] transition-all shadow-md shadow-blue-500/20 relative z-10 cursor-pointer"
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
    </DialogOverlay>
  )
}
