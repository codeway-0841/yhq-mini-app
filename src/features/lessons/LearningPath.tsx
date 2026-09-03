import { useId, useState } from 'react'
import { BookOpen, Check, Dumbbell, Lock, Play, Trophy } from 'lucide-react'
import { modules } from '../../content/modules'
import { lessons } from '../../content/lessons'
import { useT, type Lang } from '../../shared/i18n'
import { Button } from '../../shared/components/ui/button'
import { Sheet, SheetHeader, SheetTitle, SheetDescription, SheetFooter, SheetClose } from '../../shared/components/ui/sheet'
import './learning-path.css'

type Mod = typeof modules[number]
type Selection = { idx: number; practice: boolean }
const X_POSITIONS = [27, 50, 73, 50]
const ROW_HEIGHT = 192

// A turn between each pair keeps the route's shallow, isometric slopes.
function routePoints(count: number) {
  return Array.from({ length: count }, (_, i) => {
    const x = X_POSITIONS[i % 4] * 4
    const y = i * ROW_HEIGHT + 72
    if (i === count - 1) return `${x},${y}`
    const nextX = X_POSITIONS[(i + 1) % 4] * 4
    const direction = x + nextX <= 400 ? 1 : -1
    const turnX = (x + nextX + direction * ROW_HEIGHT / .55) / 2
    const turnY = y + Math.abs(turnX - x) * .55
    return `${x},${y} ${turnX},${turnY}`
  }).join(' ')
}

/** SVG is decorative; real HTML buttons supply focus, labels and touch targets. */
function PathTile({ done, current, locked, practice }: {
  done: boolean; current: boolean; locked: boolean; practice: boolean
}) {
  const id = useId()
  const Icon = locked ? Lock : practice ? Dumbbell : done ? Check : Play
  return (
    <span className="learning-tile" data-state={locked ? 'locked' : current ? 'current' : 'open'}>
      <svg aria-hidden="true" viewBox="0 0 100 110" className="h-[110px] w-[100px]">
        <defs>
          <linearGradient id={`${id}-top`} x2="1" y2="1">
            <stop stopColor="var(--tile-light)" />
            <stop offset="1" stopColor="var(--tile-color)" />
          </linearGradient>
          <linearGradient id={`${id}-glow`} x2="0" y2="1">
            <stop stopColor="var(--tile-color)" stopOpacity="0" />
            <stop offset="1" stopColor="var(--tile-color)" stopOpacity=".22" />
          </linearGradient>
        </defs>
        <ellipse cx="50" cy="93" rx="39" ry="13" fill="var(--tile-color)" opacity=".1" />
        {!locked && <>
          <path d="M12 6H88V68L50 88 12 68Z" fill={`url(#${id}-glow)`} />
          <path d="M23 35h4v4h-4zM73 17h3v3h-3zM82 47h4v4h-4z" fill="var(--tile-light)" />
        </>}
        {current && <path d="M50 41 97 66 50 92 3 66Z" fill="none" stroke="var(--tile-color)" strokeWidth="1.5" opacity=".4" />}
        <path d="M12 65 50 85V99L12 79Z" fill="var(--tile-side)" />
        <path d="M88 65 50 85V99L88 79Z" fill="var(--tile-edge)" />
        <path d="M50 45 88 65 50 85 12 65Z" fill={`url(#${id}-top)`} />
        <path d="M50 51 77 65 50 79 23 65Z" fill="none" stroke="white" strokeOpacity=".18" />
      </svg>
      <Icon aria-hidden="true" className="learning-tile-icon" size={23} strokeWidth={2.5} />
    </span>
  )
}

