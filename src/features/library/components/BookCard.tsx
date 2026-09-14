import { memo, useState } from 'react'
import { BookOpenText } from 'lucide-react'
import { cn } from '../../../shared/lib/cn'
import { libraryCoverSrc, type LibraryBook } from '../../../content/library'

interface BookCardProps {
  book: LibraryBook
  /** Sinf belgisi ko'rsatilsinmi (aralash ro'yxatda — filtr yo'q holat) */
  showGrade?: boolean
  gradeLabel: string
  onOpen: (book: LibraryBook) => void
}

/**
 * Kitob kartasi — muqova 3:4 nisbatda, ostida nom.
 * Muqova yuklanguncha shimmer, xato bo'lsa neytral placeholder (rasm hech qachon
 * "singan ikonka" bo'lib ko'rinmaydi). `loading="lazy"` — 207 ta karta bir vaqtda
 * tarmoqqa chiqmaydi.
 */
export const BookCard = memo(function BookCard({ book, showGrade = false, gradeLabel, onOpen }: BookCardProps) {
  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState(false)

  return (
    <button
      type="button"
      aria-label={book.title}
      onClick={() => onOpen(book)}
      className={cn(
        'group flex w-full flex-col text-left',
        'transition-transform duration-150 ease-out active:scale-[0.98]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pprimary focus-visible:ring-offset-2 focus-visible:ring-offset-pcanvas',
      )}
    >
      <span className="relative block aspect-[3/4] w-full overflow-hidden rounded-xl bg-psurface shadow-xs">
        {failed ? (
          <span className="flex h-full w-full flex-col items-center justify-center gap-2 px-2">
            <BookOpenText size={22} strokeWidth={1.5} className="text-pmuted" />
            <span className="line-clamp-3 text-center text-[10.5px] font-medium leading-snug text-pmuted">
              {book.name}
            </span>
          </span>
        ) : (
          <img
            src={libraryCoverSrc(book)}
            alt=""
            loading="lazy"
            decoding="async"
            draggable={false}
            onLoad={() => setLoaded(true)}
            onError={() => setFailed(true)}
            className={cn(
              'h-full w-full object-cover transition-opacity duration-300',
              loaded ? 'opacity-100' : 'opacity-0',
            )}
          />
        )}

        {!loaded && !failed && (
          <span aria-hidden="true" className="absolute inset-0 animate-pulse bg-pline" />
        )}

        {showGrade && (
          <span className="absolute left-1.5 top-1.5 rounded-lg bg-black/55 px-1.5 py-0.5 text-[10px] font-semibold leading-tight text-white backdrop-blur-[2px]">
            {gradeLabel}
          </span>
        )}
      </span>

      <span className="mt-1.5 line-clamp-2 text-[12.5px] font-semibold leading-snug text-pfg">
        {book.name}
      </span>
    </button>
  )
})
