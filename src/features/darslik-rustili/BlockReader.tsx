import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowRight, BookOpen, CheckCircle2, ChevronLeft, HelpCircle, List as ListIcon, Lock, X } from 'lucide-react'
import { getBlockOutline, loadDarslikBlock, type DarslikBlockMeta } from '../../content/darslik-rustili'
import { useAppStore } from '../../shared/store/useAppStore'
import { useT } from '../../shared/i18n'
import { registerModal } from '../../shared/lib/navigation'
import { cn } from '../../shared/lib/cn'
import { MarkdownView } from './MarkdownView'
import { buildLessonPages, extractOutline, extractSectionBlocks, parseMarkdown } from './markdown'
import { nextSection } from './progress'
import TopicCheck from './TopicCheck'
import { darslikTopicId } from '../../../shared/darslik-mastery'

interface BlockReaderProps {
  block: DarslikBlockMeta
  /** Ochiq mavzu (section) indeksi — learning path tuguni bilan bir xil */
  sectionIndex: number
  /** Testdan o'tilgan mavzular indekslari */
  doneSections: number[]
  /** O'qilgan, lekin testdan o'tilmagan mavzular */
  readSections: number[]
  /** Ketma-ket ochilish: qulflangan mavzular */
  lockedSections: number[]
  /** Preview'dan "testni boshlash" bilan ochilgan bo'lsa */
  initialQuizOpen?: boolean
  onClose: () => void
  onSelectSection: (idx: number) => void
  /** Mavzu o'qildi — lekin hali testdan o'tilmadi */
  onMarkRead: (idx: number) => void
  /** Mavzu testi muvaffaqiyatli topshirildi */
  onQuizPass: (idx: number) => void
  /** Test natijasidan keyingi mavzuga o'tish (bloklar orasida ham) */
  onNextTopic?: () => void
  /** Server 403 TOPIC_LOCKED qaytardi — progressni qayta yuklash */
  onLockedSection?: () => void
}

/**
 * Blok matnini mavzu (section) darajasida o'qiydigan to'liq ekranli o'quvchi.
 * Mundarija, scroll progressi, oldingi/keyingi mavzu — learning path bilan
 * bir xil progress indeksidan foydalanadi.
 */
