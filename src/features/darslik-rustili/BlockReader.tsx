import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowRight, BookOpen, CheckCircle2, ChevronLeft, HelpCircle, List as ListIcon, Lock, Volume2, X } from 'lucide-react'
import { getBlockOutline, loadDarslikBlock, type DarslikBlockMeta } from '../../content/darslik-rustili'
import { useAppStore } from '../../shared/store/useAppStore'
import { useT } from '../../shared/i18n'
import { registerModal } from '../../shared/lib/navigation'
import { cn } from '../../shared/lib/cn'
import { speak, stopSpeaking, isSpeaking, subscribeSpeaking } from '../../shared/lib/speech'
import { PathMascot } from '../lessons'
import { MarkdownView } from './MarkdownView'
import { buildLessonPages, extractOutline, extractSectionBlocks, parseMarkdown, plainText, type MdBlock } from './markdown'
import { nextSection } from './progress'
import TopicCheck from './TopicCheck'
import { darslikTopicId } from '../../../shared/darslik-mastery'
import { RUSSIAN_SUBJECT_ID } from '../../../shared/subjects'

const Tutor = lazy(() => import('../ai-tutor').then((module) => ({ default: module.SocraticChatSheet })))

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

const EMPTY_BLOCKS: readonly MdBlock[] = []

