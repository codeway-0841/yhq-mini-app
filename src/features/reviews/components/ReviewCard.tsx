import { Star, ThumbsUp } from 'lucide-react'
import { getSubject } from '@/shared/config/subjects'
import type { ReviewItem } from '@/shared/api'
import { haptics } from '@/platform/haptics'
import { shareUrl } from '@/platform/telegram'
import { useToast } from '@/shared/components/ToastContainer'

interface Props {
  review: ReviewItem
  isLiked: boolean
  onLikeToggle: (id: number) => void
  animationDelay?: number
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso)
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    return `${d.getDate()} ${months[d.getMonth()]}`
  } catch {
    return '27 Sep'
  }
}

export default function ReviewCard({ review, isLiked, onLikeToggle, animationDelay = 0 }: Props) {
  const { info } = useToast()
  const subject = review.subjectId ? getSubject(review.subjectId) : null
  const badgeName = subject?.name ?? (review.subjectId ? review.subjectId.toUpperCase() : 'KIVVI')

  const handleShare = (e: React.MouseEvent) => {
    e.stopPropagation()
    haptics.impact('light')
    const shareText = `"${review.title}" — ${review.comment} (${review.rating}★)`
    shareUrl('https://app.kivvi.uz', shareText)
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(`${shareText}\nhttps://app.kivvi.uz`).catch(() => {})
      info('Sharh nusxalandi!')
    }
  }

  return (
    <div
      className="bg-white dark:bg-card rounded-2xl p-4 sm:p-4.5 shadow-xs border border-slate-100 dark:border-white/5 space-y-2 transition-all"
      style={{ animationDelay: `${animationDelay}ms`, animationFillMode: 'both' }}
    >
      {/* Yuqori qator: Yulduzlar + Badge + Sana + Ulashish */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {/* 5 Yulduz */}
          <div className="flex items-center gap-0.5">
            {[1, 2, 3, 4, 5].map((n) => (
              <Star
                key={n}
                size={14}
                className={
                  n <= review.rating
                    ? 'fill-[#c7820a] text-[#c7820a]'
                    : 'fill-slate-200 text-slate-200 dark:fill-slate-700 dark:text-slate-700'
                }
              />
            ))}
          </div>

          {/* Ilova / Fan pill badge */}
          <span className="bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300 text-[11px] font-semibold px-2.5 py-0.5 rounded-full ml-1">
            {badgeName}
          </span>
        </div>

        {/* Sana va Share ikonka (rasmdagi egri o'q) */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400 dark:text-muted-foreground font-medium">
            {formatDate(review.createdAt)}
          </span>
          <button
            onClick={handleShare}
            aria-label="Share review"
            className="text-slate-800 dark:text-slate-300 hover:text-blue-500 active:scale-90 transition-transform p-0.5"
          >
            {/* Rasmdagi 1-to-1 qora egri share strelkasi */}
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="transform rotate-0"
            >
              <path d="M14 5V0.5L22 8.5L14 16.5V12C7 12 2 14.5 0 21.5C1.5 14.5 6 7.5 14 5Z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Sarlavha */}
      <h3 className="text-[15.5px] font-bold text-slate-900 dark:text-foreground tracking-tight leading-snug">
        {review.title}
      </h3>

      {/* Matn */}
      <p className="text-[13.5px] text-slate-600 dark:text-slate-300 leading-relaxed font-normal">
        {review.comment}
      </p>

      {/* Foydalanuvchi ma'lumotlari: Bayroq · Ism · Shahar · Versiya */}
      <div className="flex items-center justify-between pt-1">
        <div className="flex items-center gap-1.5 text-xs text-slate-400 dark:text-muted-foreground font-medium flex-wrap">
          <span className="text-sm">{review.flag ?? '🇺🇿'}</span>
          <span className="font-semibold text-slate-700 dark:text-slate-300">
            {review.user.firstName}
            {review.user.lastName ? ` ${review.user.lastName[0]}.` : ''}
          </span>
          <span>·</span>
          <span>{review.location ?? 'O‘zbekiston'}</span>
          {review.appVersion && (
            <>
              <span>·</span>
              <span className="text-slate-400">{review.appVersion}</span>
            </>
          )}
        </div>

        {/* Foydali ovoz berish tugmasi */}
        <button
          onClick={() => onLikeToggle(review.id)}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all active:scale-90 ${
            isLiked
              ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 border border-blue-200 dark:border-blue-800'
              : 'text-slate-400 dark:text-muted-foreground border border-slate-200/80 dark:border-white/10 hover:bg-slate-50'
          }`}
        >
          <ThumbsUp size={11} className={isLiked ? 'fill-current' : ''} />
          {review.helpfulCount}
        </button>
      </div>
    </div>
  )
}
