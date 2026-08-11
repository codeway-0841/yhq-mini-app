import { useState, useEffect, useRef, useCallback } from 'react'
import { Crown, Loader2, GraduationCap, Info, Volume2 } from 'lucide-react'
import { explainQuestion, fetchStaticExplanation, TutorError } from '../../../shared/lib/tutor'
import { openTelegramLink } from '../../../platform/telegram'
import { speak } from '../../../shared/lib/speech'
import { playSound } from '../../../shared/lib/sounds'
import { useAppStore } from '../../../shared/store/useAppStore'
import { useT } from '../../../shared/i18n'
import DialogOverlay from '../../../shared/components/DialogOverlay'

interface AiTutorModalProps {
  questionId: number
  selectedOptionId: string | null
  isCorrect: boolean
  onClose: () => void
  language: 'uz' | 'ru'
}

export default function AiTutorModal({
  questionId,
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
  const aiCacheRef = useRef(new Map<number, string>())
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

    // Cache key: questionId shifted left to avoid collisions, then add correctness bit
    const cacheKey = (questionId << 1) | (isCorrect ? 1 : 0)
    const cached = aiCacheRef.current.get(cacheKey)
    if (cached) {
      setAiText(cached)
      return
    }

    setAiBusy(true)
    setAiText('')

    try {
      let acc = ''
      for await (const chunk of explainQuestion(questionId, language, isCorrect)) {
        if (abortController.signal.aborted) return
        acc += chunk
        setAiText(acc)
      }
      if (!abortController.signal.aborted) {
        aiCacheRef.current.set(cacheKey, acc)
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
  }, [questionId, userId, selectedOptionId, isCorrect, language, tt])

  /** AI modal ochish — Premium yo'q bo'lsa statik yoki upsell */
  const openAi = useCallback(async () => {
    if (!isPremium) {
      try {
        const text = await fetchStaticExplanation(questionId, language)
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
  }, [isPremium, questionId, language, startAiExplain])

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
      <DialogOverlay onClose={handleClose} labelId="upsell-title">
        <div
          className="relative w-full bg-surface rounded-t-3xl border-t border-line p-5 pb-8"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="w-10 h-1 bg-line rounded-full mx-auto mb-4" />
          <div className="flex flex-col items-center text-center">
            <div className="w-14 h-14 rounded-2xl bg-duo-purple/15 border border-duo-purple/40 flex items-center justify-center mb-3">
              <Crown size={26} className="text-duo-yellow" fill="currentColor" />
            </div>
            <p id="upsell-title" className="text-[17px] font-black text-fg">{tt('premiumNeedTitle')}</p>
            <p className="text-[13px] text-muted mt-1.5 mb-4 leading-snug">
              {tt('premiumNeedDesc')}
            </p>
            <button
              onClick={() => {
                handleClose()
                openTelegramLink('https://t.me/kiwi_uz_bot?start=premium')
              }}
              className="btn-neon w-full py-3.5 rounded-2xl font-black text-[14px] flex items-center justify-center gap-2 mb-2"
            >
              <Crown size={16} fill="currentColor" />
              {tt('buyPremium')}
            </button>
            <button
              onClick={handleClose}
              className="w-full py-3 rounded-2xl bg-elevated text-[13px] font-bold text-muted active:scale-[0.98] transition-transform"
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
      <DialogOverlay onClose={handleClose} labelId="static-title">
        <div
          className="relative w-full bg-surface rounded-t-3xl border-t border-line p-5 pb-8 max-h-[75vh] flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="w-10 h-1 bg-line rounded-full mx-auto mb-4" />
          <div className="flex items-center gap-2 mb-3 flex-shrink-0">
            <div className="w-9 h-9 rounded-xl bg-duo-yellow/15 border border-duo-yellow/40 flex items-center justify-center flex-shrink-0">
              <Info size={17} className="text-duo-yellow" />
            </div>
            <p id="static-title" className="text-[15px] font-black text-fg">{tt('staticExplainTitle')}</p>
            <button
              onClick={(e) => {
                e.stopPropagation()
                speakExplanation(staticText)
              }}
              aria-label={language === 'ru' ? 'Озвучить объяснение' : "Tushuntirishni o'qib berish"}
              className="ml-auto w-8 h-8 rounded-full bg-elevated border border-line flex items-center justify-center text-muted hover:text-fg active:scale-90 transition-all"
            >
              <Volume2 size={14} />
            </button>
          </div>
          <div className="overflow-y-auto min-h-[60px]">
            <p className="text-[13.5px] text-fg leading-relaxed whitespace-pre-wrap">
              {staticText}
            </p>
          </div>
          {/* Soft upsell */}
          <button
            onClick={() => {
              setShowStatic(false)
              setShowUpsell(true)
            }}
            className="mt-4 w-full py-2.5 rounded-2xl bg-duo-purple/15 border border-duo-purple/40 text-duo-purple text-[12.5px] font-bold flex items-center justify-center gap-2 active:scale-[0.98] transition-transform flex-shrink-0"
          >
            <Crown size={14} fill="currentColor" />
            {tt('staticExplainAiHint')}
          </button>
        </div>
      </DialogOverlay>
    )
  }

  // AI streaming modal (PREMIUM)
  if (showAi) {
    return (
      <DialogOverlay onClose={handleClose} labelId="ai-title">
        <div
          className="relative w-full bg-surface rounded-t-3xl border-t border-line p-5 pb-8 max-h-[75vh] flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="w-10 h-1 bg-line rounded-full mx-auto mb-4" />
          <div className="flex items-center gap-2 mb-3 flex-shrink-0">
            <div className="w-9 h-9 rounded-xl bg-duo-purple/15 border border-duo-purple/40 flex items-center justify-center flex-shrink-0">
              <GraduationCap size={17} className="text-duo-purple" />
            </div>
            <p id="ai-title" className="text-[15px] font-black text-fg">AI Tutor</p>
            {aiBusy && <Loader2 size={15} className="text-duo-purple animate-spin ml-auto" />}
            {!aiBusy && aiText && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  speakExplanation(aiText)
                }}
                aria-label={language === 'ru' ? 'Озвучить объяснение' : "Tushuntirishni o'qib berish"}
                className="ml-auto w-8 h-8 rounded-full bg-elevated border border-line flex items-center justify-center text-muted hover:text-fg active:scale-90 transition-all"
              >
                <Volume2 size={14} />
              </button>
            )}
          </div>
          <div className="overflow-y-auto min-h-[80px]">
            {aiText ? (
              <p className="text-[13.5px] text-fg leading-relaxed whitespace-pre-wrap">{aiText}</p>
            ) : (
              <p className="text-[13px] text-muted">{tt('aiThinking')}</p>
            )}
          </div>
        </div>
      </DialogOverlay>
    )
  }

  return null
}
