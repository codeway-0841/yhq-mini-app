import { useT, type Lang } from '../../shared/i18n'
import LessonToken from './LessonToken'
import './learning-path.css'

export type PathSelection = { moduleId: number; idx: number; check: boolean }

const TURN_X = [10, 28, 46, 28] as const

/**
 * Learning path — modul (blok) ichidagi mavzular "yo'l" ko'rinishida.
 *
 * Komponent kontentga bog'lanmagan: sarlavhalar `nodes` prop orqali keladi,
 * shuning uchun uni YHQ darsligi ham, rus tili darsligi ham ishlatadi.
 * Progress indeksi = `nodes` tartibi (0-based).
 */
export default function LearningPath({
  moduleId,
  nodes,
  nodeLabel,
  doneList,
  lang,
  selected,
  activeModuleId,
  onSelect,
  checkLabel,
  moduleTitle,
  lockedList,
  readList,
  startIndex = 0,
}: {
  moduleId: number
  nodes: readonly string[]
  /** Tugun ustidagi kichik yozuv; berilmasa `dars` */
  nodeLabel?: string
  doneList: number[]
  lang: Lang
  selected: PathSelection | null
  activeModuleId?: number
  onSelect: (selection: PathSelection, trigger: HTMLButtonElement) => void
  /** Berilsa yo'l oxiriga "nazorat" tuguni qo'shiladi (YHQ) */
  checkLabel?: string
  /** `checkLabel` tugunining aria-label'i uchun modul nomi */
  moduleTitle?: string
  /** Ketma-ket ochilish: oldingi mavzular testlaridan o'tilmaguncha qulflangan tugunlar */
  lockedList?: number[]
  /** O'qilgan, lekin testdan o'tilmagan mavzular */
  readList?: number[]
  /** Katta modullarni oynalab ko'rsatganda asl mavzu indeksi. */
  startIndex?: number
}) {
  const tt = useT(lang)
  const activeIdx = nodes.findIndex((_, idx) => !doneList.includes(startIndex + idx))
  const list = [
    ...nodes.map((title, idx) => ({ idx: startIndex + idx, check: false, title })),
    ...(checkLabel ? [{ idx: startIndex + nodes.length, check: true, title: checkLabel }] : []),
  ]
  const label = nodeLabel ?? tt('lessonWord')

  return (
    <div className="learning-path">
      <ol aria-label={tt('pathLabel')} className="m-0 list-none p-0">
        {list.map((node, i) => {
          const done = !node.check && doneList.includes(node.idx)
          const locked = !node.check && (lockedList?.includes(node.idx) ?? false)
          const pending = !node.check && !done && !locked && (readList?.includes(node.idx) ?? false)
          const current = !node.check && !locked && moduleId === activeModuleId && node.idx === startIndex + activeIdx
          const chosen = selected?.moduleId === moduleId && selected.idx === node.idx && selected.check === node.check
          const turn = i % 4
          const nextTurn = (i + 1) % 4
          const x1 = TURN_X[turn] + 42
          const x2 = TURN_X[nextTurn] + 42

          const status = node.check
            ? tt('pathCheckHint')
            : locked
              ? tt('pathLocked')
              : done
                ? tt('pathDone')
                : pending
                  ? tt('rusDarslikQuizPending')
                  : current
                    ? tt('pathCurrent')
                    : tt('pathUnread')

          return (
            <li
              key={node.check ? 'check' : node.idx}
              className="learning-row"
              data-turn={turn}
              data-done={done ? 'true' : undefined}
              data-current={current ? 'true' : undefined}
            >
              {i < list.length - 1 && (
                <svg
                  aria-hidden="true"
                  className="learning-connector"
                  viewBox="0 0 140 100"
                  preserveAspectRatio="none"
                >
                  <path
                    d={`M ${x1} 0 C ${x1} 52, ${x2} 48, ${x2} 100`}
                    fill="none"
                    stroke={done ? 'var(--p-primary)' : 'color-mix(in srgb, var(--p-line-strong, var(--p-line)) 95%, transparent)'}
                    strokeWidth={done ? '3.5' : '2.5'}
                    strokeDasharray={done ? undefined : '6 6'}
                    strokeLinecap="round"
                  />
                </svg>
              )}
              <button
                type="button"
                data-path-node
                data-module={moduleId}
                data-lesson={node.idx}
                data-check={node.check}
                data-locked={locked ? 'true' : undefined}
                aria-current={current ? 'step' : undefined}
                aria-pressed={chosen}
                aria-disabled={locked || undefined}
                aria-controls={chosen ? 'lesson-preview' : undefined}
                aria-label={node.check ? node.title + ' — ' + (moduleTitle ?? node.title) : `${node.idx + 1}. ${node.title} — ${status}`}
                onClick={(event) => onSelect({ moduleId, idx: node.idx, check: node.check }, event.currentTarget)}
                className={locked ? 'learning-node learning-node--locked' : 'learning-node'}
              >
                <LessonToken
                  done={done}
                  current={current}
                  check={node.check}
                  locked={locked}
                  read={pending}
                  stepNumber={node.check ? undefined : node.idx + 1}
                />
                <span className="learning-node-copy">
                  {(current || pending || node.check) && (
                    <span className="learning-node-header">
                      <span className="learning-node-meta">
                        {node.check ? tt('pathModule') : `${node.idx + 1} · ${label}`}
                      </span>
                      {(current || pending) && (
                        <span
                          className={
                            pending
                              ? 'learning-current-label learning-current-label--pending'
                              : 'learning-current-label'
                          }
                        >
                          {pending ? tt('rusDarslikQuizPending') : tt('pathCurrent')}
                        </span>
                      )}
                    </span>
                  )}
                  <span className="learning-node-title">{node.title}</span>
                </span>
              </button>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
