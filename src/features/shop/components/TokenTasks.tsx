import { Check } from 'lucide-react'
import type { TokenTask } from '../data'

interface Props {
  tasks: TokenTask[]
  lang: 'uz' | 'ru'
}

export function TokenTasks({ tasks, lang }: Props) {
  return (
    <div className="px-4">
      <h3 className="text-[14px] font-bold text-pfg mb-3">
        {lang === 'ru' ? 'Как получить токены?' : 'Tokenlar qanday olinadi?'}
      </h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
        {tasks.map((task, i) => (
          <div
            key={task.id}
            className="rounded-2xl p-3 bg-pcard border border-pline flex flex-col items-center text-center gap-2 min-h-[110px] opacity-0 animate-[fadeSlideUp_0.3s_ease_forwards] hover:border-pprimary/30 transition-all"
            style={{ animationDelay: `${i * 60}ms` }}
          >
            <p className="text-[11.5px] font-semibold text-pfg leading-tight flex-1 line-clamp-2">
              {lang === 'ru' ? task.titleRu : task.titleUz}
            </p>

            {task.completed ? (
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-psuccess/15 border border-psuccess/30">
                <Check size={18} className="text-psuccess" />
              </div>
            ) : (
              <>
                <div className="text-[14px] font-black text-pgold">
                  +{task.reward}
                </div>
                <div className="text-[10px] text-psubtle font-medium">
                  {task.progress}/{task.total}
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
