import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Camera, Image as ImageIcon, ChevronLeft, Loader2,
  RefreshCw, MessageSquareQuote, Crown, BookOpen,
  History, Scan, Flashlight, Calculator, X, Sparkles, AlertCircle,
  FlipHorizontal,
} from 'lucide-react'
import { api, ApiError, type TutorQuota } from '../../shared/api'
import { useAppStore } from '../../shared/store/useAppStore'
import { useT } from '../../shared/i18n'
import { goBack } from '../../shared/lib/navigation'
import { compressImageFile } from '../../shared/lib/image-compress'
import {
  CAMERA_START_GRACE_MS,
  captureVideoFrame,
  hasRememberedCameraAccess,
  isCameraPermissionError,
  queryCameraPermission,
  rememberCameraAccess,
} from '../../shared/lib/camera-capture'
import MathText from '../../shared/components/MathText'
import SocraticChatSheet from './components/SocraticChatSheet'
import { nearestCenterIndex } from './subject-carousel'
import { haptics } from '../../platform/haptics'
import { isNativeApp, requestNativeCameraPermission } from '../../platform/native'
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
type CameraState = 'checking' | 'prompt' | 'loading' | 'active' | 'denied' | 'unsupported' | 'error'

export default function SnapSolveHub() {
  const navigate = useNavigate()
  const language = useAppStore((s) => s.settings.language)
  const tt = useT(language)
  const nativeApp = isNativeApp()

  const [quota, setQuota] = useState<TutorQuota | null>(null)
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const [subjectHint, setSubjectHint] = useState<string>('')
  const [isCompressing, setIsCompressing] = useState(false)
  const [isSolving, setIsSolving] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [currentSolution, setCurrentSolution] = useState<SolvedItem['solution'] | null>(null)
  const [history, setHistory] = useState<SolvedItem[]>([])

  // Camera stream & controls
  const [cameraState, setCameraState] = useState<CameraState>('checking')
  const [cameraErrorMessage, setCameraErrorMessage] = useState<string | null>(null)
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment')
  const [isTorchOn, setIsTorchOn] = useState(false)
  const [torchMode, setTorchMode] = useState<'hardware' | 'screen' | null>(null)
  const [torchToast, setTorchToast] = useState<string | null>(null)

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
  const subjectScrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Karusel auto-select race'ini oldini olish uchun joriy hint mirror'i
  // (scroll-debounce setState updater ichida yon-ta'sir qilmasligi uchun)
  const hintRef = useRef<string>(subjectHint)
  hintRef.current = subjectHint
  const torchToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const cameraRequestIdRef = useRef(0)

  const stopCamera = useCallback((nextState?: CameraState) => {
    cameraRequestIdRef.current += 1
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
    if (videoRef.current) {
      videoRef.current.onloadedmetadata = null
      videoRef.current.onplaying = null
      videoRef.current.srcObject = null
    }
    if (nextState) setCameraState(nextState)
    setIsTorchOn(false)
    setTorchMode(null)
  }, [])

  // Jonli (tirik) treklar bormi — ruxsat qayta so'ralmasligi uchun tekshiruv.
  // (Mock stream'larda getVideoTracks bo'lmasligi mumkin — optional chain.)
  const liveVideoTracks = useCallback((): MediaStreamTrack[] => {
    const stream = streamRef.current
    if (!stream) return []
    const tracks = stream.getVideoTracks?.() ?? []
    return tracks.filter((t) => t.readyState === 'live')
  }, [])

  // Pauza: kadrlar to'xtaydi (batareya), lekin ruxsat/grant SAQLANADI —
  // qaytganda getUserMedia chaqirilmaydi, brauzer popup chiqarmaydi.
  const pauseCameraStream = useCallback(() => {
    liveVideoTracks().forEach((t) => { t.enabled = false })
    setIsTorchOn(false)
    setTorchMode(null)
  }, [liveVideoTracks])

  // Davom ettirish: jonli stream bo'lsa uni qayta ulash (getUserMedia YO'Q).
  const resumeCameraStream = useCallback((requestId: number): boolean => {
    const stream = streamRef.current
    if (!stream || liveVideoTracks().length === 0) return false
    stream.getVideoTracks?.().forEach((t) => { t.enabled = true })
    const video = videoRef.current
    if (video) {
      video.muted = true
      video.defaultMuted = true
      video.playsInline = true
      video.setAttribute('playsinline', 'true')
      video.setAttribute('webkit-playsinline', 'true')
      if (video.srcObject !== stream) video.srcObject = stream
      video.play().then(() => {
        if (cameraRequestIdRef.current !== requestId) return
        setCameraState('active')
        setCameraErrorMessage(null)
      }).catch((playErr) => {
        console.warn('[Camera] resume play error:', playErr)
      })
    } else {
      setCameraState('active')
    }
    return true
  }, [liveVideoTracks])

  const showCameraDenied = useCallback(() => {
    setCameraState('denied')
    setCameraErrorMessage(
      language === 'ru'
        ? 'Разрешите доступ к камере в настройках браузера или приложения'
        : 'Kameraga ruxsat berilmagan. Brauzer yoki ilova sozlamalarida ruxsat bering'
    )
  }, [language])

  // Start camera stream with multi-level fallback cascade
  const startCamera = useCallback(async (forcedFacing?: 'environment' | 'user') => {
    const targetFacing = forcedFacing || facingMode
    const requestId = cameraRequestIdRef.current + 1
    cameraRequestIdRef.current = requestId
    // 0-bosqich: jonli stream bor — ruxsatni QAYTA so'ramasdan davom et
    // (bir marta "Ha" bosilgan bo'lsa, keyingi kirishlarda popup chiqmaydi)
    if (liveVideoTracks().length > 0) {
      resumeCameraStream(requestId)
      return
    }
    setCameraState('loading')
    setCameraErrorMessage(null)

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }

    if (nativeApp) {
      const permission = await requestNativeCameraPermission()
      if (cameraRequestIdRef.current !== requestId) return
      if (permission === 'denied') {
        rememberCameraAccess(false)
        showCameraDenied()
        return
      }
    }

    if (!navigator?.mediaDevices?.getUserMedia) {
      if (cameraRequestIdRef.current !== requestId) return
      setCameraState('unsupported')
      setCameraErrorMessage(
        language === 'ru'
          ? 'Камера не поддерживается в этом браузере'
          : 'Ushbu brauzerda kamera qo‘llab-quvvatlanmaydi'
      )
      return
    }

    let stream: MediaStream | null = null
    let lastError: any = null
    const loadingTimer = setTimeout(() => {
      if (cameraRequestIdRef.current !== requestId || streamRef.current) return
      setCameraState('error')
      setCameraErrorMessage(
        language === 'ru'
          ? 'Камера не ответила. Попробуйте системную камеру или выберите фото из галереи'
          : 'Kamera javob bermadi. Tizim kamerasidan oling yoki galereyadan rasm tanlang'
      )
    }, CAMERA_START_GRACE_MS)

    // Cascade 1: Target facing with standard mobile dimensions
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: targetFacing },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      })
    } catch (e1: any) {
      lastError = e1
      console.warn('[Camera] Level 1 (ideal 1280x720) failed:', e1?.name)
    }

    // Cascade 2: Target facing mode simple
    if (!stream && !isCameraPermissionError(lastError)) {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: targetFacing },
          audio: false,
        })
      } catch (e2: any) {
        lastError = e2
        console.warn('[Camera] Level 2 (facingMode simple) failed:', e2?.name)
      }
    }

    // Cascade 3: Enumerate devices to locate matching back/rear camera
    if (!stream && !isCameraPermissionError(lastError) && targetFacing === 'environment') {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices()
        const videoDevices = devices.filter((d) => d.kind === 'videoinput')
        const backCamera = videoDevices.find((d) =>
          /back|rear|environment|arka|orqa|main/i.test(d.label)
        )
        if (backCamera) {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { deviceId: { exact: backCamera.deviceId } },
            audio: false,
          })
        }
      } catch (e3: any) {
        lastError = e3
        console.warn('[Camera] Level 3 (enumerate back device) failed:', e3?.name)
      }
    }

    // Cascade 4: Any video stream
    if (!stream && !isCameraPermissionError(lastError)) {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        })
      } catch (e4: any) {
        lastError = e4
        console.warn('[Camera] Level 4 (video: true) failed:', e4?.name)
      }
    }

    if (!stream) {
      clearTimeout(loadingTimer)
      if (cameraRequestIdRef.current !== requestId) return
      const errName = lastError?.name || ''
      if (isCameraPermissionError(lastError)) {
        rememberCameraAccess(false)
        showCameraDenied()
      } else if (errName === 'NotFoundError' || errName === 'DevicesNotFoundError') {
        setCameraState('unsupported')
        setCameraErrorMessage(
          language === 'ru'
            ? 'Камера не найдена на этом устройстве'
            : 'Ushbu qurilmada kamera topilmadi'
        )
      } else if (errName === 'NotReadableError' || errName === 'TrackStartError') {
        setCameraState('error')
        setCameraErrorMessage(
          language === 'ru'
            ? 'Камера занята другим приложением. Закройте его и повторите попытку'
            : 'Kamera boshqa ilova tomonidan band qilingan. Uni yopib qayta urining'
        )
      } else {
        setCameraState('error')
        setCameraErrorMessage(
          language === 'ru'
            ? 'Не удалось запустить камеру'
            : 'Kamerani ishga tushirib bo‘lmadi'
        )
      }
      return
    }

    clearTimeout(loadingTimer)
    if (cameraRequestIdRef.current !== requestId) {
      stream.getTracks().forEach((t) => t.stop())
      return
    }

    rememberCameraAccess(true)
    streamRef.current = stream

    // Attach stream to video element
    const video = videoRef.current
    if (video) {
      video.muted = true
      video.defaultMuted = true
      video.playsInline = true
      video.setAttribute('playsinline', 'true')
      video.setAttribute('webkit-playsinline', 'true')
      video.srcObject = stream

      const markActive = () => {
        if (cameraRequestIdRef.current !== requestId) return
        setCameraState('active')
        setCameraErrorMessage(null)
      }

      video.onloadedmetadata = () => {
        video.play().then(markActive).catch((playErr) => {
          console.warn('[Camera] play on metadata error:', playErr)
        })
      }

      video.play().then(markActive).catch((playErr) => {
        console.warn('[Camera] initial play error:', playErr)
      })
    } else {
      setCameraState('active')
    }
  }, [facingMode, language, nativeApp, showCameraDenied, liveVideoTracks, resumeCameraStream])

  // Auto-start only when permission is already granted. Prompting is user-initiated.
  useEffect(() => {
    if (selectedImage || currentSolution) {
      // Rasm/yechim ko'rinayotganda — stream'ni TO'LIQ o'chirmasdan pauza qil
      // (grant saqlanadi, "orqaga" qaytganda ruxsat qayta so'ralmaydi)
      pauseCameraStream()
      return
    }

    // Jonli stream bor — ruxsatni qayta so'ramasdan davom et
    if (streamRef.current) {
      const tracks = streamRef.current.getVideoTracks?.() ?? []
      if (tracks.some((t) => t.readyState === 'live')) {
        const requestId = cameraRequestIdRef.current + 1
        cameraRequestIdRef.current = requestId
        resumeCameraStream(requestId)
        return () => {
          cameraRequestIdRef.current += 1
          if (torchToastTimerRef.current) clearTimeout(torchToastTimerRef.current)
        }
      }
    }

    let cancelled = false
    setCameraState('checking')
    setCameraErrorMessage(null)

    if (nativeApp) {
      void startCamera()
      return () => {
        cancelled = true
        if (torchToastTimerRef.current) clearTimeout(torchToastTimerRef.current)
      }
    }

    void queryCameraPermission().then((permission) => {
      if (cancelled) return
      if (permission === 'granted' || (permission !== 'denied' && hasRememberedCameraAccess())) {
        void startCamera()
      } else if (permission === 'denied') {
        rememberCameraAccess(false)
        showCameraDenied()
      } else {
        setCameraState('prompt')
      }
    })

    return () => {
      cancelled = true
      if (torchToastTimerRef.current) clearTimeout(torchToastTimerRef.current)
    }
  }, [selectedImage, currentSolution, nativeApp, startCamera, pauseCameraStream, resumeCameraStream, showCameraDenied])

  // Unmount'da stream'ni TO'LIQ to'xtatish (sahifadan chiqilganda kamera o'chadi)
  useEffect(() => () => {
    cameraRequestIdRef.current += 1
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
    if (torchToastTimerRef.current) clearTimeout(torchToastTimerRef.current)
    if (subjectScrollTimerRef.current) clearTimeout(subjectScrollTimerRef.current)
  }, [])

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

  // Handle capture from video stream or native camera fallback
  const handleShutterClick = () => {
    if (cameraState === 'active' && videoRef.current) {
      haptics.impact('medium')
      playSound('click')
      const video = videoRef.current
      const frame = captureVideoFrame(video)
      if (frame) {
        pauseCameraStream()
        setSelectedImage(frame.dataUrl)
        setCurrentSolution(null)
        void runSolve(frame.dataUrl, frame.mimeType)
        return
      }

      setCameraState('loading')
      setCameraErrorMessage(
        language === 'ru'
          ? 'Камера ещё готовит кадр. Если не сработает, откроется системная камера'
          : 'Kamera hali kadr tayyorlamadi. Ishlamasa, tizim kamerasi ochiladi'
      )
      void video.play().catch(() => {})
      window.setTimeout(() => cameraInputRef.current?.click(), 350)
      return
    } else {
      // Native system camera capture
      cameraInputRef.current?.click()
    }
  }

  // Camera flip (front/back) — boshqa qurilma = yangi stream (eskisini to'liq yopish shart,
  // aks holda reuse eski kamerani qaytarib beradi)
  const toggleFacingMode = () => {
    haptics.impact('light')
    stopCamera()
    const nextFacing = facingMode === 'environment' ? 'user' : 'environment'
    setFacingMode(nextFacing)
  }

  // Dual-mode torch (hardware LED + screen softbox light fallback)
  const toggleTorch = async () => {
    haptics.selection()
    const next = !isTorchOn
    const track = streamRef.current?.getVideoTracks()[0]
    let hardwareWorked = false

    if (track && typeof track.applyConstraints === 'function') {
      try {
        await (track as any).applyConstraints({
          advanced: [{ torch: next }],
        })
        hardwareWorked = true
      } catch (err) {
        console.warn('[Torch] Hardware applyConstraints failed:', err)
      }
    }

    if (next) {
      setIsTorchOn(true)
      if (hardwareWorked) {
        setTorchMode('hardware')
        setTorchToast(language === 'ru' ? 'Фонарик включен' : 'Chiroq yoqildi')
      } else {
        setTorchMode('screen')
        setTorchToast(language === 'ru' ? 'Подсветка экрана включена' : 'Ekran chirog‘i yoqildi')
      }
    } else {
      setIsTorchOn(false)
      setTorchMode(null)
      setTorchToast(language === 'ru' ? 'Фонарик выключен' : 'Chiroq o‘chirildi')
    }

    if (torchToastTimerRef.current) clearTimeout(torchToastTimerRef.current)
    torchToastTimerRef.current = setTimeout(() => {
      setTorchToast(null)
    }, 2400)
  }

  // Rasm tanlanganda siqish va zudlik bilan yechish
  const handleFile = async (file: File) => {
    try {
      setErrorMessage(null)
      setIsCompressing(true)
      pauseCameraStream()
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

  const handleReset = () => {
    setSelectedImage(null)
    setCurrentSolution(null)
    setErrorMessage(null)
  }

  // Fan karuseli: swipe tugagach markazga kelgan fan AVTOMATIK tanlanadi
  // (Snapchat/Instagram rejim selektori kabi — har birini bosish shart emas).
  // Scroll tinchigach (140ms debounce) markazga eng yaqin tugma topiladi.
  const handleSubjectScroll = useCallback(() => {
    const el = subjectScrollRef.current
    if (!el) return
    if (subjectScrollTimerRef.current) clearTimeout(subjectScrollTimerRef.current)
    subjectScrollTimerRef.current = setTimeout(() => {
      const buttons = Array.from(el.querySelectorAll<HTMLButtonElement>('[data-subject-id]'))
      if (buttons.length === 0) return
      const rect = el.getBoundingClientRect()
      const viewCenter = rect.left + el.clientWidth / 2
      const centers = buttons.map((b) => {
        const r = b.getBoundingClientRect()
        return r.left + r.width / 2
      })
      const idx = nearestCenterIndex(centers, viewCenter)
      const id = buttons[idx]?.dataset.subjectId ?? ''
      if (hintRef.current !== id) {
        hintRef.current = id
        setSubjectHint(id)
        haptics.selection()
      }
    }, 140)
  }, [])

  // Manual masala yozish (Kalkulyator orqali)
  const handleManualSolve = () => {    if (!manualText.trim() || isSolving) return
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
      pauseCameraStream()
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
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
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
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
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

        {/* Right Top Actions: Camera Flip, History & Calculator */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={toggleFacingMode}
            aria-label="Kamerani almashtirish"
            className="flex size-10 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-md border border-white/15 shadow-sm transition-all active:scale-90 hover:bg-black/60"
          >
            <FlipHorizontal size={18} strokeWidth={2} />
          </button>

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
        {/* Torch status notification toast */}
        {torchToast && (
          <div className="pointer-events-none absolute top-4 inset-x-0 flex justify-center z-40 animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="px-3.5 py-1.5 rounded-full bg-black/80 backdrop-blur-md border border-white/20 text-white text-xs font-medium shadow-xl flex items-center gap-2">
              <Flashlight
                size={14}
                className={isTorchOn ? 'text-amber-400 fill-amber-400' : 'text-white'}
              />
              <span>{torchToast}</span>
            </div>
          </div>
        )}

        {/* Video stream */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          onLoadedMetadata={() => {
            if (videoRef.current) {
              videoRef.current.play().then(() => setCameraState('active')).catch(() => {})
            }
          }}
          onPlaying={() => {
            setCameraState('active')
          }}
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-150 ${
            cameraState === 'active' ? 'opacity-100' : 'opacity-0'
          }`}
        />

        {/* Screen Torch (Ekran Chirog'i) Softbox Lighting Frame */}
        {isTorchOn && torchMode === 'screen' && !selectedImage && !currentSolution && (
          <div className="pointer-events-none absolute inset-0 z-20 border-[16px] sm:border-[24px] border-white/95 shadow-[inset_0_0_90px_rgba(255,255,255,1),0_0_70px_rgba(255,255,255,0.85)] animate-in fade-in duration-200" />
        )}

        {/* Center subtle crosshair from screenshot */}
        {!selectedImage && !currentSolution && cameraState === 'active' && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="relative flex items-center justify-center">
              <div className="h-6 w-[2px] bg-white/80 rounded-full shadow-sm" />
              <div className="absolute w-6 h-[2px] bg-white/80 rounded-full shadow-sm" />
            </div>
          </div>
        )}

        {/* Loading HUD: Camera initializing or permission pending */}
        {!nativeApp && (cameraState === 'checking' || cameraState === 'loading') && !selectedImage && !currentSolution && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-slate-950/80 p-6 text-center animate-in fade-in duration-200">
            <div className="relative flex size-20 items-center justify-center mb-4">
              <div className="absolute inset-0 rounded-full border-2 border-rose-500/40 animate-ping" />
              <div className="flex size-14 items-center justify-center rounded-2xl bg-white/10 text-white backdrop-blur-md border border-white/15 shadow-xl">
                <Camera size={28} className="animate-pulse text-rose-400" />
              </div>
            </div>
            <h2 className="text-base font-semibold text-white mb-1">
              {language === 'ru' ? 'Подключение камеры...' : 'Kamera ishga tushmoqda...'}
            </h2>
            <p className="text-xs text-white/70 max-w-xs mb-5">
              {language === 'ru'
                ? cameraState === 'checking'
                  ? 'Проверяем разрешение камеры...'
                  : 'Камера запускается...'
                : cameraState === 'checking'
                  ? 'Kamera ruxsati tekshirilmoqda...'
                  : 'Kamera ishga tushmoqda...'}
            </p>
            <div className="flex gap-2.5">
              <button
                type="button"
                onClick={() => galleryInputRef.current?.click()}
                className="px-4 py-2.5 rounded-xl bg-white/15 hover:bg-white/25 text-white text-xs font-semibold backdrop-blur-md transition-all active:scale-95"
              >
                {language === 'ru' ? 'Выбрать фото' : 'Rasm tanlash'}
              </button>
            </div>
          </div>
        )}

        {/* Permission prompt is intentionally user-initiated to avoid repeated WebView popups. */}
        {!nativeApp && cameraState === 'prompt' && !selectedImage && !currentSolution && (
          <div
            data-testid="camera-permission-prompt"
            className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black p-6 text-center animate-in fade-in duration-200"
          >
            <div className="flex size-16 items-center justify-center rounded-3xl bg-white/10 text-white mb-3 backdrop-blur-md border border-white/10 shadow-lg">
              <Camera size={32} strokeWidth={1.75} className="text-rose-400" />
            </div>
            <h2 className="text-base font-semibold text-white mb-1.5">
              {language === 'ru' ? 'Включить камеру?' : 'Kamerani yoqasizmi?'}
            </h2>
            <p className="text-xs text-white/70 max-w-xs mb-5 leading-relaxed">
              {language === 'ru'
                ? 'Разрешение будет запрошено только после нажатия кнопки'
                : 'Kamera ruxsati faqat tugmani bosganingizdan keyin so‘raladi'}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2.5">
              <button
                type="button"
                onClick={() => void startCamera()}
                className="px-4 py-2.5 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-xs font-semibold shadow-lg shadow-rose-500/30 transition-all active:scale-95"
              >
                {language === 'ru' ? 'Включить камеру' : 'Kamerani yoqish'}
              </button>
              <button
                type="button"
                onClick={() => galleryInputRef.current?.click()}
                className="px-4 py-2.5 rounded-xl bg-white/15 hover:bg-white/25 text-white text-xs font-semibold backdrop-blur-md transition-all active:scale-95"
              >
                {language === 'ru' ? 'Выбрать фото' : 'Rasm tanlash'}
              </button>
            </div>
          </div>
        )}

        {/* Fallback if camera denied / unsupported / error */}
        {(cameraState === 'denied' || cameraState === 'unsupported' || cameraState === 'error') &&
          !selectedImage &&
          !currentSolution && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black p-6 text-center animate-in fade-in duration-200">
              <div className="flex size-16 items-center justify-center rounded-3xl bg-white/10 text-white mb-3 backdrop-blur-md border border-white/10 shadow-lg">
                <Camera size={32} strokeWidth={1.75} className="text-rose-400" />
              </div>
              <h2 className="text-base font-semibold text-white mb-1.5">
                {language === 'ru' ? 'Камера не доступна' : 'Kamera faol emas'}
              </h2>
              <p className="text-xs text-white/70 max-w-xs mb-5 leading-relaxed">
                {cameraErrorMessage ||
                  (language === 'ru'
                    ? 'Разрешите доступ к камере или выберите фото из галереи'
                    : 'Kameraga ruxsat bering yoki galereyadan rasm tanlang')}
              </p>
              <div className="flex flex-wrap items-center justify-center gap-2.5">
                <button
                  type="button"
                  onClick={() => void startCamera()}
                  className="px-4 py-2.5 rounded-xl bg-white/15 hover:bg-white/25 text-white text-xs font-semibold backdrop-blur-md transition-all active:scale-95"
                >
                  {language === 'ru' ? 'Повторить' : 'Qayta urinish'}
                </button>
                <button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  className="px-4 py-2.5 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-xs font-semibold shadow-lg shadow-rose-500/30 transition-all active:scale-95"
                >
                  {language === 'ru' ? 'Снять на камеру' : 'Tizim kamerasidan olish'}
                </button>
                <button
                  type="button"
                  onClick={() => galleryInputRef.current?.click()}
                  className="px-4 py-2.5 rounded-xl bg-white/15 hover:bg-white/25 text-white text-xs font-semibold backdrop-blur-md transition-all active:scale-95"
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
          <div className="absolute top-[calc(1rem+var(--safe-top,0px))] inset-x-4 z-30 p-3.5 rounded-2xl bg-red-950/90 border border-red-500/50 text-red-200 text-xs flex items-center justify-between gap-3 shadow-lg backdrop-blur-md">
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
                  <p className="text-[rgb(var(--p-muted-rgb)/0.8)] italic leading-relaxed">{currentSolution.ocrText}</p>
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
          {/* Horizontal Subject Carousel — swipe'da markazdagi fan avtomatik tanlanadi */}
          <div
            className="w-full overflow-x-auto no-scrollbar snap-x snap-proximity py-2 px-4 mb-2"
            ref={subjectScrollRef}
            onScroll={handleSubjectScroll}
          >
            <div className="flex items-center justify-start gap-5 min-w-max px-2">
              {SUBJECT_OPTIONS.map((sub) => {
                const isSelected = subjectHint === sub.id
                const label = language === 'ru' ? sub.nameRu : sub.nameUz
                return (
                  <button
                    key={sub.id}
                    type="button"
                    data-subject-id={sub.id}
                    aria-pressed={isSelected}
                    onClick={() => {
                      hintRef.current = sub.id
                      setSubjectHint(sub.id)
                      haptics.selection()
                    }}
                    className={`transition-all text-center select-none min-h-11 py-1 px-1.5 snap-center ${
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
                  ? 'bg-amber-400 text-slate-950 border-amber-300 shadow-lg shadow-amber-400/50 scale-105'
                  : 'bg-black/50 text-white border-white/20 shadow-lg hover:bg-black/70'
              }`}
            >
              <Flashlight
                size={22}
                strokeWidth={1.9}
                className={isTorchOn ? 'fill-slate-950 text-slate-950' : ''}
              />
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
              className="w-full rounded-2xl bg-psurface p-3 text-base text-pfg placeholder:text-pmuted focus:outline-none focus:ring-2 focus:ring-pprimary resize-none"
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
                  className="w-full text-left p-3 rounded-2xl bg-psurface hover:bg-[rgb(var(--p-surface-rgb)/0.8)] transition-all flex items-center justify-between gap-3 shadow-2xs active:scale-[0.98]"
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
