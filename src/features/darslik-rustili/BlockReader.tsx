import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowRight, CheckCircle2, ChevronLeft, HelpCircle, Lightbulb, List as ListIcon, Lock, Sparkles, Volume2, X } from 'lucide-react'
import { getBlockOutline, loadDarslikBlock, type DarslikBlockMeta } from '../../content/darslik-rustili'
import { useAppStore } from '../../shared/store/useAppStore'
import { useT } from '../../shared/i18n'
import { registerModal } from '../../shared/lib/navigation'
import { cn } from '../../shared/lib/cn'
import { speak, stopSpeaking, isSpeaking, subscribeSpeaking } from '../../shared/lib/speech'
import { playSound } from '../../shared/lib/sounds'
import { haptics } from '../../platform/haptics'
import { Button } from '../../shared/components/ui/button'
import { BrilliantReaderHeader, BrilliantStagePill, type BrilliantLessonStage } from '../../shared/components/BrilliantLessonChrome'
import { PathMascot } from '../lessons'
import { MarkdownView } from './MarkdownView'
import { buildLessonPages, extractDiscoveryChallenge, extractOutline, extractSectionBlocks, parseMarkdown, plainText, type DiscoveryChallenge, type MdBlock } from './markdown'
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

const EMPTY_BLOCKS: readonly MdBlock[] = []
const FALLBACK_STEP = { kind: 'blocks' as const, stage: 'intro' as const, blocks: EMPTY_BLOCKS }

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
  const [tryPicked, setTryPicked] = useState<number | null>(null)
  const [quizOpen, setQuizOpen] = useState(false)
  const [speaking, setSpeaking] = useState(false)
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
  const discovery = useMemo(() => extractDiscoveryChallenge(sectionBlocks), [sectionBlocks])
  const readerSteps = useMemo(() => {
    type ReaderStep =
      | { kind: 'blocks'; stage: BrilliantLessonStage; blocks: readonly MdBlock[] }
      | { kind: 'try'; stage: 'try'; challenge: DiscoveryChallenge }

    const steps: ReaderStep[] = lessonPages.map((pageBlocks, idx) => ({
      kind: 'blocks',
      stage: idx === 0 ? 'intro' : idx === lessonPages.length - 1 && lessonPages.length > 1 ? 'synthesis' : 'concept',
      blocks: pageBlocks,
    }))
    if (discovery && steps.length >= 2) {
      steps.splice(1, 0, { kind: 'try', stage: 'try', challenge: discovery })
    } else if (discovery && steps.length === 1) {
      steps.push({ kind: 'try', stage: 'try', challenge: discovery })
    }
    return steps
  }, [lessonPages, discovery])
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
    setTryPicked(null)
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
  const pageCount = Math.max(1, readerSteps.length)
  const safePageIndex = Math.min(pageIndex, pageCount - 1)
  const isLastPage = safePageIndex >= pageCount - 1
  const currentStep = readerSteps[safePageIndex] ?? FALLBACK_STEP
  const speechText = useMemo(
    () => (currentStep.kind === 'try'
      ? (isRu ? currentStep.challenge.promptRu : currentStep.challenge.promptUz)
      : extractSpeechText(currentStep.blocks)) || sectionTitle,
    [currentStep, isRu, sectionTitle],
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
      <BrilliantReaderHeader
        onClose={onClose}
        closeLabel={tt('rusDarslikCloseReader')}
        current={safePageIndex + 1}
        total={pageCount}
        progressLabel={tt('rusDarslikTheoryProgress')}
        hot={isLastPage || tryPicked !== null}
        trailing={
          <button
            type="button"
            onClick={toggleToc}
            aria-label={tocOpen ? tt('rusDarslikHideContents') : tt('rusDarslikContents')}
            aria-expanded={tocOpen}
            className={cn(
              'grid size-9 shrink-0 cursor-pointer place-items-center rounded-full transition-colors',
              tocOpen ? 'bg-pprimary text-ponprimary' : 'bg-psurface text-pmuted hover:text-pfg',
            )}
          >
            {tocOpen ? <X size={18} strokeWidth={2.2} /> : <ListIcon size={18} strokeWidth={2.2} />}
          </button>
        }
      />

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
          <article className="mx-auto w-full max-w-[560px] pb-6" aria-labelledby="rus-lesson-topic-title">
            {safePageIndex === 0 && (
              <div className="flex flex-col items-center justify-center py-6 sm:py-8" aria-hidden="true">
                <div className="grid size-24 place-items-center rounded-full bg-psurface shadow-xs">
                  <span className="relative block size-16">
                    <PathMascot variant="avatar" animation="wave" />
                  </span>
                </div>
              </div>
            )}

            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
                <BrilliantStagePill stage={currentStep.stage} />
                <span className="truncate text-[11.5px] font-bold text-pmuted">
                  {blockLabel} · {position}
                </span>
              </div>
              <span className="shrink-0 text-[11.5px] font-bold tabular-nums text-pmuted">
                {tt('rusDarslikTheoryStep')
                  .replace('{current}', String(safePageIndex + 1))
                  .replace('{total}', String(pageCount))}
              </span>
            </div>

            <div className="mb-5 flex items-start gap-3">
              <h1 id="rus-lesson-topic-title" className="min-w-0 flex-1 font-display text-[26px] font-extrabold leading-tight tracking-tight text-pfg sm:text-[30px]">{sectionTitle}</h1>
              <button type="button" onClick={handleSpeakCard} aria-label={tt('rusDarslikListenExample')} className={cn('grid size-10 shrink-0 cursor-pointer place-items-center rounded-full bg-psurface text-pfg transition-colors hover:opacity-85', speaking && 'text-pprimary')}><Volume2 size={20} className={cn(speaking && 'animate-pulse')} /></button>
            </div>

            <section
              key={`${block.id}:${sectionIndex}:${safePageIndex}`}
              data-testid="micro-lesson-card"
              data-lesson-step={safePageIndex + 1}
              data-lesson-stage={currentStep.stage}
              className="py-1 text-[17px] leading-relaxed text-pfg"
            >
              {currentStep.kind === 'try' ? (
                <div className="flex flex-col gap-4 rounded-3xl bg-psurface p-4 sm:p-5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-pprimary">
                      <Sparkles size={14} strokeWidth={2.5} />
                      {tt('rusQuickTryHint')}
                    </span>
                  </div>
                  <p className="text-[17px] font-bold leading-snug text-pfg">
                    {isRu ? currentStep.challenge.promptRu : currentStep.challenge.promptUz}
                  </p>
                  <div className="flex flex-col gap-2.5" role="radiogroup" aria-label={tt('lessonStageTry')}>
                    {currentStep.challenge.options.map((opt, optIdx) => {
                      const answered = tryPicked !== null
                      const isPicked = tryPicked === optIdx
                      const isRight = optIdx === currentStep.challenge.correctIdx
                      return (
                        <button
                          key={optIdx}
                          type="button"
                          onClick={() => {
                            if (answered) return
                            setTryPicked(optIdx)
                            const ok = optIdx === currentStep.challenge.correctIdx
                            playSound(ok ? 'success' : 'error')
                            if (ok) haptics.success()
                            else haptics.error()
                          }}
                          className={cn(
                            'flex min-h-[50px] w-full cursor-pointer items-center gap-3 rounded-2xl px-4 py-3 text-left text-[15.5px] font-semibold transition-[transform,background-color,opacity]',
                            !answered
                              ? 'bg-pcard text-pfg shadow-2xs hover:bg-[rgb(var(--p-primary-rgb)/0.08)]'
                              : isRight
                                ? 'bg-[rgb(var(--p-success-rgb)/0.16)] text-pfg'
                                : isPicked
                                  ? 'bg-[rgb(var(--p-warning-rgb)/0.18)] text-pfg'
                                  : 'bg-pcard text-pmuted opacity-55',
                          )}
                        >
                          <span
                            className={cn(
                              'grid size-6 shrink-0 place-items-center rounded-full border-2 text-[11px] font-extrabold transition-colors',
                              !answered
                                ? 'border-plineStrong text-transparent'
                                : isRight
                                  ? 'border-psuccess bg-psuccess text-white'
                                  : isPicked
                                    ? 'border-pwarning bg-pwarning text-white'
                                    : 'border-pline text-transparent',
                            )}
                          >
                            {answered && isRight ? '✓' : answered && isPicked ? '!' : ''}
                          </span>
                          <span className="min-w-0 flex-1">{opt}</span>
                        </button>
                      )
                    })}
                  </div>
                  {tryPicked !== null && (
                    <div
                      className={cn(
                        'flex items-start gap-2.5 rounded-2xl p-3.5 text-[14px] leading-relaxed text-pfg',
                        tryPicked === currentStep.challenge.correctIdx
                          ? 'bg-[rgb(var(--p-success-rgb)/0.14)]'
                          : 'bg-[rgb(var(--p-warning-rgb)/0.14)]',
                      )}
                    >
                      <Lightbulb size={18} className={cn('mt-0.5 shrink-0', tryPicked === currentStep.challenge.correctIdx ? 'text-psuccess' : 'text-pwarning')} />
                      <div className="min-w-0 flex-1">
                        <p className="font-extrabold">
                          {tryPicked === currentStep.challenge.correctIdx ? tt('rusQuickTryRight') : tt('rusQuickTryWrong')}
                        </p>
                        <p className="mt-0.5 text-pmuted">
                          {isRu ? currentStep.challenge.explanationRu : currentStep.challenge.explanationUz}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <MarkdownView blocks={currentStep.blocks} />
              )}
            </section>
          </article>
        )}
      </div>

      <div className="bg-pcanvas px-3.5 py-3 pb-[calc(0.75rem+var(--safe-bottom,0px))]">
        <div className="mx-auto flex w-full max-w-[560px] items-center gap-2.5">
          <button
            type="button"
            disabled={safePageIndex === 0 || failed || source === null}
            onClick={previousPage}
            aria-label={tt('rusDarslikPreviousStep')}
            className="grid size-14 shrink-0 cursor-pointer place-items-center rounded-full bg-psurface text-pfg transition-[transform,opacity] active:translate-y-[1px] disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronLeft size={21} strokeWidth={2.25} />
          </button>

          <Button
            type="button"
            variant={isLastPage ? 'primary' : 'secondary'}
            size="lg"
            block
            className="min-w-0 flex-1"
            disabled={failed || source === null}
            onClick={nextPage}
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
          </Button>
        </div>
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
