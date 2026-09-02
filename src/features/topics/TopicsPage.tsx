import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../../shared/store/useAppStore'
import { useLessonsStore } from '../../shared/store/useLessonsStore'
import { useT } from '../../shared/i18n'
import { modules } from '../../content/modules'
import { lessons as lessonsData } from '../../content/lessons'
import lessonMap from '../../content/lessonMap.yhq.json'
import { goBack } from '../../shared/lib/navigation'
import { Lock, Play, Check, ChevronLeft, ChevronDown } from 'lucide-react'
import { getModuleIcon } from '../lessons'
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
    <div className="rounded-container border border-pline bg-pcard overflow-hidden">
      {/* Modul sarlavhasi — bosilganda ochiladi/yopiladi */}
      <button onClick={onToggle} className="w-full flex items-center gap-3 p-3.5 text-left active:opacity-80">
        <div className="w-10 h-10 rounded-control bg-psurface flex items-center justify-center flex-shrink-0">
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

export default function TopicsPage() {
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

  const startLesson = (l: LessonMeta) => {
    const lessonTitle = lang === 'ru' ? `Урок ${l.idx + 1}: ${l.title}` : `${l.idx + 1}-dars: ${l.title}`
    navigate('/test/1', {
      state: { questionIds: l.ids, title: lessonTitle },
    })
  }

  return (
    <div className="px-4 pb-4">
      <header className="sticky top-0 z-30 -mt-[var(--safe-top-body,0px)] pt-[var(--safe-top,0px)] -mx-4 px-4 py-2.5 bg-pcanvas border-b border-pline flex items-center gap-2 mb-4">
        <button onClick={() => goBack(navigate)} aria-label="Orqaga"
          className="grid size-10 place-items-center rounded-control text-pmuted transition-colors duration-[120ms] ease-out hover:bg-psurface hover:text-pfg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pprimary">
          <ChevronLeft size={20} strokeWidth={1.75} />
        </button>
        <h1 className="text-xl font-semibold">{tt('topics')}</h1>
      </header>

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
