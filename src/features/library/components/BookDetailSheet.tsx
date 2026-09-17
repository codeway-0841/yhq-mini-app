import { BookOpen, ExternalLink, Smartphone } from 'lucide-react'
import { Badge } from '../../../shared/components/ui/badge'
import { Button } from '../../../shared/components/ui/button'
import {
  Sheet,
  SheetBody,
  SheetClose,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '../../../shared/components/ui/sheet'
import { useT } from '../../../shared/i18n'
import { track } from '../../../shared/lib/analytics'
import { openExternalLink } from '../../../platform/open-link'
import { libraryCoverSrc, librarySubjectLabel, type LibraryBook } from '../../../content/library'
import { libraryPdfUrl } from '../library-links'
import { librarySubjectIcon } from '../subject-icons'

interface BookDetailSheetProps {
  book: LibraryBook | null
  language: 'uz' | 'ru'
  /** Tayyor sinf yorlig'i (i18n: "{grade}-sinf" / "{grade} класс") */
  gradeText: string
  onClose: () => void
  onRead: (book: LibraryBook) => void
}

/**
 * Kitob tafsiloti — pastki sheet: katta muqova + meta + ilova ichidagi reader CTA.
 */
export function BookDetailSheet({ book, language, gradeText, onClose, onRead }: BookDetailSheetProps) {
  const tt = useT(language)
  const Icon = book ? librarySubjectIcon(book.subject) : null

  return (
    <Sheet open={book != null} onClose={onClose}>
      {book && (
        <>
          <SheetHeader>
            <SheetTitle className="pr-12">{book.title}</SheetTitle>
          </SheetHeader>
          <SheetClose onClose={onClose} label={tt('close')} />

          <SheetBody className="flex gap-4 pb-3">
            <img
              src={libraryCoverSrc(book)}
              alt=""
              className="aspect-[3/4] w-24 shrink-0 rounded-xl object-cover shadow-md"
            />
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              {Icon && (
                <Badge variant="accent" className="self-start">
                  <Icon />
                  {librarySubjectLabel(book.subject, language)}
                </Badge>
              )}
              <div className="flex flex-wrap gap-1.5">
                <Badge>{gradeText}</Badge>
                {book.pages != null && (
                  <Badge>{tt('libraryPages').replace('{count}', String(book.pages))}</Badge>
                )}
              </div>
            </div>
          </SheetBody>

          <SheetFooter className="flex flex-col gap-2">
            <Button
              block
              onClick={() => {
                track('library_open_original', { slug: book.slug, grade: book.grade })
                openExternalLink(libraryPdfUrl(book))
              }}
            >
              <ExternalLink strokeWidth={1.75} />
              {tt('libraryOpenOriginalPdf')}
            </Button>
            <Button
              block
              variant="secondary"
              onClick={() => onRead(book)}
            >
              <BookOpen strokeWidth={1.75} />
              {tt('libraryOpenBook')}
            </Button>
            <p className="flex items-center justify-center gap-1 text-center text-[11.5px] text-psubtle">
              <Smartphone size={11} strokeWidth={1.75} />
              {tt('libraryOriginalPdfHint')}
            </p>
          </SheetFooter>
        </>
      )}
    </Sheet>
  )
}
