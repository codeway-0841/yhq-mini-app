/**
 * Kutubxona katalogi — 1–11 sinf darsliklari (muqova + PDF kaliti).
 *
 * MA'LUMOT `library.json`'dan keladi va `scripts/build-library-catalog.py`
 * tomonidan generatsiya qilinadi (tashqi havolalar tozalangan, dublikatlar
 * chiqarilgan). Bu faylni qo'lda tahrirlamang — kontent yangilanganda skriptni
 * qayta ishga tushiring.
 *
 * PDF fayllar repo'da yashamaydi (3GB): `config.libraryPdfBaseUrl` +
 * `book.file` orqali yig'iladi (features/library/library-links.ts).
 */
import raw from './library.json'

export interface LibrarySubject {
  id: string
  uz: string
  ru: string
}

export interface LibraryBook {
  slug: string
  grade: number
  /** To'liq sarlavha: "5-sinf Matematika (1-qism)" */
  title: string
  /** Sinf prefiksisiz ko'rsatish nomi: "Matematika (1-qism)" */
  name: string
  subject: string
  pages: number | null
  /** PDF kaliti (base URL'ga qo'shiladi): "5-sinf/5-sinf-matematika-1-qism.pdf" */
  file: string
  /** Muqova kaliti: "5-sinf/5-sinf-matematika-1-qism-cover.webp" */
  cover: string
}

export const libraryBooks: LibraryBook[] = raw.books
export const librarySubjects: LibrarySubject[] = raw.subjects

export const LIBRARY_GRADES: number[] = Array.from(
  new Set(libraryBooks.map((b) => b.grade)),
).sort((a, b) => a - b)

export const LIBRARY_GRADES_RANGE =
  LIBRARY_GRADES.length > 0 ? `${LIBRARY_GRADES[0]}–${LIBRARY_GRADES[LIBRARY_GRADES.length - 1]}` : ''

const subjectById = new Map(librarySubjects.map((s) => [s.id, s]))

export function librarySubject(id: string): LibrarySubject | undefined {
  return subjectById.get(id)
}

export function librarySubjectLabel(id: string, lang: 'uz' | 'ru'): string {
  const s = subjectById.get(id)
  return (lang === 'ru' ? s?.ru : s?.uz) ?? id
}

/** Muqova URL'i — `public/kutubxona/covers/...` (Vite base '/'). */
export function libraryCoverSrc(book: LibraryBook): string {
  return `/kutubxona/covers/${book.cover}`
}

export function libraryBooksForGrade(grade: number | null): LibraryBook[] {
  return grade == null ? libraryBooks : libraryBooks.filter((b) => b.grade === grade)
}

/** Berilgan to'plamda uchraydigan fanlar — canonical tartibda. */
export function librarySubjectsOf(books: LibraryBook[]): LibrarySubject[] {
  const used = new Set(books.map((b) => b.subject))
  return librarySubjects.filter((s) => used.has(s.id))
}

/** O'zbek lotin apostroflari turlicha yoziladi (`O‘zbekiston` / `O'zbekiston`) —
 *  qidiruvda bittaga keltiramiz. */
const APOSTROPHES = /[‘’ʻʼ`´]/g

export function normalizeLibraryText(value: string): string {
  return value.toLowerCase().replace(APOSTROPHES, "'").replace(/\s+/g, ' ').trim()
}

const haystacks = new Map<string, string>()

function haystackFor(book: LibraryBook): string {
  let h = haystacks.get(book.slug)
  if (h) return h
  const subject = subjectById.get(book.subject)
  h = normalizeLibraryText(
    [
      book.title,
      book.name,
      subject?.uz,
      subject?.ru,
      `${book.grade}`,
      `${book.grade}-sinf`,
      `${book.grade} класс`,
    ]
      .filter(Boolean)
      .join(' '),
  )
  haystacks.set(book.slug, h)
  return h
}

/**
 * Matn bo'yicha qidiruv (nom, fan uz/ru, sinf). Bo'sh so'rov — butun katalog.
 * Ko'p so'zli so'rovda BARCHA so'zlar mos kelishi shart ("matematika 5").
 */
export function searchLibrary(query: string, books: LibraryBook[] = libraryBooks): LibraryBook[] {
  const q = normalizeLibraryText(query)
  if (!q) return books
  const terms = q.split(' ').filter(Boolean)
  return books.filter((book) => {
    // Boshiga bo'shliq qo'shib SO'Z BOSHI bo'yicha qidiramiz: "1-sinf" "11-sinf"ga
    // yopishib ketmaydi, "mat" esa "matematika"ni topadi.
    const h = ` ${haystackFor(book)}`
    return terms.every((term) => h.includes(` ${term}`))
  })
}
