import { useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowUp, Check, ChevronDown, Search, SearchX, X } from 'lucide-react'
import { goBack } from '../../shared/lib/navigation'
import { pageScrollY, scrollPageToTop, addPageScrollListener } from '../../shared/lib/page-scroll'
import { PageHeader } from '../../shared/components/ui/page-header'
import { cn } from '../../shared/lib/cn'
import { useAppStore } from '../../shared/store/useAppStore'
import { useT } from '../../shared/i18n'
import { haptics } from '../../platform/haptics'
import { track } from '../../shared/lib/analytics'
import {
  LIBRARY_GRADES,
  libraryBooks,
  libraryBooksForGrade,
  librarySubjects,
  librarySubjectsOf,
  searchLibrary,
  type LibraryBook,
} from '../../content/library'
import { Input } from '../../shared/components/ui/input'
import { Button } from '../../shared/components/ui/button'
import { EmptyState } from '../../shared/components/ui/empty-state'
import {
  Sheet,
  SheetBody,
  SheetClose,
  SheetHeader,
  SheetTitle,
} from '../../shared/components/ui/sheet'
import { BookCard } from './components/BookCard'
import { BookDetailSheet } from './components/BookDetailSheet'

const KNOWN_SUBJECT_IDS = new Set(librarySubjects.map((s) => s.id))

/**
 * Kutubxona — 1–11 sinf darsliklari. Filtrlar URL hash'da (`?sinf=5&fan=ona-tili`),
 * shuning uchun havola ulashsa ham holat saqlanadi, orqaga qaytish ham to'g'ri ishlaydi.
 */
