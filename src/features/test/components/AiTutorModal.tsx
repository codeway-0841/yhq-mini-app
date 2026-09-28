import { useState, useEffect, useRef, useCallback } from 'react'
import { Loader2, Volume2 } from 'lucide-react'
import { PremiumIcon } from '../../../shared/components/PremiumIcon'
import { explainQuestion, explainSessionQuestion, fetchStaticExplanation, TutorError } from '../../../shared/lib/tutor'
import { api } from '../../../shared/api'
import { openTelegramLink } from '../../../platform/telegram'
import { config } from '../../../shared/config'
import { speak } from '../../../shared/lib/speech'
import { playSound } from '../../../shared/lib/sounds'
import { useAppStore } from '../../../shared/store/useAppStore'
import { useT } from '../../../shared/i18n'
import DialogOverlay from '../../../shared/components/DialogOverlay'
import ModalMathGrid from '../../../shared/components/ModalMathGrid'
import ModalCloseButton from '../../../shared/components/ModalCloseButton'

export interface AiTutorSessionRef {
  sessionId: string
  position: number
  deliveryToken: string
  expiresAt: string
}

interface AiTutorModalProps {
  /** Legacy master ID (V2'da YO'Q — sessionRef ishlatiladi) */
  questionId?: number
  /**
   * V2 sessiya-pozitsiya (master ID client'ga chiqmaydi — server resolve qiladi).
   * questionId O'RNIGA beriladi (ikkisi bir vaqtda bo'lmaydi).
   */
  sessionRef?: AiTutorSessionRef
  selectedOptionId: string | null
  isCorrect: boolean
  onClose: () => void
  language: 'uz' | 'ru'
}

// Session-level AI explanation cache (re-opening modal for same question is free)
// ID 17: cacheKey til (language) ni o'z ichiga oladi, shunda til almashganda boshqa tildagi izoh keshi aralashib ketmaydi
const aiExplanationCache = new Map<string, string>()

