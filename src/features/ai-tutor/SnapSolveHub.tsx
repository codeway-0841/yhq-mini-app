import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Camera, Image as ImageIcon, ChevronLeft, Loader2,
  RefreshCw, MessageSquareQuote, Crown, BookOpen,
  History, Scan, Flashlight, Calculator, X, Sparkles, AlertCircle,
} from 'lucide-react'
import { api, ApiError, type TutorQuota } from '../../shared/api'
import { useAppStore } from '../../shared/store/useAppStore'
import { useT } from '../../shared/i18n'
import { goBack } from '../../shared/lib/navigation'
import { compressImageFile } from '../../shared/lib/image-compress'
import MathText from '../../shared/components/MathText'
import SocraticChatSheet from './components/SocraticChatSheet'
import { haptics } from '../../platform/haptics'
import { playSound } from '../../shared/lib/sounds'

const SUBJECT_OPTIONS = [
  { id: '', nameUz: 'Umumiy', nameRu: 'Общий' },
  { id: 'matematika', nameUz: 'Matematika', nameRu: 'Математика' },
  { id: 'fizika', nameUz: 'Fizika', nameRu: 'Физика' },
  { id: 'kimyo', nameUz: 'Kimyo', nameRu: 'Химия' },
  { id: 'biologiya', nameUz: 'Biologiya', nameRu: 'Биология' },
  { id: 'tarix', nameUz: 'Tarix', nameRu: 'История' },
  { id: 'ingliz', nameUz: 'Ingliz tili', nameRu: 'Английский' },
  { id: 'rustili', nameUz: 'Rus tili', nameRu: 'Русский' },
  { id: 'onatili', nameUz: 'Ona tili', nameRu: 'Родной язык' },
  { id: 'yhq', nameUz: 'YHQ', nameRu: 'ПДД' },
]

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
  const [subjectHint, setSubjectHint] = useState<string>('')
  const [isCompressing, setIsCompressing] = useState(false)
  const [isSolving, setIsSolving] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [currentSolution, setCurrentSolution] = useState<SolvedItem['solution'] | null>(null)
  const [history, setHistory] = useState<SolvedItem[]>([])

  // Camera stream & controls
  const [cameraActive, setCameraActive] = useState(false)
  const [cameraError, setCameraError] = useState<'permission_denied' | 'no_camera' | null>(null)
  const [isTorchOn, setIsTorchOn] = useState(false)
  const [_hasTorch, setHasTorch] = useState(false)

  // Modals & inputs
  const [isChatOpen, setIsChatOpen] = useState(false)
  const [isManualInputOpen, setIsManualInputOpen] = useState(false)
  const [manualText, setManualText] = useState('')
  const [isHistoryOpen, setIsHistoryOpen] = useState(false)

  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const cameraInputRef = useRef<HTMLInputElement | null>(null)
  const galleryInputRef = useRef<HTMLInputElement | null>(null)
  const subjectScrollRef = useRef<HTMLDivElement | null>(null)

  // Start camera stream
  const startCamera = useCallback(async () => {
    try {
      if (!navigator?.mediaDevices?.getUserMedia) {
        setCameraError('no_camera')
        return
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop())
        streamRef.current = null
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play().catch(() => {})
      }
      setCameraActive(true)
      setCameraError(null)

      const track = stream.getVideoTracks()[0]
      const capabilities = (track?.getCapabilities?.() ?? {}) as { torch?: boolean }
      if (capabilities.torch) {
        setHasTorch(true)
      }
    } catch (err) {
      console.warn('[Camera] access error:', err)
      setCameraError('permission_denied')
      setCameraActive(false)
    }
  }, [])

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
    setCameraActive(false)
    setIsTorchOn(false)
  }, [])

  // Auto-start camera on mount, stop when photo selected/solved
  useEffect(() => {
    if (!selectedImage && !currentSolution) {
      void startCamera()
    } else {
      stopCamera()
    }
    return () => stopCamera()
  }, [selectedImage, currentSolution, startCamera, stopCamera])

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

  const runSolve = async (imgBase64: string, mime: 'image/jpeg' | 'image/png' | 'image/webp') => {
    haptics.impact('light')
    setIsSolving(true)
    setErrorMessage(null)

    try {
      const res = await api.solvePhoto({
        image: imgBase64,
        mimeType: mime,
        subjectHint: subjectHint || undefined,
        language,
      })

      if (res.ok) {
        haptics.notify('success')
        setCurrentSolution(res.solution)
        setQuota(res.quota)
        saveToHistory(res.solution, imgBase64)
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

  // Handle capture from video stream
  const handleShutterClick = () => {
    if (cameraActive && videoRef.current) {
      haptics.impact('medium')
      playSound('click')
      const video = videoRef.current
      const canvas = document.createElement('canvas')
      canvas.width = video.videoWidth || 1280
      canvas.height = video.videoHeight || 720
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
        const base64 = canvas.toDataURL('image/jpeg', 0.88)
        stopCamera()
        setSelectedImage(base64)
        setCurrentSolution(null)
        void runSolve(base64, 'image/jpeg')
      }
    } else {
      cameraInputRef.current?.click()
    }
  }

  // Rasm tanlanganda siqish va zudlik bilan yechish
  const handleFile = async (file: File) => {
    try {
      setErrorMessage(null)
      setIsCompressing(true)
      stopCamera()
      const compressed = await compressImageFile(file)
      setSelectedImage(compressed.base64)
      setCurrentSolution(null)
      void runSolve(compressed.base64, compressed.mimeType)
    } catch (err: unknown) {
      haptics.notify('error')
      setErrorMessage(err instanceof Error ? err.message : "Rasmni tayyorlashda xatolik")
    } finally {
      setIsCompressing(false)
    }
  }

  // Fonar (chiroq) almashtirish
  const toggleTorch = async () => {
    const track = streamRef.current?.getVideoTracks()[0]
    if (!track) return
    try {
      const next = !isTorchOn
      await (track as any).applyConstraints({
        advanced: [{ torch: next }],
      })
      setIsTorchOn(next)
      haptics.selection()
    } catch (e) {
      console.warn('[Torch] toggle failed:', e)
    }
  }

  const handleReset = () => {
    setSelectedImage(null)
    setCurrentSolution(null)
    setErrorMessage(null)
    void startCamera()
  }

  // Manual masala yozish (Kalkulyator orqali)
  const handleManualSolve = () => {
    if (!manualText.trim() || isSolving) return
    setIsManualInputOpen(false)

    const canvas = document.createElement('canvas')
    canvas.width = 1200
    canvas.height = 600
    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.fillStyle = '#0f172a'
      ctx.font = 'bold 36px sans-serif'

      const words = manualText.split(' ')
      let line = ''
      let y = 90
      for (const w of words) {
        const testLine = line + w + ' '
        const metrics = ctx.measureText(testLine)
        if (metrics.width > 1100 && line) {
          ctx.fillText(line, 50, y)
          line = w + ' '
          y += 50
        } else {
          line = testLine
        }
      }
      ctx.fillText(line, 50, y)

      const base64 = canvas.toDataURL('image/jpeg', 0.9)
      stopCamera()
      setSelectedImage(base64)
      setCurrentSolution(null)
      void runSolve(base64, 'image/jpeg')
    }
  }

  return (
    <div className="fixed inset-0 z-40 bg-black text-white flex flex-col overflow-hidden select-none">
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

      {/* ── TOP FLOATING BAR ────────────────────────────────────── */}
      <header className="relative z-20 flex items-center justify-between px-4 pt-[calc(0.75rem+var(--safe-top,0px))] pb-3 bg-gradient-to-b from-black/80 via-black/40 to-transparent">
        {/* Back Button */}
        <button
          type="button"
          onClick={() => goBack(navigate)}
          aria-label={tt('backWord')}
          className="flex size-10 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-md border border-white/15 shadow-sm transition-all active:scale-90 hover:bg-black/60"
        >
          <ChevronLeft size={22} strokeWidth={2} />
        </button>

        {/* Title & Quota Badge */}
        <div className="flex flex-col items-center">
          <h1 className="text-[15px] font-bold text-white drop-shadow-sm tracking-tight">
            {tt('snapSolveTitle')}
          </h1>
          {quota && (
            <div className="mt-0.5 flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-white/15 backdrop-blur-md text-white/90">
              {quota.isPremium ? (
                <span className="text-amber-300 flex items-center gap-1 font-semibold">
                  <Crown size={11} strokeWidth={2} /> {quota.photoSolvesRemaining} / {quota.photoSolvesLimit}
                </span>
              ) : (
                <span className={quota.photoSolvesRemaining > 0 ? 'text-emerald-300 font-semibold' : 'text-amber-300 font-semibold'}>
                  {quota.photoSolvesRemaining} / {quota.photoSolvesLimit} bepul
                </span>
              )}
            </div>
          )}
        </div>

        {/* Right Top Actions: History & Calculator */}
        <div className="flex items-center gap-2">
          {history.length > 0 && (
            <button
              type="button"
              onClick={() => setIsHistoryOpen(true)}
              aria-label="Tarix"
              className="flex size-10 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-md border border-white/15 shadow-sm transition-all active:scale-90 hover:bg-black/60"
            >
              <History size={18} strokeWidth={2} />
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsManualInputOpen(true)}
            aria-label="Kalkulyator"
            className="flex size-10 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-md border border-white/15 shadow-sm transition-all active:scale-90 hover:bg-black/60"
          >
            <Calculator size={18} strokeWidth={2} />
          </button>
        </div>
      </header>

      {/* ── MAIN VIEWFINDER / CAMERA STREAM ───────────────────────── */}
      <div className="relative flex-1 w-full overflow-hidden flex items-center justify-center bg-black">
        {/* Video stream */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="absolute inset-0 w-full h-full object-cover"
        />

        {/* Center subtle crosshair from screenshot */}
        {!selectedImage && !currentSolution && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="relative flex items-center justify-center">
              <div className="h-6 w-[2px] bg-white/80 rounded-full shadow-sm" />
              <div className="absolute w-6 h-[2px] bg-white/80 rounded-full shadow-sm" />
            </div>
          </div>
        )}

        {/* Fallback if camera not permitted / not active */}
        {(!cameraActive || cameraError) && !selectedImage && !currentSolution && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-slate-950/90 p-6 text-center">
            <div className="flex size-16 items-center justify-center rounded-3xl bg-white/10 text-white mb-3 backdrop-blur-md">
              <Camera size={32} strokeWidth={1.75} />
            </div>
            <h2 className="text-base font-semibold text-white mb-1">
              {language === 'ru' ? 'Камера не активна' : 'Kamera faol emas'}
            </h2>
            <p className="text-xs text-white/70 max-w-xs mb-4">
              {cameraError === 'permission_denied'
                ? language === 'ru'
                  ? 'Разрешите доступ к камере или выберите фото из галереи'
                  : 'Kameraga ruxsat bering yoki galereyadan rasm tanlang'
                : language === 'ru'
                  ? 'Выберите фото задачи из галереи'
                  : 'Galereyadan masala rasmini tanlang'}
            </p>
            <div className="flex gap-2.5">
              <button
                type="button"
                onClick={() => void startCamera()}
                className="px-4 py-2 rounded-xl bg-white/15 hover:bg-white/25 text-white text-xs font-semibold backdrop-blur-md transition-all active:scale-95"
              >
                {language === 'ru' ? 'Повторить' : 'Qayta urinish'}
              </button>
              <button
                type="button"
                onClick={() => galleryInputRef.current?.click()}
                className="px-4 py-2 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-xs font-semibold transition-all active:scale-95"
              >
                {language === 'ru' ? 'Выбрать фото' : 'Rasm tanlash'}
              </button>
            </div>
          </div>
        )}

        {/* Scanning animation while solving */}
        {isSolving && (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/80 backdrop-blur-xs">
            {selectedImage && (
              <div className="relative w-4/5 max-w-xs aspect-square rounded-2xl border-2 border-rose-500/80 overflow-hidden shadow-2xl">
                <img src={selectedImage} alt="Scanning" className="w-full h-full object-cover" />
                <div className="absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-rose-400 to-transparent shadow-[0_0_14px_#ff2e56] animate-pulse top-1/2" />
              </div>
            )}
            <div className="mt-5 flex items-center gap-2.5 rounded-full bg-black/80 px-5 py-2.5 text-white border border-white/15 shadow-xl">
              <Loader2 size={16} className="animate-spin text-rose-400" />
              <span className="text-sm font-medium">{tt('snapSolveSolving')}</span>
            </div>
          </div>
        )}

        {/* Error Banner */}
        {errorMessage && (
          <div className="absolute top-4 inset-x-4 z-30 p-3.5 rounded-2xl bg-red-950/90 border border-red-500/50 text-red-200 text-xs flex items-center justify-between gap-3 shadow-lg backdrop-blur-md">
            <div className="flex items-center gap-2">
              <AlertCircle size={16} className="shrink-0 text-red-400" />
              <span>{errorMessage}</span>
            </div>
            {errorMessage === tt('snapSolveQuotaExceeded') && (
              <button
                onClick={() => navigate('/premium')}
                className="px-3 py-1 rounded-xl bg-rose-500 text-white font-semibold text-xs shrink-0 active:scale-95"
              >
                Premium
              </button>
            )}
          </div>
        )}

        {/* ── SOLUTION OVERLAY SHEET ──────────────────────────────── */}
        {currentSolution && (
          <div className="absolute inset-0 z-30 bg-pcanvas text-pfg overflow-y-auto p-4 pb-20 animate-in fade-in slide-in-from-bottom duration-300">
            <div className="max-w-md mx-auto space-y-4">
              {/* Solution Header */}
              <div className="flex items-center justify-between pt-1">
                <span className="text-[12px] font-medium px-3 py-1 rounded-full bg-psurface text-pmuted flex items-center gap-1.5 shadow-2xs">
                  <BookOpen size={13} strokeWidth={1.75} />
                  {currentSolution.subjectName || currentSolution.detectedSubject}
                </span>
                <button
                  type="button"
                  onClick={handleReset}
                  className="text-[12.5px] font-semibold text-pprimary hover:underline flex items-center gap-1.5 py-1 px-2.5 rounded-lg bg-psurface transition-colors"
                >
                  <RefreshCw size={14} strokeWidth={2} />
                  <span>{language === 'ru' ? 'Новая задача' : 'Yangi masala'}</span>
                </button>
              </div>

              {/* Yakuniy javob bloki */}
              <div className="p-4 rounded-2xl bg-pcard shadow-xs">
                <div className="text-[11px] font-semibold text-pmuted uppercase tracking-wider mb-1">
                  {tt('snapSolveFinalAnswer')}
                </div>
                <div className="text-lg font-bold text-psuccess">
                  <MathText text={currentSolution.finalAnswer} />
                </div>
              </div>

              {/* Asosiy qoida / formula */}
              {currentSolution.keyConcept && (
                <div className="p-3.5 rounded-xl bg-psurface text-[13px] text-pmuted flex items-start gap-2 shadow-2xs">
                  <Sparkles size={16} className="text-pprimary shrink-0 mt-0.5" />
                  <p>
                    <strong className="font-semibold text-pfg">{tt('snapSolveKeyConcept')}:</strong>{' '}
                    <MathText text={currentSolution.keyConcept} as="span" />
                  </p>
                </div>
              )}

              {/* Sokratik Chat ochish banneri */}
              <div className="flex items-center justify-between gap-3 rounded-2xl bg-pcard p-4 shadow-xs">
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-semibold text-pfg">{tt('snapSolveDiscussWithAi')}</p>
                  <p className="mt-0.5 text-[12px] text-pmuted">
                    {language === 'ru'
                      ? 'Есть вопросы по решению? Задайте репетитору'
                      : 'Yechimga tushunmadingizmi? Ustoz bilan suhbatlashing'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsChatOpen(true)}
                  className="flex shrink-0 items-center gap-1.5 rounded-xl bg-pprimary px-3.5 py-2 text-[12.5px] font-semibold text-white shadow-xs transition-all active:scale-95"
                >
                  <MessageSquareQuote size={15} strokeWidth={2} />
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

              {/* Qayta suratga olish pastki tugma */}
              <button
                type="button"
                onClick={handleReset}
                className="w-full py-3.5 rounded-2xl bg-pprimary text-white font-semibold text-[14px] flex items-center justify-center gap-2 shadow-md active:scale-98 transition-all"
              >
                <Camera size={18} strokeWidth={2} />
                <span>{language === 'ru' ? 'Сфотографировать ещё' : 'Yana suratga olish'}</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── BOTTOM CONTROLS & SUBJECT CAROUSEL ─────────────────── */}
      {!currentSolution && (
        <div className="relative z-20 flex flex-col items-center pb-[calc(1rem+var(--safe-bottom,0px))] pt-2 bg-gradient-to-t from-black/95 via-black/60 to-transparent">
          {/* Horizontal Subject Carousel from screenshot */}
          <div className="w-full overflow-x-auto no-scrollbar py-2 px-4 mb-2" ref={subjectScrollRef}>
            <div className="flex items-center justify-start gap-5 min-w-max px-2">
              {SUBJECT_OPTIONS.map((sub) => {
                const isSelected = subjectHint === sub.id
                const label = language === 'ru' ? sub.nameRu : sub.nameUz
                return (
                  <button
                    key={sub.id}
                    type="button"
                    onClick={() => {
                      setSubjectHint(sub.id)
                      haptics.selection()
                    }}
                    className={`transition-all text-center select-none py-1 px-1.5 ${
                      isSelected
                        ? 'text-white font-bold text-[15px] drop-shadow-md border-b-2 border-white'
                        : 'text-white/60 font-medium text-[14px] hover:text-white/85'
                    }`}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* 3 Camera Buttons: Gallery, Big Shutter, Flashlight */}
          <div className="flex items-center justify-around w-full max-w-xs mx-auto px-4 py-1">
            {/* Gallery Button */}
            <button
              type="button"
              disabled={isCompressing || isSolving}
              onClick={() => galleryInputRef.current?.click()}
              aria-label={tt('snapSolvePickGallery')}
              className="flex size-12 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-md border border-white/20 shadow-lg transition-all active:scale-90 hover:bg-black/70 disabled:opacity-50"
            >
              <ImageIcon size={22} strokeWidth={1.9} />
              <span className="sr-only">{tt('snapSolvePickGallery')}</span>
            </button>

            {/* Big Shutter Scanner Button with Red Center & White Ring */}
            <button
              type="button"
              disabled={isCompressing || isSolving}
              onClick={handleShutterClick}
              aria-label={tt('snapSolveTakeCamera')}
              className="group relative flex size-20 items-center justify-center rounded-full border-[3.5px] border-white p-1 transition-transform active:scale-90 disabled:opacity-50"
            >
              <div className="flex size-[62px] items-center justify-center rounded-full bg-[#ff2e56] text-white shadow-lg shadow-rose-500/40 transition-transform group-hover:scale-105 group-active:scale-95">
                <Scan size={26} strokeWidth={2.4} />
              </div>
              <span className="sr-only">{tt('snapSolveTakeCamera')}</span>
            </button>

            {/* Flashlight Button */}
            <button
              type="button"
              onClick={toggleTorch}
              aria-label="Chiroq"
              className={`flex size-12 items-center justify-center rounded-full backdrop-blur-md border transition-all active:scale-90 ${
                isTorchOn
                  ? 'bg-amber-400 text-slate-900 border-amber-300 shadow-md shadow-amber-400/40'
                  : 'bg-black/50 text-white border-white/20 shadow-lg hover:bg-black/70'
              }`}
            >
              <Flashlight size={22} strokeWidth={1.9} />
            </button>
          </div>
        </div>
      )}

      {/* ── MANUAL FORMULA / PROBLEM INPUT MODAL (CALCULATOR) ──── */}
      {isManualInputOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-sm rounded-3xl bg-pcard p-5 text-pfg shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calculator size={20} className="text-pprimary" />
                <h3 className="text-[16px] font-bold">
                  {language === 'ru' ? 'Ввести задачу вручную' : 'Masalani qo‘lda yozish'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsManualInputOpen(false)}
                className="grid size-8 place-items-center rounded-full text-pmuted hover:bg-psurface hover:text-pfg transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <p className="text-xs text-pmuted leading-relaxed">
              {language === 'ru'
                ? 'Напишите условие задачи, формулу или математическое выражение:'
                : 'Masala shartini, formulani yoki matematik ifodani yozing:'}
            </p>

            <textarea
              rows={4}
              value={manualText}
              onChange={(e) => setManualText(e.target.value)}
              placeholder={language === 'ru' ? 'Например: 2x + 5 = 15, x = ?' : 'Masalan: 2x + 5 = 15, x = ?'}
              className="w-full rounded-2xl bg-psurface p-3 text-sm text-pfg placeholder:text-pmuted focus:outline-none focus:ring-2 focus:ring-pprimary resize-none"
            />

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setIsManualInputOpen(false)}
                className="px-4 py-2.5 rounded-xl bg-psurface text-xs font-semibold text-pmuted hover:text-pfg"
              >
                {tt('close')}
              </button>
              <button
                type="button"
                disabled={!manualText.trim() || isSolving}
                onClick={handleManualSolve}
                className="px-5 py-2.5 rounded-xl bg-pprimary text-xs font-semibold text-white shadow-xs disabled:opacity-50 active:scale-95"
              >
                {language === 'ru' ? 'Решить' : 'Yechish'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── HISTORY MODAL ────────────────────────────────────────── */}
      {isHistoryOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-sm max-h-[80vh] flex flex-col rounded-3xl bg-pcard p-5 text-pfg shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-pline">
              <div className="flex items-center gap-2">
                <History size={18} className="text-pprimary" />
                <h3 className="text-[15px] font-bold">
                  {language === 'ru' ? 'Недавние решения' : 'Oxirgi yechimlar'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsHistoryOpen(false)}
                className="grid size-8 place-items-center rounded-full text-pmuted hover:bg-psurface hover:text-pfg"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-3 space-y-2 no-scrollbar">
              {history.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setCurrentSolution(item.solution)
                    if (item.previewImage) setSelectedImage(item.previewImage)
                    setIsHistoryOpen(false)
                  }}
                  className="w-full text-left p-3 rounded-2xl bg-psurface hover:bg-psurface/80 transition-all flex items-center justify-between gap-3 shadow-2xs active:scale-[0.98]"
                >
                  <div className="truncate flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-pcard text-pmuted">
                        {item.solution.subjectName || item.solution.detectedSubject}
                      </span>
                      <span className="text-xs font-bold text-psuccess">
                        {item.solution.finalAnswer}
                      </span>
                    </div>
                    <p className="text-xs text-pmuted truncate">{item.solution.ocrText}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── SOCRATIC CHAT DRAWER ─────────────────────────────────── */}
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
