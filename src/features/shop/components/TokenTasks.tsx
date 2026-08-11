import { Check, Coins } from 'lucide-react'
import type { TokenTask } from '../data'

interface Props {
  tasks: TokenTask[]
  lang: 'uz' | 'ru'
}

export function TokenTasks({ tasks, lang }: Props) {
  return (
    <div className="mx-4 mt-5">
      <h3 className="text-[14px] font-bold text-pfg mb-3">
        {lang === 'ru' ? 'Как получить токены?' : 'Tokenlar qanday olinadi?'}
      </h3>
      <div className="rounded-2xl overflow-hidden border border-pline divide-y divide-pline">
        {tasks.map((task) => (
          <div key={task.id} className="flex items-center gap-3 px-4 py-3 bg-pcard">
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${
              task.completed
                ? 'bg-psuccess/20 border border-psuccess/40'
                : 'bg-pcanvas border border-pline'
            }`}>
              {task.completed
                ? <Check size={14} className="text-psuccess" />
                : <span className="text-[10px] text-psubtle font-bold">{task.progress}/{task.total}</span>
              }
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[12.5px] font-semibold text-pfg truncate">
                {lang === 'ru' ? task.titleRu : task.titleUz}
              </p>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              <Coins size={12} className="text-pgold" />
              <span className="text-[12px] font-bold text-pgold">+{task.reward}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
