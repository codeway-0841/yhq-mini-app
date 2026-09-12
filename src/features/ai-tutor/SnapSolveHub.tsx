import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Camera, Image as ImageIcon, Sparkles, ChevronLeft, Loader2,
  RefreshCw, MessageSquareQuote, Crown, ArrowRight,
  BookOpen, History,
} from 'lucide-react'
import { api, type TutorQuota } from '../../shared/api'
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
      const msg = err instanceof Error ? err.message : "Masalani yechishda xatolik yuz berdi"
      if (msg.includes('429') || msg.includes('limit')) {
        setErrorMessage(tt('snapSolveQuotaExceeded'))
      } else {
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
          <div>
            <h1 className="text-lg font-bold flex items-center gap-1.5">
              <Sparkles size={18} className="text-pprimary" />
              {tt('snapSolveTitle')}
            </h1>
          </div>
        </div>

        {/* Quota Badge */}
        {quota && (
          <div className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-psurface shadow-2xs">
            {quota.isPremium ? (
              <span className="text-amber-500 flex items-center gap-1">
                <Crown size={13} /> {quota.photoSolvesRemaining} / {quota.photoSolvesLimit}
              </span>
            ) : (
              <span className={quota.photoSolvesRemaining > 0 ? 'text-emerald-500' : 'text-amber-500'}>
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
        <div className="mb-4 p-3.5 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-500 text-xs flex items-center justify-between gap-3">
          <span>{errorMessage}</span>
          {errorMessage === tt('snapSolveQuotaExceeded') && (
            <button
              onClick={() => navigate('/premium')}
              className="px-3 py-1 rounded-lg bg-red-500 text-white font-bold text-xs shrink-0"
            >
              Premium
            </button>
          )}
        </div>
      )}

      {/* 1. Rasmni tanlash / Yuklash fazasi */}
      {!selectedImage && !currentSolution && (
        <div className="space-y-4">
          <div className="p-6 rounded-3xl bg-pcard text-center space-y-4 shadow-sm">
            <div className="size-16 mx-auto rounded-2xl bg-pprimary/10 text-pprimary grid place-items-center">
              <Camera size={32} strokeWidth={1.75} />
            </div>
            <div>
              <h2 className="text-base font-bold text-pfg">{tt('snapSolveSubtitle')}</h2>
              <p className="text-xs text-pmuted mt-1">{tt('snapSolveCropHint')}</p>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={() => cameraInputRef.current?.click()}
                className="flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-pprimary text-white font-semibold text-xs active:scale-95 transition-all shadow-xs"
              >
                <Camera size={16} />
                <span>{tt('snapSolveTakeCamera')}</span>
              </button>
              <button
                type="button"
                onClick={() => galleryInputRef.current?.click()}
                className="flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-psurface text-pfg font-semibold text-xs hover:bg-pline/40 active:scale-95 transition-all shadow-xs"
              >
                <ImageIcon size={16} />
                <span>{tt('snapSolvePickGallery')}</span>
              </button>
            </div>
          </div>

          {/* Tarix (oldingi yechilgan masalalar) */}
          {history.length > 0 && (
            <div className="space-y-2 pt-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-pmuted px-1">
                <History size={14} />
                <span>Oxirgi yechilgan masalalar</span>
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
                    className="w-full text-left p-3.5 rounded-2xl bg-pcard hover:bg-psurface transition-all flex items-center justify-between gap-3 shadow-xs"
                  >
                    <div className="truncate flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-psurface text-pprimary">
                          {item.solution.subjectName || item.solution.detectedSubject}
                        </span>
                        <span className="text-xs font-semibold text-emerald-500">
                          {item.solution.finalAnswer}
                        </span>
                      </div>
                      <p className="text-xs text-pmuted truncate">{item.solution.ocrText}</p>
                    </div>
                    <ArrowRight size={16} className="text-pmuted shrink-0" />
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
          <div className="relative rounded-3xl overflow-hidden border border-pline bg-black max-h-[360px] flex items-center justify-center">
            <img
              src={selectedImage}
              alt="Uploaded problem"
              className="max-h-[360px] w-auto object-contain"
            />
            <button
              type="button"
              onClick={handleReset}
              className="absolute top-3 right-3 px-3 py-1.5 rounded-xl bg-black/70 backdrop-blur-md text-white text-xs font-semibold hover:bg-black"
            >
              Qayta suratga olish
            </button>
          </div>

          {/* Fan yo'nalishi (ixtiyoriy) */}
          <div>
            <label className="text-xs font-medium text-pmuted block mb-2 px-1">
              Fan yo'nalishi (ixtiyoriy):
            </label>
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
              <button
                type="button"
                onClick={() => setSubjectHint('')}
                className={`px-3 py-1.5 rounded-xl text-xs shrink-0 font-medium transition-colors ${
                  !subjectHint ? 'bg-pprimary text-white shadow-xs' : 'bg-psurface text-pmuted hover:text-pfg shadow-2xs'
                }`}
              >
                Auto-detect
              </button>
              {SUBJECT_BASES.map((sub) => (
                <button
                  key={sub.id}
                  type="button"
                  onClick={() => setSubjectHint(sub.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs shrink-0 font-medium transition-colors ${
                    subjectHint === sub.id
                      ? 'bg-pprimary text-white shadow-xs'
                      : 'bg-psurface text-pmuted hover:text-pfg shadow-2xs'
                  }`}
                >
                  {sub.icon} {sub.name}
                </button>
              ))}
            </div>
          </div>

          {/* Yechish tugmasi */}
          <button
            type="button"
            disabled={isSolving || isCompressing}
            onClick={handleSolve}
            className="w-full py-3.5 rounded-2xl bg-pprimary text-white font-bold text-sm flex items-center justify-center gap-2 shadow-sm disabled:opacity-50 active:scale-98 transition-all"
          >
            {isSolving ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                <span>{tt('snapSolveSolving')}</span>
              </>
            ) : (
              <>
                <Sparkles size={18} />
                <span>Masalani yechish</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* 3. Yechim ko'rsatish fazasi */}
      {currentSolution && (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom duration-300">
          {/* Fan va Yakuniy Javob Kartasi */}
          <div className="p-5 rounded-3xl bg-pcard shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded-xl bg-pprimary/10 text-pprimary flex items-center gap-1">
                <BookOpen size={13} />
                {currentSolution.subjectName || currentSolution.detectedSubject}
              </span>
              <button
                type="button"
                onClick={handleReset}
                className="text-xs text-pmuted hover:text-pfg flex items-center gap-1"
              >
                <RefreshCw size={13} />
                <span>Boshqa masala</span>
              </button>
            </div>

            {/* Yakuniy javob bloki */}
            <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
              <div className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mb-1">
                {tt('snapSolveFinalAnswer')}
              </div>
              <div className="text-base font-bold text-emerald-700 dark:text-emerald-300">
                <MathText text={currentSolution.finalAnswer} />
              </div>
            </div>

            {/* Asosiy qoida / formula */}
            {currentSolution.keyConcept && (
              <div className="text-xs text-pmuted pt-1 flex items-start gap-2">
                <span className="shrink-0">💡</span>
                <p>
                  <strong className="text-pfg">{tt('snapSolveKeyConcept')}:</strong>{' '}
                  <MathText text={currentSolution.keyConcept} as="span" />
                </p>
              </div>
            )}
          </div>

          {/* Sokratik Chat ochish banneri */}
          <div className="p-4 rounded-3xl bg-linear-to-r from-pprimary/15 to-purple-500/15 border border-pprimary/30 flex items-center justify-between gap-3 shadow-xs">
            <div>
              <div className="text-sm font-bold flex items-center gap-1.5 text-pfg">
                <Sparkles size={16} className="text-pprimary" />
                {tt('snapSolveDiscussWithAi')}
              </div>
              <p className="text-xs text-pmuted mt-0.5">
                Yechimga tushunmadingizmi? Ustoz bilan suhbatlashing.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsChatOpen(true)}
              className="px-3.5 py-2 rounded-xl bg-pprimary text-white font-bold text-xs shrink-0 flex items-center gap-1.5 active:scale-95 transition-all shadow-xs"
            >
              <MessageSquareQuote size={15} />
              <span>Suhbat</span>
            </button>
          </div>

          {/* Bosqichma-bosqich yechim qadamlari */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-pmuted px-1">
              {tt('snapSolveStepsTitle')}
            </h3>

            {currentSolution.steps.map((step) => (
              <div
                key={step.stepNumber}
                className="p-4 rounded-2xl bg-pcard space-y-2 text-sm shadow-2xs"
              >
                <div className="flex items-center gap-2 font-bold text-pfg">
                  <div className="size-6 rounded-full bg-psurface text-pprimary text-xs grid place-items-center shrink-0">
                    {step.stepNumber}
                  </div>
                  <span>{step.title}</span>
                </div>

                <div className="text-xs text-pmuted leading-relaxed pl-8">
                  <MathText text={step.explanation} as="div" />
                </div>

                {step.formula && (
                  <div className="pl-8 pt-1">
                    <div className="p-2.5 rounded-xl bg-psurface text-xs font-mono shadow-2xs">
                      <MathText text={step.formula} as="div" />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Rasmdan o'qilgan matn (OCR) */}
          {currentSolution.ocrText && (
            <div className="p-4 rounded-2xl bg-psurface/40 text-xs space-y-1 shadow-2xs">
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
