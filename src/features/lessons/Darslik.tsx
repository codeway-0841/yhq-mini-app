import { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { goBack, registerModal } from '../../shared/lib/navigation'
import { Lock, Play, Check, ChevronLeft, MessageCircle, Dumbbell, GraduationCap, AlertTriangle } from 'lucide-react'
import { modules } from '../../content/modules'
import { MODULE_TOPICS } from '../../content/modules'
import { lessons, TOTAL_LESSONS, type Lesson } from '../../content/lessons'
import lessonMap from '../../content/lessonMap.yhq.json'
import videosData from '../../content/videos.yhq.json'
import { useLessonsStore } from '../../shared/store/useLessonsStore'
import { useDailyStore, todayStr } from '../../shared/store/useDailyStore'
import { useSubjectStore } from '../../shared/store/useSubjectStore'
import { useQuestionsStore } from '../../shared/store/useQuestionsStore'
import { useAppStore } from '../../shared/store/useAppStore'
import { openTelegramLink } from '../../platform/telegram'
import { getModuleIcon } from './module-icons'

type Mod = typeof modules[number]

interface VideoInfo {
  vimeoId: string
  poster: string
  title: string
  topicName?: string
}

// ── Lesson screen (telefon ilovasidagi dizayn kabi) ─────────────────────────
function LessonScreen({ mod, lessonIdx, onClose, onDone, onPractice }: {
  mod: Mod
  lessonIdx: number
  onClose: () => void
  onDone: (idx: number) => void
  onPractice: (idx: number) => void
}) {
  const [idx, setIdx] = useState(lessonIdx)
  const [isPlaying, setIsPlaying] = useState(false)
  const settings = useAppStore((s) => s.settings)
  const list = lessons[mod.id] ?? []
  const lesson: Lesson | undefined = list[idx]
  const ru = settings.language === 'ru'
  const videoInfo: VideoInfo | undefined = (videosData as Record<string, VideoInfo | undefined>)[`${mod.id}:${idx}`]
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  // Android hardware/sensor orqaga surish va Telegram BackButton orqali darslikka qaytish
  useEffect(() => {
    const id = Symbol('lesson-reader')
    const unregister = registerModal(id, () => {
      onCloseRef.current()
    })
    return () => {
      unregister()
    }
  }, [])

  useEffect(() => {
    setIsPlaying(false)
  }, [idx])

  if (!lesson) return null

  const advance = (i: number) => {
    onDone(i)
    if (i < list.length - 1) setIdx(i + 1)
    else onClose()
  }

  return (
    <div className="fixed inset-0 z-50 bg-pcanvas flex flex-col">
      {/* Header — fixed inset-0 sahifa (body padding tegmaydi) → .safe-top SHART */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-pline safe-top">
        <button onClick={onClose} aria-label={ru ? 'Закрыть' : 'Yopish'}
          className="grid size-11 place-items-center rounded-control text-pmuted transition-colors hover:bg-psurface hover:text-pfg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pprimary">
          <ChevronLeft size={20} strokeWidth={1.75} />
        </button>
        <span className="text-base font-semibold">{idx + 1}-{ru ? 'урок' : 'dars'}</span>
        <span className="text-xs font-semibold text-pmuted bg-psurface px-2.5 py-1 rounded-lg">
          {idx + 1}/{list.length}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 pb-6">
        {/* Video Player / HD Karta */}
        <div className="rounded-container bg-psurface border border-pline aspect-video flex items-center justify-center relative overflow-hidden mb-4 shadow-sm">
          {videoInfo?.vimeoId && isPlaying ? (
            <iframe
              src={`https://player.vimeo.com/video/${videoInfo.vimeoId}?autoplay=1&title=0&byline=0&portrait=0`}
              className="w-full h-full border-0"
              allow="autoplay; fullscreen; picture-in-picture"
              allowFullScreen
              title={videoInfo.title || lesson.titleUz}
            />
          ) : (
            <div
              onClick={() => {
                if (videoInfo?.vimeoId) setIsPlaying(true)
              }}
              className="w-full h-full relative flex items-center justify-center cursor-pointer group select-none"
            >
              {videoInfo?.poster ? (
                <img
                  src={videoInfo.poster}
                  alt={ru ? lesson.titleRu : lesson.titleUz}
                  className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                  loading="lazy"
                />
              ) : null}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/20" />
              <div className="relative z-10 flex flex-col items-center gap-2 px-4 text-center">
                <div className="grid size-14 place-items-center rounded-full border border-white/30 bg-black/60 backdrop-blur-sm shadow-lg transition-transform group-hover:scale-110 group-active:scale-95">
                  <Play size={24} strokeWidth={2} className="ml-0.5 text-white" />
                </div>
                <p className="text-sm font-semibold text-white/95 line-clamp-1 drop-shadow-sm">
                  {ru ? lesson.titleRu : lesson.titleUz}
                </p>
                {videoInfo?.vimeoId && (
                  <span className="text-[11px] font-medium text-white/80 px-2.5 py-0.5 rounded-full bg-white/15 backdrop-blur-xs border border-white/20">
                    {ru ? 'Смотреть HD видеоурок' : 'HD video darsni ko‘rish'}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        <h2 className="text-base font-semibold mb-3">
          {idx + 1}-{ru ? 'урок' : 'dars'}. {ru ? lesson.titleRu : lesson.titleUz}
        </h2>

        {/* Tanishuv matni */}
        <div className="flex flex-col gap-3 mb-5">
          {(ru ? lesson.bodyRu : lesson.bodyUz).map((p, i) => (
            <div key={i} className="flex gap-3">
              <span className="flex-none w-5 h-5 rounded-full text-[10px] font-semibold flex items-center justify-center mt-0.5"
                style={{ background: `${mod.color}22`, color: mod.color }}>
                {i + 1}
              </span>
              <p className="text-sm leading-relaxed text-pmuted">{p}</p>
            </div>
          ))}
        </div>

        {/* Mavzu bo'yicha mashq kartasi */}
        <button onClick={() => onPractice(idx)}
          className="w-full rounded-container border border-pline bg-psurface p-4 text-left active:scale-[0.98] transition-transform">
          <p className="text-sm font-semibold flex items-center gap-2 mb-1">
            <Dumbbell size={16} className="text-pprimary" />
            {ru ? 'Практика по теме' : "Mavzu bo'yicha mashq"}
          </p>
          <p className="text-xs text-pmuted">
            {ru ? 'Тест по вопросам этого урока' : "Shu dars savollaridan test"}
          </p>
        </button>
      </div>

      {/* Pastki tugmalar */}
      <div className="flex gap-3 px-4 py-3 border-t border-pline">
        <button onClick={() => openTelegramLink('https://t.me/kiwi_uz_bot')}
          className="flex-1 py-3.5 rounded-control bg-pprimary text-ponprimary font-semibold flex items-center justify-center gap-2">
          <MessageCircle size={16} />
          {ru ? 'Задать вопрос' : 'Savol berish'}
        </button>
        <button onClick={() => advance(idx)}
          className="flex-[1.4] py-3.5 rounded-control text-ponprimary font-semibold flex items-center justify-center gap-2 bg-pprimary">
          <Check size={16} />
          {idx < list.length - 1
            ? (ru ? 'Прочитано — дальше' : "O'qib bo'ldim — keyingi")
            : (ru ? 'Завершить модуль' : 'Modulni yakunlash')}
        </button>
        {idx < list.length - 1 && (
          <button onClick={() => advance(idx)}
            className="w-12 py-3.5 rounded-control bg-psurface text-pfg flex items-center justify-center">
            <ChevronLeft size={18} className="rotate-180" />
          </button>
        )}
      </div>

      {/* progress bar — o'qish progressi (aksent) */}
      <div className="h-1 bg-psurface">
        <div className="h-full transition-all" style={{ width: `${((idx + 1) / list.length) * 100}%`, background: 'var(--p-primary)' }} />
      </div>
    </div>
  )
}

// ── Dars ro'yxati — KIWI vertikal timeline rail ─────────────────────────────
// v3: ilon-izi "winding path" + doira tugunlar + atrofdagi emoji bezaklar
// (🌲🚦🌳🏠🏢) BUTUNLAY olib tashlandi — ular Duolingo dars xaritasining
// o'zi edi. O'rniga chapdan o'tuvchi rail va chapga tekislangan bosqich
// qatorlari: ro'yxat skanerlanadi, dars nomi to'liq o'qiladi (ilgari 2 ta
// so'zga qirqilardi) va ekran kengligiga bog'liq emas.
function ModulePath({ mod, doneList, onOpenLesson }: {
  mod: Mod
  doneList: number[]
  onOpenLesson: (idx: number) => void
}) {
  const settings = useAppStore((s) => s.settings)
  const ru = settings.language === 'ru'
  const modTitle = ru ? mod.titleRu : mod.title
  const total = mod.lessonCount
  const ModIcon = getModuleIcon(mod.id)
  const activeIdx = (() => {
    for (let i = 0; i < total; i++) if (!doneList.includes(i)) return i
    return -1   // hammasi tugallangan
  })()

  return (
    <div className="rounded-container border border-pline bg-pcard p-4">
      {/* Modul sarlavhasi */}
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div
            className="flex size-11 flex-shrink-0 items-center justify-center rounded-[14px]"
            style={{
              background: `color-mix(in srgb, ${mod.color} 10%, transparent)`,
              border: `1px solid color-mix(in srgb, ${mod.color} 20%, transparent)`,
            }}
          >
            <ModIcon size={20} strokeWidth={1.75} style={{ color: mod.color }} />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-psubtle">
              {mod.id}-{ru ? 'МОДУЛЬ' : 'MODUL'} · {total} {ru ? 'УРОКОВ' : 'TA DARS'}
            </p>
            <p className="truncate font-display text-[16px] font-semibold tracking-[-0.015em] text-pfg">
              {modTitle}
            </p>
          </div>
        </div>
        <span className="flex-none rounded-control border border-plineStrong bg-psurface px-2.5 py-1 text-[12px] font-semibold tabular-nums text-pmuted">
          {doneList.length}/{total}
        </span>
      </div>

      {/* Timeline rail */}
      <div className="relative pl-7">
        {/* Vertikal chiziq — birinchi va oxirgi tugun markazlari orasida */}
        <span
          aria-hidden="true"
          className="absolute left-[7px] top-3 bottom-3 w-0.5 rounded-full bg-plineStrong"
        />
        <ol className="flex flex-col">
          {Array.from({ length: total }, (_, i) => {
            const done   = doneList.includes(i)
            const active = i === activeIdx
            const locked = i > 0 && !doneList.includes(i - 1)
            const lesson = lessons[mod.id]?.[i]
            const title  = lesson
              ? (ru ? lesson.titleRu : lesson.titleUz)
              : `${i + 1}-${ru ? 'урок' : 'dars'}`
            return (
              <li key={i} className="relative py-2.5">
                {/* Bosqich nuqtasi */}
                <span
                  aria-hidden="true"
                  className={
                    'absolute -left-[26px] top-[15px] size-2.5 rounded-[3px] border-2 ' +
                    (done || active ? 'border-transparent' : 'border-plineStrong bg-pcard') +
                    (active ? ' lesson-glow' : '')
                  }
                  style={done || active ? { background: mod.color } : undefined}
                />
                <button
                  type="button"
                  onClick={() => !locked && onOpenLesson(i)}
                  disabled={locked}
                  className={
                    'flex w-full items-center gap-3 rounded-control px-2 py-1.5 text-left transition-colors duration-[120ms] ease-out ' +
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pprimary ' +
                    (locked ? 'cursor-not-allowed opacity-50' : 'hover:bg-psurface active:bg-psurface')
                  }
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-semibold text-pfg">{title}</span>
                    <span className="mt-0.5 block text-[11.5px] text-psubtle">
                      {locked
                        ? (ru ? 'Ещё закрыт' : 'Hali ochilmagan')
                        : done
                          ? (ru ? 'Пройден' : 'Tugallandi')
                          : active
                            ? (ru ? 'Текущий урок' : 'Joriy dars')
                            : (ru ? 'Доступен' : 'Ochiq')}
                    </span>
                  </span>
                  {locked
                    ? <Lock size={15} strokeWidth={1.75} className="flex-none text-psubtle" />
                    : done
                      ? <Check size={16} strokeWidth={1.75} className="flex-none" style={{ color: mod.color }} />
                      : (
                        <span
                          className="inline-flex h-[30px] flex-none items-center gap-1 rounded-control px-2.5 text-[12px] font-semibold"
                          style={{
                            background: `color-mix(in srgb, ${mod.color} 12%, transparent)`,
                            color: mod.color,
                          }}
                        >
                          <Play size={11} strokeWidth={2} />
                          {ru ? 'Открыть' : 'Ochish'}
                        </span>
                      )}
                </button>
              </li>
            )
          })}
        </ol>
      </div>
    </div>
  )
}

export default function Darslik() {
  const navigate = useNavigate()
  const location = useLocation()
  const settings = useAppStore((s) => s.settings)
  const userId = useAppStore((s) => s.user?.id) ?? '0'
  const doneFor = useLessonsStore((s) => s.byUser[userId] ?? {})
  const questions = useQuestionsStore((s) => s.questions)
  const topics = useQuestionsStore((s) => s.topics)
  // "Davom etish" kartasidan kelish — aniq darsni ochish
  const [reader, setReader] = useState<{ mod: Mod; idx: number } | null>(() => {
    const st = location.state as { moduleId?: number; lessonIdx?: number } | null
    if (st?.moduleId != null && st?.lessonIdx != null) {
      const mod = modules.find((m) => m.id === st.moduleId)
      if (mod) return { mod, idx: Math.min(Math.max(0, st.lessonIdx), mod.lessonCount - 1) }
    }
    return null
  })
  const [toast, setToast] = useState<string | null>(null)

  const ru = settings.language === 'ru'
  const totalDone = Object.values(doneFor).reduce((s, arr) => s + arr.length, 0)
  const markDone = useLessonsStore((s) => s.markDone)

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000) }

  const practiceLesson = (mod: Mod, lessonIdx: number) => {
    const map = lessonMap as Record<string, number[]>
    const lessonQuestionIds = map[`${mod.id}:${lessonIdx}`]
    if (lessonQuestionIds && lessonQuestionIds.length > 0) {
      const lessonTitle = (lessons[mod.id] && lessons[mod.id][lessonIdx])
        ? (ru ? lessons[mod.id][lessonIdx].titleRu : lessons[mod.id][lessonIdx].titleUz)
        : `${lessonIdx + 1}-dars`
      navigate('/test/1', { state: { questionIds: lessonQuestionIds, title: `${lessonTitle} — ${ru ? 'практика' : 'mashq'}` } })
      return
    }
    practiceModule(mod)
  }

  const practiceModule = (mod: Mod) => {
    const slugs = MODULE_TOPICS[mod.id] ?? []
    const topicIds = topics.filter((t) => slugs.includes(t.slug)).map((t) => t.id)
    const ids = questions.filter((q) => q.topicId != null && topicIds.includes(q.topicId)).map((q) => q.id)
    if (ids.length === 0) {
      showToast(ru ? 'Вопросы по этому модулю скоро' : "Bu modul bo'yicha savollar tez kunda")
      return
    }
    navigate('/test/1', { state: { questionIds: ids, title: `${ru ? mod.titleRu : mod.title} — ${ru ? 'практика' : 'mashq'}` } })
  }

  return (
    <div className="px-5 pb-6 pt-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <button onClick={() => goBack(navigate)} aria-label={ru ? 'Назад' : 'Orqaga'}
            className="grid size-11 place-items-center rounded-control text-pmuted transition-colors hover:bg-psurface hover:text-pfg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pprimary">
            <ChevronLeft size={20} strokeWidth={1.75} />
          </button>
          <h1 className="font-display text-[22px] font-semibold tracking-[-0.02em] text-pfg">
            {ru ? 'Учебник' : 'Darslik'}
          </h1>
        </div>
        <span className="flex items-center gap-1.5 rounded-control border border-plineStrong bg-psurface px-2.5 py-1.5 text-[12px] font-semibold tabular-nums text-pmuted">
          <GraduationCap size={13} strokeWidth={1.75} className="text-psubtle" />
          {totalDone}/{TOTAL_LESSONS}
        </span>
      </div>

      <div className="flex flex-col gap-4">
        {modules.map((mod) => (
          <ModulePath
            key={mod.id}
            mod={mod}
            doneList={doneFor[mod.id] ?? []}
            onOpenLesson={(i) => setReader({ mod, idx: i })}
          />
        ))}
      </div>

      {toast && (
        <div role="status" className="fixed bottom-20 left-5 right-5 z-40 flex items-center justify-center gap-2 rounded-container border border-[rgb(var(--p-warning-rgb)/0.35)] bg-[rgb(var(--p-warning-rgb)/0.10)] px-4 py-3 text-center text-[13px] font-medium text-pfg">
          <AlertTriangle size={15} strokeWidth={1.75} className="flex-none text-pwarning" />
          {toast}
        </div>
      )}

      {reader && (
        <LessonScreen
          mod={reader.mod}
          lessonIdx={reader.idx}
          onClose={() => setReader(null)}
          onDone={(idx) => {
            markDone(userId, reader.mod.id, idx)
            // Dars bilan shug'ullanish ham kunlik faollik — streak yoziladi (kunda 1 marta)
            void useDailyStore.getState().touchActivity(
              userId, todayStr(), useSubjectStore.getState().subjectId,
            )
          }}
          onPractice={(idx) => practiceLesson(reader.mod, idx)}
        />
      )}
    </div>
  )
}
