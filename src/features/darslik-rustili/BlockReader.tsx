import { useCallback, useEffect, useMemo, useRef, useState, type UIEvent } from 'react'
import { Check, ChevronLeft, ChevronRight, List as ListIcon, X } from 'lucide-react'
import { loadDarslikBlock, type DarslikBlockMeta } from '../../content/darslik-rustili'
import { useAppStore } from '../../shared/store/useAppStore'
import { useT } from '../../shared/i18n'
import { registerModal } from '../../shared/lib/navigation'
import { cn } from '../../shared/lib/cn'
import { MarkdownView } from './MarkdownView'
import { extractOutline, parseMarkdown } from './markdown'

interface BlockReaderProps {
  block: DarslikBlockMeta
  /** Ochiq mavzu (section) indeksi — learning path tuguni bilan bir xil */
  sectionIndex: number
  /** O'qilgan mavzular indekslari */
  doneSections: number[]
  onClose: () => void
  onSelectSection: (idx: number) => void
  /** "O'qib bo'ldim" — mavzuni belgilash va keyingisiga o'tish */
  onDone: (idx: number) => void
}

/**
 * Blok matnini mavzu (section) darajasida o'qiydigan to'liq ekranli o'quvchi.
 * Mundarija, scroll progressi, oldingi/keyingi mavzu — learning path bilan
 * bir xil progress indeksidan foydalanadi.
 */
export function BlockReader({ block, sectionIndex, doneSections, onClose, onSelectSection, onDone }: BlockReaderProps) {
  const lang = useAppStore((s) => s.settings.language)
  const tt = useT(lang)
  const isRu = lang === 'ru'

  const [source, setSource] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [tocOpen, setTocOpen] = useState(false)
  const [scrollPct, setScrollPct] = useState(0)
  const bodyRef = useRef<HTMLDivElement | null>(null)

  // Android hardware back / Telegram BackButton — o'quvchini yopadi.
  useEffect(() => {
    const id = Symbol('rus-darslik-reader')
    return registerModal(id, onClose)
  }, [onClose])

  useEffect(() => {
    let cancelled = false
    setFailed(false)
    loadDarslikBlock(block.id)
      .then((text) => { if (!cancelled) setSource(text) })
      .catch(() => { if (!cancelled) setFailed(true) })
    return () => { cancelled = true }
  }, [block.id, attempt])

  const blocks = useMemo(() => (source ? parseMarkdown(source) : []), [source])
  const outline = useMemo(() => extractOutline(blocks), [blocks])
  const total = outline.length
  const current = outline[sectionIndex]

  const scrollTo = useCallback((anchor?: string) => {
    const container = bodyRef.current
    if (!container || !anchor) return
    const target = container.querySelector<HTMLElement>(`#${anchor}`)
    if (!target) return
    if (typeof container.scrollTo === 'function') {
      // `offsetTop` offsetParent'ga nisbatan — scroll konteyneriga nisbatan hisoblanadi,
      // aks holda sarlavha yopishqoq header ostida qolib ketadi.
      const top = target.getBoundingClientRect().top - container.getBoundingClientRect().top + container.scrollTop - 10
      container.scrollTo({ top: Math.max(0, top), behavior: 'auto' })
    }
  }, [])

  // Mavzu almashganda (yoki matn yuklanganda) shu sarlavhaga suriladi.
  useEffect(() => {
    scrollTo(current?.anchor)
    setTocOpen(false)
  }, [current?.anchor, scrollTo])

  const handleScroll = (event: UIEvent<HTMLDivElement>) => {
    const el = event.currentTarget
    const max = el.scrollHeight - el.clientHeight
    setScrollPct(max > 0 ? Math.min(1, el.scrollTop / max) : 0)
  }

  const toggleToc = () => {
    setTocOpen((open) => {
      if (!open) {
        // Mundarija scroll boshida chiziladi — ochilganda yuqoriga qaytamiz.
        const container = bodyRef.current
        if (container && typeof container.scrollTo === 'function') container.scrollTo({ top: 0, behavior: 'auto' })
      }
      return !open
    })
  }

  const title = isRu ? block.titleRu : block.titleUz
  const blockLabel = isRu ? `Блок ${block.id}` : `${block.id}-blok`
  const position = `${Math.min(sectionIndex + 1, total || 1)}/${total || 1}`
  const read = doneSections.includes(sectionIndex)
  const hasPrev = sectionIndex > 0
  const hasNext = sectionIndex < total - 1

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
          <h2 className="truncate text-[15px] font-semibold leading-snug text-pfg">{title}</h2>
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

      <div className="h-0.5 bg-psurface">
        <div className="h-full transition-[width] duration-150" style={{ width: `${Math.round(scrollPct * 100)}%`, background: 'var(--p-primary)' }} />
      </div>

      <div ref={bodyRef} onScroll={handleScroll} className="flex-1 overflow-y-auto px-4 py-4">
        {tocOpen && (
          <div className="mb-4 rounded-2xl bg-pcard p-3 shadow-xs">
            <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wide text-psubtle">
              {tt('rusDarslikContents')} · {tt('rusDarslikSectionsCount').replace('{count}', String(total))}
            </p>
            <ol className="flex flex-col">
              {outline.map((entry, index) => (
                <li key={entry.anchor}>
                  <button
                    type="button"
                    onClick={() => onSelectSection(index)}
                    aria-current={index === sectionIndex ? 'true' : undefined}
                    className={cn(
                      'flex w-full cursor-pointer items-start gap-2 rounded-xl px-1.5 py-2 text-left text-[13px] leading-snug hover:bg-psurface active:opacity-80',
                      index === sectionIndex ? 'bg-[rgb(var(--p-primary-rgb)/0.10)] font-semibold text-pfg' : 'text-pfg',
                    )}
                  >
                    <span className="mt-0.5 w-5 flex-none text-right text-[11px] font-semibold text-pprimary">{index + 1}.</span>
                    <span className="min-w-0 flex-1">{entry.title}</span>
                    {doneSections.includes(index) && <Check size={13} strokeWidth={3} className="mt-0.5 flex-none text-pprimary" />}
                  </button>
                </li>
              ))}
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
          <MarkdownView source={source} className="pb-6" />
        )}
      </div>

      <div className="flex items-center gap-2 border-t border-pline px-3 py-2.5 pb-[calc(0.625rem+var(--safe-bottom,0px))]">
        <button
          type="button"
          disabled={!hasPrev}
          onClick={() => onSelectSection(sectionIndex - 1)}
          aria-label={tt('rusDarslikPrevSection')}
          className="grid size-11 shrink-0 cursor-pointer place-items-center rounded-xl bg-psurface text-pfg transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ChevronLeft size={20} strokeWidth={2.25} />
        </button>

        <button
          type="button"
          onClick={() => onDone(sectionIndex)}
          className={cn(
            'flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl px-3 py-3 text-sm font-semibold transition-transform active:scale-[0.98]',
            read ? 'bg-[rgb(var(--p-primary-rgb)/0.12)] text-pprimary' : 'bg-pprimary text-ponprimary',
          )}
        >
          <Check size={16} strokeWidth={2.5} />
          {read ? tt('rusDarslikReadBadge') : tt('rusDarslikMarkRead')}
        </button>

        <button
          type="button"
          disabled={!hasNext}
          onClick={() => onSelectSection(sectionIndex + 1)}
          aria-label={tt('rusDarslikNextSection')}
          className="grid size-11 shrink-0 cursor-pointer place-items-center rounded-xl bg-psurface text-pfg transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ChevronRight size={20} strokeWidth={2.25} />
        </button>
      </div>
    </div>
  )
}
