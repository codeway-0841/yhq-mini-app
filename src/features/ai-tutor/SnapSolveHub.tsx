import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Camera, Image as ImageIcon, ChevronLeft, ChevronRight, Loader2,
  RefreshCw, MessageSquareQuote, Crown,
  BookOpen, History,
} from 'lucide-react'
import { api, ApiError, type TutorQuota } from '../../shared/api'
import { useAppStore } from '../../shared/store/useAppStore'
import { useT } from '../../shared/i18n'
import { goBack } from '../../shared/lib/navigation'
import { compressImageFile } from '../../shared/lib/image-compress'
import MathText from '../../shared/components/MathText'
import SocraticChatSheet from './components/SocraticChatSheet'
import { SUBJECT_BASES } from '../../../shared/subjects'
import { haptics } from '../../platform/haptics'

interface SolvedItem {
  id: string
  timestamp: number
  previewImage?: string
  solution: {
    ocrText: string
    detectedSubject: string
    subjectName: string
    finalAnswer: string
    steps: { stepNumber: number; title: string; explanation: string; formula?: string }[]
    keyConcept: string
  }
}

const LOCAL_HISTORY_KEY = 'kivvi_snap_history'

export default function SnapSolveHub() {
  const navigate = useNavigate()
  const language = useAppStore((s) => s.settings.language)
  const tt = useT(language)

  const [quota, setQuota] = useState<TutorQuota | null>(null)
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const [imageMime, setImageMime] = useState<'image/jpeg' | 'image/png' | 'image/webp'>('image/jpeg')
  const [subjectHint, setSubjectHint] = useState<string>('')
  const [isCompressing, setIsCompressing] = useState(false)
  const [isSolving, setIsSolving] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [currentSolution, setCurrentSolution] = useState<SolvedItem['solution'] | null>(null)
  const [history, setHistory] = useState<SolvedItem[]>([])

  // Socratic Chat holati
  const [isChatOpen, setIsChatOpen] = useState(false)

  const cameraInputRef = useRef<HTMLInputElement | null>(null)
  const galleryInputRef = useRef<HTMLInputElement | null>(null)

  // Kvota va tarixni yuklash
  useEffect(() => {
    api.getTutorQuota()
      .then((res) => {
        if (res.ok) setQuota(res.quota)
      })
      .catch((err) => console.warn('[SnapSolve] quota fetch error:', err))

    try {
      const raw = localStorage.getItem(LOCAL_HISTORY_KEY)
      if (raw) setHistory(JSON.parse(raw))
    } catch { /* ignore */ }
  }, [])

  const saveToHistory = (sol: SolvedItem['solution'], preview?: string) => {
    const item: SolvedItem = {
      id: `solve-${Date.now()}`,
      timestamp: Date.now(),
      previewImage: preview,
      solution: sol,
    }
    const updated = [item, ...history.slice(0, 9)]
    setHistory(updated)
    try {
      localStorage.setItem(LOCAL_HISTORY_KEY, JSON.stringify(updated))
    } catch { /* ignore */ }
  }

  // Rasm tanlanganda siqish va preview
  const handleFile = async (file: File) => {
    try {
      setErrorMessage(null)
      setIsCompressing(true)
      const compressed = await compressImageFile(file)
      setSelectedImage(compressed.base64)
      setImageMime(compressed.mimeType)
      setCurrentSolution(null)
    } catch (err: unknown) {
      haptics.notify('error')
      setErrorMessage(err instanceof Error ? err.message : "Rasmni tayyorlashda xatolik")
    } finally {
      setIsCompressing(false)
    }
  }

  const handleSolve = async () => {
    if (!selectedImage || isSolving) return

    haptics.impact('light')
    setIsSolving(true)
    setErrorMessage(null)

    try {
      const res = await api.solvePhoto({
        image: selectedImage,
        mimeType: imageMime,
        subjectHint: subjectHint || undefined,
        language,
      })

      if (res.ok) {
        haptics.notify('success')
        setCurrentSolution(res.solution)
        setQuota(res.quota)
        saveToHistory(res.solution, selectedImage)
      }
    } catch (err: unknown) {
      haptics.notify('error')
      if (err instanceof ApiError && (err.code === 'free_limit_exceeded' || err.code === 'daily_limit')) {
        setErrorMessage(tt('snapSolveQuotaExceeded'))
      } else if (err instanceof ApiError && err.code) {
        setErrorMessage(err.code)
      } else {
        const msg = err instanceof Error ? err.message : "Masalani yechishda xatolik yuz berdi"
        setErrorMessage(msg)
      }
    } finally {
      setIsSolving(false)
    }
  }

  const handleReset = () => {
    setSelectedImage(null)
    setCurrentSolution(null)
    setErrorMessage(null)
  }

  return (
    <div className="px-4 pb-12">
      {/* Header */}
      <header className="sticky top-0 z-30 -mt-[var(--safe-top-body,0px)] pt-[var(--safe-top,0px)] -mx-4 px-4 py-2.5 bg-pcanvas/90 backdrop-blur-md border-b border-pline flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => goBack(navigate)}
            aria-label={tt('backWord')}
            className="grid size-10 place-items-center rounded-xl text-pmuted hover:bg-psurface hover:text-pfg transition-colors"
          >
            <ChevronLeft size={20} strokeWidth={1.75} />
          </button>
          <h1 className="text-[17px] font-semibold text-pfg">
            {tt('snapSolveTitle')}
          </h1>
        </div>

        {/* Quota Badge */}
        {quota && (
          <div className="flex items-center gap-1 text-[12px] font-medium px-2.5 py-1 rounded-full bg-psurface text-pmuted shadow-2xs">
            {quota.isPremium ? (
              <span className="text-pwarning flex items-center gap-1 font-semibold">
                <Crown size={13} strokeWidth={1.75} /> {quota.photoSolvesRemaining} / {quota.photoSolvesLimit}
              </span>
            ) : (
              <span className={quota.photoSolvesRemaining > 0 ? 'text-psuccess font-semibold' : 'text-pwarning font-semibold'}>
                {quota.photoSolvesRemaining} / {quota.photoSolvesLimit} bepul
              </span>
            )}
          </div>
        )}
      </header>

      {/* Hidden file inputs */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) void handleFile(file)
          e.target.value = ''
        }}
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) void handleFile(file)
          e.target.value = ''
        }}
      />

      {/* Error Banner */}
      {errorMessage && (
        <div className="mb-4 p-3.5 rounded-2xl bg-pdanger/10 text-pdanger text-xs flex items-center justify-between gap-3 shadow-2xs">
          <span>{errorMessage}</span>
          {errorMessage === tt('snapSolveQuotaExceeded') && (
            <button
              onClick={() => navigate('/premium')}
              className="px-3 py-1 rounded-xl bg-pdanger text-white font-medium text-xs shrink-0"
            >
              Premium
            </button>
          )}
        </div>
      )}

      {/* 1. Rasmni tanlash / Yuklash fazasi */}
      {!selectedImage && !currentSolution && (
        <div className="space-y-4">
          <div className="p-6 rounded-2xl bg-pcard text-center space-y-4 shadow-xs">
            <Camera size={32} strokeWidth={1.75} className="mx-auto text-pmuted" />
            <div>
              <h2 className="text-[15px] font-semibold text-pfg">{tt('snapSolveSubtitle')}</h2>
              <p className="text-[13px] text-pmuted mt-1">{tt('snapSolveCropHint')}</p>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={() => cameraInputRef.current?.click()}
                className="flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-pprimary text-white font-medium text-[13px] active:scale-[0.98] transition-all shadow-xs"
              >
                <Camera size={16} strokeWidth={1.75} />
                <span>{tt('snapSolveTakeCamera')}</span>
              </button>
              <button
                type="button"
                onClick={() => galleryInputRef.current?.click()}
                className="flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-psurface text-pfg font-medium text-[13px] hover:bg-psurface/80 active:scale-[0.98] transition-all shadow-xs"
              >
                <ImageIcon size={16} strokeWidth={1.75} />
                <span>{tt('snapSolvePickGallery')}</span>
              </button>
            </div>
          </div>

          {/* Tarix (oldingi yechilgan masalalar) */}
          {history.length > 0 && (
            <div className="space-y-2 pt-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-pmuted px-1">
                <History size={14} strokeWidth={1.75} />
                <span>{language === 'ru' ? 'Недавние решения' : 'Oxirgi yechilgan masalalar'}</span>
              </div>
              <div className="space-y-2">
                {history.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setCurrentSolution(item.solution)
                      if (item.previewImage) setSelectedImage(item.previewImage)
                    }}
                    className="w-full text-left p-3.5 rounded-2xl bg-pcard hover:bg-psurface transition-all flex items-center justify-between gap-3 shadow-xs active:scale-[0.99]"
                  >
                    <div className="truncate flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-psurface text-pmuted">
                          {item.solution.subjectName || item.solution.detectedSubject}
                        </span>
                        <span className="text-xs font-semibold text-psuccess">
                          {item.solution.finalAnswer}
                        </span>
                      </div>
                      <p className="text-xs text-pmuted truncate">{item.solution.ocrText}</p>
                    </div>
                    <ChevronRight size={16} strokeWidth={1.75} className="text-psubtle shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 2. Rasm ko'rinishi va Fan tanlash */}
      {selectedImage && !currentSolution && (
        <div className="space-y-4 animate-in fade-in duration-200">
          <div className="relative rounded-2xl overflow-hidden bg-black/90 max-h-[360px] flex items-center justify-center shadow-xs">
            <img
              src={selectedImage}
              alt="Uploaded problem"
              className="max-h-[360px] w-auto object-contain"
            />
            <button
              type="button"
              onClick={handleReset}
              className="absolute top-3 right-3 px-3 py-1.5 rounded-xl bg-black/70 backdrop-blur-md text-white text-xs font-medium hover:bg-black transition-colors"
            >
              {language === 'ru' ? 'Переснять' : 'Qayta suratga olish'}
            </button>
          </div>

          {/* Fan yo'nalishi (ixtiyoriy) */}
          <div>
            <label className="text-[12.5px] font-medium text-pmuted block mb-2 px-1">
              {language === 'ru' ? 'Предмет (необязательно):' : "Fan yo'nalishi (ixtiyoriy):"}
            </label>
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
              <button
                type="button"
                onClick={() => setSubjectHint('')}
                className={`px-3 py-1.5 rounded-full text-[12px] shrink-0 font-medium transition-colors ${
                  !subjectHint
                    ? 'bg-pprimary text-white shadow-xs'
                    : 'bg-psurface text-pmuted hover:text-pfg shadow-2xs'
                }`}
              >
                Auto-detect
              </button>
              {SUBJECT_BASES.map((sub) => (
                <button
                  key={sub.id}
                  type="button"
                  onClick={() => setSubjectHint(sub.id)}
                  className={`px-3 py-1.5 rounded-full text-[12px] shrink-0 font-medium transition-colors ${
                    subjectHint === sub.id
                      ? 'bg-pprimary text-white shadow-xs'
                      : 'bg-psurface text-pmuted hover:text-pfg shadow-2xs'
                  }`}
                >
                  {sub.name}
                </button>
              ))}
            </div>
          </div>

          {/* Yechish tugmasi */}
          <button
            type="button"
            disabled={isSolving || isCompressing}
            onClick={handleSolve}
            className="w-full py-3.5 rounded-2xl bg-pprimary text-white font-medium text-[14px] flex items-center justify-center gap-2 shadow-xs disabled:opacity-50 active:scale-[0.98] transition-all"
          >
            {isSolving ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                <span>{tt('snapSolveSolving')}</span>
              </>
            ) : (
              <span>{language === 'ru' ? 'Решить задачу' : 'Masalani yechish'}</span>
            )}
          </button>
        </div>
      )}

      {/* 3. Yechim ko'rsatish fazasi */}
      {currentSolution && (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom duration-300">
          {/* Fan va Yakuniy Javob Kartasi */}
          <div className="p-5 rounded-2xl bg-pcard shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[12px] font-medium px-2.5 py-1 rounded-full bg-psurface text-pmuted flex items-center gap-1.5">
                <BookOpen size={13} strokeWidth={1.75} />
                {currentSolution.subjectName || currentSolution.detectedSubject}
              </span>
              <button
                type="button"
                onClick={handleReset}
                className="text-[12px] text-pmuted hover:text-pfg flex items-center gap-1 transition-colors"
              >
                <RefreshCw size={13} strokeWidth={1.75} />
                <span>{language === 'ru' ? 'Другая задача' : 'Boshqa masala'}</span>
              </button>
            </div>

            {/* Yakuniy javob bloki */}
            <div className="p-4 rounded-2xl bg-psurface shadow-2xs">
              <div className="text-[11px] font-semibold text-pmuted uppercase tracking-wider mb-1">
                {tt('snapSolveFinalAnswer')}
              </div>
              <div className="text-base font-bold text-psuccess">
                <MathText text={currentSolution.finalAnswer} />
              </div>
            </div>

            {/* Asosiy qoida / formula */}
            {currentSolution.keyConcept && (
              <div className="text-[13px] text-pmuted pt-1 flex items-start gap-2">
                <p>
                  <strong className="font-semibold text-pfg">{tt('snapSolveKeyConcept')}:</strong>{' '}
                  <MathText text={currentSolution.keyConcept} as="span" />
                </p>
              </div>
            )}
          </div>

          {/* Sokratik Chat ochish banneri */}
          <div className="flex items-center justify-between gap-3 rounded-2xl bg-pcard p-4 shadow-xs">
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-semibold text-pfg">{tt('snapSolveDiscussWithAi')}</p>
              <p className="mt-0.5 text-[12.5px] text-pmuted">
                {language === 'ru'
                  ? 'Есть вопросы по решению? Задайте репетитору'
                  : 'Yechimga tushunmadingizmi? Ustoz bilan suhbatlashing'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsChatOpen(true)}
              className="flex shrink-0 items-center gap-1.5 rounded-xl bg-pprimary px-3.5 py-2 text-[12.5px] font-medium text-white shadow-xs transition-all active:scale-[0.98]"
            >
              <MessageSquareQuote size={15} strokeWidth={1.75} />
              <span>{language === 'ru' ? 'Спросить' : 'Suhbat'}</span>
            </button>
          </div>

          {/* Bosqichma-bosqich yechim qadamlari */}
          <div className="space-y-3">
            <h3 className="text-[12px] font-semibold uppercase tracking-wider text-pmuted px-1">
              {tt('snapSolveStepsTitle')}
            </h3>

            {currentSolution.steps.map((step) => (
              <div
                key={step.stepNumber}
                className="p-4 rounded-2xl bg-pcard space-y-2 text-sm shadow-xs"
              >
                <div className="flex items-center gap-2.5 font-semibold text-pfg">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-psurface text-[11px] font-semibold text-pmuted">
                    {step.stepNumber}
                  </span>
                  <span className="text-[14px]">{step.title}</span>
                </div>

                <div className="text-[13px] text-pmuted leading-relaxed pl-8.5">
                  <MathText text={step.explanation} as="div" />
                </div>

                {step.formula && (
                  <div className="pl-8.5 pt-1">
                    <div className="p-2.5 rounded-xl bg-psurface text-xs font-mono shadow-2xs text-pfg">
                      <MathText text={step.formula} as="div" />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Rasmdan o'qilgan matn (OCR) */}
          {currentSolution.ocrText && (
            <div className="p-4 rounded-2xl bg-pcard text-xs space-y-1 shadow-xs">
              <span className="font-semibold text-pmuted block">{tt('snapSolveOcrTitle')}:</span>
              <p className="text-pmuted/80 italic leading-relaxed">{currentSolution.ocrText}</p>
            </div>
          )}
        </div>
      )}

      {/* Sokratik Chat Drawer */}
      {currentSolution && (
        <SocraticChatSheet
          isOpen={isChatOpen}
          onClose={() => setIsChatOpen(false)}
          context={{
            questionText: currentSolution.ocrText,
            subjectId: currentSolution.detectedSubject,
            correctAnswer: currentSolution.finalAnswer,
          }}
          initialPrompt={
            language === 'ru'
              ? 'Объясни мне эту задачу подробнее, пожалуйста.'
              : 'Iltimos, ushbu masalaning yechimini soddaroq tilda tushuntirib bering.'
          }
        />
      )}
    </div>
  )
}
