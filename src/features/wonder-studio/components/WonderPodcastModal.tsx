import { useState, useEffect, useRef, useMemo } from 'react'
import {
  X,
  Headphones,
  Sliders,
  PenLine,
  Lock,
  ChevronDown,
  ChevronUp,
  Play,
  Pause,
  MessageSquare,
  Volume2,
} from 'lucide-react'
import { haptics } from '../../../platform/haptics'
import { useAppStore } from '../../../shared/store/useAppStore'
import type { WonderCourse, PodcastEpisode, PodcastTurn } from '../types'

interface WonderPodcastModalProps {
  course: WonderCourse
  onClose: () => void
  onOpenUpgrade: () => void
}

function getPodcastHosts(lang: string) {
  if (lang === 'ru') {
    return {
      hostA: { name: 'Сардор', role: 'Когнитивный эксперт', avatar: '🎙️' },
      hostB: { name: 'Малика', role: 'Любознательный исследователь', avatar: '👩‍🎓' },
    }
  }
  if (lang === 'en') {
    return {
      hostA: { name: 'Dr. Sarah Lin', role: 'Cognitive Guide', avatar: '👩‍🔬' },
      hostB: { name: 'Alex', role: 'Inquisitive Mind', avatar: '🧑‍🎓' },
    }
  }
  // Default Uzbek
  return {
    hostA: { name: 'Sardor', role: 'Kognitiv ekspert', avatar: '🎙️' },
    hostB: { name: 'Malika', role: 'Qiziquvchan tadqiqotchi', avatar: '👩‍🎓' },
  }
}

function getPodcastTurns(lessonTitle: string, lessonTldr: string | undefined, lang: string): PodcastTurn[] {
  if (lang === 'ru') {
    return [
      {
        id: 't1',
        speaker: 'hostB',
        text: `Привет всем! Сегодня мы разбираем тему "${lessonTitle}". Сардор, в чём заключается ключевая суть этого урока?`,
        timestamp: 0,
      },
      {
        id: 't2',
        speaker: 'hostA',
        text: lessonTldr || `Главная мысль — не просто заучить ${lessonTitle}, а понять фундаментальные ментальные модели и логику процесса.`,
        timestamp: 12,
      },
      {
        id: 't3',
        speaker: 'hostB',
        text: `То есть регулярная практика и активное воспроизведение позволяют интуитивно закрепить этот концепт?`,
        timestamp: 26,
      },
      {
        id: 't4',
        speaker: 'hostA',
        text: `Именно! Мы связываем теорию с реальными практическими задачами, благодаря чему материал легко вспоминается на практике.`,
        timestamp: 38,
      },
    ]
  }

  if (lang === 'en') {
    return [
      {
        id: 't1',
        speaker: 'hostB',
        text: `Welcome! Today we are discussing "${lessonTitle}". What is the core dynamic here?`,
        timestamp: 0,
      },
      {
        id: 't2',
        speaker: 'hostA',
        text: lessonTldr || `The key insight is to deconstruct ${lessonTitle} into foundational mental models.`,
        timestamp: 12,
      },
      {
        id: 't3',
        speaker: 'hostB',
        text: 'And by applying active recall, retention becomes effortless?',
        timestamp: 26,
      },
      {
        id: 't4',
        speaker: 'hostA',
        text: 'Exactly! Consistent deliberate practice wires this intuition directly into memory.',
        timestamp: 38,
      },
    ]
  }

  // Uzbek (Default)
  return [
    {
      id: 't1',
      speaker: 'hostB',
      text: `Assalomu alaykum! Bugungi sonimizda biz "${lessonTitle}" mavzusini batafsil tahlil qilamiz. Sardor, ushbu darsning tub mohiyati nimada?`,
      timestamp: 0,
    },
    {
      id: 't2',
      speaker: 'hostA',
      text: lessonTldr || `Asosiy g'oya shundaki, ${lessonTitle} mavzusini shunchaki yodlash emas, uning ichki qonuniyatlarini tushunish va aqliy model yaratish kerak.`,
      timestamp: 12,
    },
    {
      id: 't3',
      speaker: 'hostB',
      text: `Demak, faol eslash va muntazam mashq qilish orqali bu tushuncha xotiraga mustahkam o'rnashadi, to'g'rimi?`,
      timestamp: 26,
    },
    {
      id: 't4',
      speaker: 'hostA',
      text: `Aynan shunday! Har bir tamoyilni hayotiy misollar bilan bog'lash orqali mustahkam intuitsiya shakllanadi.`,
      timestamp: 38,
    },
  ]
}

