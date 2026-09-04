import { GraduationCap, Sparkles } from 'lucide-react'
import { Sheet, SheetHeader, SheetTitle, SheetBody, SheetClose, SheetFooter } from '../../../shared/components/ui/sheet'
import { Button } from '../../../shared/components/ui/button'
import { useT, type Lang } from '../../../shared/i18n'
import MarkdownExplanation from './MarkdownExplanation'
import TestHelperAvatar from './TestHelperAvatar'

interface Props {
  loading: boolean
  text: string | null
  lesson?: { titleUz: string; titleRu: string; bodyUz: string[]; bodyRu: string[] }
  language: Lang
  onClose: () => void
  onOpenLesson?: () => void
  onOpenAi: () => void
}

export default function TestExplanation({ loading, text, lesson, language, onClose, onOpenLesson, onOpenAi }: Props) {
  const tt = useT(language)
  return (
    <Sheet onClose={onClose} className="flex max-h-[75dvh] flex-col overflow-visible">
      <div className="pointer-events-none absolute -top-12 right-5"><TestHelperAvatar /></div>
      <SheetHeader className="shrink-0 pr-16"><SheetTitle>{tt('whyThis')}</SheetTitle></SheetHeader>
      <SheetClose onClose={onClose} label={tt('pathClose')} />
      <SheetBody className="min-h-0 overflow-y-auto" aria-live="polite" aria-busy={loading}>
        {loading ? <p className="py-3 text-sm text-pmuted">{tt('loadingDots')}</p>
          : text ? <MarkdownExplanation content={text} />
          : lesson ? <>
            <p className="mb-2 font-semibold text-pfg">{language === 'ru' ? lesson.titleRu : lesson.titleUz}</p>
            {(language === 'ru' ? lesson.bodyRu : lesson.bodyUz).slice(0, 3).map((paragraph, index) => (
              <p key={index} className="mb-2 text-sm leading-relaxed text-pmuted">{paragraph}</p>
            ))}
          </> : <p className="text-sm text-pmuted">{tt('testExplanationSoon')}</p>}
      </SheetBody>
      <SheetFooter className="shrink-0">
        <Button variant="secondary" block className="text-ppurple" onClick={onOpenAi}><Sparkles />{tt('askAiExplain')}</Button>
        {onOpenLesson && <Button variant="secondary" block onClick={() => { onClose(); onOpenLesson() }}><GraduationCap />{tt('openModule')}</Button>}
      </SheetFooter>
    </Sheet>
  )
}
