/**
 * Kutubxona katalogi CONSISTENCY testi.
 *
 * Katalog `scripts/build-library-catalog.py` tomonidan generatsiya qilinadi —
 * bu testlar generatsiya natijasining shartnomasini qo'riqlaydi:
 *  - 1–11 sinf to'liq, slug'lar noyob
 *  - tashqi manbalarga (testmakon/http) havola YO'Q (ilova faqat o'z asset'laridan)
 *  - har bir muqova public/ da mavjud, har bir fan id'sining ikonkasi bor
 *  - qidiruv (apostrof variantlari, ru fan nomi, sinf raqami) ishlaydi
 */
import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import {
  LIBRARY_GRADES,
  libraryBooks,
  libraryBooksForGrade,
  libraryCoverSrc,
  librarySubjectLabel,
  librarySubjects,
  normalizeLibraryText,
  searchLibrary,
} from '../../../src/content/library'
import { librarySubjectIcon } from '../../../src/features/library/subject-icons'
import { libraryPdfUrl } from '../../../src/features/library/library-links'
import { config, resolveLibraryPdfBase } from '../../../src/shared/config'

const ROOT = path.resolve(__dirname, '../../..')
const RAW_JSON = fs.readFileSync(path.join(ROOT, 'src/content/library.json'), 'utf8')

describe('kutubxona katalogi', () => {
  it('1–11 sinflar to\'liq, slug va muqova yo\'llari noyob', () => {
    expect(LIBRARY_GRADES).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11])
    for (const grade of LIBRARY_GRADES) {
      expect(libraryBooksForGrade(grade).length, `${grade}-sinf bo'sh`).toBeGreaterThan(0)
    }
    expect(new Set(libraryBooks.map((b) => b.slug)).size).toBe(libraryBooks.length)
    expect(new Set(libraryBooks.map((b) => b.cover)).size).toBe(libraryBooks.length)
  })

  it('har bir kitobda nom, fan va PDF kaliti bor', () => {
    for (const book of libraryBooks) {
      expect(book.name.trim().length, book.slug).toBeGreaterThan(0)
      expect(book.title).toContain(`${book.grade}-sinf`)
      expect(book.file.endsWith('.pdf'), book.slug).toBe(true)
      expect(book.cover.endsWith('-cover.webp'), book.slug).toBe(true)
      if (book.pages != null) expect(book.pages).toBeGreaterThan(0)
    }
  })

  it('tashqi manba havolalari YO\'Q (testmakon/http)', () => {
    expect(RAW_JSON.toLowerCase()).not.toContain('testmakon')
    expect(RAW_JSON.toLowerCase()).not.toContain('http')
  })

  it('har bir muqova public/kutubxona/covers da mavjud', () => {
    const missing = libraryBooks.filter(
      (book) => !fs.existsSync(path.join(ROOT, 'public', libraryCoverSrc(book).replace(/^\//, ''))),
    )
    expect(missing.map((b) => b.slug)).toEqual([])
  })

  it('fan id\'lari jadvalga mos, har biriga ikonka biriktirilgan', () => {
    const ids = new Set(librarySubjects.map((s) => s.id))
    expect(ids.size).toBe(librarySubjects.length)
    for (const book of libraryBooks) expect(ids.has(book.subject), book.slug).toBe(true)
    for (const subject of librarySubjects) {
      expect(librarySubjectLabel(subject.id, 'uz')).toBe(subject.uz)
      expect(librarySubjectLabel(subject.id, 'ru')).toBe(subject.ru)
      expect(librarySubjectIcon(subject.id)).toBeTruthy()
    }
  })

  it('PDF URL joriy base (env yoki lokal fallback) bilan yig\'iladi', () => {
    const book = libraryBooks[0]
    const base = config.libraryPdfBaseUrl.replace(/\/+$/, '')
    expect(libraryPdfUrl(book)).toBe(`${base}/${book.file}`)
  })

  it('PDF base resolver: env, trailing slash va bo\'sh qiymat fallback', () => {
    expect(resolveLibraryPdfBase(undefined)).toBe('/kutubxona/pdf')
    expect(resolveLibraryPdfBase('   ')).toBe('/kutubxona/pdf')
    expect(resolveLibraryPdfBase('///')).toBe('/kutubxona/pdf')
    expect(resolveLibraryPdfBase('https://cdn.kivvi.uz/kutubxona/pdf/'))
      .toBe('https://cdn.kivvi.uz/kutubxona/pdf')
  })

  it('qidiruv: so\'z boshi, apostrof variantlari va ru fan nomi', () => {
    expect(normalizeLibraryText('O‘zbekiston tarixi')).toBe("o'zbekiston tarixi")

    const alifbe = searchLibrary('alifbe')
    expect(alifbe.map((b) => b.slug)).toEqual(['1-sinf-alifbe'])

    const grade1 = searchLibrary('1-sinf')
    expect(grade1.length).toBeGreaterThan(0)
    expect(grade1.every((b) => b.grade === 1)).toBe(true)

    const ruMath = searchLibrary('Математика')
    expect(ruMath.length).toBeGreaterThan(0)
    expect(ruMath.every((b) => b.subject === 'matematika')).toBe(true)
  })
})
