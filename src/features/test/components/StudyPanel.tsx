import { Play, Video, Info, MessageCircle } from 'lucide-react'
import { useT } from '../../../shared/i18n'

// Study panel elementlari (Ovozli/Video/Qoidasi/Muhokama)
const STUDY_ITEMS = [
  { key: 'voiceLesson' as const, icon: Play },
  { key: 'videoLesson' as const, icon: Video },
  { key: 'ruleBook'    as const, icon: Info },
  { key: 'discuss'     as const, icon: MessageCircle },
] as const

type StudyItemKey = typeof STUDY_ITEMS[number]['key']

interface StudyPanelProps {
  language: 'uz' | 'ru'
  isOpen: boolean
}

export default function StudyPanel({ language, isOpen }: StudyPanelProps) {
  const tt = useT(language)

  return (
    <div className="fixed right-4 bottom-6 z-40 flex flex-col items-end gap-2 pointer-events-none">
      {STUDY_ITEMS.map((it, i) => {
        const Icon = it.icon
        return (
          <button
            key={it.key}
            disabled
            title={tt('comingSoon')}
            aria-label={tt(it.key as StudyItemKey)}
            className={`btn-3d-ghost flex items-center gap-2 pl-3 pr-4 py-2.5 rounded-full text-[12px] font-semibold transition-all duration-300 pointer-events-auto ${
              isOpen ? 'opacity-100 translate-y-0 visible' : 'opacity-0 translate-y-3 invisible pointer-events-none'
            }`}
            style={{ transitionDelay: isOpen ? `${i * 45}ms` : `${(STUDY_ITEMS.length - 1 - i) * 45}ms` }}>
            <Icon size={14} />
            {tt(it.key as StudyItemKey)}
          </button>
        )
      })}
    </div>
  )
}
