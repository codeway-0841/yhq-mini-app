import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Loader2,
  Minus,
  Plus,
  RefreshCw,
} from 'lucide-react'
import type { PDFDocumentLoadingTask, PDFDocumentProxy, RenderTask } from 'pdfjs-dist'
import { libraryBooks, librarySubjectLabel } from '../../content/library'
import { haptics } from '../../platform/haptics'
import { openExternalLink } from '../../platform/open-link'
import { Button } from '../../shared/components/ui/button'
import { useT } from '../../shared/i18n'
import { track } from '../../shared/lib/analytics'
import { goBack } from '../../shared/lib/navigation'
import { useAppStore } from '../../shared/store/useAppStore'
import { libraryPdfUrl } from './library-links'
import { BundledPdfWasmFactory, loadPdfJs } from './pdfjs-loader'

const MIN_ZOOM = 0.75
const MAX_ZOOM = 2
const ZOOM_STEP = 0.25

type ReaderStatus = 'loading' | 'ready' | 'error'

function initialReaderWidth(): number {
  return typeof window === 'undefined' ? 360 : Math.max(280, window.innerWidth)
}

/**
 * Ilova ichidagi mobil PDF reader. Faqat joriy bet canvas'ga chiziladi — katta
 * darsliklarda DOM va xotira betlar soniga qarab o'sib ketmaydi.
 */
