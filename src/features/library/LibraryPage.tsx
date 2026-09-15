import { useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Search, SearchX, X, type LucideIcon } from 'lucide-react'
import { goBack } from '../../shared/lib/navigation'
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
import { BookCard } from './components/BookCard'
import { BookDetailSheet } from './components/BookDetailSheet'
import { librarySubjectIcon } from './subject-icons'

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

  const grid = (books: LibraryBook[], showGrade: boolean) => (
    <div className="grid grid-cols-3 gap-x-3 gap-y-4 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
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

  return (
    <div className="px-4 pb-4">
      {/* Sticky header (PageHeader SSOT) + qidiruv */}
      <PageHeader
        title={tt('library')}
        subtitle={tt('librarySubtitle').replace('{count}', String(libraryBooks.length))}
        onBack={() => goBack(navigate)}
        backLabel={tt('backWord')}
        className="-mx-4 mb-3"
      >
        <div className="relative px-4 pb-2.5">
          <Search
            size={16}
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
            className="pl-10 pr-11"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label={tt('clearSearch')}
              className="absolute right-1.5 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-lg text-pmuted transition-colors hover:bg-psurface hover:text-pfg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pprimary"
            >
              <X size={15} strokeWidth={2} />
            </button>
          )}
        </div>
      </PageHeader>

      {/* Sinf filtri */}
      <div className="-mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <FilterChip active={grade === null} label={tt('libraryAllGrades')} onClick={() => selectGrade(null)} />
        {LIBRARY_GRADES.map((g) => (
          <FilterChip key={g} active={grade === g} label={gradeText(g)} onClick={() => selectGrade(g)} />
        ))}
      </div>

      {/* Fan filtri */}
      <div className="-mx-4 mt-1 flex snap-x gap-2 overflow-x-auto px-4 pb-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <FilterChip active={subject === null} label={tt('libraryAllSubjects')} onClick={() => selectSubject(null)} />
        {subjectOptions.map((s) => (
          <FilterChip
            key={s.id}
            icon={librarySubjectIcon(s.id)}
            active={subject === s.id}
            label={language === 'ru' ? s.ru : s.uz}
            onClick={() => selectSubject(s.id)}
          />
        ))}
      </div>

      <div className="mb-3 mt-2 flex items-center justify-between gap-3">
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

      <BookDetailSheet
        book={selected}
        language={language}
        gradeText={selected ? gradeText(selected.grade) : ''}
        onClose={() => setSelected(null)}
        onRead={readBook}
      />
    </div>
  )
}

function FilterChip({ active, label, icon: Icon, onClick }: {
  active: boolean
  label: string
  icon?: LucideIcon
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'inline-flex h-9 shrink-0 snap-start items-center gap-1.5 rounded-xl px-3 text-[13px] font-semibold',
        'transition-[background-color,color,transform] duration-150 ease-out active:scale-[0.97]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pprimary focus-visible:ring-offset-2 focus-visible:ring-offset-pcanvas',
        active
          ? 'bg-pprimary text-ponprimary shadow-xs'
          : 'bg-psurface text-pmuted shadow-2xs hover:text-pfg',
      )}
    >
      {Icon && <Icon size={14} strokeWidth={2} aria-hidden="true" />}
      {label}
    </button>
  )
}
