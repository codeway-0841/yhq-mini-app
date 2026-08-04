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

/** ── Dars-bobliq test qoidasi ──────────────────────────────────────────────
 *  YANGI ALGORITM (foydalanuvchi talabiga binoan):
 *
 *  1. **Bank-WIDE keyword match**: darsning kalit so'zlari (title + maxsus aliaslar)
 *     bilan BUTUN savollar bazasidan qidiriladi — tramvay question "umumiy" topic'da
 *     bo'lsa ham uchraydi (modul topic id chegarasi olingan endi EMAS).
 *  2. **FILL/KOPAYTIRISH YO'Q**: testda faqat REAL kalit-mos savollar bo'ladi
 *     (faqat shunga doir test — chala "so'xta" test emas!).
 *  3. **HIDE qoidasi**: agar dars uchun kamida MIN_VISIBLE=3 ta real mos savol
 *     topilmasa — shu dars Mavzular ro'yxatida CHIQARILMAYDI (boshqa darslar ham
 *     xuddi shu qoida bilan filtrlanadi — "so'xta" test sahifasi yo'q).
 */

const MIN_VISIBLE = 3   // kam savol — test deb ko'rinmaslik (kam bo'lsa dars yashirin)
const MAX_VISIBLE = 12  // eng ko'pi shuncha savol — dars testi ixcham

/** Qo'lda aliaslar — buhimtsiz maxsus darslar uchun "${modId}:${darsIdx}" */
const LESSON_ALIAS: Record<string, { uz: string[]; ru: string[] }> = {
  '2:3': { uz: ['tramvay', 'ustuvorlik'], ru: ['трамвай', 'приоритет'] },
  '5:0': { uz: ['maxsus signal', 'militsiya', 'pojar'], ru: ['спецсигнал', 'милиц'] },
  '5:2': { uz: ["temir yo'l", 'shlagbaum'], ru: ['железнодорож', 'шлагбаум'] },
  '5:4': { uz: ['sirpanchiq', 'muzlama', 'qor'], ru: ['скользк', 'гололед', 'снег'] },
  '5:5': { uz: ["yomg'ir", 'tuman', 'fara'], ru: ['дождь', 'туман', 'фар'] },
  '6:0': { uz: ['aholi punkti', 'shaharda'], ru: ['населенн', 'город'] },
  '7:1': { uz: ['bolalar', 'maktab'], ru: ['детей', 'школ', 'учащ'] },
}

/** Sarlavhadan keywords: uzun so'zlarni olamiz (stopword'siz) */
function titleKeywords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[()—–-]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 5)
    .slice(0, 5)
}

/** Kengaytirilgan keyword set (title + alias, lang bo'yicha) */
function lessonKeywords(modId: number, idx: number, lesson: { titleUz: string; titleRu: string }, lang: 'uz' | 'ru'): string[] {
  const alias = LESSON_ALIAS[`${modId}:${idx}`]?.[lang] ?? []
  const title = lang === 'ru' ? lesson.titleRu : lesson.titleUz
  return [...new Set([...titleKeywords(title), ...alias])]
}

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
    <div className="card-neon overflow-hidden">
      {/* Modul sarlavhasi — bosilganda ochiladi/yopiladi */}
      <button onClick={onToggle} className="w-full flex items-center gap-3 p-3.5 text-left active:opacity-80">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
          style={{ background: `${mod.color}26`, border: `1px solid ${mod.color}55`, boxShadow: `0 0 14px ${mod.color}55` }}>
          {mod.icon}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[15px] font-black text-fg truncate">{name}</p>
          <p className="text-[11px] text-subtle">{total} {lang === 'ru' ? 'тестов' : 'ta test'}</p>
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

      {/* Modul ichidagi FAQAT ko'rinadigan darslar (real test bor) */}
      {open && (
        <div className="border-t border-line/50">
          {total === 0 && (
            <p className="text-center text-muted text-xs py-4">{lang === 'ru' ? 'Уроки скоро' : 'Darslar tez kunda'}</p>
          )}
          {lessons.map((l) => {
            const st = state(l.idx)
            return (
              <button key={l.idx} onClick={() => st !== 'locked' && onLesson(l)} disabled={st === 'locked'}
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
                    {l.idx + 1}-dars. {l.title}
                  </p>
                  <p className="text-[10px] text-subtle">{l.ids.length} {lang === 'ru' ? 'вопросов' : 'savol'}</p>
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
  const { questions } = useQuestionsStore()
  const lang = settings.language
  const uid = user?.id ?? '0'
  const lessonsProg = useLessonsStore((s) => s.byUser[uid])

  const [openId, setOpenId] = useState<number>(1)   // birinchi modul default ochiq

  const totalWrong = useMemo(
    () => Object.values(wrongByTicket).filter((n) => n > 0).length,
    [wrongByTicket]
  )

  /** Har modul uchun VISIBLE darslar: faqat kamida 3 ta real kalit-mos savoli borlar */
  const visibleByMod = useMemo(() => {
    const perMod: Record<number, LessonMeta[]> = {}
    for (const mod of modules) {
      const list = lessonsData[mod.id] ?? []
      const rows = list.map((lesson, idx) => {
        const kws = lessonKeywords(mod.id, idx, lesson, lang)
        const ids = kws.length === 0
          ? []
          : questions
              .filter((q) => {
                const t = q.text.toLowerCase()
                return kws.some((k) => t.includes(k))
              })
              .sort((a, b) => a.id - b.id)
              .slice(0, MAX_VISIBLE)
              .map((q) => q.id)
        return {
          idx,
          title: lang === 'ru' ? lesson.titleRu : lesson.titleUz,
          ids,
        }
      })
      perMod[mod.id] = rows.filter((r) => r.ids.length >= MIN_VISIBLE)
    }
    return perMod
  }, [questions, lang])

  const startLesson = (l: LessonMeta) => {
    navigate('/test/1', {
      state: { questionIds: l.ids, title: `${l.idx + 1}-dars: ${l.title}` },
    })
  }

  const startMistakes = () => {
    const ids = questions.filter((q) => (wrongByTicket[q.id] ?? 0) > 0).map((q) => q.id)
    if (ids.length === 0) return
    navigate('/test/1', { state: { questionIds: ids, title: tt('fixMistakes') } })
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
              onLesson={(l) => startLesson(l)}
            />
          )
        })}
      </div>
    </div>
  )
}