export function BlockReader({
  block,
  sectionIndex,
  doneSections,
  readSections,
  lockedSections,
  initialQuizOpen = false,
  onClose,
  onSelectSection,
  onMarkRead,
  onQuizPass,
  onNextTopic,
  onLockedSection,
}: BlockReaderProps) {
  const lang = useAppStore((s) => s.settings.language)
  const tt = useT(lang)
  const isRu = lang === 'ru'

  const [source, setSource] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [tocOpen, setTocOpen] = useState(false)
  const [pageIndex, setPageIndex] = useState(0)
  const [quizOpen, setQuizOpen] = useState(false)
  const bodyRef = useRef<HTMLDivElement | null>(null)

  // Android hardware back / Telegram BackButton — o'quvchini yopadi.
  useEffect(() => {
    const id = Symbol('rus-darslik-reader')
    return registerModal(id, onClose)
  }, [onClose])

  useEffect(() => {
    let cancelled = false
    setSource(null)
    setFailed(false)
    loadDarslikBlock(block.id)
      .then((text) => { if (!cancelled) setSource(text) })
      .catch(() => { if (!cancelled) setFailed(true) })
    return () => { cancelled = true }
  }, [block.id, attempt])

  const blocks = useMemo(() => (source ? parseMarkdown(source) : []), [source])
  const outline = useMemo(() => extractOutline(blocks), [blocks])
  const sectionBlocks = useMemo(() => extractSectionBlocks(blocks, sectionIndex), [blocks, sectionIndex])
  const lessonPages = useMemo(() => buildLessonPages(sectionBlocks), [sectionBlocks])
  const fallbackTitles = useMemo(() => getBlockOutline(block.id), [block.id])
  const total = outline.length || fallbackTitles.length
  const current = outline[sectionIndex]
  const sectionTitle = current?.title ?? fallbackTitles[sectionIndex] ?? (isRu ? block.titleRu : block.titleUz)
  const passed = doneSections.includes(sectionIndex)
  const read = readSections.includes(sectionIndex) || passed
  const next = nextSection(block.id, sectionIndex)
  const hasNext = next != null
  const lastSectionKey = useRef(block.id + ':' + sectionIndex)

  const scrollToTop = useCallback(() => {
    const container = bodyRef.current
    if (container && typeof container.scrollTo === 'function') container.scrollTo({ top: 0, behavior: 'auto' })
  }, [])

  // Mavzu almashganda mikro-dars birinchi kartadan boshlanadi.
  useEffect(() => {
    setPageIndex(0)
    scrollToTop()
    setTocOpen(false)
  }, [block.id, sectionIndex, source, scrollToTop])

  // Preview'dan "testni boshlash" bosilganda testni darhol ochamiz.
  useEffect(() => {
    if (initialQuizOpen) setQuizOpen(true)
  }, [initialQuizOpen])

  useEffect(() => {
    const key = block.id + ':' + sectionIndex
    if (lastSectionKey.current === key) return
    lastSectionKey.current = key
    setQuizOpen(false)
  }, [block.id, sectionIndex])

  const toggleToc = () => {
    setTocOpen((open) => {
      if (!open) scrollToTop()
      return !open
    })
  }

  const blockLabel = isRu ? `Блок ${block.id}` : `${block.id}-blok`
  const position = `${Math.min(sectionIndex + 1, total || 1)}/${total || 1}`
  const pageCount = Math.max(1, lessonPages.length)
  const safePageIndex = Math.min(pageIndex, pageCount - 1)
  const isLastPage = safePageIndex >= pageCount - 1
  const openPractice = () => {
    if (!read) onMarkRead(sectionIndex)
    setQuizOpen(true)
  }
  const nextPage = () => {
    if (isLastPage) {
      openPractice()
      return
    }
    setPageIndex((value) => Math.min(value + 1, pageCount - 1))
    scrollToTop()
  }
  const previousPage = () => {
    setPageIndex((value) => Math.max(0, value - 1))
    scrollToTop()
  }

  return (
    <div className="lesson-reader fixed inset-0 z-50 flex flex-col bg-pcanvas">
      <div className="flex items-center gap-2 border-b border-pline px-3 py-2.5 safe-top">
        <button
          type="button"
          onClick={onClose}
          aria-label={tt('rusDarslikCloseReader')}
          className="grid size-11 shrink-0 cursor-pointer place-items-center rounded-full border border-black/[0.04] bg-white text-gray-700 shadow-[0_2px_8px_rgba(0,0,0,0.06)] transition-all duration-150 ease-out active:scale-95 hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pprimary dark:border-white/10 dark:bg-white/10 dark:text-white dark:shadow-none"
        >
          <ChevronLeft size={22} strokeWidth={2.25} />
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[11px] font-semibold uppercase tracking-wide text-pmuted">
            {blockLabel} · {position}
          </p>
          <h2 className="truncate text-[15px] font-semibold leading-snug text-pfg">{sectionTitle}</h2>
        </div>
        <button
          type="button"
          onClick={toggleToc}
          aria-label={tocOpen ? tt('rusDarslikHideContents') : tt('rusDarslikContents')}
          aria-expanded={tocOpen}
          className={cn(
            'grid size-11 shrink-0 cursor-pointer place-items-center rounded-full transition-colors',
            tocOpen ? 'bg-pprimary text-ponprimary' : 'bg-psurface text-pfg',
          )}
        >
          {tocOpen ? <X size={19} strokeWidth={2} /> : <ListIcon size={19} strokeWidth={2} />}
        </button>
      </div>

      <div
        className="h-1.5 bg-psurface"
        role="progressbar"
        aria-label={tt('rusDarslikTheoryProgress')}
        aria-valuemin={1}
        aria-valuemax={pageCount}
        aria-valuenow={safePageIndex + 1}
      >
        <div
          className="h-full rounded-r-full bg-pprimary transition-[width] duration-300"
          style={{ width: `${Math.round(((safePageIndex + 1) / pageCount) * 100)}%` }}
        />
      </div>

      <div ref={bodyRef} className="flex-1 overflow-y-auto overscroll-contain px-4 py-4">
        {tocOpen && (
          <div className="mb-4 rounded-2xl bg-pcard p-3 shadow-xs">
            <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wide text-psubtle">
              {tt('rusDarslikContents')} · {tt('rusDarslikSectionsCount').replace('{count}', String(total))}
            </p>
            <ol className="flex flex-col">
              {outline.map((entry, index) => {
                const locked = lockedSections.includes(index)
                const done = doneSections.includes(index)
                const pending = readSections.includes(index) && !done
                return (
                  <li key={entry.anchor}>
                    <button
                      type="button"
                      onClick={() => { if (!locked) onSelectSection(index) }}
                      disabled={locked}
                      aria-current={index === sectionIndex ? 'true' : undefined}
                      className={cn(
                        'flex w-full items-start gap-2 rounded-xl px-1.5 py-2 text-left text-[13px] leading-snug',
                        locked ? 'cursor-not-allowed opacity-45' : 'cursor-pointer hover:bg-psurface active:opacity-80',
                        index === sectionIndex ? 'bg-[rgb(var(--p-primary-rgb)/0.10)] font-semibold text-pfg' : 'text-pfg',
                      )}
                    >
                      <span className="mt-0.5 w-5 flex-none text-right text-[11px] font-semibold text-pprimary">{index + 1}.</span>
                      <span className="min-w-0 flex-1">{entry.title}</span>
                      {locked
                        ? <Lock size={13} strokeWidth={2.5} className="mt-0.5 flex-none text-pmuted" />
                        : done
                          ? <CheckCircle2 size={13} strokeWidth={2.5} className="mt-0.5 flex-none text-psuccess" />
                          : pending
                            ? <HelpCircle size={13} strokeWidth={2.5} className="mt-0.5 flex-none text-pwarning" />
                            : null}
                    </button>
                  </li>
                )
              })}
            </ol>
          </div>
        )}

        {failed ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl bg-pcard px-4 py-10 text-center">
            <p className="text-sm text-pmuted">{tt('rusDarslikLoadFailed')}</p>
            <button
              type="button"
              onClick={() => setAttempt((n) => n + 1)}
              className="cursor-pointer rounded-xl bg-pprimary px-4 py-2 text-sm font-semibold text-ponprimary active:scale-95"
            >
              {tt('rusDarslikRetry')}
            </button>
          </div>
        ) : source === null ? (
          <div className="flex flex-col gap-2.5" aria-busy="true" aria-live="polite">
            {[92, 100, 74, 88, 96, 60].map((width, i) => (
              <div key={i} className="h-3.5 animate-pulse rounded-full bg-psurface" style={{ width: `${width}%` }} />
            ))}
          </div>
        ) : (
          <article className="mx-auto w-full max-w-[560px] pb-5" aria-labelledby="rus-lesson-topic-title">
            <div className="mb-3 flex items-center justify-between gap-3">
              <span className="inline-flex items-center gap-1.5 rounded-xl bg-[rgb(var(--p-primary-rgb)/0.10)] px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.08em] text-pprimary shadow-2xs">
                <BookOpen size={13} strokeWidth={2.25} />
                {tt('rusDarslikTheory')}
              </span>
              <span className="text-[11.5px] font-semibold tabular-nums text-pmuted">
                {tt('rusDarslikTheoryStep')
                  .replace('{current}', String(safePageIndex + 1))
                  .replace('{total}', String(pageCount))}
              </span>
            </div>
            <h1 id="rus-lesson-topic-title" className="mb-2 font-display text-[22px] font-bold leading-tight tracking-tight text-pfg">
              {sectionTitle}
            </h1>
            <p className="mb-4 text-[13px] leading-relaxed text-pmuted">{tt('rusDarslikTheoryHint')}</p>
            <section
              key={`${block.id}:${sectionIndex}:${safePageIndex}`}
              data-testid="micro-lesson-card"
              data-lesson-step={safePageIndex + 1}
              className="rounded-3xl bg-pcard px-4 py-5 shadow-xs sm:px-5"
            >
              <MarkdownView blocks={lessonPages[safePageIndex] ?? []} />
            </section>
          </article>
        )}
      </div>

      <div className="flex items-center gap-2 border-t border-pline bg-pcanvas px-3 py-2.5 pb-[calc(0.625rem+var(--safe-bottom,0px))]">
        <button
          type="button"
          disabled={safePageIndex === 0 || failed || source === null}
          onClick={previousPage}
          aria-label={tt('rusDarslikPreviousStep')}
          className="grid size-11 shrink-0 cursor-pointer place-items-center rounded-xl bg-psurface text-pfg transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ChevronLeft size={20} strokeWidth={2.25} />
        </button>

        <button
          type="button"
          disabled={failed || source === null}
          onClick={nextPage}
          className={cn(
            'flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-2xl px-3 py-3 text-sm font-bold shadow-md transition-transform active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50',
            !isLastPage
              ? 'bg-pprimary text-ponprimary'
              : passed
              ? 'bg-[rgb(var(--p-success-rgb)/0.14)] text-psuccess'
              : read
                ? 'bg-[rgb(var(--p-warning-rgb)/0.14)] text-pwarning'
                : 'bg-pprimary text-ponprimary',
          )}
        >
          {isLastPage
            ? passed
              ? <CheckCircle2 size={17} strokeWidth={2.5} />
              : <HelpCircle size={17} strokeWidth={2.5} />
            : <ArrowRight size={17} strokeWidth={2.5} />}
          {isLastPage
            ? passed
              ? tt('rusDarslikQuizAgain')
              : read
                ? tt('rusDarslikQuizOpen')
                : tt('rusDarslikStartPractice')
            : tt('rusDarslikTheoryContinue')}
        </button>
      </div>

      {quizOpen && (
        <TopicCheck
          key={block.id + ':' + sectionIndex}
          topicId={darslikTopicId(block.id, sectionIndex)}
          title={sectionTitle}
          onClose={() => setQuizOpen(false)}
          onPassed={() => onQuizPass(sectionIndex)}
          onNext={onNextTopic}
          hasNext={hasNext}
          onLocked={onLockedSection}
        />
      )}
    </div>
  )
}
