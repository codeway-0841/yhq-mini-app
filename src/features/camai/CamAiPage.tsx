/**
 * CamAi — kamera orqali sinfda ADOLATLI tasodifiy tanlov o'yini.
 * (BilimAi CamAi g'oyasining KIVVI implementatsiyasi.)
 *
 * CLIENT-ONLY o'yin: hisob/iqtisod serverga yozilmaydi (belgilar o'yini
 * pattern'i). Yuzlar on-device aniqlanadi (MediaPipe WASM) — video hech qayerga
 * yuborilmaydi, biometrik ma'lumot saqlanmaydi, slotlar anonim.
 *
 * Savollar: (1) KIVVI savol banki — UMUMIY useQuestionsStore orqali
 * (R2/Worker + IndexedDB kesh; correctAnswer'siz — javobni o'qituvchi
 * baholaydi, scoring trust boundary buzilmaydi) yoki (2) o'qituvchi
 * yozgan erkin savollar (localStorage 'yhq-camai-custom').
 *
 * Kamera bo'lmasa/ruxsat berilmasa — kamerasiz rejim (raqamli slotlar).
 */
import { useCallback, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, Dices, Loader2, Shuffle, Trophy, Users, X } from 'lucide-react'
import { type Question } from '@/shared/api'
import { useAppStore } from '@/shared/store/useAppStore'
import { useQuestionsStore } from '@/shared/store/useQuestionsStore'
import { useT } from '@/shared/i18n'
import { useToast } from '@/shared/components/ToastContainer'
import { PageHeader } from '@/shared/components/ui/page-header'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Dialog, DialogHeader, DialogTitle, DialogBody, DialogFooter } from '@/shared/components/ui/dialog'
import { goBack } from '@/shared/lib/navigation'
import { playSound } from '@/shared/lib/sounds'
import { SUBJECTS } from '@/shared/config/subjects'
import { cn } from '@/shared/lib/cn'
import {
  roulettePlan,
  applyMark,
  ranking,
  parseCustomQuestions,
  computeFaceCrop,
  shuffled,
  drawNext,
  type CamAiQuestion,
  type Slot,
  type SlotStats,
} from './camai-logic'
import { useFaceDetection } from './useFaceDetection'
import CameraStage from './components/CameraStage'

const CUSTOM_KEY = 'yhq-camai-custom'

type Phase = 'setup' | 'game'
type GameStep = 'idle' | 'roulette' | 'question' | 'done'

/** Store'dagi til-mapping qilingan savol → CamAi savoli.
 *  Store allaqachon joriy tilda map qilgan (load ichida) — qayta til
 *  tanlash shart emas. answer har doim null (bank kaliti client'ga
 *  chiqmaydi — scoring trust boundary). */
function questionToCamAi(q: Question): CamAiQuestion {
  return {
    id: `bank-${q.id}`,
    text: q.text,
    options: q.options.map((o) => o.text),
    image: q.image,
    answer: null,
  }
}

function readCustom(): string {
  try { return localStorage.getItem(CUSTOM_KEY) ?? '' } catch { return '' }
}