export default function LibraryReaderPage() {
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const language = useAppStore((s) => s.settings.language)
  const tt = useT(language)
  const book = useMemo(() => libraryBooks.find((item) => item.slug === slug), [slug])

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const viewportRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const renderTaskRef = useRef<RenderTask | null>(null)
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null)
  const [status, setStatus] = useState<ReaderStatus>('loading')
  const [progress, setProgress] = useState<number | null>(null)
  const [pageNumber, setPageNumber] = useState(1)
  const [pageCount, setPageCount] = useState(0)
  const [zoom, setZoom] = useState(1)
  const [readerWidth, setReaderWidth] = useState(initialReaderWidth)
  const [isRendering, setIsRendering] = useState(false)
  const [retryKey, setRetryKey] = useState(0)

  const closeReader = useCallback(() => goBack(navigate), [navigate])

  useEffect(() => {
    const element = viewportRef.current
    if (!element) return

    const measure = () => setReaderWidth(Math.max(280, element.clientWidth))
    measure()

    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(measure)
      observer.observe(element)
      return () => observer.disconnect()
    }

    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [])

  useEffect(() => {
    if (!book) {
      setStatus('error')
      return
    }

    let disposed = false
    let loadingTask: PDFDocumentLoadingTask | null = null

    setPdf(null)
    setStatus('loading')
    setProgress(null)
    setPageNumber(1)
    setPageCount(0)
    setZoom(1)

    void (async () => {
      try {
        const pdfjs = await loadPdfJs()
        if (disposed) return

        loadingTask = pdfjs.getDocument({
          url: libraryPdfUrl(book),
          // KIVVI CSP'da unsafe-eval talab qilmasligi uchun.
          isEvalSupported: false,
          // Vite hash'langan decoder assetlarini asosiy threaddan worker'ga uzatadi.
          WasmFactory: BundledPdfWasmFactory,
          useWorkerFetch: false,
          // Darsliklardagi CID/Cyrillic matn va nostandart shriftlar original
          // ko'rinishda chiqishi uchun (public/pdfjs — copy-pdfjs-assets.mjs).
          cMapUrl: '/pdfjs/cmaps/',
          cMapPacked: true,
          standardFontDataUrl: '/pdfjs/standard_fonts/',
          wasmUrl: '/pdfjs/wasm/',
        })
        loadingTask.onProgress = ({ loaded, total }: { loaded: number; total: number }) => {
          if (!disposed && total > 0) setProgress(Math.min(100, Math.round((loaded / total) * 100)))
        }

        const document = await loadingTask.promise
        if (disposed) {
          await document.destroy()
          return
        }

        setPdf(document)
        setPageCount(document.numPages)
        setStatus('ready')
        track('library_reader_ready', { slug: book.slug, pages: document.numPages })
      } catch (error) {
        if (disposed) return
        console.error('Kutubxona PDF yuklanmadi:', error)
        setStatus('error')
        track('library_reader_error', { slug: book.slug })
      }
    })()

    return () => {
      disposed = true
      renderTaskRef.current?.cancel()
      renderTaskRef.current = null
      if (loadingTask) void loadingTask.destroy()
    }
  }, [book, retryKey])

  useEffect(() => {
    if (!pdf || status !== 'ready') return
    const canvas = canvasRef.current
    if (!canvas) return

    let disposed = false
    setIsRendering(true)

    void (async () => {
      try {
        const page = await pdf.getPage(pageNumber)
        if (disposed) return

        const naturalViewport = page.getViewport({ scale: 1 })
        const fitScale = Math.max(0.2, (readerWidth - 24) / naturalViewport.width)
        const viewport = page.getViewport({ scale: fitScale * zoom })
        const outputScale = Math.min(window.devicePixelRatio || 1, 2)

        canvas.width = Math.floor(viewport.width * outputScale)
        canvas.height = Math.floor(viewport.height * outputScale)
        canvas.style.width = `${Math.floor(viewport.width)}px`
        canvas.style.height = `${Math.floor(viewport.height)}px`

        const task = page.render({
          canvas,
          viewport,
          transform: outputScale === 1 ? undefined : [outputScale, 0, 0, outputScale, 0, 0],
          background: '#ffffff',
        })
        renderTaskRef.current = task
        await task.promise
      } catch (error) {
        if (!disposed && (error as { name?: string }).name !== 'RenderingCancelledException') {
          console.error('Kutubxona PDF beti chizilmadi:', error)
          setStatus('error')
        }
      } finally {
        if (!disposed) setIsRendering(false)
      }
    })()

    return () => {
      disposed = true
      renderTaskRef.current?.cancel()
      renderTaskRef.current = null
    }
  }, [pageNumber, pdf, readerWidth, status, zoom])

  const changePage = useCallback((nextPage: number) => {
    const clamped = Math.min(pageCount, Math.max(1, nextPage))
    if (!pageCount || clamped === pageNumber) return
    haptics.impact('light')
    setPageNumber(clamped)
    scrollRef.current?.scrollTo?.({ top: 0, left: 0, behavior: 'smooth' })
  }, [pageCount, pageNumber])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft') changePage(pageNumber - 1)
      if (event.key === 'ArrowRight') changePage(pageNumber + 1)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [changePage, pageNumber])

  const changeZoom = (nextZoom: number) => {
    haptics.impact('light')
    setZoom(Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, nextZoom)))
  }

  const openFallback = () => {
    if (!book) return
    openExternalLink(libraryPdfUrl(book))
  }

  if (!book) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-pcanvas text-pfg">
        <ReaderHeader title={tt('library')} subtitle={tt('libraryBookNotFound')} onBack={closeReader} backLabel={tt('backWord')} />
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
          <div className="grid size-16 place-items-center rounded-2xl bg-psurface text-pmuted">
            <BookOpen size={28} strokeWidth={1.5} />
          </div>
          <p className="text-sm text-pmuted">{tt('libraryBookNotFound')}</p>
          <Button variant="secondary" onClick={closeReader}>{tt('backWord')}</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-pcanvas text-pfg">
      <ReaderHeader
        title={book.title}
        subtitle={`${book.grade}-${language === 'ru' ? 'класс' : 'sinf'} · ${librarySubjectLabel(book.subject, language)}`}
        onBack={closeReader}
        backLabel={tt('backWord')}
        action={(
          <button
            type="button"
            onClick={openFallback}
            className="flex h-9 shrink-0 items-center gap-1.5 rounded-xl bg-[rgb(var(--p-primary-rgb)/0.1)] px-2.5 text-xs font-bold text-pprimary transition-colors hover:bg-pprimary hover:text-ponprimary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pprimary"
          >
            <ExternalLink size={14} strokeWidth={2} />
            <span>{tt('libraryOpenExternalFull')}</span>
          </button>
        )}
      />

      {status === 'ready' && (
        <div className="flex h-11 shrink-0 items-center justify-between border-b border-pline bg-pcard px-4">
          <span className="min-w-[64px] text-xs font-semibold tabular-nums text-pmuted">
            {tt('libraryPageOf')
              .replace('{current}', String(pageNumber))
              .replace('{total}', String(pageCount))}
          </span>
          <div className="flex items-center gap-1" aria-label={tt('libraryZoomControls')}>
            <ReaderIconButton
              label={tt('libraryZoomOut')}
              disabled={zoom <= MIN_ZOOM}
              onClick={() => changeZoom(zoom - ZOOM_STEP)}
            >
              <Minus size={16} />
            </ReaderIconButton>
            <button
              type="button"
              onClick={() => changeZoom(1)}
              className="min-w-14 rounded-lg px-2 py-1 text-xs font-bold tabular-nums text-pfg hover:bg-psurface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pprimary"
            >
              {Math.round(zoom * 100)}%
            </button>
            <ReaderIconButton
              label={tt('libraryZoomIn')}
              disabled={zoom >= MAX_ZOOM}
              onClick={() => changeZoom(zoom + ZOOM_STEP)}
            >
              <Plus size={16} />
            </ReaderIconButton>
          </div>
        </div>
      )}

      <div ref={viewportRef} className="relative min-h-0 flex-1">
        {status === 'loading' ? (
          <div role="status" className="flex h-full flex-col items-center justify-center gap-4 px-8 text-center">
            <div className="grid size-14 place-items-center rounded-2xl bg-psurface text-pprimary shadow-sm">
              <Loader2 className="animate-spin" size={26} strokeWidth={1.75} />
            </div>
            <div>
              <p className="font-semibold text-pfg">{tt('libraryLoadingPdf')}</p>
              <p className="mt-1 text-xs text-pmuted">
                {progress == null
                  ? tt('libraryLoadingHint')
                  : tt('libraryLoadingProgress').replace('{percent}', String(progress))}
              </p>
            </div>
            <div className="h-1.5 w-44 overflow-hidden rounded-full bg-psurface">
              <div
                className="h-full rounded-full bg-pprimary transition-[width] duration-200"
                style={{ width: `${progress ?? 18}%` }}
              />
            </div>
          </div>
        ) : status === 'error' ? (
          <div role="alert" className="flex h-full flex-col items-center justify-center gap-4 px-7 text-center">
            <div className="grid size-16 place-items-center rounded-2xl bg-[rgb(var(--p-danger-rgb)/0.1)] text-pdanger">
              <BookOpen size={28} strokeWidth={1.5} />
            </div>
            <div className="max-w-sm">
              <h2 className="font-display text-lg font-bold">{tt('libraryPdfErrorTitle')}</h2>
              <p className="mt-1.5 text-sm leading-relaxed text-pmuted">{tt('libraryPdfErrorDesc')}</p>
            </div>
            <div className="flex w-full max-w-xs flex-col gap-2">
              <Button block onClick={openFallback}>
                <ExternalLink size={17} />
                {tt('libraryOpenExternalFull')}
              </Button>
              <Button block variant="secondary" onClick={() => setRetryKey((key) => key + 1)}>
                <RefreshCw size={17} />
                {tt('libraryRetry')}
              </Button>
            </div>
          </div>
        ) : (
          <div
            ref={scrollRef}
            data-no-swipe
            data-pdf-rendering={isRendering ? 'true' : 'false'}
            className="h-full overflow-auto overscroll-contain bg-psurface p-3 [scrollbar-gutter:stable_both-edges]"
          >
            <div className="relative mx-auto w-max min-w-full">
              <canvas
                ref={canvasRef}
                aria-label={tt('libraryCanvasPage').replace('{page}', String(pageNumber))}
                className="mx-auto block max-w-none rounded-sm bg-white shadow-lg"
              />
              {isRendering && (
                <div className="absolute inset-0 grid place-items-center rounded-sm bg-white/70" aria-hidden="true">
                  <Loader2 className="animate-spin text-pprimary" size={25} />
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {status === 'ready' && (
        <nav
          aria-label={tt('libraryPageNavigation')}
          className="flex shrink-0 items-center gap-3 border-t border-pline bg-pcard px-4 pb-[calc(.65rem+var(--safe-bottom,0px))] pt-2.5"
        >
          <Button
            variant="secondary"
            className="flex-1"
            disabled={pageNumber <= 1 || isRendering}
            onClick={() => changePage(pageNumber - 1)}
          >
            <ChevronLeft size={18} />
            {tt('libraryPreviousPage')}
          </Button>
          <Button
            className="flex-1"
            disabled={pageNumber >= pageCount || isRendering}
            onClick={() => changePage(pageNumber + 1)}
          >
            {tt('libraryNextPage')}
            <ChevronRight size={18} />
          </Button>
        </nav>
      )}
    </div>
  )
}

function ReaderHeader({ title, subtitle, onBack, backLabel, action }: {
  title: string
  subtitle: string
  onBack: () => void
  backLabel: string
  action?: React.ReactNode
}) {
  return (
    <header className="safe-top flex shrink-0 items-center gap-2 border-b border-pline bg-pcanvas px-3 pb-2.5 pt-2">
      <button
        type="button"
        onClick={onBack}
        aria-label={backLabel}
        className="grid size-10 shrink-0 place-items-center rounded-xl text-pmuted transition-colors hover:bg-psurface hover:text-pfg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pprimary"
      >
        <ChevronLeft size={20} strokeWidth={1.75} />
      </button>
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-[15px] font-bold text-pfg">{title}</h1>
        <p className="truncate text-[11px] text-pmuted">{subtitle}</p>
      </div>
      {action}
    </header>
  )
}

function ReaderIconButton({ label, disabled, onClick, children }: {
  label: string
  disabled: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="grid size-8 place-items-center rounded-lg text-pmuted transition-colors hover:bg-psurface hover:text-pfg disabled:pointer-events-none disabled:opacity-35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pprimary"
    >
      {children}
    </button>
  )
}