export default function LibraryPage() {
  const navigate = useNavigate()
  const language = useAppStore((s) => s.settings.language)
  const tt = useT(language)

  const [params, setParams] = useSearchParams()
  const gradeParam = Number(params.get('sinf'))
  const grade = Number.isInteger(gradeParam) && LIBRARY_GRADES.includes(gradeParam) ? gradeParam : null
  const subjectParam = params.get('fan')
  const subject = subjectParam && KNOWN_SUBJECT_IDS.has(subjectParam) ? subjectParam : null

  const [query, setQuery] = useState('')
  const deferredQuery = useDeferredValue(query)
  const [selected, setSelected] = useState<LibraryBook | null>(null)
  const [gradeSheetOpen, setGradeSheetOpen] = useState(false)
  const [subjectSheetOpen, setSubjectSheetOpen] = useState(false)
  const [showScrollTop, setShowScrollTop] = useState(false)

  useEffect(() => {
    let ticking = false
    const onScroll = () => {
      if (ticking) return
      ticking = true
      requestAnimationFrame(() => {
        ticking = false
        setShowScrollTop(pageScrollY() > 350)
      })
    }
    return addPageScrollListener(onScroll)
  }, [])

  const handleScrollToTop = useCallback(() => {
    haptics.impact('light')
    scrollPageToTop('smooth')
  }, [])

  const gradeText = (g: number) => tt('libraryGrade').replace('{grade}', String(g))

  const updateFilters = useCallback((nextGrade: number | null, nextSubject: string | null) => {
    const next: Record<string, string> = {}
    if (nextGrade != null) next.sinf = String(nextGrade)
    if (nextSubject) next.fan = nextSubject
    setParams(next, { replace: true })
  }, [setParams])

  const gradeScoped = useMemo(() => libraryBooksForGrade(grade), [grade])
  const subjectOptions = useMemo(() => librarySubjectsOf(gradeScoped), [gradeScoped])

  // URL'dagi fan joriy sinfda bo'lmasa — jim tozalaymiz (bo'sh natija
  // ko'rsatib foydalanuvchini chalg'itmaslik uchun).
  useEffect(() => {
    if (subject && !subjectOptions.some((s) => s.id === subject)) {
      updateFilters(grade, null)
    }
  }, [subject, subjectOptions, grade, updateFilters])

  const filtered = useMemo(() => {
    const base = searchLibrary(deferredQuery, gradeScoped)
    return subject ? base.filter((b) => b.subject === subject) : base
  }, [deferredQuery, gradeScoped, subject])

  // Filtr yo'q — sinflar bo'yicha bo'limlar ("javon"); aks holda yagona panjara.
  const grouped = useMemo(() => {
    if (grade != null || subject != null || deferredQuery.trim()) return null
    return LIBRARY_GRADES
      .map((g) => ({ grade: g, books: filtered.filter((b) => b.grade === g) }))
      .filter((section) => section.books.length > 0)
  }, [grade, subject, deferredQuery, filtered])

  const filtering = query.trim().length > 0 || grade != null || subject != null
  const countText = tt('libraryBooksFound').replace('{count}', String(filtered.length))

  const clearFilters = useCallback(() => {
    haptics.impact('light')
    setQuery('')
    updateFilters(null, null)
  }, [updateFilters])

  const openBook = useCallback((book: LibraryBook) => {
    haptics.impact('light')
    setSelected(book)
  }, [])

  const readBook = useCallback((book: LibraryBook) => {
    haptics.impact('medium')
    track('library_open', { slug: book.slug, grade: book.grade })
    setSelected(null)
    navigate(`/kutubxona/kitob/${encodeURIComponent(book.slug)}`)
  }, [navigate])

  const selectGrade = (next: number | null) => {
    haptics.impact('light')
    const scope = libraryBooksForGrade(next)
    const keepSubject = subject && scope.some((b) => b.subject === subject) ? subject : null
    updateFilters(next, keepSubject)
  }

  const selectSubject = (next: string | null) => {
    haptics.impact('light')
    updateFilters(grade, next)
  }

  const activeSubjectObj = subject ? librarySubjects.find((s) => s.id === subject) : null
  const activeSubjectLabel = activeSubjectObj ? (language === 'ru' ? activeSubjectObj.ru : activeSubjectObj.uz) : null

  const grid = (books: LibraryBook[], showGrade: boolean) => (
    <div className="grid grid-cols-3 gap-2.5 sm:gap-3 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
      {books.map((book) => (
        <BookCard
          key={book.slug}
          book={book}
          showGrade={showGrade}
          gradeLabel={gradeText(book.grade)}
          onOpen={openBook}
        />
      ))}
    </div>
  )

  const allGradesLabel = language === 'ru' ? 'Классы' : 'Sinflar'

  return (
    <div className="px-4 pb-4">
      {/* Sticky header (PageHeader SSOT) + qidiruv */}
      <PageHeader
        title={tt('library')}
        subtitle={tt('librarySubtitle').replace('{count}', String(libraryBooks.length))}
        size="lg"
        onBack={() => goBack(navigate)}
        backLabel={tt('backWord')}
        className="-mx-4 mb-2.5"
      >
        <div className="px-4 pb-2.5">
          <div className="relative flex items-center">
            <Search
              size={17}
              strokeWidth={2}
              aria-hidden="true"
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-pmuted"
            />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={tt('librarySearchPlaceholder')}
              aria-label={tt('librarySearchPlaceholder')}
              inputMode="search"
              enterKeyHint="search"
              className="h-10 w-full rounded-xl pl-10 pr-9 bg-pcanvas text-[13.5px] border border-pline focus:border-pprimary"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                aria-label={tt('clearSearch')}
                className="absolute right-2 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-lg text-pmuted transition-colors hover:bg-psurface hover:text-pfg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pprimary"
              >
                <X size={15} strokeWidth={2} />
              </button>
            )}
          </div>
        </div>
      </PageHeader>

      {/* 50/50 Simmetrik Filtr Tugmalari (Sinf va Fan tanlash) */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        {/* Sinf filtri */}
        <button
          type="button"
          onClick={() => { haptics.impact('light'); setGradeSheetOpen(true) }}
          aria-label={`${language === 'ru' ? 'Класс' : 'Sinf'}: ${grade !== null ? gradeText(grade) : allGradesLabel}`}
          className={cn(
            'flex h-10 min-w-0 items-center justify-between gap-2 rounded-xl px-3.5 text-[13px] font-semibold shadow-2xs transition-all active:scale-[0.98]',
            grade !== null
              ? 'bg-pprimary text-ponprimary shadow-xs'
              : 'bg-psurface text-pfg hover:bg-pcard',
          )}
        >
          <span className="truncate">{grade !== null ? gradeText(grade) : allGradesLabel}</span>
          <ChevronDown size={15} className="shrink-0 opacity-60" />
        </button>

        {/* Fan filtri */}
        <button
          type="button"
          onClick={() => { haptics.impact('light'); setSubjectSheetOpen(true) }}
          aria-label={`${language === 'ru' ? 'Предмет' : 'Fan'}: ${activeSubjectLabel || tt('libraryAllSubjects')}`}
          className={cn(
            'flex h-10 min-w-0 items-center justify-between gap-2 rounded-xl px-3.5 text-[13px] font-semibold shadow-2xs transition-all active:scale-[0.98]',
            subject !== null
              ? 'bg-pprimary text-ponprimary shadow-xs'
              : 'bg-psurface text-pfg hover:bg-pcard',
          )}
        >
          <span className="truncate">{activeSubjectLabel || tt('libraryAllSubjects')}</span>
          <ChevronDown size={15} className="shrink-0 opacity-60" />
        </button>
      </div>

      <div className="mb-3 mt-1 flex items-center justify-between gap-3">
        <p className="text-[12.5px] font-medium text-pmuted">{countText}</p>
        {filtering && (
          <button
            type="button"
            onClick={clearFilters}
            className="shrink-0 text-[12.5px] font-semibold text-pprimary transition-opacity hover:opacity-80"
          >
            {tt('libraryClearFilters')}
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={SearchX}
          title={tt('libraryNoResultsTitle')}
          description={tt('libraryNoResultsDesc')}
          action={
            <Button variant="secondary" onClick={clearFilters}>
              {tt('libraryClearFilters')}
            </Button>
          }
        />
      ) : grouped ? (
        <div className="flex flex-col gap-6">
          {grouped.map(({ grade: g, books }) => (
            <section key={g}>
              <div className="mb-2 flex items-baseline justify-between gap-3">
                <h2 className="font-display text-[15px] font-semibold text-pfg">{gradeText(g)}</h2>
                <span className="text-[11.5px] font-medium tabular-nums text-pmuted">
                  {tt('libraryBooksFound').replace('{count}', String(books.length))}
                </span>
              </div>
              {grid(books, false)}
            </section>
          ))}
        </div>
      ) : (
        grid(filtered, grade == null)
      )}

      {/* Sinf tanlash pastki modal oynasi */}
      <Sheet open={gradeSheetOpen} onClose={() => setGradeSheetOpen(false)}>
        <SheetHeader>
          <SheetTitle>{language === 'ru' ? 'Выберите класс' : 'Sinfni tanlang'}</SheetTitle>
        </SheetHeader>
        <SheetClose onClose={() => setGradeSheetOpen(false)} label={tt('close')} />
        <SheetBody className="max-h-[65svh] overflow-y-auto pb-6">
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => { selectGrade(null); setGradeSheetOpen(false) }}
              className={cn(
                'flex h-11 items-center justify-center rounded-xl px-3 text-[13px] font-semibold shadow-2xs transition-all active:scale-[0.98]',
                grade === null
                  ? 'bg-pprimary text-ponprimary shadow-xs'
                  : 'bg-psurface text-pfg hover:bg-pcard',
              )}
            >
              {tt('libraryAllGrades')}
            </button>
            {LIBRARY_GRADES.map((g) => {
              const isSelected = grade === g
              return (
                <button
                  key={g}
                  type="button"
                  onClick={() => { selectGrade(g); setGradeSheetOpen(false) }}
                  className={cn(
                    'flex h-11 items-center justify-center rounded-xl px-3 text-[13px] font-semibold shadow-2xs transition-all active:scale-[0.98]',
                    isSelected
                      ? 'bg-pprimary text-ponprimary shadow-xs'
                      : 'bg-psurface text-pfg hover:bg-pcard',
                  )}
                >
                  {gradeText(g)}
                </button>
              )
            })}
          </div>
        </SheetBody>
      </Sheet>

      {/* Fan tanlash pastki modal oynasi */}
      <Sheet open={subjectSheetOpen} onClose={() => setSubjectSheetOpen(false)}>
        <SheetHeader>
          <SheetTitle>{language === 'ru' ? 'Выберите предмет' : 'Fanni tanlang'}</SheetTitle>
        </SheetHeader>
        <SheetClose onClose={() => setSubjectSheetOpen(false)} label={tt('close')} />
        <SheetBody className="max-h-[65svh] overflow-y-auto pb-6">
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={() => { selectSubject(null); setSubjectSheetOpen(false) }}
              className={cn(
                'flex h-12 items-center justify-between rounded-xl px-4 text-[13.5px] font-semibold shadow-2xs transition-all active:scale-[0.98]',
                subject === null
                  ? 'bg-pprimary text-ponprimary shadow-xs'
                  : 'bg-psurface text-pfg hover:bg-pcard',
              )}
            >
              <span>{tt('libraryAllSubjects')}</span>
              {subject === null && <Check size={18} strokeWidth={2.5} />}
            </button>
            {subjectOptions.map((s) => {
              const isSelected = subject === s.id
              const label = language === 'ru' ? s.ru : s.uz
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => { selectSubject(s.id); setSubjectSheetOpen(false) }}
                  className={cn(
                    'flex h-12 items-center justify-between rounded-xl px-4 text-[13.5px] font-semibold shadow-2xs transition-all active:scale-[0.98]',
                    isSelected
                      ? 'bg-pprimary text-ponprimary shadow-xs'
                      : 'bg-psurface text-pfg hover:bg-pcard',
                  )}
                >
                  <span>{label}</span>
                  {isSelected && <Check size={18} strokeWidth={2.5} />}
                </button>
              )
            })}
          </div>
        </SheetBody>
      </Sheet>

      <BookDetailSheet
        book={selected}
        language={language}
        gradeText={selected ? gradeText(selected.grade) : ''}
        onClose={() => setSelected(null)}
        onRead={readBook}
      />

      {/* Tepaga qaytish tugmasi */}
      <button
        type="button"
        onClick={handleScrollToTop}
        aria-label="Tepaga qaytish"
        className={cn(
          'fixed bottom-[calc(1.5rem+var(--safe-bottom,0px))] right-4 sm:right-6 z-30 grid size-11 place-items-center rounded-full bg-pprimary text-ponprimary shadow-lg shadow-[rgb(var(--p-primary-rgb)/0.3)] transition-all duration-200 active:scale-90',
          showScrollTop
            ? 'opacity-100 translate-y-0 pointer-events-auto'
            : 'opacity-0 translate-y-4 pointer-events-none',
        )}
      >
        <ArrowUp size={20} strokeWidth={2.5} />
      </button>
    </div>
  )
}
