import { useEffect, type CSSProperties } from 'react'
import { ArrowRight, Check, Sparkles, Trophy, X } from 'lucide-react'
import { modules } from '../../content/modules'
import { useT, type Lang } from '../../shared/i18n'
import Confetti from '../../shared/components/Confetti'
import { BrilliantEndstateRive } from '../../shared/components/BrilliantEndstateRive'
import { BrilliantEndstateShell } from '../../shared/components/BrilliantEndstateShell'
import { BrilliantCompletionStage } from '../../shared/components/BrilliantCompletionContent'
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
  const dark = typeof document !== 'undefined' && document.body.dataset.theme === 'dark'

  useEffect(() => {
    if (!next) return
    const timer = window.setTimeout(onContinue, MODULE_TRANSITION_MS)
    return () => window.clearTimeout(timer)
  }, [next, onContinue])

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="module-complete-title"
      className="fixed inset-0 z-[60] bg-pcanvas"
    >
      <BrilliantEndstateShell
        primaryLabel={tt(next ? 'pathNextNow' : 'pathBackToPath')}
        onPrimaryClick={next ? onContinue : onStay}
        secondaryLabel={next ? tt('pathStay') : undefined}
        onSecondaryClick={next ? onStay : undefined}
        overlaySlot={
          <>
            <Confetti count={24} />
            <button
              type="button"
              onClick={onStay}
              aria-label="Yopish"
              className="fixed right-4 top-[calc(var(--safe-top,0px)+12px)] z-30 flex size-9 items-center justify-center rounded-full bg-pcard/90 text-pmuted border border-pline hover:text-pfg cursor-pointer"
            >
              <X size={18} strokeWidth={2.4} />
            </button>
          </>
        }
        footerCaption={
          next ? (
            <div className="flex w-full max-w-[353px] flex-col items-center gap-1.5">
              <div className="h-1 w-full overflow-hidden rounded-full bg-psurface">
                <span
                  aria-hidden="true"
                  className="block h-full rounded-full bg-pprimary"
                  style={{ animation: `moduleProgress ${MODULE_TRANSITION_MS}ms linear forwards` } as CSSProperties}
                />
              </div>
              <p className="text-xs text-pmuted">{tt('pathAutoNextHint')}</p>
            </div>
          ) : undefined
        }
      >
        <BrilliantCompletionStage
          mode="lesson"
          heading={tt(courseDone ? 'pathCourseDone' : 'pathModuleDone')}
          headingId="module-complete-title"
          subtitle={lang === 'ru' ? finished.titleRu : finished.title}
          xpLabel={tt('pathBravo')}
          dark={dark}
          variant={finished.id % 6}
          isLevel
          levelNumber={finished.id}
          skillCheckMastered={courseDone}
          lessonTrigger={courseDone ? 'koji360' : 'kojiGem'}
          showXp={false}
          fallback={
            <div className="module-medal" aria-hidden="true">
              <span className="module-medal-orbit" />
              <span className="module-medal-face"><Trophy size={42} strokeWidth={1.5} /></span>
              <span className="module-medal-check"><Check size={17} strokeWidth={3} /></span>
              <Sparkles size={21} className="module-medal-spark" />
            </div>
          }
        >
          <p className="max-w-[330px] text-sm leading-relaxed text-pmuted">
            {tt(courseDone ? 'pathCourseDoneHint' : 'pathMilestoneHint')}
          </p>
          {next && (
            <div className="module-next-preview mt-1 flex w-full items-center gap-3 rounded-2xl bg-pcard p-3.5 text-left border border-pline">
              <div className="size-12 flex-none flex items-center justify-center">
                <BrilliantEndstateRive
                  kind="icp-node"
                  variant={next.id % 6}
                  nodeCompleted={false}
                  dark={dark}
                  label="Next Module Node"
                  className="size-full"
                  fallback={
                    <span className="grid size-11 flex-none place-items-center rounded-full bg-psurface text-pmuted">
                      <NextIcon size={23} />
                    </span>
                  }
                />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold uppercase tracking-widest text-pmuted">
                  {tt('pathNextModule')} · {next.id}
                </p>
                <p className="mt-0.5 break-words text-[15px] font-semibold text-pfg">
                  {lang === 'ru' ? next.titleRu : next.title}
                </p>
              </div>
              <ArrowRight aria-hidden="true" size={18} className="flex-none text-pprimary" />
            </div>
          )}
        </BrilliantCompletionStage>
      </BrilliantEndstateShell>
    </div>
  )
}
