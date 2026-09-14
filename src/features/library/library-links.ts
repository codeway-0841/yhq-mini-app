import { config } from '../../shared/config'
import type { LibraryBook } from '../../content/library'

/**
 * Kitob PDF manzili. PDF'lar repo'da emas (jami ~3GB) — `VITE_LIBRARY_PDF_BASE_URL`
 * bilan R2/S3/CDN'ga yo'naltiriladi; berilmasa lokal `/kutubxona/pdf` (dev fallback).
 */
export function libraryPdfUrl(book: LibraryBook): string {
  const base = config.libraryPdfBaseUrl.replace(/\/+$/, '')
  return `${base}/${book.file}`
}
