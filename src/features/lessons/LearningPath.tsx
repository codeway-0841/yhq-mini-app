import { modules } from '../../content/modules'
import { lessons } from '../../content/lessons'
import { useT, type Lang } from '../../shared/i18n'
import LessonToken from './LessonToken'
import './learning-path.css'

type Mod = typeof modules[number]
export type PathSelection = { moduleId: number; idx: number; check: boolean }

export default function LearningPath({ mod, doneList, lang, selected, activeModuleId, onSelect }: {
  mod: Mod; doneList: number[]; lang: Lang; selected: PathSelection | null; activeModuleId?: number
  onSelect: (selection: PathSelection, trigger: HTMLButtonElement) => void
}) {
  const tt = useT(lang)
  const list = lessons[mod.id] ?? []
  const activeIdx = list.findIndex((_, idx) => !doneList.includes(idx))
  const nodes = [
    ...list.map((lesson, idx) => ({ idx, check: false, title: lang === 'ru' ? lesson.titleRu : lesson.titleUz })),
    { idx: list.length, check: true, title: tt('pathLevelCheck') },
  ]
  return <div className="learning-path">
    <ol aria-label={tt('pathLabel')} className="m-0 list-none p-0">
      {nodes.map((node, i) => {
        const done = !node.check && doneList.includes(node.idx)
        const current = !node.check && mod.id === activeModuleId && node.idx === activeIdx
        const chosen = selected?.moduleId === mod.id && selected.idx === node.idx && selected.check === node.check
        const status = node.check ? tt('pathCheckHint') : done ? tt('pathDone') : current ? tt('pathCurrent') : tt('pathUnread')
        return <li key={node.idx} className="learning-row" data-turn={i % 4}>
          <button type="button" data-path-node data-module={mod.id} data-lesson={node.idx} data-check={node.check}
            aria-current={current ? 'step' : undefined} aria-pressed={chosen}
            aria-controls={chosen ? 'lesson-preview' : undefined}
            aria-label={node.check ? node.title + ' — ' + (lang === 'ru' ? mod.titleRu : mod.title) : `${node.idx + 1}. ${node.title} — ${status}`}
            onClick={(event) => onSelect({ moduleId: mod.id, idx: node.idx, check: node.check }, event.currentTarget)}
            className="learning-node">
            <LessonToken done={done} current={current} check={node.check} />
            <span className="learning-node-copy">
              <span className="learning-node-meta">{node.check ? tt('pathModule') : node.idx + 1 + ' · ' + tt('lessonWord')}</span>
              <span className="learning-node-title">{node.title}</span>
              {current && <span className="learning-current-label">{tt('pathCurrent')}</span>}
            </span>
          </button>
        </li>
      })}
    </ol>
  </div>
}