export default function CamAiPage() {
  const navigate = useNavigate()
  const lang = useAppStore((s) => s.settings.language)
  const tt = useT(lang)
  const { error: showError } = useToast()

  // ── Setup holati ──────────────────────────────────────────────────────────
  const [phase, setPhase] = useState<Phase>('setup')
  const [source, setSource] = useState<'bank' | 'custom'>('bank')
  const [subjectId, setSubjectId] = useState<string>(SUBJECTS[0].id)
  const [customText, setCustomText] = useState(readCustom)
  const [loading, setLoading] = useState(false)

  const availableSubjects = useMemo(() => SUBJECTS.filter((s) => s.available), [])
  const customCount = useMemo(() => parseCustomQuestions(customText).length, [customText])

  // ── O'yin holati ──────────────────────────────────────────────────────────
  // CHEKSIZ rejim: savollar tugamaydi (deck tugasa pool qayta aralashadi) —
  // o'qituvchi o'yinni "Yakunlash" tugmasi bilan o'zi to'xtatadi.
  const [pool, setPool] = useState<CamAiQuestion[]>([])
  const [current, setCurrent] = useState<CamAiQuestion | null>(null)
  const [answered, setAnswered] = useState(0)
  const [scores, setScores] = useState<Record<number, SlotStats>>({})
  const [step, setStep] = useState<GameStep>('idle')
  const [winnerSlotId, setWinnerSlotId] = useState<number | null>(null)
  const [highlightSlotId, setHighlightSlotId] = useState<number | null>(null)
  /** G'olib yuzining kadrdan qirqilgan fotosi (data URL; kamerasiz rejimda null) */
  const [winnerPhoto, setWinnerPhoto] = useState<string | null>(null)
  /** Custom savol kutilgan javobi — ekran proyektorda bo'lsa yashirin turadi */
  const [showAnswer, setShowAnswer] = useState(false)
  const [cameraMode, setCameraMode] = useState(true)
  const [manualCount, setManualCount] = useState(10)

  const videoRef = useRef<HTMLVideoElement>(null)
  const { slots: camSlots, status: camStatus, photos } = useFaceDetection(videoRef, phase === 'game' && cameraMode)

  // O'quvchi ismlari (ixtiyoriy — slot ustiga bosib yoziladi, sessiya xotirasida)
  const [names, setNames] = useState<Record<number, string>>({})
  const [renamingId, setRenamingId] = useState<number | null>(null)
  const [nameDraft, setNameDraft] = useState('')

  // Kamerasiz rejim — sintetik raqamli slotlar
  const manualSlots = useMemo<Slot[]>(
    () => Array.from({ length: manualCount }, (_, i) => ({ id: i + 1, box: { x: 0, y: 0, width: 0, height: 0 }, missed: 0 })),
    [manualCount],
  )
  const slots = cameraMode ? camSlots : manualSlots

  // Kamera ruxsati berilmasa — kamerasiz rejimni taklif qilamiz (avtomatik emas)
  const cameraFailed = camStatus === 'denied' || camStatus === 'error'

  const rouletteTimers = useRef<number[]>([])
  // Cheksiz deck ref'lari — ruletka timer'i ichida stale-closure'siz o'qiladi
  const deckRef = useRef<CamAiQuestion[]>([])
  const lastQuestionIdRef = useRef<string | null>(null)

  const clearRouletteTimers = useCallback(() => {
    rouletteTimers.current.forEach((t) => window.clearTimeout(t))
    rouletteTimers.current = []
  }, [])

  // ── Setup → Game ─────────────────────────────────────────────────────────
  const start = useCallback(async () => {
    let questions: CamAiQuestion[]
    if (source === 'custom') {
      questions = parseCustomQuestions(customText)
      if (questions.length === 0) {
        showError(tt('camaiCustomEmpty'))
        return
      }
      try { localStorage.setItem(CUSTOM_KEY, customText) } catch { /* private mode */ }
    } else {
      // Savol banki — UMUMIY store orqali (R2/Worker yo'li + IndexedDB kesh).
      // To'g'ridan-to'g'ri api.getQuestions() chaqirilsa legacy full-bank
      // endpoint'ga tushib Neon egress yeydi (2026-09-24 CamAi bypass fix).
      // retry() — "Boshlash" foydalanuvchi harakati: oldingi muvaffaqiyatsiz
      // urinishdan keyin ham qayta urinadi; yuklangan bank bo'lsa fetch YO'Q.
      setLoading(true)
      try {
        await useQuestionsStore.getState().retry(lang, subjectId)
      } finally {
        setLoading(false)
      }
      const bank = useQuestionsStore.getState()
      if (!bank.loaded || bank.subjectId !== subjectId || bank.questions.length === 0) {
        showError(tt(bank.error ? 'camaiLoadError' : 'camaiBankEmpty'))
        return
      }
      questions = bank.questions.map(questionToCamAi)
    }
    clearRouletteTimers()
    setPool(questions)
    deckRef.current = shuffled(questions)
    lastQuestionIdRef.current = null
    setCurrent(null)
    setAnswered(0)
    setScores({})
    setNames({})
    setStep('idle')
    setWinnerSlotId(null)
    setWinnerPhoto(null)
    setHighlightSlotId(null)
    setPhase('game')
  }, [source, customText, subjectId, lang, tt, showError, clearRouletteTimers])

  // ── Tasodifiy tanlov (ruletka) ────────────────────────────────────────────
  /** G'olib slot yuzini joriy kadrdan qirqib oladi ("rasmga olish"). */
  const captureWinnerFace = useCallback((slot: Slot): string | null => {
    const video = videoRef.current
    if (!video || video.videoWidth === 0) return null
    const rect = computeFaceCrop(slot.box, video.videoWidth, video.videoHeight)
    if (!rect || rect.size < 8) return null
    const canvas = document.createElement('canvas')
    canvas.width = rect.size
    canvas.height = rect.size
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    ctx.drawImage(video, rect.x, rect.y, rect.size, rect.size, 0, 0, rect.size, rect.size)
    try {
      return canvas.toDataURL('image/jpeg', 0.85)
    } catch {
      return null
    }
  }, [])

  const pick = useCallback(() => {
    if (step === 'roulette' || slots.length === 0) return
    const plan = roulettePlan(slots.length)
    if (!plan) return
    setStep('roulette')
    setWinnerSlotId(null)
    setWinnerPhoto(null)
    playSound('click')
    const total = plan.sequence.length
    plan.sequence.forEach((slotIdx, i) => {
      // Sekinlashuv effekti: kvadratik o'suvchi interval
      const t = 60 * i + (220 * i * i) / total
      const timer = window.setTimeout(() => {
        setHighlightSlotId(slots[slotIdx]?.id ?? null)
        if (i === total - 1) {
          const winner = slots[slotIdx]
          setWinnerSlotId(winner?.id ?? null)
          setHighlightSlotId(null)
          if (winner && cameraMode) setWinnerPhoto(captureWinnerFace(winner))
          // Cheksiz deck'dan keyingi savol (tugasa pool qayta aralashadi)
          const r = drawNext(pool, deckRef.current, lastQuestionIdRef.current)
          deckRef.current = r.deck
          lastQuestionIdRef.current = r.question?.id ?? null
          setCurrent(r.question)
          setShowAnswer(false)
          setStep('question')
          playSound('win')
        }
      }, t)
      rouletteTimers.current.push(timer)
    })
  }, [step, slots, cameraMode, captureWinnerFace, pool])

  // ── O'qituvchi baholaydi ──────────────────────────────────────────────────
  const mark = useCallback((correct: boolean) => {
    if (step !== 'question' || winnerSlotId === null) return
    setScores((s) => applyMark(s, winnerSlotId, correct))
    playSound(correct ? 'success' : 'error')
    setWinnerSlotId(null)
    setWinnerPhoto(null)
    setCurrent(null)
    setShowAnswer(false)
    setAnswered((n) => n + 1)
    setStep('idle')
  }, [step, winnerSlotId])

  // ── O'yinni yakunlash (o'qituvchi o'zi to'xtatadi — cheksiz rejim) ────────
  const finish = useCallback(() => {
    clearRouletteTimers()
    setStep('done')
    playSound('win')
  }, [clearRouletteTimers])

  const backToSetup = useCallback(() => {
    clearRouletteTimers()
    setPhase('setup')
    setStep('idle')
    setWinnerSlotId(null)
    setWinnerPhoto(null)
    setHighlightSlotId(null)
  }, [clearRouletteTimers])

  const currentQuestion = current
  const ranks = useMemo(() => ranking(scores), [scores])

  /** Slot ko'rsatma nomi: yozilgan ism YOKI "O'quvchi N" */
  const slotLabel = useCallback((id: number) => names[id]?.trim() || `${tt('camaiStudent')} ${id}`, [names, tt])

  const openRename = useCallback((id: number) => {
    setNameDraft(names[id] ?? '')
    setRenamingId(id)
  }, [names])

  const saveRename = useCallback(() => {
    if (renamingId === null) return
    const v = nameDraft.trim()
    setNames((n) => {
      const next = { ...n }
      if (v) next[renamingId] = v
      else delete next[renamingId]
      return next
    })
    setRenamingId(null)
    playSound('click')
  }, [renamingId, nameDraft])

  // ── SETUP ─────────────────────────────────────────────────────────────────
  if (phase === 'setup') {
    return (
      <div className="px-4">
        {/* size="md" (default): CamAi — back'li ichki sahifa, tab-root emas.
            size="lg" (2026-09-24 shell restyle) sticky header'ni shishirib,
            desktop panel scrollport'da manba tugmalarini header ostiga
            tiqib qo'ygandi — Playwright "subtree intercepts pointer events"
            bilan yiqilgan (UI kontrakt: lg = back'SIZ tab-root). */}
        <PageHeader title={tt('camaiTitle')} subtitle={tt('camaiSubtitle')} onBack={() => goBack(navigate)} className="-mx-4 mb-4" />

        {/* Manba tanlash — scroll-mt: brauzer/Playwright scrollIntoView
            tugmani sticky header ostiga park qilmasligi uchun (real user:
            klaviatura fokusi ham header ostida qolmaydi). Vizualga ta'sir
            qilmaydi (faqat scroll pozitsiyasi). */}
        <div className="mb-4 grid scroll-mt-24 grid-cols-2 gap-2">
          {(['bank', 'custom'] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSource(s)}
              className={cn(
                'rounded-2xl px-4 py-3 text-[14px] font-semibold shadow-2xs transition-colors',
                source === s ? 'bg-pprimary text-ponprimary' : 'bg-psurface text-pmuted hover:bg-pcard',
              )}
            >
              {s === 'bank' ? tt('camaiSourceBank') : tt('camaiSourceCustom')}
            </button>
          ))}
        </div>

        {source === 'bank' ? (
          <>
            <p className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-psubtle">{tt('camaiSubject')}</p>
            <div className="mb-4 flex flex-wrap gap-2">
              {availableSubjects.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSubjectId(s.id)}
                  className={cn(
                    'rounded-xl px-3.5 py-2 text-[13px] font-semibold shadow-2xs transition-colors',
                    subjectId === s.id ? 'bg-pprimary text-ponprimary' : 'bg-psurface text-pfg hover:bg-pcard',
                  )}
                >
                  {lang === 'ru' ? s.nameRu : s.name}
                </button>
              ))}
            </div>
            <p className="mb-4 rounded-2xl bg-psurface px-4 py-3 text-[12.5px] leading-snug text-pmuted shadow-2xs">
              {tt('camaiBankNote')}
            </p>
          </>
        ) : (
          <>
            <textarea
              value={customText}
              onChange={(e) => setCustomText(e.target.value)}
              placeholder={tt('camaiCustomPlaceholder')}
              rows={8}
              className="mb-2 w-full resize-none rounded-2xl bg-psurface px-4 py-3 text-[14px] text-pfg shadow-2xs outline-none focus:ring-2 focus:ring-pprimary"
            />
            <p className="mb-4 text-[12.5px] text-pmuted">
              {customCount} {tt('camaiCustomCount')}
            </p>
          </>
        )}

        <Button block size="lg" onClick={() => void start()} disabled={loading}>
          {loading ? <Loader2 className="animate-spin" /> : <Shuffle />}
          {loading ? tt('camaiBankLoading') : tt('camaiStart')}
        </Button>
        <p className="mt-3 text-center text-[12.5px] text-psubtle">{tt('camaiEndlessHint')}</p>
      </div>
    )
  }

  // ── GAME ──────────────────────────────────────────────────────────────────
  return (
    <div className="px-4">
      <PageHeader
        title={tt('camaiTitle')}
        subtitle={`${answered} ${tt('camaiQuestionOf')}`}
        onBack={backToSetup}
        className="-mx-4 mb-3"
      />

      {/* Sahnа: kamera YOKI kamerasiz slotlar */}
      {cameraMode ? (
        <CameraStage
          videoRef={videoRef}
          status={camStatus}
          slots={camSlots}
          highlightSlotId={highlightSlotId}
          winnerSlotId={winnerSlotId}
          labels={{
            loading: tt('camaiCameraLoading'),
            request: tt('camaiCameraRequest'),
            denied: tt('camaiCameraDenied'),
            error: tt('camaiCameraError'),
          }}
        />
      ) : (
        <div className="grid grid-cols-5 gap-2 rounded-2xl bg-pcard p-3 shadow-xs">
          {manualSlots.map((s) => {
            const active = s.id === highlightSlotId || s.id === winnerSlotId
            return (
              <div
                key={s.id}
                className={cn(
                  'grid aspect-square place-items-center rounded-xl text-[16px] font-bold shadow-2xs transition-all duration-150',
                  s.id === winnerSlotId
                    ? 'bg-pgold text-pongold scale-110'
                    : active
                      ? 'bg-pprimary text-ponprimary scale-105'
                      : 'bg-psurface text-pfg',
                )}
              >
                {s.id}
              </div>
            )
          })}
        </div>
      )}

      {/* Kamera xatosi — kamerasiz rejimga o'tish */}
      {cameraMode && cameraFailed && (
        <div className="mt-3 rounded-2xl bg-pcard p-4 shadow-xs">
          <p className="mb-1 text-[14px] font-semibold text-pfg">{tt('camaiManualMode')}</p>
          <p className="mb-3 text-[12.5px] text-pmuted">{tt('camaiManualHint')}</p>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={2}
              max={30}
              value={manualCount}
              onChange={(e) => setManualCount(Math.max(2, Math.min(30, Number(e.target.value) || 2)))}
              className="h-11 w-24 rounded-xl bg-psurface px-3 text-center text-[15px] font-bold text-pfg shadow-2xs outline-none focus:ring-2 focus:ring-pprimary"
              aria-label={tt('camaiStudentsCount')}
            />
            <Button variant="secondary" onClick={() => setCameraMode(false)}>
              <Users />
              {tt('camaiManualStart')}
            </Button>
          </div>
        </div>
      )}

      {/* Jonli reyting taxtasi (saralangan: ko'p ✓ → kam ✗); chip'ga bosish — ism yozish */}
      {ranks.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {ranks.map((r, i) => (
            <button
              key={r.slotId}
              type="button"
              onClick={() => openRename(r.slotId)}
              className={cn(
                'flex items-center gap-1.5 rounded-full py-1 pl-1 pr-2.5 text-[11.5px] font-semibold shadow-2xs transition-transform active:scale-95',
                i === 0 && r.correct > 0
                  ? 'bg-[rgb(var(--p-gold-rgb)/0.18)] text-pgold'
                  : 'bg-pcard text-pmuted',
              )}
            >
              {photos[r.slotId] ? (
                <img src={photos[r.slotId]} alt="" className="size-6 rounded-full object-cover" />
              ) : (
                <span className="grid size-6 place-items-center rounded-full bg-psurface text-[10px] font-bold text-pfg">{r.slotId}</span>
              )}
              {slotLabel(r.slotId)}: <span className="text-psuccess">{r.correct}✓</span>
              {r.wrong > 0 && <span className="text-pdanger">{r.wrong}✗</span>}
            </button>
          ))}
        </div>
      )}

      {/* Savol kartasi / tanlash tugmasi / yakun */}
      {step === 'done' ? (
        <div className="mt-4 rounded-2xl bg-pcard p-5 shadow-xs">
          <Trophy className="mx-auto mb-2 size-9 text-pgold" />
          <p className="text-center text-[17px] font-bold text-pfg">{tt('camaiFinished')}</p>

          {/* To'liq reyting jadvali */}
          {ranks.length > 0 ? (
            <div className="mt-4">
              <p className="mb-2 text-[12px] font-bold uppercase tracking-wide text-psubtle">{tt('camaiRating')}</p>
              <div className="overflow-hidden rounded-2xl bg-psurface shadow-2xs divide-y divide-pline">
                {ranks.map((r, i) => (
                  <div key={r.slotId} className="flex items-center gap-3 px-4 py-2.5">
                    <span className="w-7 text-center text-[15px] font-black">
                      {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : <span className="text-psubtle">{i + 1}</span>}
                    </span>
                    {photos[r.slotId] ? (
                      <img src={photos[r.slotId]} alt="" className="size-9 rounded-full object-cover shadow-2xs" />
                    ) : (
                      <span className="grid size-9 place-items-center rounded-full bg-pcard text-[12px] font-bold text-pfg shadow-2xs">{r.slotId}</span>
                    )}
                    <span className="flex-1 truncate text-left text-[14px] font-semibold text-pfg">
                      {slotLabel(r.slotId)}
                    </span>
                    <span className="text-[13px] font-bold text-psuccess">{r.correct}✓</span>
                    <span className="text-[13px] font-bold text-pdanger">{r.wrong}✗</span>
                    <span className="w-11 text-right text-[12px] font-semibold tabular-nums text-pmuted">{r.accuracy}%</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="mt-2 text-[13.5px] text-pmuted">{tt('camaiNoMarks')}</p>
          )}

          <div className="mt-4 flex gap-2">
            <Button block variant="secondary" onClick={() => void start()}>
              {tt('camaiRestart')}
            </Button>
            <Button block variant="ghost" onClick={backToSetup}>
              {tt('camaiNewSetup')}
            </Button>
          </div>
        </div>
      ) : step === 'question' && currentQuestion ? (
        <div className="mt-4 rounded-2xl bg-pcard p-5 shadow-xs motion-safe:animate-premiumIn">
          {/* G'olib — katta foto (kamera) yoki raqam (kamerasiz) */}
          <div className="mb-3 flex justify-center">
            {winnerPhoto ? (
              <img
                src={winnerPhoto}
                alt={`${tt('camaiStudent')} ${winnerSlotId}`}
                className="size-36 rounded-2xl object-cover shadow-md ring-4 ring-[rgb(var(--p-gold-rgb)/0.5)]"
              />
            ) : (
              <div className="grid size-24 place-items-center rounded-2xl bg-pgold text-4xl font-black text-pongold shadow-md">
                {winnerSlotId}
              </div>
            )}
          </div>
          <p className="mb-1 text-center text-[13px] font-bold uppercase tracking-wide text-pgold">
            {winnerSlotId !== null ? slotLabel(winnerSlotId) : ''}
          </p>
          <p className="text-[16px] font-semibold leading-snug text-pfg">{currentQuestion.text}</p>
          {currentQuestion.image && (
            <img src={currentQuestion.image} alt="" className="mt-3 max-h-44 rounded-xl object-contain" />
          )}
          {currentQuestion.options.length > 0 && (
            <ul className="mt-3 space-y-1.5">
              {currentQuestion.options.map((opt, i) => (
                <li key={i} className="rounded-xl bg-psurface px-3.5 py-2.5 text-[14px] text-pfg shadow-2xs">
                  {opt}
                </li>
              ))}
            </ul>
          )}
          {/* Kutilgan javob (custom) — proyektorda o'quvchilarga ko'rinmasligi
              uchun toggle ortida; faqat o'qituvchi ochadi */}
          {currentQuestion.answer && (
            <div className="mt-3">
              {showAnswer ? (
                <button
                  type="button"
                  onClick={() => setShowAnswer(false)}
                  className="w-full rounded-xl bg-[rgb(var(--p-gold-rgb)/0.15)] px-3.5 py-2.5 text-left shadow-2xs"
                >
                  <span className="text-[11px] font-bold uppercase tracking-wide text-pgold">{tt('camaiAnswerLabel')}: </span>
                  <span className="text-[14px] font-semibold text-pfg">{currentQuestion.answer}</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowAnswer(true)}
                  className="w-full rounded-xl bg-psurface px-3.5 py-2.5 text-[13px] font-semibold text-pmuted shadow-2xs transition-colors hover:bg-pcard"
                >
                  {tt('camaiShowAnswer')}
                </button>
              )}
            </div>
          )}
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Button size="lg" onClick={() => mark(true)}>
              <Check />
              {tt('camaiCorrect')}
            </Button>
            <Button size="lg" variant="destructive" onClick={() => mark(false)}>
              <X />
              {tt('camaiWrong')}
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-4">
          <Button block size="lg" onClick={pick} disabled={step === 'roulette' || slots.length === 0}>
            {step === 'roulette' ? <Loader2 className="animate-spin" /> : <Dices />}
            {tt('camaiPickRandom')}
          </Button>
          {cameraMode && camStatus === 'running' && slots.length === 0 && (
            <p className="mt-2 text-center text-[12.5px] text-pmuted">
              {tt('camaiNoFaces')} — {tt('camaiNoFacesHint')}
            </p>
          )}
          <Button block variant="ghost" className="mt-2" onClick={finish}>
            <Trophy />
            {tt('camaiFinish')}
          </Button>
        </div>
      )}

      {/* Ism yozish dialogi — scoreboard chip'iga bosilganda */}
      {renamingId !== null && (
        <Dialog open onClose={() => setRenamingId(null)} className="max-w-xs">
          <DialogHeader>
            <DialogTitle>{tt('camaiRename')}</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <Input
              autoFocus
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') saveRename() }}
              placeholder={`${tt('camaiStudent')} ${renamingId}`}
              maxLength={30}
            />
          </DialogBody>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRenamingId(null)}>{tt('camaiCancel')}</Button>
            <Button onClick={saveRename}>{tt('camaiSave')}</Button>
          </DialogFooter>
        </Dialog>
      )}
    </div>
  )
}
