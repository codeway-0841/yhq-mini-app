import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ChevronLeft,
  BookOpen,
  Ticket,
  Swords,
  HeartCrack,
  GraduationCap,
  Bookmark,
  Signpost,
  Hash,
  Play,
  NotebookText,
  Bot,
} from 'lucide-react'
import { useAppStore } from '../../shared/store/useAppStore'
import { useSubjectStore } from '../../shared/store/useSubjectStore'
import { useToast } from '../../shared/components/ToastContainer'
import { useT } from '../../shared/i18n'
import { goBack } from '../../shared/lib/navigation'
import { ModeGridCard } from './components/GridCards'

export default function ModesPage() {
  const navigate = useNavigate()
  const language = useAppStore((s) => s.settings.language)
  const savedQuestions = useAppStore((s) => s.savedQuestions)
  const subject = useSubjectStore((s) => s.subject)
  const { info: showToast } = useToast()
  const tt = useT(language)

  const goSaved = useCallback(() => {
    const prefix = `${subject.id}:`
    const ids = savedQuestions
      .filter((k) => k.startsWith(prefix))
      .map((k) => Number(k.slice(prefix.length)))
      .filter((n) => Number.isInteger(n) && n > 0)
    if (ids.length === 0) {
      showToast(
        language === 'ru'
          ? 'Нет сохранённых вопросов — используйте 📌 в тесте'
          : "Hali saqlangan savollar yo'q — testda 📌 tugmasini bosing",
      )
      return
    }
    navigate('/test/1', { state: { questionIds: ids, title: tt('saved') } })
  }, [savedQuestions, subject.id, language, navigate, tt, showToast])

  const goMode = (m: string, title?: string) => () => {
    navigate('/test/1', { state: { mode: m, title } })
  }

  const items = [
    { icon: BookOpen,      label: tt('topics'),      onClick: () => navigate('/mavzular') },
    { icon: Ticket,        label: tt('tickets'),     onClick: () => navigate('/biletlar') },
    { icon: Swords,        label: tt('duelTitle'),   onClick: () => navigate('/octagon') },
    { icon: HeartCrack,    label: tt('mistakes'),    onClick: () => navigate('/xatolar') },
    { icon: GraduationCap, label: tt('lessons'),     onClick: () => navigate('/darslik') },
    { icon: Bookmark,      label: tt('saved'),       onClick: goSaved },
    ...(subject.id === 'yhq'
      ? [{ icon: Signpost, label: tt('roadSigns'),   onClick: () => navigate('/belgilar') }]
      : []),
    { icon: Hash,          label: tt('numeric'),     onClick: goMode('numeric', tt('numeric')) },
    { icon: Play,          label: tt('adaptive'),    onClick: () => navigate('/adaptive') },
    { icon: NotebookText,  label: tt('cheatsheets'), onClick: () => navigate('/shpargalkalar') },
    { icon: Bot,           label: tt('aiTutor'),     onClick: () => showToast(tt('comingSoonD')) },
  ]

  return (
    <div className="px-4 pb-8">
      {/* Header — boshqa sahifalar bilan bir xil toza sticky safe-top header */}
      <header className="sticky top-0 z-30 -mt-[var(--safe-top-body,0px)] pt-[var(--safe-top,0px)] -mx-4 px-4 py-2.5 bg-pcanvas border-b border-pline flex items-center gap-2 mb-4">
        <button
          type="button"
          onClick={() => goBack(navigate)}
          aria-label={tt('backWord')}
          className="grid size-10 place-items-center rounded-xl text-pmuted transition-colors duration-150 ease-out hover:bg-psurface hover:text-pfg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pprimary"
        >
          <ChevronLeft size={20} strokeWidth={1.75} />
        </button>
        <h1 className="text-lg font-bold text-pfg">{tt('modesTitle')}</h1>
      </header>

      {/* 3-ustunli rejimlar panjarasi */}
      <div className="grid grid-cols-3 gap-3">
        {items.map((it) => (
          <ModeGridCard
            key={it.label}
            icon={it.icon}
            label={it.label}
            onClick={it.onClick}
          />
        ))}
      </div>
    </div>
  )
}
