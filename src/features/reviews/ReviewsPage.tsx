import { useEffect, useState, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, MessageSquare, ChevronLeft, X } from 'lucide-react'
import { goBack } from '@/shared/lib/navigation'
import { useAppStore } from '@/shared/store/useAppStore'
import { useT } from '@/shared/i18n'
import { api, type ReviewItem, type ReviewSummary } from '@/shared/api'
import { haptics } from '@/platform/haptics'
import { EmptyState } from '@/shared/components/ui/empty-state'
import { SUBJECTS, getSubject } from '@/shared/config/subjects'
import WriteReviewSheet from './components/WriteReviewSheet'
import ReviewCard from './components/ReviewCard'
import RatingSummary from './components/RatingSummary'
import FilterSortSheet, { type TimeRange, type SortOrder } from './components/FilterSortSheet'

export type { ReviewItem, ReviewSummary }

const RATING_FILTERS = [
  { label: 'All', value: undefined },
  { label: '5 ★', value: 5 },
  { label: '4 ★', value: 4 },
  { label: '3 ★', value: 3 },
  { label: '2 ★', value: 2 },
  { label: '1 ★', value: 1 },
] as const

export default function ReviewsPage() {
  const navigate = useNavigate()
  const settings = useAppStore((s) => s.settings)
  const lang = settings.language
  const tt = useT(lang)

  const [reviews, setReviews] = useState<ReviewItem[]>([])
  const [summary, setSummary] = useState<ReviewSummary | null>(null)
  const [likedIds, setLikedIds] = useState<Set<number>>(new Set())
  const [activeRatingFilter, setActiveRatingFilter] = useState<number | undefined>(undefined)
  const [selectedSubject, setSelectedSubject] = useState<string | undefined>(undefined)
  const [timeRange, setTimeRange] = useState<TimeRange>('7D')
  const [sortOrder, setSortOrder] = useState<SortOrder>('newest')
  const [loading, setLoading] = useState(true)
  const [showWriteSheet, setShowWriteSheet] = useState(false)
  const [showFilterSheet, setShowFilterSheet] = useState(false)

  const activeSubjects = useMemo(() => SUBJECTS.filter((s) => s.available), [])
  const currentSubject = useMemo(
    () => (selectedSubject ? getSubject(selectedSubject) : null),
    [selectedSubject],
  )

  const fetchReviews = useCallback(async (rating?: number, subject?: string) => {
    try {
      setLoading(true)
      const data = await api.getReviews({ rating, subjectId: subject, limit: 50 })
      if (data) {
        setReviews(data.reviews)
        setSummary(data.summary)
        setLikedIds(new Set(data.likedIds))
      }
    } catch {
      // silently fallback
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchReviews(activeRatingFilter, selectedSubject)
  }, [activeRatingFilter, selectedSubject, fetchReviews])

  const handleRatingFilterChange = (rating?: number) => {
    haptics.impact('light')
    setActiveRatingFilter(rating)
  }

  const handleSubjectFilterChange = (subjectId?: string) => {
    haptics.selection()
    setSelectedSubject(subjectId)
  }

  const handleLikeToggle = async (reviewId: number) => {
    haptics.impact('light')
    const wasLiked = likedIds.has(reviewId)
    // Optimistic update
    setLikedIds((prev) => {
      const next = new Set(prev)
      if (next.has(reviewId)) {
        next.delete(reviewId)
      } else {
        next.add(reviewId)
      }
      return next
    })
    setReviews((prev) =>
      prev.map((r) => {
        if (r.id === reviewId) {
          return { ...r, helpfulCount: r.helpfulCount + (wasLiked ? -1 : 1) }
        }
        return r
      }),
    )
    try {
      await api.toggleHelpfulReview(reviewId)
    } catch {
      // Revert on failure
      setLikedIds((prev) => {
        const next = new Set(prev)
        if (wasLiked) next.add(reviewId)
        else next.delete(reviewId)
        return next
      })
      setReviews((prev) =>
        prev.map((r) => {
          if (r.id === reviewId) {
            return { ...r, helpfulCount: r.helpfulCount + (wasLiked ? 1 : -1) }
          }
          return r
        }),
      )
    }
  }

  const handleReviewSubmitted = () => {
    setShowWriteSheet(false)
    fetchReviews(activeRatingFilter, selectedSubject)
  }

  // Saralash
  const sortedReviews = useMemo(() => {
    const list = [...reviews]
    if (sortOrder === 'highest') {
      return list.sort((a, b) => b.rating - a.rating)
    }
    if (sortOrder === 'helpful') {
      return list.sort((a, b) => b.helpfulCount - a.helpfulCount)
    }
    // newest
    return list.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )
  }, [reviews, sortOrder])

  const timeRangeLabel = useMemo(() => {
    if (timeRange === '7D') return 'LAST 7 DAYS'
    if (timeRange === '30D') return 'LAST 30 DAYS'
    if (timeRange === '90D') return 'LAST 90 DAYS'
    return 'ALL TIME'
  }, [timeRange])

  return (
    <div className="w-full max-w-2xl mx-auto flex flex-col min-h-full bg-[#f4f5f9] dark:bg-background text-foreground">
      {/* ── Top App Bar (1-to-1 Reference Design) ─────────────────────────── */}
      <header className="sticky top-0 z-30 -mt-[var(--safe-top-body,0px)] pt-[var(--safe-top,0px)] px-4 py-2.5 bg-[#f4f5f9]/90 dark:bg-background/90 backdrop-blur-xl flex items-center justify-between border-b border-black/[0.04] dark:border-white/[0.04]">
        <div className="flex items-center gap-2">
          {/* Orqaga tugmasi (< aylana) */}
          <button
            onClick={() => goBack(navigate)}
            aria-label="Back"
            className="w-9 h-9 rounded-full bg-white dark:bg-card shadow-xs border border-black/5 dark:border-white/10 flex items-center justify-center active:scale-95 transition-transform"
          >
            <ChevronLeft size={20} className="text-slate-800 dark:text-foreground stroke-[2.4]" />
          </button>

          {/* Filter/Sort tugmasi (3 gorizontal chiziqcha) */}
          <button
            onClick={() => {
              haptics.impact('light')
              setShowFilterSheet(true)
            }}
            aria-label="Filter"
            className="w-9 h-9 rounded-full bg-white dark:bg-card shadow-xs border border-black/5 dark:border-white/10 flex items-center justify-center active:scale-95 transition-transform"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.3"
              strokeLinecap="round"
              className="text-slate-800 dark:text-foreground"
            >
              <line x1="4" y1="6" x2="20" y2="6" />
              <line x1="7" y1="12" x2="17" y2="12" />
              <line x1="10" y1="18" x2="14" y2="18" />
            </svg>
          </button>

          {/* Sarlavha: Reviews */}
          <h1 className="text-lg font-bold tracking-tight text-slate-900 dark:text-foreground ml-0.5">
            Reviews
          </h1>
        </div>

        {/* O'ng tomon: Ilova/Fanlar stack pill tugmasi (bosiladigan interaktiv selektor) */}
        {currentSubject ? (
          <button
            onClick={() => {
              haptics.selection()
              setShowFilterSheet(true)
            }}
            className="flex items-center gap-1.5 bg-white dark:bg-card px-2.5 py-1 rounded-full shadow-xs border border-blue-200 dark:border-blue-900 active:scale-95 transition-transform"
          >
            <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400 max-w-[100px] truncate">
              {lang === 'ru' ? currentSubject.nameRu : currentSubject.name}
            </span>
            <span
              onClick={(e) => {
                e.stopPropagation()
                handleSubjectFilterChange(undefined)
              }}
              className="w-3.5 h-3.5 rounded-full bg-slate-100 dark:bg-white/10 flex items-center justify-center text-slate-500 hover:text-slate-900"
            >
              <X size={9} strokeWidth={3} />
            </span>
          </button>
        ) : (
          <button
            onClick={() => {
              haptics.selection()
              setShowFilterSheet(true)
            }}
            aria-label="Fan tanlash"
            className="flex items-center gap-1.5 bg-white dark:bg-card px-2.5 py-1 rounded-full shadow-xs border border-black/5 dark:border-white/10 active:scale-95 transition-transform"
          >
            <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
              {lang === 'ru' ? 'Предметы' : 'Fanlar'}
            </span>
            <span className="text-[10px] font-bold text-slate-500 bg-slate-100 dark:bg-white/10 px-1.5 py-0.2 rounded-full">
              {activeSubjects.length}
            </span>
          </button>
        )}
      </header>

      {/* ── Subheader (LAST 7 DAYS · Updated in 0 sec) ────────────────────── */}
      <div className="flex items-center justify-between px-4 pt-2 pb-1 text-[10.5px] font-bold tracking-wider text-slate-400 dark:text-muted-foreground uppercase">
        <span>{timeRangeLabel}</span>
        <span>Updated in 0 sec</span>
      </div>

      {/* ── Asosiy kontent ────────────────────────────────────────────────── */}
      <main className="flex-1 pb-16">
        {/* 1. Katta Reyting Kartasi (4.1 + 20 reviews + 5 ta Bar) */}
        {summary && <RatingSummary summary={summary} />}

        {/* ── 2. FANLAR RO'YXATI (Toza matnli pill filtr, iconsiz) ─────────── */}
        <div className="mt-2 mb-1">
          <div className="flex items-center gap-1.5 px-4 pb-1.5 overflow-x-auto no-scrollbar">
            {/* Hammasi */}
            <button
              onClick={() => handleSubjectFilterChange(undefined)}
              className={`shrink-0 px-3 py-1 rounded-full text-[11px] font-bold transition-all active:scale-95 ${
                !selectedSubject
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-white dark:bg-card text-slate-700 dark:text-slate-300 border border-slate-200/80 dark:border-white/10 hover:bg-slate-50'
              }`}
            >
              {lang === 'ru' ? 'Все предметы' : 'Barcha fanlar'}
            </button>

            {/* Barcha faol fanlar — FAQAT TOZA MATN (iconsiz) */}
            {activeSubjects.map((s) => {
              const isSelected = selectedSubject === s.id
              return (
                <button
                  key={s.id}
                  onClick={() => handleSubjectFilterChange(isSelected ? undefined : s.id)}
                  className={`shrink-0 px-3 py-1 rounded-full text-[11px] font-bold transition-all active:scale-95 ${
                    isSelected
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-white dark:bg-card text-slate-700 dark:text-slate-300 border border-slate-200/80 dark:border-white/10 hover:bg-slate-50'
                  }`}
                >
                  {lang === 'ru' ? s.nameRu : s.name}
                </button>
              )
            })}
          </div>
        </div>

        {/* ── 3. Yulduzlar Filtr Tablari (All, 5★, 4★, 3★, 2★, 1★) ─────────── */}
        <div className="flex items-center gap-1.5 px-4 pb-2.5 overflow-x-auto no-scrollbar">
          {RATING_FILTERS.map((f) => {
            const isSelected = activeRatingFilter === f.value
            return (
              <button
                key={f.label}
                onClick={() => handleRatingFilterChange(f.value)}
                className={`px-3 py-1 rounded-full text-[11px] font-bold whitespace-nowrap transition-all duration-150 active:scale-95 ${
                  isSelected
                    ? 'bg-[#dcebff] text-[#1a56db] dark:bg-blue-950/60 dark:text-blue-300 shadow-2xs'
                    : 'bg-white dark:bg-card text-slate-600 dark:text-slate-300 border border-slate-200/80 dark:border-white/10 shadow-2xs hover:bg-slate-50'
                }`}
              >
                {f.label}
              </button>
            )
          })}
        </div>

        {/* ── 4. Sharhlar Ro'yxati ─────────────────────────────────────────── */}
        <div className="px-4 space-y-3">
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="bg-white dark:bg-card rounded-2xl p-5 shadow-xs border border-slate-100 dark:border-white/5 animate-pulse space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex gap-2">
                    <div className="h-4 w-20 bg-slate-100 dark:bg-white/10 rounded" />
                    <div className="h-4 w-14 bg-slate-100 dark:bg-white/10 rounded-full" />
                  </div>
                  <div className="h-4 w-12 bg-slate-100 dark:bg-white/10 rounded" />
                </div>
                <div className="h-5 w-2/5 bg-slate-100 dark:bg-white/10 rounded" />
                <div className="h-4 w-full bg-slate-100 dark:bg-white/10 rounded" />
                <div className="h-4 w-3/4 bg-slate-100 dark:bg-white/10 rounded" />
              </div>
            ))
          ) : sortedReviews.length === 0 ? (
            <EmptyState
              icon={MessageSquare}
              title={tt('reviewsEmptyTitle')}
              description={tt('reviewsEmptyDesc')}
            />
          ) : (
            sortedReviews.map((review, i) => (
              <ReviewCard
                key={review.id}
                review={review}
                isLiked={likedIds.has(review.id)}
                onLikeToggle={handleLikeToggle}
                animationDelay={i * 35}
              />
            ))
          )}
        </div>
      </main>

      {/* ── FAB — Yangi sharh qoldirish ────────────────────────────────────── */}
      <button
        onClick={() => {
          haptics.impact('medium')
          setShowWriteSheet(true)
        }}
        aria-label="Write Review"
        className="fixed bottom-[calc(1.5rem+var(--safe-bottom,0px))] right-5 z-40 w-14 h-14 rounded-full bg-blue-600 text-white shadow-xl flex items-center justify-center active:scale-90 transition-transform hover:bg-blue-700"
        style={{
          boxShadow: '0 8px 24px rgba(37, 99, 235, 0.38)',
        }}
      >
        <Plus size={26} strokeWidth={2.4} />
      </button>

      {/* ── Modal Sheets ──────────────────────────────────────────────────── */}
      {showFilterSheet && (
        <FilterSortSheet
          timeRange={timeRange}
          setTimeRange={setTimeRange}
          selectedSubject={selectedSubject}
          setSelectedSubject={setSelectedSubject}
          sortOrder={sortOrder}
          setSortOrder={setSortOrder}
          onClose={() => setShowFilterSheet(false)}
        />
      )}

      {showWriteSheet && (
        <WriteReviewSheet
          onClose={() => setShowWriteSheet(false)}
          onSubmitted={handleReviewSubmitted}
        />
      )}
    </div>
  )
}
