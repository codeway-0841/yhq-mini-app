import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BookOpen,
  Ticket,
  Swords,
  HeartCrack,
  GraduationCap,
  LibraryBig,
  Bookmark,
  Signpost,
  Hash,
  Brain,
  Zap,
  NotebookText,
  Camera,
  LineChart,
  Sparkles,
  Compass,
  PenLine,
} from 'lucide-react'
import { useAppStore } from '../../shared/store/useAppStore'
import { useSubjectStore } from '../../shared/store/useSubjectStore'
import { useToast } from '../../shared/components/ToastContainer'
import { useT } from '../../shared/i18n'
import { PageHeader } from '../../shared/components/ui/page-header'
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
    navigate('/test/1', {
      state: { questionIds: ids, mode: 'saved', serverSelector: 'saved', title: tt('saved') },
    })
  }, [savedQuestions, subject.id, language, navigate, tt, showToast])

  const goMode = (m: string, title?: string) => () => {
    navigate('/test/1', { state: { mode: m, title } })
  }

  // Aniq fanlar (hisob-kitob, formulali): 10 soniyalik speed test ularga mos emas
  const isExactScience = ['matematika', 'fizika', 'kimyo'].includes(subject.id)

  const items = [
    { icon: BookOpen,      label: tt('topics'),        onClick: () => navigate('/mavzular') },
    { icon: Ticket,        label: tt('tickets'),       onClick: () => navigate('/biletlar') },
    { icon: Swords,        label: tt('duelTitle'),     onClick: () => navigate('/octagon') },
    { icon: HeartCrack,    label: tt('mistakes'),      onClick: () => navigate('/xatolar') },
    { icon: GraduationCap, label: tt('lessons'),       onClick: () => navigate('/darslik') },
    { icon: LibraryBig,    label: tt('library'),       onClick: () => navigate('/kutubxona') },
    { icon: Bookmark,      label: tt('saved'),         onClick: goSaved },
    ...(subject.id === 'yhq'
      ? [{ icon: Signpost, label: tt('roadSigns'),     onClick: () => navigate('/belgilar') }]
      : []),
    { icon: Hash,          label: tt('numeric'),       onClick: goMode('numeric', tt('numeric')) },
    { icon: Brain,         label: tt('adaptiveTitle'), onClick: () => navigate('/adaptive') },
    ...(!isExactScience
      ? [{ icon: Zap,      label: tt('speedRound'),    onClick: () => navigate('/speed') }]
      : []),
    { icon: NotebookText,  label: tt('cheatsheets'),   onClick: () => navigate('/shpargalkalar') },
    ...(['matematika', 'fizika'].includes(subject.id)
      ? [{ icon: LineChart, label: tt('graphTitle'),   onClick: () => navigate('/grafik') }]
      : []),
    { icon: Camera,        label: tt('snapSolveTitle'), onClick: () => navigate('/ai-tutor') },
    { icon: PenLine,       label: tt('mathBoardTitle'), onClick: () => navigate('/doska') },
    { icon: Sparkles,      label: tt('aiCourseTitle'),  onClick: () => navigate('/ai-kurslar') },
    { icon: Compass,       label: tt('wonderStudioTitle'), onClick: () => navigate('/wonder-studio') },
  ]

  return (
    <div className="px-4">
      {/* Tab-root header — back'siz katta sarlavha (PageHeader SSOT) */}
      <PageHeader title={tt('modesTitle')} size="lg" className="-mx-4 mb-4" />

      {/* 3-ustunli ixcham rejimlar panjarasi (desktop'da 4/5 ustun) */}
      <div className="grid grid-cols-3 gap-2 sm:gap-2.5 lg:grid-cols-4 xl:grid-cols-5">
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
