import { useState, useRef, useEffect, useMemo } from 'react'
import {
  X,
  Globe,
  ArrowUp,
  RotateCcw,
  Pin,
  BookmarkPlus,
} from 'lucide-react'
import { WonderFloatingMascot } from './WonderIcons'
import { useWonderStore } from '../store/useWonderStore'
import { useAppStore } from '../../../shared/store/useAppStore'
import { streamSocraticChat, TutorError } from '../../../shared/lib/tutor'
import { haptics } from '../../../platform/haptics'
import { playSound } from '../../../shared/lib/sounds'
import TutorRichMessage from '../../../shared/components/TutorRichMessage'
import type { WonderCourse, WonderLessonNode } from '../types'

interface WonderChatPanelProps {
  course: WonderCourse
  activeLesson?: WonderLessonNode | null
}

interface ChatMessage {
  id: string
  sender: 'tutor' | 'user'
  text: string
  timestamp: string
  savedToNotes?: boolean
}

export default function WonderChatPanel({ course, activeLesson }: WonderChatPanelProps) {
  const language: string = useAppStore((s) => s.settings.language) || 'uz'
  const isChatOpen = useWonderStore((s) => s.isChatOpen)
  const setChatOpen = useWonderStore((s) => s.setChatOpen)
  const addLessonNote = useWonderStore((s) => s.addLessonNote)
  const addCanvasCard = useWonderStore((s) => s.addCanvasCard)

  const lessonId = activeLesson?.id || course.sections[0]?.lessons[0]?.id || course.id
  const lessonTitle = activeLesson?.title || course.title

  const [inputQuery, setInputQuery] = useState('')
  const [webSearchOn, setWebSearchOn] = useState(true)
  const [isTyping, setIsTyping] = useState(false)

  const initialGreeting = useMemo(() => {
    if (language === 'ru') {
      return `Привет! Я твой универсальный AI-наставник. Ты можешь задать любой вопрос как по текущей теме («${lessonTitle}»), так и по любому другому предмету (физика, математика, языки, химия и др.). Чем могу помочь?`
    }
    if (language === 'en') {
      return `Hello! I'm your universal AI Tutor. You can ask anything about "${lessonTitle}" or any other subject (physics, math, chemistry, languages, etc.). How can I help you today?`
    }
    return `Salom! Men sizning universal AI o'quv ustozingizman. Joriy mavzu («${lessonTitle}») yoki istalgan boshqa fan va mavzu (fizika, matematika, kimyo, tillar, tarix va h.k.) bo'yicha xohlagan savolingizni bering. Nimani o'rganamiz?`
  }, [language, lessonTitle])

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'init',
      sender: 'tutor',
      text: initialGreeting,
      timestamp: 'Just now',
    },
  ])

  const scrollBottomRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    return () => {
      abortRef.current?.abort()
    }
  }, [])

  useEffect(() => {
    scrollBottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isTyping])

  const hasActiveLesson = Boolean(activeLesson)

  const quickPrompts = useMemo(() => {
    if (language === 'ru') {
      if (hasActiveLesson) {
        return [
          { label: '📝 Дай тест', query: `Дай 1 проверочный тест с 4 вариантами (A, B, C, D) по теме ${lessonTitle}` },
          { label: '💡 Объясни просто', query: `Объясни ${lessonTitle} простыми словами` },
          { label: '🔄 Живая аналогия', query: `Приведи наглядную жизненную аналогию для ${lessonTitle}` },
          { label: '🎯 Проверь меня', query: `Задай вопрос для проверки понимания ${lessonTitle}` },
        ]
      }
      return [
        { label: '📝 Дай тест', query: `Составь 1 интересный тест с 4 вариантами ответа (A, B, C, D)` },
        { label: '💡 Что изучить?', query: `Объясни простую, но полезную тему из науки или технологий` },
        { label: '⚛️ Физика / Математика', query: `Объясни интересный закон физики или математическую формулу` },
        { label: '🧠 Лайфхак для мозга', query: `Как быстрее и легче усваивать любую новую информацию?` },
      ]
    }
    if (language === 'en') {
      if (hasActiveLesson) {
        return [
          { label: '📝 Quiz me', query: `Give me 1 multiple-choice test question with options A, B, C, D on ${lessonTitle}` },
          { label: '💡 Explain simply', query: `Explain ${lessonTitle} in simple terms` },
          { label: '🔄 Give an analogy', query: `Give me a vivid real-world analogy for ${lessonTitle}` },
        ]
      }
      return [
        { label: '📝 Quiz me', query: `Give me 1 multiple-choice quiz question with options A, B, C, D` },
        { label: '💡 Explain a concept', query: `Explain an interesting science or tech concept in simple terms` },
        { label: '⚛️ Physics / Math', query: `Explain an intriguing physics law or math formula` },
        { label: '🧠 Brain hack', query: `Give me a practical technique to learn anything faster` },
      ]
    }
    if (hasActiveLesson) {
      return [
        { label: '📝 Test ber', query: `${lessonTitle} mavzusi bo'yicha 4 ta variantli (A, B, C, D) 1 ta qiziqarli test savoli ber` },
        { label: '💡 Oddiy tushuntir', query: `${lessonTitle} mavzusini oddiy tushunarli so'zlar bilan tushuntirib ber` },
        { label: '🔄 Hayotiy analogiya', query: `${lessonTitle} uchun esda qolarli hayotiy o'xshatish keltir` },
        { label: '🎯 Bilimimni tekshir', query: `${lessonTitle} ning tub mohiyati bo'yicha savol berib bilimimni tekshir` },
      ]
    }
    return [
      { label: '📝 Test ber', query: `Menga variantli (A, B, C, D) 1 ta qiziqarli test savoli ber` },
      { label: '💡 Foydali tushuncha', query: `Menga qiziqarli va foydali ilmiy mavzuni oddiy so'zlar bilan tushuntirib ber` },
      { label: '⚛️ Fizika / Matematika', query: `Fizika yoki matematikadan qiziqarli qoida va formula tushuntirib ber` },
      { label: '🧠 O\'rganish siri', query: `Har qanday yangi narsani tez va oson o'rganish bo'yicha amaliy usul aytib ber` },
    ]
  }, [hasActiveLesson, lessonTitle, language])

  const chatPlaceholder = useMemo(() => {
    if (language === 'ru') return 'Задайте вопрос по любому предмету или теме...'
    if (language === 'en') return 'Ask anything on any subject or topic...'
    return "Istalgan fan yoki mavzu bo'yicha savol bering..."
  }, [language])

  if (!isChatOpen) return null

  const handleSendMessage = async (customText?: string) => {
    const query = (customText || inputQuery).trim()
    if (!query || isTyping) return

    setInputQuery('')
    haptics.impact('light')
    playSound('click')

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: query,
      timestamp: 'Just now',
    }

    const tutorMsgId = `tutor-${Date.now()}`
    const initialTutorMsg: ChatMessage = {
      id: tutorMsgId,
      sender: 'tutor',
      text: '',
      timestamp: 'Just now',
    }

    setMessages((prev) => [...prev, userMsg, initialTutorMsg])
    setIsTyping(true)

    // Setup streaming controller
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    const language = useAppStore.getState().settings.language || 'uz'

    // History for Socratic chat
    const socraticMessages = messages
      .slice(-6)
      .concat(userMsg)
      .map((m) => ({
        role: (m.sender === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
        content: m.text,
      }))

    let accumulated = ''

    try {
      const stream = streamSocraticChat(
        socraticMessages,
        {
          topicName: activeLesson ? `${course.title} · ${lessonTitle}` : undefined,
          questionText: activeLesson ? activeLesson.tldr : undefined,
          subjectId: course.subjectId || undefined,
        },
        language === 'ru' ? 'ru' : 'uz',
        controller.signal,
      )

      for await (const chunk of stream) {
        if (controller.signal.aborted) break
        accumulated += chunk
        setMessages((prev) =>
          prev.map((m) => (m.id === tutorMsgId ? { ...m, text: accumulated } : m)),
        )
      }
    } catch (err: unknown) {
      if (controller.signal.aborted) return
      let errReply = ''
      if (err instanceof TutorError) {
        if (err.kind === 'daily_limit') {
          errReply = language === 'ru'
            ? 'Вы использовали дневной лимит бесплатных запросов к AI-тьютору. Перейдите на Premium для безлимитного общения!'
            : 'AI Tutor kunlik bepul so\'rovlar limitingiz tugadi. Cheksiz suhbat uchun Premium obunaga o\'ting!'
        } else if (err.kind === 'quota') {
          errReply = language === 'ru'
            ? 'AI-сервер временно перегружен. Пожалуйста, подождите минутку и повторите вопрос.'
            : 'AI serveri hozirda juda band. Iltimos, bir daqiqadan so\'ng qayta urinib ko\'ring.'
        } else if (err.kind === 'premium_required') {
          errReply = language === 'ru'
            ? 'Для общения с AI-тьютором требуется Premium.'
            : 'AI Tutor bilan muloqot uchun Premium talab qilinadi.'
        }
      }
      if (!errReply) {
        errReply = language === 'ru'
          ? 'Произошла ошибка связи с сервером. Пожалуйста, попробуйте еще раз!'
          : 'Server bilan aloqada xatolik yuz berdi. Iltimos, qayta urinib ko\'ring!'
      }
      setMessages((prev) =>
        prev.map((m) => (m.id === tutorMsgId ? { ...m, text: errReply } : m)),
      )
    } finally {
      setIsTyping(false)
      haptics.selection()
    }
  }

  const handleSaveToNotes = (msg: ChatMessage) => {
    addLessonNote(lessonId, msg.text)
    setMessages((prev) =>
      prev.map((m) => (m.id === msg.id ? { ...m, savedToNotes: true } : m)),
    )
    haptics.notify('success')
    playSound('click')
  }

  const handlePinToCanvas = (msg: ChatMessage) => {
    addCanvasCard(course.id, {
      title: `Tutor Insight: ${lessonTitle}`,
      content: msg.text.slice(0, 180) + (msg.text.length > 180 ? '...' : ''),
      category: 'insight',
      color: '#BAE6FD',
      x: 120 + Math.random() * 140,
      y: 120 + Math.random() * 140,
    })
    haptics.notify('success')
    playSound('click')
  }

  return (
    <div className="fixed inset-y-0 right-0 top-[var(--safe-top,0px)] z-50 w-full sm:w-[420px] bg-[#FFFDF8] dark:bg-[#1E1512] border-l border-stone-200/90 dark:border-stone-800 shadow-2xl flex flex-col font-sans select-none animate-in slide-in-from-right-4 duration-200">
      {/* Header (1:1 with authentic Wondering ChatPanel) */}
      <div className="flex items-center justify-between p-4 border-b border-stone-200/80 dark:border-stone-800 shrink-0 bg-[#FBF9F4] dark:bg-[#18110F]">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="size-9 rounded-2xl bg-[#E0F2FE] dark:bg-sky-950/60 border border-sky-200/70 dark:border-sky-800 flex items-center justify-center text-[#0284C7] shrink-0">
            <WonderFloatingMascot size={20} />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-stone-900 dark:text-stone-100 font-serif leading-tight">
              Wondering AI Tutor
            </h2>
            <div className="text-[11px] text-stone-500 dark:text-stone-400 truncate flex items-center gap-1.5 mt-0.5">
              <span className="size-1.5 rounded-full bg-emerald-500 shrink-0" />
              <span className="truncate">{lessonTitle}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => {
              setMessages([
                {
                  id: 'init',
                  sender: 'tutor',
                  text: `Chat reset. What would you like to explore regarding "${lessonTitle}"?`,
                  timestamp: 'Just now',
                },
              ])
            }}
            title="Reset conversation"
            aria-label="Reset conversation"
            className="p-2 rounded-xl text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors cursor-pointer"
          >
            <RotateCcw size={15} />
          </button>
          <button
            type="button"
            onClick={() => setChatOpen(false)}
            title="Close AI Tutor"
            aria-label="Close AI Tutor"
            className="p-2 rounded-xl text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Chat Messages Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs leading-relaxed">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col ${
              msg.sender === 'user' ? 'items-end' : 'items-start'
            }`}
          >
            <div
              className={`max-w-[85%] rounded-2xl p-3.5 space-y-2 select-text ${
                msg.sender === 'user'
                  ? 'bg-[#59B2E6] text-[#261312] font-medium shadow-xs rounded-br-xs'
                  : 'bg-[#FAF8F2] dark:bg-stone-800/80 border border-stone-200/80 dark:border-stone-700 text-stone-800 dark:text-stone-200 rounded-bl-xs shadow-2xs'
              }`}
            >
              <TutorRichMessage
                content={msg.text}
                isUser={msg.sender === 'user'}
                onSelectOption={(opt) => handleSendMessage(opt)}
              />

              {msg.sender === 'tutor' && msg.id !== 'init' && (
                <div className="flex items-center gap-3 pt-2 border-t border-stone-200/50 dark:border-stone-700/60 text-[10px] text-stone-500 dark:text-stone-400">
                  <button
                    type="button"
                    onClick={() => handleSaveToNotes(msg)}
                    className="flex items-center gap-1 hover:text-stone-900 dark:hover:text-stone-100 transition-colors cursor-pointer"
                  >
                    <BookmarkPlus size={12} />
                    <span>{msg.savedToNotes ? 'Saved to notes' : 'Save to notes'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePinToCanvas(msg)}
                    className="flex items-center gap-1 hover:text-stone-900 dark:hover:text-stone-100 transition-colors cursor-pointer"
                  >
                    <Pin size={12} />
                    <span>Pin to Canvas</span>
                  </button>
                </div>
              )}
            </div>
            <span className="text-[10px] text-stone-400 px-1 mt-1">
              {msg.timestamp}
            </span>
          </div>
        ))}

        {isTyping && (
          <div className="flex items-center gap-2 text-stone-400 py-1 pl-2">
            <div className="flex gap-1">
              <span className="size-1.5 rounded-full bg-stone-400 animate-bounce" />
              <span className="size-1.5 rounded-full bg-stone-400 animate-bounce [animation-delay:0.2s]" />
              <span className="size-1.5 rounded-full bg-stone-400 animate-bounce [animation-delay:0.4s]" />
            </div>
            <span className="text-[11px] font-medium">Tutor is thinking...</span>
          </div>
        )}

        <div ref={scrollBottomRef} />
      </div>

      {/* Suggestion Chips */}
      <div className="px-3 pt-2 pb-1 overflow-x-auto no-scrollbar flex items-center gap-1.5 shrink-0 bg-[#FFFDF8] dark:bg-[#1E1512]">
        {quickPrompts.map((chip, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => handleSendMessage(chip.query)}
            className="shrink-0 px-2.5 py-1.5 rounded-xl border border-stone-200/90 dark:border-stone-700 bg-[#FAF8F2] dark:bg-stone-800 text-stone-700 dark:text-stone-300 text-[11px] font-medium hover:border-stone-400 hover:bg-white dark:hover:bg-stone-700 transition-all cursor-pointer whitespace-nowrap"
          >
            {chip.label}
          </button>
        ))}
      </div>

      {/* Input Box Footer (1:1 with live_auth_canvas.png prompt bar style) */}
      <div className="p-3 border-t border-stone-200/80 dark:border-stone-800 bg-[#FFFDF8] dark:bg-[#1E1512] pb-[calc(1rem+var(--safe-bottom,0px))] shrink-0">
        <div className="rounded-2xl border border-stone-200/90 dark:border-stone-700 bg-white dark:bg-stone-900 p-2.5 shadow-xs space-y-2">
          <textarea
            rows={2}
            value={inputQuery}
            onChange={(e) => setInputQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSendMessage()
              }
            }}
            placeholder={chatPlaceholder}
            className="w-full bg-transparent px-1 text-xs text-stone-900 dark:text-stone-100 placeholder:text-stone-400 outline-hidden font-medium resize-none"
          />

          <div className="flex items-center justify-between pt-1 border-t border-stone-100 dark:border-stone-800">
            <button
              type="button"
              onClick={() => setWebSearchOn(!webSearchOn)}
              className="flex items-center gap-1.5 text-[11px] text-stone-500 hover:text-stone-900 dark:hover:text-stone-200 transition-colors cursor-pointer"
            >
              <Globe
                size={13}
                className={webSearchOn ? 'text-[#0284C7]' : 'text-stone-400'}
              />
              <span>Web search {webSearchOn ? 'on' : 'off'}</span>
            </button>

            <button
              type="button"
              disabled={!inputQuery.trim() || isTyping}
              onClick={() => handleSendMessage()}
              className={`size-8 rounded-full flex items-center justify-center transition-all ${
                inputQuery.trim() && !isTyping
                  ? 'bg-[#59B2E6] hover:bg-[#4EA5D9] text-[#261312] shadow-xs active:scale-95 cursor-pointer'
                  : 'bg-stone-200 dark:bg-stone-800 text-stone-400 cursor-not-allowed'
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