export default function AiTutorModal({
  questionId,
  sessionRef,
  selectedOptionId,
  isCorrect,
  onClose,
  language,
}: AiTutorModalProps) {
  const tariff = useAppStore((s) => s.tariff)
  const userId = useAppStore((s) => s.user?.id)
  const isPremium = tariff === 'premium'
  const tt = useT(language)

  const [showAi, setShowAi] = useState(false)
  const [showStatic, setShowStatic] = useState(false)
  const [showUpsell, setShowUpsell] = useState(false)
  const [aiText, setAiText] = useState('')
  const [staticText, setStaticText] = useState<string | null>(null)
  const [aiBusy, setAiBusy] = useState(false)
  const abortControllerRef = useRef<AbortController | null>(null)

  /** AI tushuntirish — cache bilan (re-open bepul) */
  const startAiExplain = useCallback(async () => {
    if (!userId || !selectedOptionId) return

    // Cancel any ongoing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }

    const abortController = new AbortController()
    abortControllerRef.current = abortController

    // Cache key: questionId (legacy) yoki session:position (V2) + correctness + language (ID 17)
    const cacheKey = `${sessionRef ? `${sessionRef.sessionId}:${sessionRef.position}` : `q:${questionId}`}:${isCorrect ? '1' : '0'}:${language}`
    const cached = aiExplanationCache.get(cacheKey)
    if (cached) {
      setAiText(cached)
      return
    }

    setAiBusy(true)
    setAiText('')

    try {
      const stream = sessionRef
        ? explainSessionQuestion(sessionRef, language, isCorrect, abortController.signal)
        : questionId != null
          ? explainQuestion(questionId, language, isCorrect, abortController.signal)
          : null
      if (!stream) return
      let acc = ''
      for await (const chunk of stream) {
        if (abortController.signal.aborted) return
        acc += chunk
        setAiText(acc)
      }
      if (!abortController.signal.aborted) {
        aiExplanationCache.set(cacheKey, acc)
      }
    } catch (err) {
      if (abortController.signal.aborted) return

      if (err instanceof TutorError && err.kind === 'premium_required') {
        setShowAi(false)
        setShowUpsell(true)
        return
      }
      setAiText(
        err instanceof TutorError && err.kind === 'quota'
          ? tt('aiQuotaMsg')
          : err instanceof TutorError && err.kind === 'daily_limit'
            ? tt('aiDailyLimit')
            : tt('aiUnavailable')
      )
    } finally {
      if (!abortController.signal.aborted) {
        setAiBusy(false)
      }
    }
  }, [questionId, sessionRef, userId, selectedOptionId, isCorrect, language, tt])

  /** AI modal ochish — Premium yo'q bo'lsa statik yoki upsell */
  const openAi = useCallback(async () => {
    if (!isPremium) {
      try {
        const text = sessionRef
          ? (await api.getSessionExplanation(sessionRef.sessionId, { ...sessionRef, language })).text
          : questionId != null
            ? await fetchStaticExplanation(questionId, language)
            : null
        if (text) {
          setStaticText(text)
          setShowStatic(true)
          return
        }
      } catch (err) {
        console.error('Failed to fetch static explanation:', err)
        // tarmoq xatosi — upsell'ga tushamiz
      }
      setShowUpsell(true)
      return
    }
    setShowAi(true)
    void startAiExplain()
  }, [isPremium, questionId, sessionRef, language, startAiExplain])

  /** Ovozli o'qish (TTS) */
  const speakExplanation = useCallback(
    (text: string) => {
      speak(text, language)
      playSound('click')
    },
    [language]
  )

  // Ochilishda AI tushuntirishni avtomatik boshlash va cleanup
  useEffect(() => {
    void openAi()

    return () => {
      // Cleanup: abort ongoing AI requests
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
        abortControllerRef.current = null
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleClose = useCallback(() => {
    setShowAi(false)
    setShowStatic(false)
    setShowUpsell(false)
    onClose()
  }, [onClose])

  // Upsell modal
  if (showUpsell) {
    return (
      <DialogOverlay onClose={handleClose} labelId="upsell-title" swipeToDismiss>
        <div
          className="relative w-full bg-psurface rounded-t-sheet px-5 pt-3 pb-[calc(1.75rem+var(--safe-bottom,0px))] shadow-2xl overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          <ModalMathGrid glow={false} height={360} />
          <ModalCloseButton onClick={handleClose} label={tt('close')} />
          <div data-drag-handle className="w-10 h-1 bg-plineStrong rounded-full mx-auto mb-3 cursor-grab active:cursor-grabbing touch-none select-none relative z-10" />

          {/* Minimalist Centered Header */}
          <div className="text-center mb-3 pt-0.5 px-12 relative z-10 select-none">
            <h3 id="upsell-title" className="text-[17px] font-bold text-pfg tracking-tight">{tt('premiumNeedTitle')}</h3>
          </div>

          <div className="flex flex-col items-center text-center relative z-10">
            <div className="size-14 rounded-2xl bg-pcard shadow-2xs flex items-center justify-center mb-3">
              <PremiumIcon size={28} className="text-pwarning" />
            </div>
            <p className="text-[13px] text-pmuted mb-5 leading-snug max-w-xs">
              {tt('premiumNeedDesc')}
            </p>
            <button
              onClick={() => {
                handleClose()
                openTelegramLink(`https://t.me/${config.botUsername}?start=premium`)
              }}
              className="bg-pprimary text-ponprimary font-bold hover:brightness-[1.06] active:scale-[0.98] transition-all w-full min-h-11 py-3 rounded-2xl text-[13.5px] flex items-center justify-center gap-2 mb-2.5 shadow-xs"
            >
              <PremiumIcon size={16} />
              {tt('buyPremium')}
            </button>
            <button
              onClick={handleClose}
              className="w-full min-h-11 py-3 rounded-2xl bg-pcard text-[13px] font-semibold text-pmuted hover:text-pfg active:scale-[0.98] transition-all shadow-2xs"
            >
              {tt('cancel')}
            </button>
          </div>
        </div>
      </DialogOverlay>
    )
  }

  // Statik tushuntirish modal (FREE)
  if (showStatic && staticText) {
    return (
      <DialogOverlay onClose={handleClose} labelId="static-title" swipeToDismiss>
        <div
          className="relative w-full bg-psurface rounded-t-sheet px-5 pt-3 pb-[calc(1.75rem+var(--safe-bottom,0px))] max-h-[75vh] flex flex-col shadow-2xl overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          <ModalMathGrid glow={false} height={360} />
          <ModalCloseButton onClick={handleClose} label={tt('close')} />
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              speakExplanation(staticText)
            }}
            aria-label={language === 'ru' ? 'Озвучить объяснение' : "Tushuntirishni o'qib berish"}
            className="absolute right-3.5 top-3 z-30 size-9 rounded-full bg-white text-slate-800 shadow-[0_2px_8px_rgba(0,0,0,0.08)] border border-black/[0.06] dark:bg-[#1E2530] dark:text-white dark:border-white/10 flex items-center justify-center hover:scale-105 active:scale-95 transition-all cursor-pointer"
          >
            <Volume2 size={16} />
          </button>
          <div data-drag-handle className="w-10 h-1 bg-plineStrong rounded-full mx-auto mb-3 cursor-grab active:cursor-grabbing touch-none select-none relative z-10" />

          {/* Minimalist Centered Header */}
          <div className="text-center mb-3.5 pt-0.5 px-12 relative z-10 select-none">
            <h3 id="static-title" className="text-[17px] font-bold text-pfg tracking-tight">{tt('staticExplainTitle')}</h3>
          </div>

          <div className="overflow-y-auto min-h-[60px] relative z-10 bg-pcard rounded-2xl p-4 shadow-2xs">
            <p className="text-[13.5px] text-pfg leading-relaxed whitespace-pre-wrap">
              {staticText}
            </p>
          </div>

          {/* Soft upsell */}
          <button
            onClick={() => {
              setShowStatic(false)
              setShowUpsell(true)
            }}
            className="mt-3.5 w-full min-h-11 py-2.5 rounded-2xl bg-pcard text-ppurple hover:text-ppurple text-[12.5px] font-bold flex items-center justify-center gap-2 active:scale-[0.98] transition-all flex-shrink-0 shadow-2xs relative z-10"
          >
            <PremiumIcon size={15} />
            {tt('staticExplainAiHint')}
          </button>
        </div>
      </DialogOverlay>
    )
  }

  // AI streaming modal (PREMIUM)
  if (showAi) {
    return (
      <DialogOverlay onClose={handleClose} labelId="ai-title" swipeToDismiss>
        <div
          className="relative w-full bg-psurface rounded-t-sheet px-5 pt-3 pb-[calc(1.75rem+var(--safe-bottom,0px))] max-h-[75vh] flex flex-col shadow-2xl overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          <ModalMathGrid glow={false} height={360} />
          <ModalCloseButton onClick={handleClose} label={tt('close')} />
          {!aiBusy && aiText && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                speakExplanation(aiText)
              }}
              aria-label={language === 'ru' ? 'Озвучить объяснение' : "Tushuntirishni o'qib berish"}
              className="absolute right-3.5 top-3 z-30 size-9 rounded-full bg-white text-slate-800 shadow-[0_2px_8px_rgba(0,0,0,0.08)] border border-black/[0.06] dark:bg-[#1E2530] dark:text-white dark:border-white/10 flex items-center justify-center hover:scale-105 active:scale-95 transition-all cursor-pointer"
            >
              <Volume2 size={16} />
            </button>
          )}
          <div data-drag-handle className="w-10 h-1 bg-plineStrong rounded-full mx-auto mb-3 cursor-grab active:cursor-grabbing touch-none select-none relative z-10" />

          {/* Minimalist Centered Header */}
          <div className="text-center mb-3.5 pt-0.5 px-12 relative z-10 select-none flex items-center justify-center gap-2">
            <h3 id="ai-title" className="text-[17px] font-bold text-pfg tracking-tight">AI Ustoz</h3>
            {aiBusy && <Loader2 size={15} className="text-pprimary animate-spin" />}
          </div>

          <div className="overflow-y-auto min-h-[80px] bg-pcard rounded-2xl p-4 shadow-2xs relative z-10">
            {aiText ? (
              <p className="text-[13.5px] text-pfg leading-relaxed whitespace-pre-wrap">{aiText}</p>
            ) : (
              <p className="text-[13px] text-pmuted">{tt('aiThinking')}</p>
            )}
          </div>
        </div>
      </DialogOverlay>
    )
  }

  return null
}