export default function WonderPodcastModal({
  course,
  onClose,
  onOpenUpgrade,
}: WonderPodcastModalProps) {
  const currentLang = useAppStore((s) => s.settings.language || 'uz')
  const localizedHosts = useMemo(() => getPodcastHosts(currentLang), [currentLang])

  // Normalize episodes from course.podcastEpisodes, or fallback to section lessons
  const episodes: (PodcastEpisode & { isLocked: boolean })[] = useMemo(() => {
    if (course.podcastEpisodes && course.podcastEpisodes.length > 0) {
      return course.podcastEpisodes.map((ep, idx) => ({
        ...ep,
        isLocked: idx > 1, // first 2 episodes unlocked
      }))
    }

    // Fallback generated episodes from sections
    return course.sections.flatMap((sec, sIdx) =>
      sec.lessons.map((lesson, lIdx) => ({
        id: `ep-${lesson.id}`,
        title: lesson.title,
        duration: '05:30',
        durationSec: 330,
        hosts: localizedHosts,
        turns: getPodcastTurns(lesson.title, lesson.tldr, currentLang),
        isLocked: sIdx > 0 || lIdx > 1,
      })),
    )
  }, [course, localizedHosts, currentLang])

  const [activeEpisodeIdx, setActiveEpisodeIdx] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [styleExpanded, setStyleExpanded] = useState(false)
  const [instructionsExpanded, setInstructionsExpanded] = useState(false)
  const [transcriptExpanded, setTranscriptExpanded] = useState(true)

  const [isPreparing, setIsPreparing] = useState(true)
  const [currentTurnIdx, setCurrentTurnIdx] = useState(0)
  const [playbackTime, setPlaybackTime] = useState(0)
  const [playbackRate, setPlaybackRate] = useState<'1x' | '1.5x' | '2x'>('1x')

  const currentEpisode = episodes[activeEpisodeIdx] || episodes[0]
  const currentTurns: PodcastTurn[] = currentEpisode?.turns || []
  const activeTurn = currentTurns[currentTurnIdx] || currentTurns[0]

  // Timer reference for mock progression if speech synthesis finishes
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const isSpeakingRef = useRef(false)

  // Clean preparation spinner on episode switch
  useEffect(() => {
    setIsPreparing(true)
    setIsPlaying(false)
    setCurrentTurnIdx(0)
    setPlaybackTime(0)
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel()
    }
    const t = setTimeout(() => setIsPreparing(false), 800)
    return () => clearTimeout(t)
  }, [activeEpisodeIdx])

  // Cleanup speech synthesis on unmount
  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel()
      }
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])

  // Web Speech API Voice synthesis for multi-turn dialogue
  const speakTurn = (turnIndex: number) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return
    if (!isPlaying) return

    const turn = currentTurns[turnIndex]
    if (!turn) {
      setIsPlaying(false)
      setCurrentTurnIdx(0)
      setPlaybackTime(0)
      return
    }

    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(turn.text)
    utterance.lang = currentLang === 'ru' ? 'ru-RU' : currentLang === 'uz' ? 'uz-UZ' : 'en-US'

    // Rate based on pill
    const speedMult = playbackRate === '2x' ? 1.45 : playbackRate === '1.5x' ? 1.25 : 1.0
    utterance.rate = speedMult

    // Two distinct pitches for Host A (expert) vs Host B (learner)
    if (turn.speaker === 'hostA') {
      utterance.pitch = 1.18 // slightly brighter, articulate
    } else {
      utterance.pitch = 0.92 // slightly deeper, conversational
    }

    // Try finding diverse voices if available
    const voices = window.speechSynthesis.getVoices()
    if (voices.length > 0) {
      if (currentLang === 'ru') {
        const ruVoices = voices.filter((v) => v.lang.startsWith('ru'))
        if (ruVoices.length > 0) {
          if (turn.speaker === 'hostA') {
            const f = ruVoices.find((v) => /female|milena|tatiana|irina|yandex/i.test(v.name)) || ruVoices[0]
            utterance.voice = f
          } else {
            const m = ruVoices.find((v) => /male|dmitry|pavel|google/i.test(v.name)) || ruVoices[ruVoices.length - 1]
            utterance.voice = m
          }
        }
      } else if (currentLang === 'uz') {
        const uzVoices = voices.filter((v) => v.lang.startsWith('uz') || v.lang.startsWith('tr'))
        if (uzVoices.length > 0) {
          utterance.voice = uzVoices[0]
        }
      } else {
        if (turn.speaker === 'hostA') {
          const femaleVoice = voices.find((v) => /female|samantha|zira|victoria|google us english/i.test(v.name))
          if (femaleVoice) utterance.voice = femaleVoice
        } else {
          const maleVoice = voices.find((v) => /male|david|alex|daniel/i.test(v.name))
          if (maleVoice) utterance.voice = maleVoice
        }
      }
    }

    utterance.onstart = () => {
      isSpeakingRef.current = true
      setCurrentTurnIdx(turnIndex)
      setPlaybackTime(turn.timestamp)
    }

    utterance.onend = () => {
      isSpeakingRef.current = false
      if (turnIndex + 1 < currentTurns.length) {
        speakTurn(turnIndex + 1)
      } else {
        setIsPlaying(false)
        setCurrentTurnIdx(0)
        setPlaybackTime(0)
      }
    }

    utterance.onerror = () => {
      isSpeakingRef.current = false
      // fallback to timer-based advance
      if (turnIndex + 1 < currentTurns.length) {
        setTimeout(() => speakTurn(turnIndex + 1), 2000)
      } else {
        setIsPlaying(false)
      }
    }

    window.speechSynthesis.speak(utterance)
  }

  // Handle Play/Pause
  const handleTogglePlay = (targetPlayState: boolean) => {
    haptics.impact('light')
    setIsPlaying(targetPlayState)

    if (targetPlayState) {
      speakTurn(currentTurnIdx)
    } else {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel()
      }
    }
  }

  // Timer update for progress slider when playing
  useEffect(() => {
    if (isPlaying) {
      timerRef.current = setInterval(() => {
        setPlaybackTime((t) => Math.min(t + 1, currentEpisode.durationSec || 330))
      }, 1000)
    } else if (timerRef.current) {
      clearInterval(timerRef.current)
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [isPlaying, currentEpisode.durationSec])

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60)
    const s = Math.floor(sec % 60)
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }

  const handleClose = () => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel()
    }
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs font-sans select-none animate-in fade-in duration-150">
      <div className="relative w-full max-w-lg rounded-3xl bg-[#FFFDF8] dark:bg-[#1C1411] border border-[#E7E2D6] dark:border-stone-800 shadow-2xl p-5 sm:p-7 space-y-5 max-h-[92vh] overflow-y-auto">
        {/* Top Header (1:1 with podcast_player_view.png) */}
        <div className="flex items-center justify-between pb-2 border-b border-stone-100 dark:border-stone-800">
          <div className="flex items-center gap-3">
            <Headphones size={22} className="text-stone-700 dark:text-stone-300 shrink-0" strokeWidth={1.8} />
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-stone-900 dark:text-stone-100">
                  Podcast
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-stone-200/80 dark:bg-stone-800 text-[10px] font-semibold text-stone-600 dark:text-stone-400">
                  Dual-Host Beta
                </span>
              </div>
              <p className="text-xs text-stone-500 truncate max-w-xs">
                {course.title}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleClose}
            aria-label="Close"
            className="size-8 rounded-xl border border-stone-200 dark:border-stone-700 flex items-center justify-center text-stone-400 hover:text-stone-800 dark:hover:text-stone-200 hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors cursor-pointer"
          >
            <X size={17} strokeWidth={2} />
          </button>
        </div>

        {/* Current Episode Title & Status Box (1:1 with podcast_player_view.png) */}
        <div className="space-y-3">
          <h3 className="text-center text-base sm:text-lg font-bold text-stone-900 dark:text-stone-100 font-sans">
            {currentEpisode.title}
          </h3>

          <div className="p-5 sm:p-6 rounded-2xl bg-[#EFECE4] dark:bg-stone-900/60 border border-[#E3DFD5] dark:border-stone-800 text-center flex flex-col items-center justify-center min-h-[120px] gap-2.5">
            {isPreparing ? (
              <div className="flex flex-col items-center gap-2">
                <div className="size-5 rounded-full border-2 border-stone-300 dark:border-stone-600 border-t-stone-700 dark:border-t-stone-200 animate-spin" />
                <span className="text-xs text-stone-600 dark:text-stone-300 font-medium">
                  Synthesizing audio episode...
                </span>
              </div>
            ) : isPlaying ? (
              <div className="space-y-3 w-full">
                {/* Active Host Speaker Tag */}
                <div className="flex items-center justify-center gap-2 text-xs font-semibold text-[#0284C7] dark:text-[#38BDF8] animate-in fade-in">
                  <span className="text-base">{activeTurn?.speaker === 'hostA' ? currentEpisode.hosts.hostA.avatar : currentEpisode.hosts.hostB.avatar}</span>
                  <span>{activeTurn?.speaker === 'hostA' ? currentEpisode.hosts.hostA.name : currentEpisode.hosts.hostB.name} is speaking</span>
                  <Volume2 size={14} className="animate-pulse" />
                </div>

                {/* Animated Soundwave bars */}
                <div className="flex items-center justify-center gap-1.5 h-7">
                  {[14, 24, 12, 22, 18, 26, 14, 20, 16].map((h, i) => (
                    <span
                      key={i}
                      className="w-1 bg-[#0284C7] dark:bg-[#38BDF8] rounded-full animate-pulse"
                      style={{ height: `${h}px`, animationDelay: `${i * 0.1}s` }}
                    />
                  ))}
                </div>

                {/* Scrubber Bar */}
                <div className="flex items-center gap-2 text-[11px] text-stone-500 font-mono w-full max-w-xs mx-auto">
                  <span>{formatTime(playbackTime)}</span>
                  <input
                    type="range"
                    min={0}
                    max={currentEpisode.durationSec || 330}
                    value={playbackTime}
                    onChange={(e) => {
                      const newTime = Number(e.target.value)
                      setPlaybackTime(newTime)
                    }}
                    className="flex-1 accent-[#0284C7] h-1.5 cursor-pointer"
                  />
                  <span>{currentEpisode.duration || '05:30'}</span>
                </div>

                {/* Controls: Play/Pause, Speed */}
                <div className="flex items-center justify-center gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => handleTogglePlay(false)}
                    className="size-10 rounded-full bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 flex items-center justify-center shadow-xs active:scale-95 transition-transform cursor-pointer"
                    aria-label="Pause"
                  >
                    <Pause size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      haptics.selection()
                      setPlaybackRate((r) => (r === '1x' ? '1.5x' : r === '1.5x' ? '2x' : '1x'))
                    }}
                    className="px-2.5 py-1 rounded-lg bg-stone-200/80 dark:bg-stone-800 text-[11px] font-bold text-stone-700 dark:text-stone-300 cursor-pointer hover:bg-stone-300/80"
                  >
                    {playbackRate}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-2.5">
                <div className="text-xs text-stone-600 dark:text-stone-300 font-medium">
                  {currentEpisode.hosts.hostA.name} & {currentEpisode.hosts.hostB.name} · {currentEpisode.duration || '05:30'}
                </div>
                <button
                  type="button"
                  onClick={() => handleTogglePlay(true)}
                  className="px-6 py-2.5 rounded-xl bg-[#67C2F9] hover:bg-[#5BB9F5] text-[#261312] font-mono text-xs font-bold uppercase tracking-wider shadow-[0_3px_0_0_#2B8FD0] active:translate-y-0.5 active:shadow-none transition-all cursor-pointer flex items-center gap-2 mx-auto"
                >
                  <Play size={14} fill="currentColor" />
                  <span>PLAY EPISODE</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Interactive Dialogue Transcript (1:1 Socratic Studio) */}
        {currentTurns.length > 0 && (
          <div className="rounded-2xl border border-stone-200/90 dark:border-stone-800 bg-[#FAF8F2] dark:bg-stone-900/40 overflow-hidden text-xs">
            <button
              type="button"
              onClick={() => setTranscriptExpanded(!transcriptExpanded)}
              className="w-full flex items-center justify-between p-3 text-left cursor-pointer hover:bg-stone-100/50"
            >
              <div className="flex items-center gap-2 font-bold text-stone-800 dark:text-stone-200">
                <MessageSquare size={14} className="text-[#0284C7]" />
                <span>Interactive Transcript ({currentTurns.length} turns)</span>
              </div>
              {transcriptExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>

            {transcriptExpanded && (
              <div className="p-3 pt-1 border-t border-stone-100 dark:border-stone-800 space-y-2 max-h-48 overflow-y-auto">
                {currentTurns.map((turn, idx) => {
                  const isTurnActive = currentTurnIdx === idx && isPlaying
                  const host = turn.speaker === 'hostA' ? currentEpisode.hosts.hostA : currentEpisode.hosts.hostB

                  return (
                    <div
                      key={turn.id}
                      onClick={() => {
                        setCurrentTurnIdx(idx)
                        setPlaybackTime(turn.timestamp)
                        handleTogglePlay(true)
                      }}
                      className={`p-2 rounded-xl transition-all cursor-pointer text-[11px] ${
                        isTurnActive
                          ? 'bg-[#E0F2FE] dark:bg-sky-950/70 border border-sky-300 dark:border-sky-800 text-sky-950 dark:text-sky-100 font-medium shadow-2xs'
                          : 'hover:bg-white dark:hover:bg-stone-800 text-stone-700 dark:text-stone-300'
                      }`}
                    >
                      <div className="flex items-center justify-between text-[10px] opacity-70 mb-0.5">
                        <span className="font-bold flex items-center gap-1">
                          <span>{host.avatar}</span>
                          <span>{host.name} ({turn.speaker === 'hostA' ? 'Host' : 'Learner'})</span>
                        </span>
                        <span className="font-mono">{formatTime(turn.timestamp)}</span>
                      </div>
                      <p className="leading-relaxed">{turn.text}</p>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* Collapsible Accordions: Style & Voices + Custom Instructions */}
        <div className="space-y-2 text-xs">
          {/* Style & Voices Accordion */}
          <div className="rounded-2xl border border-stone-200/90 dark:border-stone-800 bg-[#FAF8F2] dark:bg-stone-900/40 overflow-hidden">
            <button
              type="button"
              onClick={() => setStyleExpanded(!styleExpanded)}
              className="w-full flex items-center justify-between p-3 text-left cursor-pointer hover:bg-stone-100/50"
            >
              <div className="flex items-center gap-2.5">
                <Sliders size={15} className="text-stone-500" />
                <div>
                  <div className="font-bold text-stone-800 dark:text-stone-200">
                    Style & voices
                  </div>
                  <div className="text-[11px] text-stone-400">
                    Socratic dialogue · 2-Host multi-pitch synthesis
                  </div>
                </div>
              </div>
              {styleExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
            </button>

            {styleExpanded && (
              <div className="p-3 pt-0 border-t border-stone-100 dark:border-stone-800 space-y-1.5 text-[11px] text-stone-600 dark:text-stone-300">
                <div>Format: Conversational Socratic Dialogue</div>
                <div>Hosts: {currentEpisode.hosts.hostA.name} ({currentEpisode.hosts.hostA.role}) & {currentEpisode.hosts.hostB.name} ({currentEpisode.hosts.hostB.role})</div>
              </div>
            )}
          </div>

          {/* Custom Instructions Accordion */}
          <div className="rounded-2xl border border-stone-200/90 dark:border-stone-800 bg-[#FAF8F2] dark:bg-stone-900/40 overflow-hidden">
            <button
              type="button"
              onClick={() => setInstructionsExpanded(!instructionsExpanded)}
              className="w-full flex items-center justify-between p-3 text-left cursor-pointer hover:bg-stone-100/50"
            >
              <div className="flex items-center gap-2.5">
                <PenLine size={15} className="text-stone-500" />
                <div>
                  <div className="font-bold text-stone-800 dark:text-stone-200">
                    Custom instructions
                  </div>
                  <div className="text-[11px] text-stone-400">
                    Tell the hosts what to focus on and how to sound.
                  </div>
                </div>
              </div>
              {instructionsExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
            </button>

            {instructionsExpanded && (
              <div className="p-3 pt-0 border-t border-stone-100 dark:border-stone-800">
                <textarea
                  rows={2}
                  placeholder="e.g. Emphasize intuition pumps and real-world analogies..."
                  className="w-full p-2 text-[11px] rounded-xl bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 resize-none outline-hidden"
                />
              </div>
            )}
          </div>
        </div>

        {/* Episodes List (1:1 with podcast_player_view.png) */}
        <div className="space-y-1">
          {episodes.map((ep, idx) => (
            <div
              key={ep.id}
              onClick={() => {
                haptics.selection()
                if (ep.isLocked) {
                  onOpenUpgrade()
                } else {
                  setActiveEpisodeIdx(idx)
                  handleTogglePlay(true)
                }
              }}
              className={`flex items-center justify-between p-3 rounded-2xl text-xs transition-all cursor-pointer ${
                activeEpisodeIdx === idx
                  ? 'bg-[#EFECE4] dark:bg-stone-800/80 font-semibold text-stone-900 dark:text-stone-100'
                  : 'text-stone-700 dark:text-stone-300 hover:bg-stone-100/60 dark:hover:bg-stone-900'
              }`}
            >
              <span className="truncate pr-2">{ep.title}</span>

              {ep.isLocked ? (
                <Lock size={14} className="text-stone-400 shrink-0" />
              ) : activeEpisodeIdx === idx ? (
                <div className="flex items-center gap-1.5 shrink-0 text-[11px] font-medium text-stone-600 dark:text-stone-300">
                  {isPlaying ? (
                    <span className="text-[#0284C7] font-semibold flex items-center gap-1">
                      <span className="size-1.5 rounded-full bg-[#0284C7] animate-pulse" />
                      Playing
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5">
                      <div className="size-3 rounded-full border border-stone-300 border-t-stone-700 animate-spin" />
                      Ready
                    </span>
                  )}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
