import { useT, type Lang } from '../../shared/i18n'
import LessonToken from './LessonToken'
import './learning-path.css'

export type PathSelection = { moduleId: number; idx: number; check: boolean }

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
}) {
  const tt = useT(lang)
  const activeIdx = nodes.findIndex((_, idx) => !doneList.includes(idx))
  const list = [
    ...nodes.map((title, idx) => ({ idx, check: false, title })),
    ...(checkLabel ? [{ idx: nodes.length, check: true, title: checkLabel }] : []),
  ]
  const label = nodeLabel ?? tt('lessonWord')
  return <div className="learning-path">
    <ol aria-label={tt('pathLabel')} className="m-0 list-none p-0">
      {list.map((node, i) => {
        const done = !node.check && doneList.includes(node.idx)
        const locked = !node.check && (lockedList?.includes(node.idx) ?? false)
        const pending = !node.check && !done && !locked && (readList?.includes(node.idx) ?? false)
        const current = !node.check && !locked && moduleId === activeModuleId && node.idx === activeIdx
        const chosen = selected?.moduleId === moduleId && selected.idx === node.idx && selected.check === node.check
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
        return <li key={node.check ? 'check' : node.idx} className="learning-row" data-turn={i % 4}>
          <button type="button" data-path-node data-module={moduleId} data-lesson={node.idx} data-check={node.check}
            data-locked={locked ? 'true' : undefined}
            aria-current={current ? 'step' : undefined} aria-pressed={chosen}
            aria-disabled={locked || undefined}
            aria-controls={chosen ? 'lesson-preview' : undefined}
            aria-label={node.check ? node.title + ' — ' + (moduleTitle ?? node.title) : `${node.idx + 1}. ${node.title} — ${status}`}
            onClick={(event) => onSelect({ moduleId, idx: node.idx, check: node.check }, event.currentTarget)}
            className={locked ? 'learning-node learning-node--locked' : 'learning-node'}>
            <LessonToken done={done} current={current} check={node.check} locked={locked} read={pending} />
            <span className="learning-node-copy">
              <span className="learning-node-meta">{node.check ? tt('pathModule') : node.idx + 1 + ' · ' + label}</span>
              <span className="learning-node-title">{node.title}</span>
              {current && (
                <span className={pending ? 'learning-current-label learning-current-label--pending' : 'learning-current-label'}>
                  {pending ? tt('rusDarslikQuizPending') : tt('pathCurrent')}
                </span>
              )}
            </span>
          </button>
        </li>
      })}
    </ol>
  </div>
}
