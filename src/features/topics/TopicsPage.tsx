import { useMemo, useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../../shared/store/useAppStore'
import { useLessonsStore } from '../../shared/store/useLessonsStore'
import { useSubjectStore } from '../../shared/store/useSubjectStore'
import { useQuestionsStore } from '../../shared/store/useQuestionsStore'
import { api } from '../../shared/api'
import { config } from '../../shared/config'
import { useT } from '../../shared/i18n'
import { modules } from '../../content/modules'
import { lessons as lessonsData } from '../../content/lessons'
import lessonMap from '../../content/lessonMap.yhq.json'
import { goBack } from '../../shared/lib/navigation'
import { PageHeader } from '../../shared/components/ui/page-header'
import { Lock, Play, Check, ChevronDown, ChevronRight, BookOpen } from 'lucide-react'
import { getModuleIcon } from '../lessons'
import { sortTopicsForTickets } from '../tickets'
import { cn } from '../../shared/lib/cn'

/** ── Dars-bobliq test (v1.1: CURATED mapping — runtime keyword emas!) ──────
 *
 *  Runtime da savollarni keyword bilan taxmin qilmaymiz — buning o'rniga
 *  `src/content/lessonMap.yhq.json` ichida manual curate qilingan DARS → questionIds
 *  jadvalini o'qiymiz. Bu:
 *   ✓ deterministik: bir xil darsda bir xil test har doim
 *   ✓ haqiqiy: har savol manual review qilingan (tramvay kabi maxsuslar manual
 *     kiritilgan)
 *   ✓ multi-fan: kelajakda `lessonMap.fizika.json` qo'shilganda hech qanday
 *     runtime o'zgarish kerak emas — faqat JSON fayl!
 *
 *  Format: { "modulID:darsIdx": [savolID, savolID, ...] }
 *
 *  HIDE qoidasi saqlanadi — manual mapping bo'lmasa (yashirin) yoki 3'tan kam
 *  boʻlsa, yashirin ("so'xta" kichik testlar ko'rsatilmaydi). */

const MIN_VISIBLE = 3   // kam savol — test deb ko'rinmaslik (kam bo'lsa dars yashirin)

interface LessonMeta { idx: number; title: string; ids: number[] }

/** Bitta dars qatori holati (Darslik qoidasi: oldingi dars tugallanmagan — keyingisi quful) */
type LessonState = 'done' | 'active' | 'locked'

function ModuleCard({ mod, lessons, doneIdx, lang, open, onToggle, onLesson }: {
  mod: typeof modules[number]
  lessons: LessonMeta[]          // FAQAT visible (test bor) darslar
  doneIdx: number[]
  lang: 'uz' | 'ru'
  open: boolean
  onToggle: () => void
  onLesson: (l: LessonMeta) => void
}) {
  const total = lessons.length
  const done  = lessons.filter((l) => doneIdx.includes(l.idx)).length
  const pct   = total > 0 ? Math.round((done / total) * 100) : 0
  const name  = lang === 'ru' ? mod.titleRu : mod.title
  const state = (idx: number): LessonState =>
    doneIdx.includes(idx) ? 'done' : idx === 0 || doneIdx.includes(idx - 1) ? 'active' : 'locked'

  return (
    <div className="rounded-2xl bg-pcard overflow-hidden shadow-xs">
      {/* Modul sarlavhasi — bosilganda ochiladi/yopiladi */}
      <button onClick={onToggle} className="w-full flex items-center gap-3 p-3.5 text-left active:opacity-80">
        <div className="size-10 rounded-xl bg-psurface flex items-center justify-center flex-shrink-0">
          {(() => { const ModIcon = getModuleIcon(mod.id); return <ModIcon size={18} strokeWidth={1.75} className="text-pmuted" /> })()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[15px] font-semibold text-pfg truncate">{name}</p>
          <p className="text-[11px] text-psubtle">{total} {lang === 'ru' ? 'тестов' : 'ta test'}</p>
        </div>
        <div className="flex items-center gap-2.5 flex-shrink-0">
          <div className="text-right">
            <p className="text-[11px] font-semibold text-pfg leading-none">{done}/{total}</p>
            <div className="w-20 h-1.5 rounded-full bg-plineStrong mt-1 overflow-hidden">
              <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: 'var(--p-primary)' }} />
            </div>
          </div>
          <ChevronDown size={16} strokeWidth={1.75} className={`text-psubtle transition-transform ${open ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {/* Modul ichidagi FAQAT ko'rinadigan darslar (real test bor) */}
      {open && (
        <div className="border-t border-pline">
          {total === 0 && (
            <p className="text-center text-pmuted text-xs py-4">{lang === 'ru' ? 'Уроки скоро' : 'Darslar tez kunda'}</p>
          )}
          {lessons.map((l) => {
            const st = state(l.idx)
            return (
              <button key={l.idx} onClick={() => st !== 'locked' && onLesson(l)} disabled={st === 'locked'}
                className={`w-full flex items-center gap-3 px-3.5 py-3 text-left transition-colors ${
                  st === 'locked' ? 'opacity-45 cursor-not-allowed' : 'hover:bg-psurface active:opacity-80'}`}>
                {/* Chap icon — holat bo'yicha (borderlarsiz, toza fonda) */}
                <div className={cn(
                  "w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0",
                  st === 'done'
                    ? "bg-[color-mix(in_srgb,var(--p-primary)_15%,transparent)] text-pprimary"
                    : st === 'active'
                      ? "bg-[color-mix(in_srgb,var(--p-blue)_15%,transparent)] text-pblue"
                      : "bg-psurface text-pmuted"
                )}>
                  {st === 'done'
                    ? <Check size={16} strokeWidth={2} />
                    : st === 'active'
                      ? <Play size={14} strokeWidth={2} />
                      : <Lock size={13} strokeWidth={1.75} />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-pfg truncate">
                    {lang === 'ru' ? `Урок ${l.idx + 1}. ${l.title}` : `${l.idx + 1}-dars. ${l.title}`}
                  </p>
                  <p className="text-[10px] text-psubtle">{l.ids.length} {lang === 'ru' ? 'вопросов' : 'savol'}</p>
                </div>
                <div className="flex-shrink-0">
                  {st === 'done'
                    ? <Check size={17} strokeWidth={1.75} className="text-pprimary" />
                    : st === 'locked'
                      ? <Lock size={14} strokeWidth={1.75} className="text-pmuted" />
                      : null}
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

/** YHQ — curated dars/modul ko'rinishi (lessonMap.yhq.json, progress bilan). */
function YhqTopics() {
  const navigate = useNavigate()
  // Selector'li obuna — whole-store EMAS
  const settings    = useAppStore((s) => s.settings)
  const user        = useAppStore((s) => s.user)
  const tt = useT(settings.language)
  const lang = settings.language
  const uid = user?.id ?? '0'
  const lessonsProg = useLessonsStore((s) => s.byUser[uid])

  const [openId, setOpenId] = useState<number>(1)   // birinchi modul default ochiq

  /** Har modul uchun VISIBLE darslar: FAQAT curated mapping'da borlar (3+ savol) */
  const visibleByMod = useMemo(() => {
    const perMod: Record<number, LessonMeta[]> = {}
    const map = (lessonMap as Record<string, number[]>)
    for (const mod of modules) {
      const list = lessonsData[mod.id] ?? []
      const rows = list.map((lesson, idx) => ({
        idx,
        title: lang === 'ru' ? lesson.titleRu : lesson.titleUz,
        ids: map[`${mod.id}:${idx}`] ?? [],
      }))
      perMod[mod.id] = rows.filter((r) => r.ids.length >= MIN_VISIBLE)
    }
    return perMod
  }, [lang])

  const startLesson = (modId: number, l: LessonMeta) => {
    const lessonTitle = lang === 'ru' ? `Урок ${l.idx + 1}: ${l.title}` : `${l.idx + 1}-dars: ${l.title}`
    // v2: curated lesson server session orqali (master ID'siz)
    navigate('/test/1', config.testSessionsV2Enabled
      ? {
          state: {
            mode: 'lesson',
            serverSelector: { type: 'lesson', moduleId: modId, lessonIndex: l.idx },
            title: lessonTitle,
          },
        }
      : {
          state: { questionIds: l.ids, title: lessonTitle },
        })
  }

  return (
    // Desktop: akkordeon ro'yxat tor markaziy ustunda (ochiladigan kontent uchun).
    <div className="px-4 pb-4 lg:mx-auto lg:w-full lg:max-w-2xl">
      <PageHeader title={tt('topics')} onBack={() => goBack(navigate)} backLabel="Orqaga" className="-mx-4 mb-4" />

      <div className="flex flex-col gap-2.5">
        {modules.map((mod) => {
          const lessons = visibleByMod[mod.id] ?? []
          if (lessons.length === 0) return null   // testli darsi yo'q modul — ko'rsatilmaydi
          const doneLessonsIdx = lessonsProg?.[mod.id] ?? []
          return (
            <ModuleCard
              key={mod.id}
              mod={mod}
              lessons={lessons}
              doneIdx={doneLessonsIdx}
              lang={lang}
              open={openId === mod.id}
              onToggle={() => setOpenId((o) => o === mod.id ? 0 : mod.id)}
              onLesson={(l) => startLesson(mod.id, l)}
            />
          )
        })}
      </div>
    </div>
  )
}

/** Boshqa fanlar — server'dagi REAL mavzular (har fanda o'z mavzulari). */
function SubjectTopics({ subjectId }: { subjectId: string }) {
  const navigate = useNavigate()
  const settings = useAppStore((s) => s.settings)
  const solvedQuestions = useAppStore((s) => s.solvedQuestions ?? [])
  const questions = useQuestionsStore((s) => s.questions)
  const topics = useQuestionsStore((s) => s.topics)
  const loaded = useQuestionsStore((s) => s.loaded)
  const loading = useQuestionsStore((s) => s.loading)
  const error = useQuestionsStore((s) => s.error)
  const storedSubjectId = useQuestionsStore((s) => s.subjectId)
  const loadQs = useQuestionsStore((s) => s.load)
  const loadTopics = useQuestionsStore((s) => s.loadTopics)
  const retry = useQuestionsStore((s) => s.retry)
  const tt = useT(settings.language)
  const lang = settings.language
  const userId = useAppStore((s) => s.user?.id)

  // v2: mavzular metadata'dan, ochilish server topic session orqali.
  // Progress chiziqlari uchun savol-darajali mapping kerak — metadata'da yo'q,
  // shuning uchun v2'da faqat sonlar (keyingi bosqichda server agregati).
  const isV2 = config.testSessionsV2Enabled
  const [topicsFailed, setTopicsFailed] = useState(false)
  const [topicsRetry, setTopicsRetry] = useState(0)

  useEffect(() => {
    if (!isV2) {
      if ((!loaded && !loading && !error) || storedSubjectId !== subjectId) {
        void loadQs(lang, subjectId)
      }
      return
    }
    if (storedSubjectId !== subjectId || topics.length === 0) {
      setTopicsFailed(false)
      void loadTopics(subjectId).catch(() => setTopicsFailed(true))
    }
  }, [isV2, loaded, loading, error, storedSubjectId, lang, subjectId, loadQs, loadTopics, topics.length, topicsRetry])

  // v2 progress agregati (server, question-level mapping'siz)
  const [solvedByTopic, setSolvedByTopic] = useState<Record<number, number>>({})
  useEffect(() => {
    if (!isV2 || !userId || userId === '0') return
    let cancelled = false
    api.getTopicProgress(userId, subjectId)
      .then((r) => {
        if (!cancelled) setSolvedByTopic(Object.fromEntries(r.topics.map((t) => [t.topicId, t.solved])))
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [isV2, userId, subjectId])

  const rows = useMemo(() => {
    if (isV2) {
      return sortTopicsForTickets(subjectId, topics)
        .map((t) => {
          const count = t.questionCount ?? 0
          return {
            topic: t,
            ids: [] as number[],
            done: Math.min(solvedByTopic[t.id] ?? 0, count),
            count,
          }
        })
        .filter((r) => r.count > 0)
    }
    const byTopic = new Map<number, number[]>()
    for (const q of questions) {
      if (q.topicId == null) continue
      const list = byTopic.get(q.topicId)
      if (list) list.push(q.id)
      else byTopic.set(q.topicId, [q.id])
    }
    const prefix = `${subjectId}:`
    const solved = new Set<number>()
    for (const k of solvedQuestions) {
      if (!k.startsWith(prefix)) continue
      const id = Number(k.slice(prefix.length))
      if (Number.isInteger(id)) solved.add(id)
    }
    return sortTopicsForTickets(subjectId, topics)
      .map((t) => {
        const ids = (byTopic.get(t.id) ?? []).sort((a, b) => a - b)
        return {
          topic: t,
          ids,
          done: ids.filter((id) => solved.has(id)).length,
          count: ids.length,
        }
      })
      .filter((r) => r.ids.length > 0)
  }, [isV2, solvedByTopic, questions, topics, solvedQuestions, subjectId])

  const startTopic = (topicId: number, title: string, ids: number[]) => {
    navigate('/test/1', isV2
      ? { state: { mode: 'topic', serverSelector: { type: 'topic', topicId }, title } }
      : { state: { questionIds: ids, title } })
  }

  return (
    <div className="px-4 pb-4">
      <PageHeader title={tt('topics')} onBack={() => goBack(navigate)} backLabel="Orqaga" className="-mx-4 mb-4" />

      {loading && rows.length === 0 && (
        <div className="grid place-items-center py-16">
          <div className="w-8 h-8 rounded-full border-2 border-pprimary border-t-transparent animate-spin" />
        </div>
      )}

      {error && rows.length === 0 && !loading && (
        <div className="rounded-2xl bg-pcard p-6 text-center shadow-xs">
          <p className="text-sm text-pmuted mb-3">{tt('qLoadFailed')}</p>
          <button
            type="button"
            onClick={() => void retry(lang, subjectId)}
            className="px-5 min-h-11 inline-flex items-center py-2.5 rounded-xl bg-pprimary text-sm font-semibold text-ponprimary active:scale-[0.98] transition-all"
          >
            {tt('qLoadRetry')}
          </button>
        </div>
      )}

      {loaded && !loading && rows.length === 0 && !error && (
        <p className="text-center text-sm text-pmuted py-16">{tt('topicsEmpty')}</p>
      )}

      {isV2 && rows.length === 0 && !topicsFailed && (
        <div className="grid place-items-center py-16">
          <div className="w-8 h-8 rounded-full border-2 border-pprimary border-t-transparent animate-spin" />
        </div>
      )}

      {isV2 && topicsFailed && rows.length === 0 && (
        <div className="rounded-2xl bg-pcard p-6 text-center shadow-xs">
          <p className="text-sm text-pmuted mb-3">{tt('qLoadFailed')}</p>
          <button
            type="button"
            onClick={() => setTopicsRetry((c) => c + 1)}
            className="px-5 min-h-11 inline-flex items-center py-2.5 rounded-xl bg-pprimary text-sm font-semibold text-ponprimary active:scale-[0.98] transition-all"
          >
            {tt('qLoadRetry')}
          </button>
        </div>
      )}

      <div className="flex flex-col gap-2.5 lg:grid lg:grid-cols-2 lg:items-start">
        {rows.map(({ topic, ids, done, count }) => {
          const name = lang === 'ru' ? (topic.nameRu || topic.nameUz) : (topic.nameUz || topic.nameRu)
          const shownDone = Math.min(done, count)
          const pct = count > 0 ? Math.round((shownDone / count) * 100) : 0
          return (
            <button
              key={topic.id}
              type="button"
              onClick={() => startTopic(topic.id, name, ids)}
              className="w-full flex items-center gap-3 rounded-2xl bg-pcard p-3.5 text-left shadow-xs active:scale-[0.99] transition-all"
            >
              <div className="size-10 rounded-xl bg-psurface flex items-center justify-center shrink-0">
                <BookOpen size={18} strokeWidth={1.75} className="text-pmuted" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="truncate text-[15px] font-semibold text-pfg">{name}</p>
                <div className="mt-1.5 flex items-center gap-2">
                  <div className="h-1.5 flex-1 rounded-full bg-plineStrong overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: 'var(--p-primary)' }} />
                  </div>
                  <span className="text-[11px] font-semibold text-pmuted tabular-nums shrink-0">
                    {shownDone}/{count}
                  </span>
                </div>
              </div>
              <ChevronRight size={16} strokeWidth={1.75} className="text-psubtle shrink-0" />
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default function TopicsPage() {
  const subjectId = useSubjectStore((s) => s.subjectId)
  if (subjectId === 'yhq') return <YhqTopics />
  return <SubjectTopics subjectId={subjectId} />
}