function extractSpeechText(blocks: readonly MdBlock[]): string {
  const parts: string[] = []
  for (const block of blocks) {
    if (block.kind === 'heading') parts.push(plainText(block.text))
    else if (block.kind === 'paragraph' || block.kind === 'quote') parts.push(plainText(block.lines.join(' ')))
    else if (block.kind === 'list') parts.push(block.items.map((item) => plainText(item.text)).join('. '))
    else if (block.kind === 'table') parts.push(block.rows.map((row) => row.map(plainText).join(' — ')).join('. '))
  }
  return parts
    .join('. ')
    .replace(/\[[^\]]*]/g, '')
    .replace(/⚠️|🔹|•/g, '')
    .replace(/\s+/g, ' ')
    .trim()
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
  const [speaking, setSpeaking] = useState(false)
  const [showTutor, setShowTutor] = useState(false)
  const bodyRef = useRef<HTMLDivElement | null>(null)

  // Android hardware back / Telegram BackButton — o'quvchini yopadi.
  useEffect(() => {
    const id = Symbol('rus-darslik-reader')
    return registerModal(id, onClose)
  }, [onClose])

  useEffect(() => subscribeSpeaking(() => setSpeaking(isSpeaking())), [])
  useEffect(() => () => stopSpeaking(), [])

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
    stopSpeaking()
    setPageIndex(0)
    setShowTutor(false)
    scrollToTop()
    setTocOpen(false)
  }, [block.id, sectionIndex, source, scrollToTop])

  useEffect(() => {
    const key = block.id + ':' + sectionIndex
    if (lastSectionKey.current !== key) {
      lastSectionKey.current = key
      setQuizOpen(initialQuizOpen)
    } else if (initialQuizOpen) {
      setQuizOpen(true)
    }
  }, [block.id, sectionIndex, initialQuizOpen])

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
  const currentCardBlocks = lessonPages[safePageIndex] ?? EMPTY_BLOCKS
  const speechText = useMemo(
    () => extractSpeechText(currentCardBlocks) || sectionTitle,
    [currentCardBlocks, sectionTitle],
  )

  const openPractice = () => {
    stopSpeaking()
    if (!read) onMarkRead(sectionIndex)
    setQuizOpen(true)
  }
  const nextPage = () => {
    stopSpeaking()
    if (isLastPage) {
      openPractice()
      return
    }
    setPageIndex((value) => Math.min(value + 1, pageCount - 1))
    scrollToTop()
  }
  const previousPage = () => {
    stopSpeaking()
    setPageIndex((value) => Math.max(0, value - 1))
    scrollToTop()
  }

  const handleSpeakCard = () => {
    if (speaking) {
      stopSpeaking()
      return
    }
    speak(speechText, 'ru')
  }

  return (
    <div className="lesson-reader fixed inset-0 z-50 flex flex-col bg-pcanvas">
      <div className="border-b border-pline bg-pcanvas px-3.5 py-2.5 safe-top">
        <div className="mx-auto flex w-full max-w-[560px] items-center gap-2.5">
          <button
            type="button"
            onClick={onClose}
            aria-label={tt('rusDarslikCloseReader')}
            className="grid size-10 shrink-0 cursor-pointer place-items-center rounded-full bg-psurface text-pfg shadow-2xs transition-transform active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pprimary"
          >
            <ChevronLeft size={21} strokeWidth={2.25} />
          </button>

          <div className="min-w-0 flex-1">
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <p className="truncate text-[11px] font-extrabold uppercase tracking-wider text-pprimary">
                {blockLabel} · {position}
              </p>
              <span className="shrink-0 text-[11px] font-bold tabular-nums text-pmuted">
                {tt('rusDarslikTheoryStep')
                  .replace('{current}', String(safePageIndex + 1))
                  .replace('{total}', String(pageCount))}
              </span>
            </div>

            {/* Segmented Story Progress Bar */}
            <div
              className="flex w-full items-center gap-1.5"
              role="progressbar"
              aria-label={tt('rusDarslikTheoryProgress')}
              aria-valuemin={1}
              aria-valuemax={pageCount}
              aria-valuenow={safePageIndex + 1}
            >
              {Array.from({ length: pageCount }).map((_, idx) => {
                const isCompleted = idx < safePageIndex
                const isActive = idx === safePageIndex
                return (
                  <div
                    key={idx}
                    aria-hidden="true"
                    className="h-2 flex-1 overflow-hidden rounded-full bg-psurface"
                  >
                    <div
                      className={cn(
                        'h-full rounded-full transition-all duration-300',
                        isCompleted
                          ? 'w-full bg-psuccess'
                          : isActive
                            ? 'w-full bg-pprimary'
                            : 'w-0 bg-transparent',
                      )}
                    />
                  </div>
                )
              })}
            </div>
          </div>

          <button
            type="button"
            onClick={toggleToc}
            aria-label={tocOpen ? tt('rusDarslikHideContents') : tt('rusDarslikContents')}
            aria-expanded={tocOpen}
            className={cn(
              'grid size-10 shrink-0 cursor-pointer place-items-center rounded-full transition-colors',
              tocOpen ? 'bg-pprimary text-ponprimary shadow-xs' : 'bg-psurface text-pfg',
            )}
          >
            {tocOpen ? <X size={18} strokeWidth={2.2} /> : <ListIcon size={18} strokeWidth={2.2} />}
          </button>
        </div>
      </div>

      <div ref={bodyRef} className="flex-1 overflow-y-auto overscroll-contain px-4 py-4">
        {tocOpen && (
          <div className="mx-auto mb-4 w-full max-w-[560px] rounded-3xl bg-pcard p-3.5 shadow-xs">
            <p className="mb-2 px-1 text-[11px] font-extrabold uppercase tracking-wider text-psubtle">
              {tt('rusDarslikContents')} · {tt('rusDarslikSectionsCount').replace('{count}', String(total))}
            </p>
            <ol className="flex flex-col gap-0.5">
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
                        'flex w-full items-start gap-2.5 rounded-xl px-2.5 py-2 text-left text-[13px] leading-snug transition-colors',
                        locked ? 'cursor-not-allowed opacity-45' : 'cursor-pointer hover:bg-psurface active:opacity-80',
                        index === sectionIndex ? 'bg-[rgb(var(--p-primary-rgb)/0.12)] font-bold text-pfg' : 'text-pfg',
                      )}
                    >
                      <span className="mt-0.5 w-5 flex-none text-right text-[11px] font-extrabold tabular-nums text-pprimary">{index + 1}.</span>
                      <span className="min-w-0 flex-1">{entry.title}</span>
                      {locked
                        ? <Lock size={13} strokeWidth={2.5} className="mt-0.5 flex-none text-pmuted" />
                        : done
                          ? <CheckCircle2 size={14} strokeWidth={2.5} className="mt-0.5 flex-none text-psuccess" />
                          : pending
                            ? <HelpCircle size={14} strokeWidth={2.5} className="mt-0.5 flex-none text-pwarning" />
                            : null}
                    </button>
                  </li>
                )
              })}
            </ol>
          </div>
        )}

        {failed ? (
          <div className="mx-auto flex w-full max-w-[560px] flex-col items-center gap-3 rounded-3xl bg-pcard px-4 py-10 text-center shadow-xs">
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
          <div className="mx-auto flex w-full max-w-[560px] flex-col gap-2.5 rounded-3xl bg-pcard p-5 shadow-xs" aria-busy="true" aria-live="polite">
            {[92, 100, 74, 88, 96, 60].map((width, i) => (
              <div key={i} className="h-3.5 animate-pulse rounded-full bg-psurface" style={{ width: `${width}%` }} />
            ))}
          </div>
        ) : (
          <article className="mx-auto w-full max-w-[560px] pb-5" aria-labelledby="rus-lesson-topic-title">
            {safePageIndex === 0 && <div className="flex min-h-[180px] items-center justify-center py-8 sm:min-h-[220px]" aria-hidden="true"><div className="grid size-28 -rotate-6 place-items-center rounded-3xl bg-amber-400 text-blue-900 shadow-[8px_8px_0_#d39914]"><BookOpen size={64} strokeWidth={1.7} /></div></div>}
            <div className="mb-5 flex items-start gap-3">
              <h1 id="rus-lesson-topic-title" className="min-w-0 flex-1 font-display text-[28px] font-extrabold leading-tight tracking-tight text-pfg sm:text-[32px]">{sectionTitle}</h1>
              <button type="button" onClick={handleSpeakCard} aria-label={tt('rusDarslikListenExample')} className={cn('grid size-10 shrink-0 cursor-pointer place-items-center rounded-full bg-psurface text-pfg', speaking && 'text-pprimary')}><Volume2 size={20} className={cn(speaking && 'animate-pulse')} /></button>
            </div>

            <section
              key={`${block.id}:${sectionIndex}:${safePageIndex}`}
              data-testid="micro-lesson-card"
              data-lesson-step={safePageIndex + 1}
              className="py-2 text-[17px] leading-relaxed text-pfg"
            >
              <MarkdownView blocks={currentCardBlocks} />
            </section>
          </article>
        )}
      </div>

      <div className="border-t border-pline bg-pcanvas px-3.5 py-3 pb-[calc(0.75rem+var(--safe-bottom,0px))]">
        <div className="mx-auto flex w-full max-w-[560px] items-center gap-2.5">
          <button type="button" className="relative block size-12 shrink-0" aria-label={tt('darslikAskTutor')} onClick={() => setShowTutor(true)}><PathMascot variant="avatar" animation="idle" /></button>
          <button
            type="button"
            disabled={safePageIndex === 0 || failed || source === null}
            onClick={previousPage}
            aria-label={tt('rusDarslikPreviousStep')}
            className="grid size-12 shrink-0 cursor-pointer place-items-center rounded-2xl bg-psurface text-pfg shadow-[0_3px_0_var(--p-line)] transition-all active:translate-y-[2px] active:shadow-none disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
          >
            <ChevronLeft size={21} strokeWidth={2.25} />
          </button>

          <button
            type="button"
            disabled={failed || source === null}
            onClick={nextPage}
            className={cn(
              'flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-full px-4 py-3.5 text-[14.5px] font-extrabold transition-all active:translate-y-[2px] active:shadow-none disabled:cursor-not-allowed disabled:opacity-50',
              !isLastPage
                ? 'bg-pprimary text-ponprimary shadow-[0_4px_0_color-mix(in_srgb,var(--p-primary)_62%,#0f172a)]'
                : passed
                  ? 'bg-psuccess text-white shadow-[0_4px_0_color-mix(in_srgb,var(--p-success)_65%,#0f172a)]'
                  : read
                    ? 'bg-pwarning text-white shadow-[0_4px_0_color-mix(in_srgb,var(--p-warning)_65%,#0f172a)]'
                    : 'bg-pprimary text-ponprimary shadow-[0_4px_0_color-mix(in_srgb,var(--p-primary)_62%,#0f172a)]',
            )}
          >
            {isLastPage
              ? passed
                ? <CheckCircle2 size={18} strokeWidth={2.5} />
                : <HelpCircle size={18} strokeWidth={2.5} />
              : <ArrowRight size={18} strokeWidth={2.5} />}
            {isLastPage
              ? passed
                ? tt('rusDarslikQuizAgain')
                : read
                  ? tt('rusDarslikQuizOpen')
                  : tt('rusDarslikStartPractice')
              : tt('rusDarslikTheoryContinue')}
          </button>
        </div>
      </div>

      {showTutor && !quizOpen && <Suspense fallback={null}><Tutor isOpen onClose={() => setShowTutor(false)} zIndex={80} variant="lesson"
        mascot={<PathMascot variant="avatar" animation="idle" />}
        context={{ subjectId: RUSSIAN_SUBJECT_ID, topicName: sectionTitle, questionText: speechText.slice(0, 3000) }} /></Suspense>}

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
