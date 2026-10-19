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
        const current = !node.check && moduleId === activeModuleId && node.idx === activeIdx
        const chosen = selected?.moduleId === moduleId && selected.idx === node.idx && selected.check === node.check
        const status = node.check ? tt('pathCheckHint') : done ? tt('pathDone') : current ? tt('pathCurrent') : tt('pathUnread')
        return <li key={node.check ? 'check' : node.idx} className="learning-row" data-turn={i % 4}>
          <button type="button" data-path-node data-module={moduleId} data-lesson={node.idx} data-check={node.check}
            aria-current={current ? 'step' : undefined} aria-pressed={chosen}
            aria-controls={chosen ? 'lesson-preview' : undefined}
            aria-label={node.check ? node.title + ' — ' + (moduleTitle ?? node.title) : `${node.idx + 1}. ${node.title} — ${status}`}
            onClick={(event) => onSelect({ moduleId, idx: node.idx, check: node.check }, event.currentTarget)}
            className="learning-node">
            <LessonToken done={done} current={current} check={node.check} />
            <span className="learning-node-copy">
              <span className="learning-node-meta">{node.check ? tt('pathModule') : node.idx + 1 + ' · ' + label}</span>
              <span className="learning-node-title">{node.title}</span>
              {current && <span className="learning-current-label">{tt('pathCurrent')}</span>}
            </span>
          </button>
        </li>
      })}
    </ol>
  </div>
}
