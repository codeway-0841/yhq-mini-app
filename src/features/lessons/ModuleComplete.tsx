import { useEffect, type CSSProperties } from 'react'
import { ArrowRight, Check, Sparkles, Trophy } from 'lucide-react'
import { modules } from '../../content/modules'
import { useT, type Lang } from '../../shared/i18n'
import Confetti from '../../shared/components/Confetti'
import { Button } from '../../shared/components/ui/button'
import { Dialog, DialogBody, DialogHeader, DialogTitle, DialogDescription } from '../../shared/components/ui/dialog'
import { getModuleIcon } from './module-icons'

export const MODULE_TRANSITION_MS = 5000
type Mod = typeof modules[number]
export interface CompletedModule {
  finished: Mod
  next?: Mod
  courseDone: boolean
}

export default function ModuleComplete({ completion, lang, onContinue, onStay }: {
  completion: CompletedModule
  lang: Lang
  onContinue: () => void
  onStay: () => void
}) {
  const tt = useT(lang)
  const { finished, next, courseDone } = completion
  const NextIcon = next ? getModuleIcon(next.id) : Trophy
  useEffect(() => {
    if (!next) return
    const timer = window.setTimeout(onContinue, MODULE_TRANSITION_MS)
    return () => window.clearTimeout(timer)
  }, [next, onContinue])

  return <Dialog onClose={onStay} className="module-complete text-center" zIndex={60}>
    <Confetti count={24} />
    <DialogHeader className="module-complete-header relative items-center pt-8">
      <div className="module-medal" aria-hidden="true">
        <span className="module-medal-orbit" />
        <span className="module-medal-face"><Trophy size={42} strokeWidth={1.5} /></span>
        <span className="module-medal-check"><Check size={17} strokeWidth={3} /></span>
        <Sparkles size={21} className="module-medal-spark" />
      </div>
      <p className="mt-4 text-[10px] font-bold uppercase tracking-[.22em] text-psuccess">{tt('pathBravo')}</p>
      <DialogTitle className="text-[25px] leading-tight">{tt(courseDone ? 'pathCourseDone' : 'pathModuleDone')}</DialogTitle>
      <DialogDescription className="text-base">{lang === 'ru' ? finished.titleRu : finished.title}</DialogDescription>
    </DialogHeader>
    <DialogBody className="relative pb-6">
      <p className="mb-5 text-sm leading-relaxed text-pmuted">{tt(courseDone ? 'pathCourseDoneHint' : 'pathMilestoneHint')}</p>
      {next && <div className="module-next-preview mb-5 flex items-center gap-3 rounded-2xl bg-psurface p-4 text-left">
        <span className="grid size-11 flex-none place-items-center rounded-xl bg-pcard text-pmuted"><NextIcon size={23} /></span>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-widest text-pmuted">{tt('pathNextModule')} · {next.id}</p>
          <p className="mt-1 break-words text-base font-semibold text-pfg">{lang === 'ru' ? next.titleRu : next.title}</p>
        </div>
        <ArrowRight aria-hidden="true" size={18} className="flex-none text-pprimary" />
      </div>}
      <Button block size="lg" className="relative overflow-hidden" onClick={next ? onContinue : onStay}>
        {next && <span aria-hidden="true" className="module-auto-progress" style={{ '--module-delay': `${MODULE_TRANSITION_MS}ms` } as CSSProperties} />}
        <span className="relative">{tt(next ? 'pathNextNow' : 'pathBackToPath')}</span>
        {next && <ArrowRight size={18} className="relative" />}
      </Button>
      {next && <>
        <p className="mt-3 text-xs text-pmuted">{tt('pathAutoNextHint')}</p>
        <Button variant="ghost" block className="mt-1" onClick={onStay}>{tt('pathStay')}</Button>
      </>}
    </DialogBody>
  </Dialog>
}
