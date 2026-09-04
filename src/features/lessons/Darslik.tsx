import { useState, useEffect, useRef, useCallback, type CSSProperties } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { goBack, registerModal } from '../../shared/lib/navigation'
import { Play, Check, ChevronLeft, MessageCircle, Dumbbell, GraduationCap, AlertTriangle, ArrowDown } from 'lucide-react'
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
import LearningPath, { type PathSelection } from './LearningPath'
import LessonPreview from './LessonPreview'
import LessonLaunch, { lessonLaunchOrigin, type LaunchOrigin } from './LessonLaunch'
import { usePathFocus } from './usePathFocus'
import { canReadLesson } from './lesson-access'
import ModuleComplete, { type CompletedModule } from './ModuleComplete'
import { useT } from '../../shared/i18n'
import { Button } from '../../shared/components/ui/button'
import { getModuleIcon } from './module-icons'

type Mod = typeof modules[number]

interface VideoInfo {
  vimeoId: string
  poster: string
  title: string
  topicName?: string
}

// ── Lesson screen (telefon ilovasidagi dizayn kabi) ─────────────────────────
function LessonScreen({ mod, lessonIdx, onClose, onDone, onPractice, onPremium }: {
  mod: Mod
  lessonIdx: number
  onClose: () => void
  onDone: (idx: number) => void
  onPractice: (idx: number) => void
  onPremium: () => void
}) {
  const [idx, setIdx] = useState(lessonIdx)
  const [isPlaying, setIsPlaying] = useState(false)
  const settings = useAppStore((s) => s.settings)
  const isPremium = useAppStore((s) => s.tariff === 'premium')
  const list = lessons[mod.id] ?? []
  const lesson: Lesson | undefined = list[idx]
  const ru = settings.language === 'ru'
  const videoInfo: VideoInfo | undefined = (videosData as Record<string, VideoInfo | undefined>)[`${mod.id}:${idx}`]
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose
  const onPremiumRef = useRef(onPremium)
  onPremiumRef.current = onPremium
  const allowed = canReadLesson(isPremium, mod.id, idx)
  useEffect(() => {
    if (!allowed) onPremiumRef.current()
  }, [allowed])

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

  if (!lesson || !allowed) return null

  const advance = (i: number) => {
    onDone(i)
    if (i < list.length - 1) {
      if (!canReadLesson(isPremium, mod.id, i + 1)) { onPremium(); return }
      setIdx(i + 1)
    }
    else onClose()
  }

  return (
    <div className="lesson-reader fixed inset-0 z-50 bg-pcanvas flex flex-col">
      {/* Header — fixed inset-0 sahifa (body padding tegmaydi) → .safe-top SHART */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-pline safe-top">
        <button onClick={onClose} aria-label={ru ? 'Закрыть' : 'Yopish'}
          className="grid size-11 place-items-center rounded-xl text-pmuted transition-colors hover:bg-psurface hover:text-pfg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pprimary">
          <ChevronLeft size={20} strokeWidth={1.75} />
        </button>
        <span className="text-base font-semibold">{idx + 1}-{ru ? 'урок' : 'dars'}</span>
        <span className="text-xs font-semibold text-pmuted bg-psurface px-2.5 py-1 rounded-xl shadow-2xs">
          {idx + 1}/{list.length}
        </span>
      </div>

      {/* pb calc: fixed inset-0 sahifa (body padding tegmaydi) — scroll kontent
          gesture bar/home indicator ostida qolmasligi uchun bazaviy 24px + inset */}
      <div className="flex-1 overflow-y-auto px-4 py-4 pb-[calc(1.5rem+var(--safe-bottom,0px))]">
        {/* Video Player / HD Karta */}
        <div className="rounded-2xl bg-psurface aspect-video flex items-center justify-center relative overflow-hidden mb-4 shadow-sm">
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
                <div className="grid size-14 place-items-center rounded-full bg-black/60 backdrop-blur-md shadow-xl transition-transform group-hover:scale-110 group-active:scale-95">
                  <Play size={24} strokeWidth={2} className="ml-0.5 text-white" />
                </div>
                <p className="text-sm font-semibold text-white/95 line-clamp-1 drop-shadow-sm">
                  {ru ? lesson.titleRu : lesson.titleUz}
                </p>
                {videoInfo?.vimeoId && (
                  <span className="text-[11px] font-medium text-white/90 px-2.5 py-0.5 rounded-full bg-white/20 backdrop-blur-xs shadow-2xs">
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
          className="w-full rounded-2xl bg-pcard p-4 text-left active:scale-[0.98] transition-all shadow-xs hover:bg-psurface">
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
          className="flex-1 py-3.5 rounded-2xl bg-pprimary text-ponprimary font-semibold flex items-center justify-center gap-2 shadow-xs">
          <MessageCircle size={16} />
          {ru ? 'Задать вопрос' : 'Savol berish'}
        </button>
        <button onClick={() => advance(idx)}
          className="flex-[1.4] py-3.5 rounded-2xl text-ponprimary font-semibold flex items-center justify-center gap-2 bg-pprimary shadow-xs">
          <Check size={16} />
          {idx < list.length - 1
            ? (ru ? 'Прочитано — дальше' : "O'qib bo'ldim — keyingi")
            : (ru ? 'Завершить модуль' : 'Modulni yakunlash')}
        </button>
        {idx < list.length - 1 && (
          <button onClick={() => advance(idx)}
            className="w-12 py-3.5 rounded-2xl bg-psurface text-pfg flex items-center justify-center shadow-xs">
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

export default function Darslik() {
  const navigate = useNavigate()
  const location = useLocation()
  const settings = useAppStore((s) => s.settings)
  const isPremium = useAppStore((s) => s.tariff === 'premium')
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
  const [moduleId, setModuleId] = useState(() => {
    const st = location.state as { moduleId?: number } | null
    return modules.find((m) => m.id === st?.moduleId)?.id
      ?? modules.find((m) => (lessons[m.id] ?? []).some((_, i) => !doneFor[m.id]?.includes(i)))?.id
      ?? modules[0].id
  })
  const [completion, setCompletion] = useState<CompletedModule | null>(null)
  const [selected, setSelected] = useState<PathSelection | null>(null)
  const [collapsed, setCollapsed] = useState(false)
  const [launch, setLaunch] = useState<{ mod: Mod; idx: number; origin: LaunchOrigin } | null>(null)
  const [jumpDirection, setJumpDirection] = useState<'up' | 'down'>('down')
  const selectedTrigger = useRef<HTMLButtonElement | null>(null)
  const selectedLesson = selected ? lessons[selected.moduleId]?.[selected.idx] : undefined
  const headingRef = useRef<HTMLHeadingElement>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const headerRef = useRef<HTMLElement>(null)
  const moduleRefs = useRef(new Map<number, HTMLElement>())
  const resetPathScroll = useRef(moduleId !== modules[0].id)
  useEffect(() => {
    const header = headerRef.current
    if (!header) return
    const measure = () => rootRef.current?.style.setProperty('--lesson-header-height', `${header.getBoundingClientRect().height}px`)
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    observer.observe(header)
    return () => observer.disconnect()
  }, [])
  const continueModule = useCallback(() => {
    if (!completion?.next) return
    resetPathScroll.current = true
    setModuleId(completion.next.id)
    setCompletion(null)
  }, [completion])
  useEffect(() => {
    // Wait for the completion dialog's scroll lock to be released first.
    if (completion || reader || !resetPathScroll.current) return
    resetPathScroll.current = false
    const section = moduleRefs.current.get(moduleId)
    if (!section) return
    const top = section.getBoundingClientRect().top + window.scrollY - (headerRef.current?.getBoundingClientRect().height ?? 0) - 8
    const reduceMotion = settings.noAnimation || window.matchMedia('(prefers-reduced-motion: reduce)').matches
    window.scrollTo({ top: Math.max(0, top), behavior: reduceMotion ? 'instant' : 'smooth' })
    section.querySelector('h2')?.focus({ preventScroll: true })
  }, [completion, moduleId, reader, settings.noAnimation])
  const tt = useT(settings.language)
  const currentModule = modules.find((m) => (lessons[m.id] ?? []).some((_, i) => !doneFor[m.id]?.includes(i)))
  const selectedMod = modules.find((m) => m.id === selected?.moduleId)
  const SelectedIcon = getModuleIcon(selected?.moduleId ?? currentModule?.id ?? 1)
  const isSelectedCurrent = !!selected && selected.moduleId === currentModule?.id
    && selected.idx === (lessons[selected.moduleId] ?? []).findIndex((_, i) => !doneFor[selected.moduleId]?.includes(i))
  const selectPathNode = useCallback((selection: PathSelection, trigger: HTMLButtonElement) => {
    selectedTrigger.current = trigger
    const current = rootRef.current?.querySelector('[aria-current="step"]')
    if (current) setJumpDirection(current.getBoundingClientRect().top > trigger.getBoundingClientRect().top ? 'down' : 'up')
    setSelected(previous => previous?.moduleId === selection.moduleId && previous.idx === selection.idx && previous.check === selection.check ? previous : selection)
  }, [])
  usePathFocus(rootRef, !!reader || !!completion || !!launch, selectPathNode)
  const [toast, setToast] = useState<string | null>(null)

  const ru = settings.language === 'ru'
  const totalDone = modules.reduce((sum, m) => sum + (lessons[m.id] ?? []).filter((_, i) => doneFor[m.id]?.includes(i)).length, 0)
  const markDone = useLessonsStore((s) => s.markDone)
  const jumpToCurrent = () => {
    if (!currentModule) return
    const node = moduleRefs.current.get(currentModule.id)?.querySelector<HTMLButtonElement>('[aria-current="step"]')
    if (!node) return
    setCollapsed(false)
    selectPathNode({ moduleId: currentModule.id, idx: Number(node.dataset.lesson), check: false }, node)
    node.scrollIntoView({ behavior: settings.noAnimation || window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'center' })
    node.focus({ preventScroll: true })
  }

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000) }
  const requestPremium = () => {
    setReader(null)
    setLaunch(null)
    navigate('/premium')
  }

  const practiceLesson = (mod: Mod, lessonIdx: number) => {
    if (!canReadLesson(isPremium, mod.id, lessonIdx)) { requestPremium(); return }
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
    if (!isPremium) { requestPremium(); return }
    const map = lessonMap as Record<string, number[]>
    const curatedIds = [...new Set((lessons[mod.id] ?? []).flatMap((_, idx) => map[`${mod.id}:${idx}`] ?? []))]
    if (curatedIds.length) {
      navigate('/test/1', { state: { questionIds: curatedIds, title: `${ru ? mod.titleRu : mod.title} — ${tt('pathLevelCheck')}` } })
      return
    }
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
    <div ref={rootRef} className="lesson-course px-4 pb-4" data-preview-open={!!selected && !collapsed} data-has-selection={!!selected} data-launching={!!launch}>
      <header ref={headerRef} className="sticky top-0 z-30 -mt-[var(--safe-top-body,0px)] pt-[var(--safe-top,0px)] -mx-4 px-4 py-2.5 bg-pcanvas border-b border-pline flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <button onClick={() => goBack(navigate)} aria-label={ru ? 'Назад' : 'Orqaga'}
            className="grid size-10 place-items-center rounded-xl text-pmuted transition-colors hover:bg-psurface hover:text-pfg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pprimary">
            <ChevronLeft size={20} strokeWidth={1.75} />
          </button>
          <span className="lesson-toolbar-icon" aria-hidden="true"><SelectedIcon size={20} /></span>
          <h1 ref={headingRef} tabIndex={-1} className="font-display text-[20px] font-semibold tracking-[-0.02em] text-pfg">
            {ru ? 'Учебник' : 'Darslik'}
          </h1>
        </div>
        <span className="flex items-center gap-1.5 rounded-full bg-psurface px-2.5 py-1 text-[12px] font-semibold tabular-nums text-pmuted">
          <GraduationCap size={13} strokeWidth={1.75} className="text-psubtle" />
          {totalDone}/{TOTAL_LESSONS}
        </span>
      </header>

      {modules.map((item) => {
        const list = lessons[item.id] ?? []
        const done = list.filter((_, i) => doneFor[item.id]?.includes(i)).length
        const Icon = getModuleIcon(item.id)
        const title = ru ? item.titleRu : item.title
        return <section key={item.id} id={`lesson-module-${item.id}`} aria-labelledby={`lesson-module-title-${item.id}`}
          ref={(node) => { if (node) moduleRefs.current.set(item.id, node); else moduleRefs.current.delete(item.id) }}
          className="lesson-module-section mx-auto max-w-[440px]" data-module-state={done === list.length ? 'done' : item.id === currentModule?.id ? 'current' : 'upcoming'} style={{ '--module-color': item.color } as CSSProperties}>
          <div className="lesson-module-sticky">
            <div className="lesson-module-banner rounded-2xl">
              <span className="lesson-module-icon"><Icon aria-hidden="true" size={21} strokeWidth={1.75} /></span>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold uppercase tracking-[.1em] opacity-90">{item.id} · {tt('pathModule')} · {list.length} {tt('lessonWord')}</p>
                <h2 id={`lesson-module-title-${item.id}`} tabIndex={-1} className="mt-0.5 break-words font-display text-[16px] font-bold leading-tight focus-visible:outline-none">{title}</h2>
              </div>
              <div role="progressbar" aria-label={`${title} — ${tt('pathProgress')}`} aria-valuenow={done} aria-valuemin={0} aria-valuemax={list.length}
                className="lesson-module-progress" style={{ '--module-progress': `${list.length ? done / list.length * 100 : 0}%` } as CSSProperties}>
                <span>{done}/{list.length}</span>
              </div>
            </div>
          </div>
          <LearningPath mod={item} doneList={doneFor[item.id] ?? []} lang={settings.language} selected={selected} activeModuleId={currentModule?.id}
            onSelect={(selection, trigger) => { selectPathNode(selection, trigger); setCollapsed(false) }} />
        </section>
      })}
      {currentModule && !selected && <div className="pointer-events-none fixed bottom-[calc(2rem+var(--safe-bottom,0px))] left-0 right-0 z-20 flex justify-center">
        <Button className="pointer-events-auto rounded-full bg-psuccess text-white shadow-lg" onClick={jumpToCurrent}><ArrowDown size={17} />{tt('pathJump')}</Button>
      </div>}

      {selected && selectedMod && !reader && !completion && <LessonPreview
        title={selected.check ? tt('pathLevelCheck') : selectedLesson ? (ru ? selectedLesson.titleRu : selectedLesson.titleUz) : ''}
        selectionKey={`${selected.moduleId}:${selected.idx}`} check={selected.check} current={isSelectedCurrent}
        premiumRequired={selected.check ? !isPremium : !canReadLesson(isPremium, selected.moduleId, selected.idx)}
        done={!selected.check && !!doneFor[selected.moduleId]?.includes(selected.idx)} lang={settings.language} collapsed={collapsed}
        onJump={currentModule ? jumpToCurrent : undefined} jumpDirection={jumpDirection}
        onClose={() => { setCollapsed(true); selectedTrigger.current?.focus({ preventScroll: true }) }}
        onPractice={() => selected.check ? practiceModule(selectedMod) : practiceLesson(selectedMod, selected.idx)}
        onStart={() => {
          if (launch) return
          if (!canReadLesson(isPremium, selected.moduleId, selected.idx) || (selected.check && !isPremium)) { requestPremium(); return }
          if (selected.check) { practiceModule(selectedMod); return }
          const target = { mod: selectedMod, idx: selected.idx }
          if (settings.noAnimation || window.matchMedia('(prefers-reduced-motion: reduce)').matches) setReader(target)
          else setLaunch({ ...target, origin: lessonLaunchOrigin(selectedTrigger.current) })
        }} />}
      {launch && <LessonLaunch origin={launch.origin} lang={settings.language}
        onReveal={() => {
          if (!canReadLesson(isPremium, launch.mod.id, launch.idx)) { requestPremium(); return }
          setReader({ mod: launch.mod, idx: launch.idx })
        }}
        onFinish={() => setLaunch(null)}
        onCancel={() => { setLaunch(null); setReader(null) }} />}

      {toast && (
        <div role="status" className="fixed bottom-[calc(5rem+var(--safe-bottom,0px))] left-5 right-5 z-40 flex items-center justify-center gap-2 rounded-2xl bg-pwarning/15 px-4 py-3 text-center text-[13px] font-medium text-pfg shadow-lg">
          <AlertTriangle size={15} strokeWidth={1.75} className="flex-none text-pwarning" />
          {toast}
        </div>
      )}

      {reader && (
        <LessonScreen
          mod={reader.mod}
          lessonIdx={reader.idx}
          onClose={() => { setReader(null); setLaunch(null) }}
          onPremium={requestPremium}
          onDone={(idx) => {
            if (!canReadLesson(useAppStore.getState().tariff === 'premium', reader.mod.id, idx)) { requestPremium(); return }
            const finished = reader.mod
            const list = lessons[finished.id] ?? []
            const previous = useLessonsStore.getState().byUser[userId]?.[finished.id] ?? []
            const wasDone = list.every((_, i) => previous.includes(i))
            markDone(userId, reader.mod.id, idx)
            if (!wasDone && list.every((_, i) => i === idx || previous.includes(i))) {
              const progress = useLessonsStore.getState().byUser[userId] ?? {}
              const courseDone = modules.every((m) => (lessons[m.id] ?? []).every((_, i) => progress[m.id]?.includes(i)))
              setReader(null)
              setCompletion({ finished, next: courseDone ? undefined : modules[modules.findIndex((m) => m.id === finished.id) + 1], courseDone })
            }
            // Dars bilan shug'ullanish ham kunlik faollik — streak yoziladi (kunda 1 marta)
            void useDailyStore.getState().touchActivity(
              userId, todayStr(), useSubjectStore.getState().subjectId,
            )
          }}
          onPractice={(idx) => practiceLesson(reader.mod, idx)}
        />
      )}
      {completion && <ModuleComplete completion={completion} lang={settings.language}
        onContinue={continueModule} onStay={() => setCompletion(null)} />}
    </div>
  )
}