export default function LearningPath({ mod, doneList, lang, onOpenLesson, onPractice }: {
  mod: Mod
  doneList: number[]
  lang: Lang
  onOpenLesson: (idx: number) => void
  onPractice: (idx: number) => void
}) {
  const tt = useT(lang)
  const [selected, setSelected] = useState<Selection | null>(null)
  const list = lessons[mod.id] ?? []
  const activeIdx = list.findIndex((_, idx) => !doneList.includes(idx))
  const nodes = list.flatMap((lesson, idx) => [
    { idx, practice: false, title: lang === 'ru' ? lesson.titleRu : lesson.titleUz },
    { idx, practice: true, title: lang === 'ru' ? lesson.titleRu : lesson.titleUz },
  ])
  const selectedLesson = selected ? list[selected.idx] : undefined
  const selectedTitle = selectedLesson && (lang === 'ru' ? selectedLesson.titleRu : selectedLesson.titleUz)

  return (
    <div className="learning-path">
      <div className="relative mx-auto max-w-[440px]">
        <svg aria-hidden="true" className="pointer-events-none absolute inset-0 w-full" style={{ height: nodes.length * ROW_HEIGHT }} viewBox={`0 0 400 ${nodes.length * ROW_HEIGHT}`} preserveAspectRatio="none">
          {nodes.map((_, i) => {
            const y = i * ROW_HEIGHT + 72
            return <path key={`decor-${i}`} d={i % 2 === 0 ? `M330 ${y - 50}l48 26-25 15m-328 15 40 22-32 18` : `M0 ${y - 28}l40 24-22 13m312 80 45-26 30 16`} fill="none" stroke="var(--p-line)" strokeWidth="2" />
          })}
          <polyline points={routePoints(nodes.length)} fill="none" stroke="var(--path-line)" strokeWidth="5" strokeLinejoin="round" strokeLinecap="round" />
        </svg>
        <ol aria-label={tt('pathLabel')} className="relative m-0 list-none p-0">
          {nodes.map((node, i) => {
            const done = doneList.includes(node.idx)
            const locked = node.practice ? !done : !done && node.idx > 0 && !doneList.includes(node.idx - 1)
            const current = !node.practice && node.idx === activeIdx
            const status = locked ? tt('pathLocked') : node.practice ? tt('pathPracticeReady') : done ? tt('pathDone') : tt('pathCurrent')
            return (
              <li key={`${node.idx}-${node.practice}`} className="relative" style={{ height: ROW_HEIGHT }}>
                <button
                  type="button"
                  disabled={locked}
                  aria-current={current ? 'step' : undefined}
                  aria-label={`${node.idx + 1}. ${node.title} — ${node.practice ? tt('pathPractice') + ', ' : ''}${status}`}
                  onClick={() => setSelected({ idx: node.idx, practice: node.practice })}
                  className="learning-node absolute flex w-[46%] -translate-x-1/2 flex-col items-center rounded-2xl text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pprimary disabled:cursor-not-allowed"
                  style={{ left: `${X_POSITIONS[i % 4]}%` }}
                >
                  <PathTile done={done} current={current} locked={locked} practice={node.practice} />
                  <span className="-mt-1 block text-[10px] font-bold uppercase tracking-[.12em] text-pmuted">
                    {node.idx + 1} · {node.practice ? tt('pathPractice') : tt('lessonWord')}
                  </span>
                  <span className="mt-1 block max-w-full break-words text-[13px] font-semibold leading-[17px] text-pfg">{node.title}</span>
                  {current && <span className="mt-1 text-[10px] font-bold text-psuccess">{tt('pathCurrent')}</span>}
                </button>
              </li>
            )
          })}
        </ol>
        {activeIdx === -1 && <div className="flex flex-col items-center gap-2 py-8 text-center">
          <Trophy aria-hidden="true" size={28} className="text-psuccess" />
          <p className="font-semibold text-pfg">{tt('pathModuleDone')}</p>
          <p className="text-sm text-pmuted">{tt('pathReviewHint')}</p>
        </div>}
      </div>

      {selected && <Sheet onClose={() => setSelected(null)}>
        <SheetClose onClose={() => setSelected(null)} label={tt('pathClose')} />
        <SheetHeader className="pr-14">
          <p className="mb-1 text-xs font-bold uppercase tracking-widest text-pmuted">{selected.idx + 1} · {selected.practice ? tt('pathPractice') : tt('lessonWord')}</p>
          <SheetTitle>{selectedTitle}</SheetTitle>
          <SheetDescription>{selected.practice ? tt('pathPracticeHint') : doneList.includes(selected.idx) ? tt('pathReviewHint') : tt('pathLessonHint')}</SheetDescription>
        </SheetHeader>
        <SheetFooter>
          <Button size="lg" block onClick={() => {
            const { idx, practice } = selected
            setSelected(null)
            if (practice) onPractice(idx)
            else onOpenLesson(idx)
          }}>
            {selected.practice ? <Dumbbell /> : <BookOpen />}
            {selected.practice ? tt('pathStartPractice') : doneList.includes(selected.idx) ? tt('pathReview') : tt('pathStartLesson')}
          </Button>
        </SheetFooter>
      </Sheet>}
    </div>
  )
}
