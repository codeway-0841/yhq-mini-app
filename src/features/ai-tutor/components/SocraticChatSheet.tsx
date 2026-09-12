import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Send, Sparkles, Volume2, VolumeX, X, Loader2, Crown, Bot, User,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import MathText from '../../../shared/components/MathText'
import { speak, stopSpeaking } from '../../../shared/lib/speech'
import { useAppStore } from '../../../shared/store/useAppStore'
import { useT } from '../../../shared/i18n'
import { haptics } from '../../../platform/haptics'
import { streamSocraticChat, TutorError } from '../../../shared/lib/tutor'

export interface SocraticContextData {
  questionText?: string
  options?: Record<string, string>
  userSelectedOption?: string
  correctAnswer?: string
  subjectId?: string
  topicName?: string
}

interface SocraticChatSheetProps {
  isOpen: boolean
  onClose: () => void
  context: SocraticContextData
  initialPrompt?: string
}

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
}

export default function SocraticChatSheet({
  isOpen,
  onClose,
  context,
  initialPrompt,
}: SocraticChatSheetProps) {
  const navigate = useNavigate()
  const language = useAppStore((s) => s.settings.language)
  const isPremium = useAppStore((s) => s.tariff === 'premium')
  const tt = useT(language)

  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [inputText, setInputText] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [streamingText, setStreamingText] = useState('')
  const [isSpeakingId, setIsSpeakingId] = useState<string | null>(null)
  const [quotaError, setQuotaError] = useState(false)

  const abortControllerRef = useRef<AbortController | null>(null)
  const messagesEndRef = useRef<HTMLDivElement | null>(null)

  const scrollToBottom = useCallback(() => {
    if (typeof messagesEndRef.current?.scrollIntoView === 'function') {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, streamingText, scrollToBottom])

  // Xabar yuborish va oqimni qabul qilish
  const sendMessage = useCallback(async (userContent: string) => {
    if (!userContent.trim() || isStreaming) return

    haptics.impact('light')
    setQuotaError(false)

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: userContent.trim(),
    }

    const nextMessages = [...messages, userMsg]
    setMessages(nextMessages)
    setInputText('')
    setIsStreaming(true)
    setStreamingText('')

    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    const controller = new AbortController()
    abortControllerRef.current = controller

    try {
      const apiMessages = nextMessages.map((m) => ({
        role: m.role,
        content: m.content,
      }))

      let accumulated = ''
      for await (const chunk of streamSocraticChat(apiMessages, context, language, controller.signal)) {
        if (controller.signal.aborted) return
        accumulated += chunk
        setStreamingText(accumulated)
      }

      if (!controller.signal.aborted && accumulated) {
        setMessages((prev) => [
          ...prev,
          {
            id: `assistant-${Date.now()}`,
            role: 'assistant',
            content: accumulated,
          },
        ])
        setStreamingText('')
      }
    } catch (err) {
      if (controller.signal.aborted) return

      if (err instanceof TutorError && (err.kind === 'daily_limit' || err.kind === 'quota')) {
        setQuotaError(true)
      } else {
        setMessages((prev) => [
          ...prev,
          {
            id: `assistant-err-${Date.now()}`,
            role: 'assistant',
            content: language === 'ru'
              ? 'Произошла ошибка при получении ответа. Пожалуйста, попробуйте еще раз.'
              : "Javob olishda xatolik yuz berdi. Iltimos, qayta urinib ko'ring.",
          },
        ])
      }
    } finally {
      setIsStreaming(false)
    }
  }, [messages, isStreaming, context, language])

  // Boshlang'ich salomlashuv yoki savol konteksti
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      if (initialPrompt) {
        void sendMessage(initialPrompt)
      } else {
        // Kirish xabari
        const welcomeText = language === 'ru'
          ? 'Привет! Я твой персональный AI-репетитор. Давай разберем эту задачу вместе! Что именно вызвало затруднение?'
          : "Assalomu alaykum! Men sizning shaxsiy Kivvi AI repetitoringizman. Keling, bu masalani birgalikda tahlil qilamiz. Qaysi qismiga tushunmadingiz?"
        setMessages([
          {
            id: 'welcome',
            role: 'assistant',
            content: welcomeText,
          },
        ])
      }
    }
  }, [isOpen, messages.length, initialPrompt, language, sendMessage])

  const handleSpeechToggle = (id: string, text: string) => {
    if (isSpeakingId === id) {
      stopSpeaking()
      setIsSpeakingId(null)
    } else {
      stopSpeaking()
      setIsSpeakingId(id)
      speak(text, language)
    }
  }

  const handleChipClick = (text: string) => {
    haptics.selection()
    void sendMessage(text)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200">
      <div
        className="relative flex flex-col w-full max-w-2xl mx-auto h-[88vh] max-h-[780px] bg-pcard rounded-t-sheet shadow-2xl overflow-hidden animate-in slide-in-from-bottom duration-300"
        role="dialog"
        aria-modal="true"
      >
        {/* Drag handle */}
        <div className="w-10 h-1 bg-plineStrong rounded-full mx-auto my-2.5 shrink-0 select-none" />

        {/* Header */}
        <div className="flex items-center justify-between px-5 pb-3 bg-pcard">
          <div className="flex items-center gap-2.5">
            <Bot size={20} strokeWidth={1.75} className="text-pmuted shrink-0" />
            <div>
              <div className="flex items-center gap-1.5">
                <h2 className="text-[15px] font-semibold text-pfg">{tt('socraticChatTitle')}</h2>
                {isPremium && (
                  <span className="rounded-full bg-psurface px-2 py-0.5 text-[10px] font-semibold text-pmuted">
                    PRO
                  </span>
                )}
              </div>
              <p className="text-[12px] text-pmuted">{tt('socraticChatSubtitle')}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              stopSpeaking()
              if (abortControllerRef.current) abortControllerRef.current.abort()
              onClose()
            }}
            className="size-8 rounded-xl grid place-items-center text-pmuted hover:text-pfg hover:bg-psurface transition-colors"
            aria-label="Yopish"
          >
            <X size={18} strokeWidth={1.75} />
          </button>
        </div>

        {/* Question Context Preview (kichik panel) */}
        {context.questionText && (
          <div className="px-5 py-2 bg-psurface/60 flex items-center justify-between text-[12px] text-pmuted gap-2">
            <span className="truncate flex-1">
              {context.questionText}
            </span>
            {context.subjectId && (
              <span className="uppercase text-[10px] tracking-wider px-2 py-0.5 bg-pcard rounded-full font-semibold text-psubtle shrink-0">
                {context.subjectId}
              </span>
            )}
          </div>
        )}

        {/* Message List */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {messages.map((msg) => {
            const isAss = msg.role === 'assistant'
            return (
              <div
                key={msg.id}
                className={`flex gap-2.5 ${isAss ? 'justify-start' : 'justify-end'}`}
              >
                {isAss && (
                  <div className="flex size-7 items-center justify-center rounded-full bg-psurface text-pmuted shrink-0 mt-0.5">
                    <Bot size={15} strokeWidth={1.75} />
                  </div>
                )}
                <div
                  className={`relative max-w-[85%] rounded-2xl px-4 py-3 text-[13.5px] leading-relaxed ${
                    isAss
                      ? 'bg-psurface text-pfg shadow-2xs'
                      : 'bg-pprimary text-white rounded-br-xs shadow-2xs'
                  }`}
                >
                  <MathText text={msg.content} as="div" className="space-y-2" />

                  {isAss && msg.content.length > 20 && (
                    <div className="mt-2 flex items-center justify-end gap-2 text-pmuted">
                      <button
                        type="button"
                        onClick={() => handleSpeechToggle(msg.id, msg.content)}
                        className="inline-flex items-center gap-1 text-[11px] text-pmuted hover:text-pfg transition-colors px-1.5 py-0.5 rounded-md hover:bg-pcard"
                      >
                        {isSpeakingId === msg.id ? (
                          <>
                            <VolumeX size={13} className="text-pdanger" />
                            <span>{tt('socraticStopVoice')}</span>
                          </>
                        ) : (
                          <>
                            <Volume2 size={13} />
                            <span>{tt('socraticListenVoice')}</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
                {!isAss && (
                  <div className="flex size-7 items-center justify-center rounded-full bg-psurface text-pmuted shrink-0 mt-0.5">
                    <User size={15} strokeWidth={1.75} />
                  </div>
                )}
              </div>
            )
          })}

          {/* Streaming Bubble */}
          {isStreaming && (
            <div className="flex gap-2.5 justify-start">
              <div className="flex size-7 items-center justify-center rounded-full bg-psurface text-pmuted shrink-0 mt-0.5">
                <Sparkles size={15} strokeWidth={1.75} />
              </div>
              <div className="max-w-[85%] rounded-2xl px-4 py-3 text-[13.5px] leading-relaxed bg-psurface text-pfg shadow-2xs">
                {streamingText ? (
                  <MathText text={streamingText} as="div" className="space-y-2" />
                ) : (
                  <div className="flex items-center gap-2 text-pmuted">
                    <Loader2 size={14} className="animate-spin" />
                    <span>Ustoz fikrlamoqda…</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Quota Exceeded Card */}
          {quotaError && (
            <div className="rounded-2xl p-4 bg-pwarning/10 text-center space-y-3 my-2 shadow-2xs">
              <div className="text-pwarning font-semibold text-sm">
                {tt('snapSolveQuotaExceeded')}
              </div>
              <button
                type="button"
                onClick={() => {
                  onClose()
                  navigate('/premium')
                }}
                className="btn-premium w-full py-2.5 text-xs font-bold"
              >
                <Crown size={14} /> Premium Obuna
              </button>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Quick Suggestion Chips */}
        {!isStreaming && !quotaError && (
          <div className="px-4 py-2 flex items-center gap-1.5 overflow-x-auto no-scrollbar bg-pcard">
            <button
              type="button"
              onClick={() => handleChipClick(tt('socraticChipWhyFormula'))}
              className="shrink-0 px-3 py-1.5 rounded-full text-[12px] font-medium bg-psurface hover:bg-psurface/80 text-pmuted hover:text-pfg transition-colors shadow-2xs active:scale-95"
            >
              {tt('socraticChipWhyFormula')}
            </button>
            <button
              type="button"
              onClick={() => handleChipClick(tt('socraticChipOtherWays'))}
              className="shrink-0 px-3 py-1.5 rounded-full text-[12px] font-medium bg-psurface hover:bg-psurface/80 text-pmuted hover:text-pfg transition-colors shadow-2xs active:scale-95"
            >
              {tt('socraticChipOtherWays')}
            </button>
            <button
              type="button"
              onClick={() => handleChipClick(tt('socraticChipExplainSimpler'))}
              className="shrink-0 px-3 py-1.5 rounded-full text-[12px] font-medium bg-psurface hover:bg-psurface/80 text-pmuted hover:text-pfg transition-colors shadow-2xs active:scale-95"
            >
              {tt('socraticChipExplainSimpler')}
            </button>
            <button
              type="button"
              onClick={() => handleChipClick(tt('socraticChipFullAnswer'))}
              className="shrink-0 px-3 py-1.5 rounded-full text-[12px] font-medium bg-psurface hover:bg-psurface/80 text-pmuted hover:text-pfg transition-colors shadow-2xs active:scale-95"
            >
              {tt('socraticChipFullAnswer')}
            </button>
          </div>
        )}

        {/* Input Bar */}
        <div className="p-3 bg-pcard">
          <form
            onSubmit={(e) => {
              e.preventDefault()
              void sendMessage(inputText)
            }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={tt('socraticChatAskHint')}
              disabled={isStreaming}
              className="flex-1 bg-psurface rounded-2xl px-4 py-2.5 text-[14px] text-pfg placeholder:text-pmuted/60 focus:outline-none focus:ring-2 focus:ring-pprimary shadow-xs"
            />
            <button
              type="submit"
              disabled={!inputText.trim() || isStreaming}
              className="size-10 rounded-2xl bg-pprimary text-white grid place-items-center disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 active:scale-95 transition-all shadow-xs"
              aria-label="Yuborish"
            >
              <Send size={17} strokeWidth={1.75} />
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
