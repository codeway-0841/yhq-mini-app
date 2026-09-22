import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import {
  RotateCcw,
  RotateCw,
  Plus,
  Minus,
  Maximize2,
  Globe,
  ChevronDown,
  ArrowUp,
  Trash2,
  Copy,
  Check,
  StickyNote,
} from 'lucide-react'
import { useWonderStore } from '../store/useWonderStore'
import { useAppStore } from '../../../shared/store/useAppStore'
import { streamSocraticChat } from '../../../shared/lib/tutor'
import type { WonderCourse, CanvasCard } from '../types'

interface SpatialCanvasViewProps {
  course: WonderCourse
}

export default function SpatialCanvasView({ course }: SpatialCanvasViewProps) {
  const lang: string = useAppStore((s) => s.settings.language) || 'uz'
  const canvasCardsMap = useWonderStore((s) => s.canvasCardsMap)
  const addCanvasCard = useWonderStore((s) => s.addCanvasCard)
  const deleteCanvasCard = useWonderStore((s) => s.deleteCanvasCard)

  const dynamicSuggestions = useMemo(() => {
    const allLessons = course.sections.flatMap((s) => s.lessons)
    if (allLessons.length === 0) {
      if (lang === 'ru') {
        return [
          `Как работает ${course.title}?`,
          `Ключевые механизмы ${course.title}`,
          `Практические модели`,
        ]
      }
      if (lang === 'en') {
        return [
          `How does ${course.title} work?`,
          `Core mechanisms of ${course.title}`,
          `Practical mental models`,
        ]
      }
      return [
        `${course.title} qanday ishlaydi?`,
        `${course.title} ning asosiy mexanizmlari`,
        `Amaliy aqliy modellar`,
      ]
    }

    const t1 = allLessons[0]?.title || course.title
    const t2 = allLessons[1]?.title || allLessons[0]?.title || course.title
    const t3 = allLessons[2]?.title || allLessons[1]?.title || course.title

    if (lang === 'ru') {
      return [
        `Как работает ${t1}?`,
        `Основной механизм: ${t2}`,
        `Сравнение и принципы: ${t3}`,
      ]
    }
    if (lang === 'en') {
      return [
        `How does ${t1} work?`,
        `Core mechanism of ${t2}`,
        `Compare and break down: ${t3}`,
      ]
    }
    return [
      `${t1} qanday ishlaydi?`,
      `${t2} ning asosiy mexanizmi`,
      `${t3} mohiyatini tahlil qilish`,
    ]
  }, [course, lang])

  const inputPlaceholder = useMemo(() => {
    if (lang === 'ru') return 'Что вы хотите понять или визуализировать?'
    if (lang === 'en') return 'What do you want to understand or visualize?'
    return "Nimani chuqur tushunmoqchisiz yoki ko'rmoqchisiz?"
  }, [lang])

  const watermarkText = useMemo(() => {
    if (lang === 'ru') return 'Пространство для параллельного и визуального понимания концепций'
    if (lang === 'en') return 'A visual way to understand things in parallel'
    return "Tushunchalarni parallel va vizual bog'lab o'rganish maydoni"
  }, [lang])

  const initialCards: CanvasCard[] = canvasCardsMap[course.id] || course.canvasCards

  // Undo / Redo history state (1:1 with bundle line 8882000)
  const [history, setHistory] = useState<CanvasCard[][]>([initialCards])
  const [historyIndex, setHistoryIndex] = useState(0)

  const cards = history[historyIndex] || []

  const [prompt, setPrompt] = useState('')
  const [webSearchOn, setWebSearchOn] = useState(true)
  const [chatModel, setChatModel] = useState<'Fast' | 'Deep Reasoning' | 'Synthesis'>('Fast')
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false)
  const [zoomLevel, setZoomLevel] = useState(1.0)
  const [copiedCardId, setCopiedCardId] = useState<string | null>(null)

  const handleCopyCard = (card: CanvasCard) => {
    navigator.clipboard.writeText(`${card.title}\n\n${card.content}`)
    setCopiedCardId(card.id)
    setTimeout(() => setCopiedCardId(null), 1500)
  }

  const canUndo = historyIndex > 0
  const canRedo = historyIndex < history.length - 1

  const pushCardsState = useCallback((newCards: CanvasCard[]) => {
    setHistory((prev) => {
      const next = prev.slice(0, historyIndex + 1)
      next.push(newCards)
      return next
    })
    setHistoryIndex((prev) => prev + 1)
  }, [historyIndex])

  const handleUndo = useCallback(() => {
    if (canUndo) {
      setHistoryIndex((prev) => prev - 1)
    }
  }, [canUndo])

  const handleRedo = useCallback(() => {
    if (canRedo) {
      setHistoryIndex((prev) => prev + 1)
    }
  }, [canRedo])

  const handleAddStickyCard = () => {
    const cardId = `sticky-${Date.now()}`
    const defaultTitle =
      lang === 'ru' ? 'Заметка на доске' : lang === 'en' ? 'Canvas Note' : 'Maydon qaydi'
    const newCard: CanvasCard = {
      id: cardId,
      title: defaultTitle,
      content:
        lang === 'ru'
          ? 'Новая идея или наблюдение...'
          : lang === 'en'
          ? 'New takeaway or thought...'
          : 'Yangi tushuncha yoki xulosa...',
      category: 'core',
      color: '#FEF9C3',
      x: 120 + Math.random() * 100,
      y: 120 + Math.random() * 100,
    }
    addCanvasCard(course.id, newCard)
    pushCardsState([...cards, newCard])
  }

  // Keyboard shortcut listener (Ctrl+Z / ⌘Z, Ctrl+Y / ⇧⌘Z, bundle line 8882000)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = /Mac|iP(hone|od|ad)/.test(navigator.platform || navigator.userAgent)
      const modifier = isMac ? e.metaKey : e.ctrlKey

      if (modifier && !e.altKey) {
        const key = e.key.toLowerCase()
        if (key === 'z' && !e.shiftKey) {
          e.preventDefault()
          handleUndo()
        } else if ((key === 'z' && e.shiftKey) || key === 'y') {
          e.preventDefault()
          handleRedo()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleUndo, handleRedo])

  const abortCardRef = useRef<AbortController | null>(null)

  useEffect(() => {
    return () => {
      abortCardRef.current?.abort()
    }
  }, [])

  const handleAskCanvas = async (customQuery?: string) => {
    const query = (customQuery || prompt).trim()
    if (!query) return
    if (!customQuery) setPrompt('')

    const cardId = `card-${Date.now()}`
    const initialContent = `Synthesizing cognitive insight for "${query}"...`
    const newCard: CanvasCard = {
      id: cardId,
      title: query,
      content: initialContent,
      category: 'insight',
      color: '#FEF3C7',
      x: 140 + Math.random() * 120,
      y: 140 + Math.random() * 120,
    }

    addCanvasCard(course.id, newCard)
    pushCardsState([...cards, newCard])

    // Stream real AI insight onto the card
    abortCardRef.current?.abort()
    const controller = new AbortController()
    abortCardRef.current = controller

    const lang = useAppStore.getState().settings.language || 'uz'
    let accumulated = ''

    try {
      const stream = streamSocraticChat(
        [
          {
            role: 'user',
            content: `Explain the mental model of "${query}" in the context of ${course.title}. Provide a high-density 2-3 sentence cognitive breakdown highlighting core dynamics and practical intuition.`,
          },
        ],
        { topicName: course.title },
        lang === 'ru' ? 'ru' : 'uz',
        controller.signal,
      )

      for await (const chunk of stream) {
        if (controller.signal.aborted) break
        accumulated += chunk
        setHistory((prev) => {
          const next = [...prev]
          const curIndex = next.length - 1
          const curCards = next[curIndex] || []
          const updated = curCards.map((c) =>
            c.id === cardId ? { ...c, content: accumulated } : c,
          )
          next[curIndex] = updated
          return next
        })
      }
    } catch {
      // fallback handled in finally
    } finally {
      if (!accumulated.trim()) {
        const fallbackContent = `Cognitive model for "${query}": Correlates direct causal dynamics with systemic equilibrium states in ${course.title}.`
        setHistory((prev) => {
          const next = [...prev]
          const curIndex = next.length - 1
          const curCards = next[curIndex] || []
          const updated = curCards.map((c) =>
            c.id === cardId ? { ...c, content: fallbackContent } : c,
          )
          next[curIndex] = updated
          return next
        })
      }
    }
  }

  const handleDeleteCard = (cardId: string) => {
    deleteCanvasCard(course.id, cardId)
    pushCardsState(cards.filter((c) => c.id !== cardId))
  }

  return (
    <div className="relative min-h-[calc(100vh-10rem)] flex flex-col justify-between font-sans select-none overflow-hidden rounded-2xl bg-[#FFFDF8] dark:bg-[#150F0D]">
      {/* 1:1 Authentic Dotted Grid (matching live_auth_canvas.png) */}
      <div
        className="absolute inset-0 pointer-events-none opacity-45 dark:opacity-20"
        style={{
          backgroundImage: 'radial-gradient(#D5CEBE 1.3px, transparent 1.3px)',
          backgroundSize: '24px 24px',
        }}
      />

      {/* Top-Right: Undo / Redo & Add Sticky (1:1 with live_auth_canvas.png) */}
      <div className="absolute top-4 right-4 z-20 flex items-center p-1 rounded-xl bg-white/90 dark:bg-stone-800/90 border border-stone-200/90 dark:border-stone-700 shadow-2xs backdrop-blur-xs">
        <button
          type="button"
          onClick={handleAddStickyCard}
          title={lang === 'ru' ? 'Добавить заметку' : lang === 'en' ? 'Add Sticky' : "Yangi qayd qo'shish"}
          aria-label="Add Sticky Card"
          className="p-1.5 rounded-lg text-stone-600 hover:text-stone-900 dark:text-stone-300 dark:hover:text-white hover:bg-stone-100 dark:hover:bg-stone-700 cursor-pointer transition-all flex items-center gap-1 text-xs font-semibold"
        >
          <StickyNote size={14} className="text-amber-500" />
          <span className="hidden sm:inline text-[11px] font-mono">{lang === 'ru' ? 'Заметка' : lang === 'en' ? 'Note' : 'Qayd'}</span>
        </button>

        <div className="w-px h-3.5 bg-stone-200 dark:bg-stone-700 my-auto mx-1" />

        <button
          type="button"
          onClick={handleUndo}
          disabled={!canUndo}
          title="Undo (Ctrl+Z)"
          aria-label="Undo"
          className={`p-1.5 rounded-lg transition-all ${
            canUndo
              ? 'text-stone-600 hover:text-stone-900 dark:text-stone-300 dark:hover:text-white hover:bg-stone-100 dark:hover:bg-stone-700 cursor-pointer'
              : 'text-stone-300 dark:text-stone-600 cursor-not-allowed'
          }`}
        >
          <RotateCcw size={15} />
        </button>

        <div className="w-px h-3.5 bg-stone-200 dark:bg-stone-700 my-auto mx-0.5" />

        <button
          type="button"
          onClick={handleRedo}
          disabled={!canRedo}
          title="Redo (Ctrl+Y)"
          aria-label="Redo"
          className={`p-1.5 rounded-lg transition-all ${
            canRedo
              ? 'text-stone-600 hover:text-stone-900 dark:text-stone-300 dark:hover:text-white hover:bg-stone-100 dark:hover:bg-stone-700 cursor-pointer'
              : 'text-stone-300 dark:text-stone-600 cursor-not-allowed'
          }`}
        >
          <RotateCw size={15} />
        </button>
      </div>

      {/* Center Canvas Watermark or Active Cards */}
      <div
        className="flex-1 p-6 relative z-10 transition-transform duration-200"
        style={{ transform: `scale(${zoomLevel})`, transformOrigin: 'center center' }}
      >
        {cards.length === 0 ? (
          /* 1:1 Center Watermark from live_auth_canvas.png */
          <div className="h-full flex flex-col items-center justify-center my-auto pt-24 text-center">
            <h2 className="text-2xl sm:text-3xl font-serif text-stone-900 dark:text-stone-100">
              Canvas
            </h2>
            <p className="text-xs sm:text-sm text-stone-500 dark:text-stone-400 mt-1 max-w-sm">
              {watermarkText}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 pt-10">
            {cards.map((card) => (
              <div
                key={card.id}
                className="group relative p-4 rounded-2xl border border-stone-200/90 dark:border-stone-700 shadow-xs hover:shadow-md transition-all space-y-2 bg-white dark:bg-stone-900"
                style={{
                  borderLeftColor: card.color || '#38BDF8',
                  borderLeftWidth: '5px',
                }}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="px-2 py-0.5 rounded-md bg-stone-100 dark:bg-stone-800 text-[10px] font-black uppercase tracking-wide text-stone-600 dark:text-stone-300">
                    {card.category}
                  </span>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      type="button"
                      onClick={() => handleCopyCard(card)}
                      className="p-1 text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 transition-colors cursor-pointer"
                      title={copiedCardId === card.id ? 'Copied!' : 'Copy card content'}
                      aria-label="Copy card content"
                    >
                      {copiedCardId === card.id ? (
                        <Check size={13} className="text-emerald-500" />
                      ) : (
                        <Copy size={13} />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteCard(card.id)}
                      className="p-1 text-stone-400 hover:text-rose-600 transition-colors cursor-pointer"
                      title="Delete card"
                      aria-label="Delete card"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                <h3 className="text-sm font-bold text-stone-900 dark:text-stone-100">
                  {card.title}
                </h3>

                <p className="text-xs text-stone-600 dark:text-stone-300 leading-relaxed">
                  {card.content}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Bottom-Right: Zoom Controls Pill (1:1 with live_auth_canvas.png) */}
      <div className="absolute bottom-6 right-4 z-20 flex flex-col items-center p-1 rounded-2xl bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 shadow-sm">
        <button
          type="button"
          onClick={() => setZoomLevel((z) => Math.min(1.4, z + 0.1))}
          title="Zoom in"
          aria-label="Zoom in"
          className="p-1.5 text-stone-500 hover:text-stone-900 dark:hover:text-white cursor-pointer"
        >
          <Plus size={15} />
        </button>
        <button
          type="button"
          onClick={() => setZoomLevel((z) => Math.max(0.7, z - 0.1))}
          title="Zoom out"
          aria-label="Zoom out"
          className="p-1.5 text-stone-500 hover:text-stone-900 dark:hover:text-white border-y border-stone-100 dark:border-stone-700 cursor-pointer"
        >
          <Minus size={15} />
        </button>
        <button
          type="button"
          onClick={() => setZoomLevel(1.0)}
          title="Reset zoom"
          aria-label="Reset zoom"
          className="p-1.5 text-stone-500 hover:text-stone-900 dark:hover:text-white cursor-pointer"
        >
          <Maximize2 size={14} />
        </button>
      </div>

      {/* Bottom-Center: Prompt Bar & Suggested Topics (1:1 with live_auth_canvas.png & bundle line 8883107) */}
      <div className="relative z-20 max-w-xl mx-auto w-full px-4 pb-6">
        {/* Suggested Topics Pills */}
        <div className="flex flex-wrap justify-center gap-1.5 mb-2.5">
          {dynamicSuggestions.map((sug) => (
            <button
              key={sug}
              type="button"
              onClick={() => handleAskCanvas(sug)}
              className="text-[11px] px-3 py-1 rounded-full border border-stone-200 dark:border-stone-700 bg-white/80 dark:bg-stone-800/80 text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-700 hover:text-stone-900 transition-all cursor-pointer backdrop-blur-xs"
            >
              {sug}
            </button>
          ))}
        </div>

        <div className="rounded-2xl border border-stone-200/90 dark:border-stone-800 bg-white dark:bg-[#1C1411] p-3 shadow-md space-y-2">
          <input
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                handleAskCanvas()
              }
            }}
            placeholder={inputPlaceholder}
            className="w-full bg-transparent px-1 py-0.5 text-xs sm:text-sm text-stone-900 dark:text-stone-100 placeholder:text-stone-400 outline-hidden font-medium"
          />

          <div className="flex items-center justify-between pt-1 border-t border-stone-100 dark:border-stone-800">
            {/* Status indicators: Web Search & Model Option */}
            <div className="flex items-center gap-3 text-[11px] text-stone-500 font-medium">
              <button
                type="button"
                onClick={() => setWebSearchOn(!webSearchOn)}
                className="flex items-center gap-1.5 hover:text-stone-900 dark:hover:text-stone-200 cursor-pointer"
              >
                <Globe size={13} className={webSearchOn ? 'text-[#0284C7]' : 'text-stone-400'} />
                <span>Web search {webSearchOn ? 'on' : 'off'}</span>
              </button>

              <div className="relative">
                <button
                  type="button"
                  onClick={() => setModelDropdownOpen(!modelDropdownOpen)}
                  className="flex items-center gap-1 text-stone-600 dark:text-stone-300 hover:text-stone-900 cursor-pointer"
                >
                  <span>{chatModel}</span>
                  <ChevronDown size={11} />
                </button>

                {modelDropdownOpen && (
                  <div className="absolute bottom-full mb-2 left-0 w-36 rounded-xl bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 shadow-lg p-1 z-30 text-xs">
                    {(['Fast', 'Deep Reasoning', 'Synthesis'] as const).map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => {
                          setChatModel(m)
                          setModelDropdownOpen(false)
                        }}
                        className={`w-full text-left px-2.5 py-1.5 rounded-lg ${
                          chatModel === m
                            ? 'bg-[#E0F2FE] text-[#0284C7] font-bold'
                            : 'hover:bg-stone-100 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300'
                        }`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* 1:1 Light Blue Rounded-XL Send Button from live_auth_canvas.png */}
            <button
              type="button"
              disabled={!prompt.trim()}
              onClick={() => handleAskCanvas()}
              aria-label="Send"
              className={`size-9 rounded-xl flex items-center justify-center transition-all ${
                prompt.trim()
                  ? 'bg-[#AEE0F8] hover:bg-[#92D4F7] text-stone-800 shadow-xs active:scale-95 cursor-pointer'
                  : 'bg-[#E2EDF3] dark:bg-stone-800 text-stone-400 cursor-not-allowed'
              }`}
            >
              <ArrowUp size={16} strokeWidth={2.5} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
