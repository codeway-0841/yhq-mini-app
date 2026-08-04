import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuestionsStore } from '../../store/useQuestionsStore'
import { useAppStore } from '../../shared/store/useAppStore'
import { useLessonsStore } from '../../store/useLessonsStore'
import { useT } from '../../shared/i18n'
import { modules } from '../../data/modules'
import { lessons as lessonsData } from '../../data/lessons'
import { goBack } from '../../lib/navigation'
import { HeartCrack, Lock, Play, Check } from 'lucide-react'

/** Darslik moduli → DB mavzu slug'lari (darsga mos SAVOLLAR topish uchun) */
const MODULE_TOPICS: Record<number, string[]> = {
  1: ['yol-belgilari', 'yol-chiziqlari'],
  2: ['chorrahalar'],
  3: ['toxtatish-va-turish'],
  4: ['manyovr', 'quvib-otish', 'signallar'],
  5: ['temir-yol', 'yuk-tashish', 'yolovchi-tashish', 'shatakka-olish', 'avtomagistral', 'sirpanchiq-yol'],
  6: ['tezlik'],
  7: ['piyodalar'],
  8: ['birinchi-tibbiy-yordam', 'texnik-holat', 'yoritish', 'haydovchi-majburiyatlari'],
}

/** Deterministik shuffle — har dars uchun savollar TURLICHA, lekin har qayta kirishda bir xil */
function seededShuffle<T>(arr: T[], seed: number): T[] {
  const a = [...arr]
  let s = seed
  const rnd = () => {
    s |= 0; s = (s + 0x6D2B79F5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/** Bitta dars qatori holati (Darslik qoidasi: oldingi dars tugallanmagan — keyingisi quful) */
type LessonState = 'done' | 'active' | 'locked'

function ModuleCard({ mod, lessonsList, doneIdx, lang, open, onToggle, onLesson }: {
  mod: typeof modules[number]
  lessonsList: { titleUz: string; titleRu: string }[]
  doneIdx: number[]
  lang: 'uz' | 'ru'
  open: boolean
  onToggle: () => void
  onLesson: (modId: number, idx: number) => void
}) {
  const total = lessonsList.length
  const done  = doneIdx.length
  const pct   = total > 0 ? Math.round((done / total) * 100) : 0
  const name  = lang === 'ru' ? mod.titleRu : mod.title
  const openIdx = (i: number): LessonState =>
    doneIdx.includes(i) ? 'done' : i === 0 || doneIdx.includes(i - 1) ? 'active' : 'locked'

  return (
    <div className="card-neon overflow-hidden">
      {/* Modul sarlavhasi — bosilganda ochiladi/yopiladi */}
      <button onClick={onToggle} className="w-full flex items-center gap-3 p-3.5 text-left active:opacity-80">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
          style={{ background: `${mod.color}26`, border: `1px solid ${mod.color}55`, boxShadow: `0 0 14px ${mod.color}55` }}>
          {mod.icon}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[15px] font-black text-fg truncate">{name}</p>
          <p className="text-[11px] text-subtle">{total} ta dars</p>
        </div>
        <div className="flex items-center gap-2.5 flex-shrink-0">
          <div className="text-right">
            <p className="text-[11px] font-black text-fg leading-none">{done}/{total}</p>
            <div className="w-20 h-1.5 rounded-full bg-line mt-1 overflow-hidden">
              <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: mod.color, boxShadow: `0 0 6px ${mod.color}` }} />
            </div>
          </div>
          <span className={`text-subtle transition-transform ${open ? 'rotate-180' : ''}`}>⌄</span>
        </div>
      </button>

      {/* Modul ichidagi DARSLAR (Darslik'dagi darsliklar ro'yxati) */}
      {open && (
        <div className="border-t border-line/50">
          {total === 0 && (
            <p className="text-center text-muted text-xs py-4">{lang === 'ru' ? 'Уроки скоро' : 'Darslar tez kunda'}</p>
          )}
          {lessonsList.map((l, i) => {
            const st = openIdx(i)
            return (
              <button key={i} onClick={() => st !== 'locked' && onLesson(mod.id, i)} disabled={st === 'locked'}
                className={`w-full flex items-center gap-3 px-3.5 py-3 text-left transition-colors ${
                  st === 'locked' ? 'opacity-45 cursor-not-allowed' : 'hover:bg-elevated/50 active:opacity-80'}`}>
                {/* Chap icon — holat bo'yicha */}
                <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
                  style={st === 'done'
                    ? { background: '#58cc0226', border: '1.5px solid #58cc02' }
                    : st === 'active'
                      ? { background: '#38bdf826', border: '1.5px solid #38bdf866', boxShadow: '0 0 14px rgba(56,189,248,0.4)' }
                      : { background: 'var(--theme-elevated)', border: '1.5px solid var(--theme-line)' }}>
                  {st === 'done'
                    ? <Check size={16} className="text-duo-green drop-shadow-[0_0_6px_rgba(88,204,2,0.7)]" />
                    : st === 'active'
                      ? <Play size={14} className="text-neon-blue" fill="#38bdf8" />
                      : <Lock size={13} className="text-muted" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-bold text-fg truncate">
                    {i + 1}-dars. {lang === 'ru' ? l.titleRu : l.titleUz}
                  </p>
                </div>
                <div className="flex-shrink-0">
                  {st === 'done'
                    ? <Check size={17} className="text-duo-green drop-shadow-[0_0_6px_rgba(88,204,2,0.6)]" />
                    : st === 'locked'
                      ? <Lock size={14} className="text-muted" />
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

export default function TopicsPage() {
  const navigate = useNavigate()
  const { settings, wrongByTicket, user } = useAppStore()
  const tt = useT(settings.language)
  const { questions, topics: storeTopics } = useQuestionsStore()
  const lang = settings.language
  const uid = user?.id ?? '0'
  const lessonsProg = useLessonsStore((s) => s.byUser[uid])

  const [openId, setOpenId] = useState<number>(1)   // birinchi modul default ochiq

  const totalWrong = useMemo(
    () => Object.values(wrongByTicket).filter((n) => n > 0).length,
    [wrongByTicket]
  )

  const startMistakes = () => {
    const ids = questions.filter((q) => (wrongByTicket[q.id] ?? 0) > 0).map((q) => q.id)
    if (ids.length === 0) return
    navigate('/test/1', { state: { questionIds: ids, title: tt('fixMistakes') } })
  }

  /** Dars → MAVZU TESTI: shu modulning mavzu savollaridan deterministik 10 ta.
      Seed = modId*1000 + darsIdx — har dars uchun savollar TURLICHA, ammo stabil. */
  const startLesson = (modId: number, idx: number) => {
    const slugs    = MODULE_TOPICS[modId] ?? []
    const topicIds = storeTopics.filter((t) => slugs.includes(t.slug)).map((t) => t.id)
    const pool     = questions.filter((q) => q.topicId != null && topicIds.includes(q.topicId))
    if (pool.length === 0) return   // bo'sh modul — hozircha test yo'q
    const sample = seededShuffle(pool, modId * 1000 + idx * 73).slice(0, Math.min(10, pool.length))
    navigate('/test/1', {
      state: { questionIds: sample.map((q) => q.id), title: `${idx + 1}-dars — ${tt('topicTest')}` },
    })
  }

  return (
    <div className="px-4 pt-4 pb-6">
      <div className="flex items-center gap-2 mb-4">
        <button onClick={() => goBack(navigate)} aria-label="Orqaga"
          className="text-subtle hover:text-fg text-xl px-1 transition-colors">←</button>
        <h1 className="text-xl font-black">{tt('topics')}</h1>
      </div>

      {totalWrong > 0 && (
        <button onClick={startMistakes}
          className="flex items-center justify-between w-full bg-red-900/30 border border-red-700/40 rounded-2xl px-4 py-3.5 mb-4 active:scale-[0.98] transition-transform">
          <span className="flex items-center gap-2.5 text-sm font-bold text-red-300">
            <HeartCrack size={18} />
            {tt('fixMistakes')}
          </span>
          <span className="bg-red-600 text-white text-xs font-bold px-2.5 py-0.5 rounded-full">
            {totalWrong}
          </span>
        </button>
      )}

      <div className="flex flex-col gap-2.5">
        {modules.map((mod) => {
          const doneLessonsIdx = lessonsProg?.[mod.id] ?? []
          const lessonsList = (lessonsData[mod.id] ?? []).map((l) => ({ titleUz: l.titleUz, titleRu: l.titleRu }))
          return (
            <ModuleCard
              key={mod.id}
              mod={mod}
              lessonsList={lessonsList}
              doneIdx={doneLessonsIdx}
              lang={lang}
              open={openId === mod.id}
              onToggle={() => setOpenId((o) => o === mod.id ? 0 : mod.id)}
              onLesson={startLesson}
            />
          )
        })}
      </div>
    </div>
  )
}
