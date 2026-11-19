import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { ArrowRight, ChevronLeft, HelpCircle, Play, Volume2, VolumeX } from 'lucide-react'
import { modules } from '../../content/modules'
import { lessons } from '../../content/lessons'
import videosData from '../../content/videos.yhq.json'
import { useAppStore } from '../../shared/store/useAppStore'
import { useT } from '../../shared/i18n'
import { registerModal } from '../../shared/lib/navigation'
import { isSpeaking, speak, stopSpeaking, subscribeSpeaking } from '../../shared/lib/speech'
import { Button } from '../../shared/components/ui/button'
import {
  BrilliantExitDialog,
  BrilliantReaderHeader,
  BrilliantStagePill,
  type BrilliantLessonStage,
} from '../../shared/components/BrilliantLessonChrome'
import { PathMascot } from './LessonToken'
import { getModuleIcon } from './module-icons'
import { canReadLesson } from './lesson-access'
import './lesson-reader.css'

type Mod = typeof modules[number]
type VideoInfo = { vimeoId: string; poster: string; title: string }

export default function LessonReader({ mod, lessonIdx, onClose, onDone, onPractice, onPremium }: {
  mod: Mod
  lessonIdx: number
  onClose: () => void
  onDone: (idx: number) => void
  onPractice: (idx: number) => void
  onPremium: () => void
}) {
  const [idx, setIdx] = useState(lessonIdx)
  const [step, setStep] = useState(0)
  const [showExitConfirm, setShowExitConfirm] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const settings = useAppStore((state) => state.settings)
  const premium = useAppStore((state) => state.tariff === 'premium')
  const speaking = useSyncExternalStore(subscribeSpeaking, isSpeaking, () => false)
  const tt = useT(settings.language)
  const ru = settings.language === 'ru'
  const lesson = (lessons[mod.id] ?? [])[idx]
  const paragraphs = (ru ? lesson?.bodyRu : lesson?.bodyUz) ?? []
  const stepCount = Math.max(1, paragraphs.length) + 1
  const isFinal = step === stepCount - 1
  const title = lesson ? (ru ? lesson.titleRu : lesson.titleUz) : ''
  const ordinal = tt('darslikLessonOrdinal').replace('{n}', String(idx + 1))
  const video = (videosData as Record<string, VideoInfo | undefined>)[`${mod.id}:${idx}`]
  const allowed = canReadLesson(premium, mod.id, idx)
  const onCloseRef = useRef(onClose)
  const onPremiumRef = useRef(onPremium)
  onCloseRef.current = onClose
  onPremiumRef.current = onPremium

  useEffect(() => { if (!allowed) onPremiumRef.current() }, [allowed])
  useEffect(() => {
    const unregister = registerModal(Symbol('lesson-reader'), () => onCloseRef.current())
    return () => { unregister(); stopSpeaking() }
  }, [])
  useEffect(() => { stopSpeaking(); setIsPlaying(false) }, [idx, step])

  if (!lesson || !allowed) return null

  const advance = () => {
    if (!isFinal) { setStep((value) => value + 1); return }
    onDone(idx)
    const next = idx + 1
    if (next >= (lessons[mod.id] ?? []).length) { onClose(); return }
    if (!canReadLesson(premium, mod.id, next)) { onPremium(); return }
    setIdx(next)
    setStep(0)
  }
  const spokenText = isFinal ? tt('darslikPracticeHint') : `${title}. ${paragraphs[step] ?? ''}`
  const LessonIcon = getModuleIcon(mod.id)
  const stage: BrilliantLessonStage = isFinal ? 'synthesis' : step === 0 ? 'intro' : 'concept'
  const handleRequestClose = () => {
    stopSpeaking()
    if (step > 0 && !isFinal) {
      setShowExitConfirm(true)
      return
    }
    onClose()
  }

  return (
    <div className="lesson-reader fixed inset-0 z-50 flex flex-col bg-pcanvas text-pfg">
      <BrilliantReaderHeader
        onClose={handleRequestClose}
        closeLabel={tt('darslikClose')}
        current={step + 1}
        total={stepCount}
        progressLabel={tt('darslikStepProgress')}
        hot={isFinal}
        trailing={
          <button
            type="button"
            className="grid size-9 shrink-0 cursor-pointer place-items-center rounded-full bg-psurface text-pfg transition-opacity hover:opacity-85"
            onClick={() => (speaking ? stopSpeaking() : speak(spokenText, settings.language))}
            aria-label={speaking ? tt('darslikStopAudio') : tt('darslikListen')}
          >
            {speaking ? <VolumeX size={19} /> : <Volume2 size={19} />}
          </button>
        }
      />

      <main className="lesson-reader-panel">
        <div className="lesson-reader-content" key={`${idx}-${step}`}>
          {step === 0 && (
            <div className="my-5 flex flex-col items-center justify-center gap-3" aria-hidden="true">
              <div className="grid size-24 place-items-center rounded-full bg-psurface text-pprimary shadow-xs">
                <LessonIcon size={48} strokeWidth={1.75} />
              </div>
            </div>
          )}
          <div className="mx-auto max-w-[520px]">
            <div className="mb-2 flex items-center gap-2">
              <BrilliantStagePill stage={stage} />
              <span className="text-xs font-bold text-pmuted">{ordinal}</span>
            </div>
            <h1 aria-label={`${ordinal}. ${title}`} className="font-display text-[26px] font-extrabold leading-tight tracking-tight text-pfg sm:text-[32px]">
              {title}
            </h1>
            {isFinal ? (
              <div className="mt-5 flex flex-col gap-3.5">
                <div className="rounded-3xl bg-psurface p-4 sm:p-5">
                  <div className="mb-3 flex items-center gap-3">
                    <div className="grid size-10 shrink-0 place-items-center rounded-full bg-[rgb(var(--p-primary-rgb)/0.14)] text-pprimary">
                      <HelpCircle size={20} strokeWidth={2.2} />
                    </div>
                    <p className="text-[15.5px] font-semibold leading-snug text-pfg">{tt('darslikPracticeHint')}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onPractice(idx)}
                    className="flex w-full cursor-pointer items-center justify-between rounded-2xl bg-pcard px-4 py-3.5 text-left text-[15px] font-bold text-pfg shadow-2xs transition-colors hover:bg-[rgb(var(--p-primary-rgb)/0.08)]"
                  >
                    <span>{tt('darslikPracticeTitle')}</span>
                    <ArrowRight size={18} strokeWidth={2.3} className="text-pprimary" />
                  </button>
                </div>
                {video?.vimeoId && (isPlaying ? (
                  <iframe
                    src={`https://player.vimeo.com/video/${video.vimeoId}?autoplay=1&title=0&byline=0&portrait=0`}
                    allow="autoplay; fullscreen; picture-in-picture"
                    allowFullScreen
                    title={video.title || title}
                    className="aspect-video w-full overflow-hidden rounded-2xl border-0"
                  />
                ) : (
                  <button type="button" className="lesson-reader-video" onClick={() => setIsPlaying(true)}>
                    {video.poster && <img src={video.poster} alt="" />}
                    <span><Play size={18} /> {tt('darslikPlayVideo')}</span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="mt-5 text-[17px] leading-[1.7] text-pfg">{paragraphs[step]}</p>
            )}
          </div>
        </div>

        <div className="lesson-reader-footer">
          {step > 0 && (
            <button
              type="button"
              className="lesson-reader-previous bg-psurface text-pfg"
              onClick={() => setStep((value) => Math.max(0, value - 1))}
              aria-label={tt('darslikBack')}
            >
              <ChevronLeft size={21} />
            </button>
          )}
          <Button
            type="button"
            variant={isFinal ? 'primary' : 'secondary'}
            block
            className="min-w-0 flex-1"
            onClick={advance}
          >
            {isFinal ? (idx < (lessons[mod.id] ?? []).length - 1 ? tt('darslikReadNext') : tt('darslikFinishModule')) : tt('darslikContinue')}
          </Button>
        </div>
      </main>
      <BrilliantExitDialog
        open={showExitConfirm}
        onStay={() => setShowExitConfirm(false)}
        onLeave={() => {
          setShowExitConfirm(false)
          onClose()
        }}
        mascot={<span className="relative block size-16"><PathMascot animation="thinking" variant="avatar" /></span>}
      />
    </div>
  )
}
