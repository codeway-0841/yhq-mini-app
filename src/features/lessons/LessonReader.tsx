import { lazy, Suspense, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { ChevronLeft, Play, Volume2, VolumeX, X } from 'lucide-react'
import { modules } from '../../content/modules'
import { lessons } from '../../content/lessons'
import videosData from '../../content/videos.yhq.json'
import { useAppStore } from '../../shared/store/useAppStore'
import { useT } from '../../shared/i18n'
import { registerModal } from '../../shared/lib/navigation'
import { isSpeaking, speak, stopSpeaking, subscribeSpeaking } from '../../shared/lib/speech'
import { PathMascot } from './LessonToken'
import { getModuleIcon } from './module-icons'
import { canReadLesson } from './lesson-access'
import './lesson-reader.css'

const Tutor = lazy(() => import('../ai-tutor').then((module) => ({ default: module.SocraticChatSheet })))
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
  const [showTutor, setShowTutor] = useState(false)
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
    setShowTutor(false)
  }
  const spokenText = isFinal ? tt('darslikPracticeHint') : `${title}. ${paragraphs[step] ?? ''}`
  const LessonIcon = getModuleIcon(mod.id)

  return (
    <div className="lesson-reader fixed inset-0 z-50 flex flex-col">
      <header className="lesson-reader-header safe-top">
        <button type="button" onClick={onClose} aria-label={tt('darslikClose')} className="lesson-reader-icon"><X size={23} /></button>
        <div className="lesson-reader-progress" role="progressbar" aria-label={tt('darslikStepProgress')} aria-valuemin={1} aria-valuemax={stepCount} aria-valuenow={step + 1}>
          <span style={{ width: `${(step + 1) / stepCount * 100}%` }} />
        </div>
        <button type="button" className="lesson-reader-icon" onClick={() => speaking ? stopSpeaking() : speak(spokenText, settings.language)} aria-label={speaking ? tt('darslikStopAudio') : tt('darslikListen')}>
          {speaking ? <VolumeX size={21} /> : <Volume2 size={21} />}
        </button>
      </header>

      <main className="lesson-reader-panel">
        <div className="lesson-reader-content" key={`${idx}-${step}`}>
          {step === 0 && <div className="lesson-reader-art" aria-hidden="true"><div className="lesson-reader-illustration"><LessonIcon size={88} strokeWidth={1.6} /></div></div>}
          <h1 aria-label={`${ordinal}. ${title}`}>{title}</h1>
          {isFinal ? (
            <div className="lesson-reader-practice">
              <p>{tt('darslikPracticeHint')}</p>
              <button type="button" onClick={() => onPractice(idx)}>{tt('darslikPracticeTitle')}</button>
              {video?.vimeoId && (isPlaying ? (
                <iframe src={`https://player.vimeo.com/video/${video.vimeoId}?autoplay=1&title=0&byline=0&portrait=0`} allow="autoplay; fullscreen; picture-in-picture" allowFullScreen title={video.title || title} />
              ) : (
                <button type="button" className="lesson-reader-video" onClick={() => setIsPlaying(true)}>
                  {video.poster && <img src={video.poster} alt="" />}
                  <span><Play size={18} /> {tt('darslikPlayVideo')}</span>
                </button>
              ))}
            </div>
          ) : <p>{paragraphs[step]}</p>}
        </div>

        <div className="lesson-reader-footer">
          <button type="button" className="lesson-reader-mascot" onClick={() => setShowTutor(true)} aria-label={tt('darslikAskTutor')}>
            <PathMascot animation="idle" variant="avatar" />
          </button>
          {step > 0 && <button type="button" className="lesson-reader-previous" onClick={() => setStep((value) => Math.max(0, value - 1))} aria-label={tt('darslikBack')}><ChevronLeft size={21} /></button>}
          <button type="button" className="lesson-reader-next" onClick={advance}>
            {isFinal ? (idx < (lessons[mod.id] ?? []).length - 1 ? tt('darslikReadNext') : tt('darslikFinishModule')) : tt('darslikContinue')}
          </button>
        </div>
      </main>
      {showTutor && <Suspense fallback={null}><Tutor isOpen onClose={() => setShowTutor(false)} context={{ subjectId: 'yhq', topicName: title, questionText: `${title}\n${paragraphs.join('\n')}`.slice(0, 3000) }} /></Suspense>}
    </div>
  )
}
