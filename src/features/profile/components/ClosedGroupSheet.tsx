import { Lightbulb, Lock, Megaphone, Users } from 'lucide-react'
import DialogOverlay from '../../../shared/components/DialogOverlay'
import { ClaudeTreeIcon } from '../../../shared/components/ClaudeTreeIcon'
import { Button } from '../../../shared/components/ui/button'
import { useAppStore } from '../../../shared/store/useAppStore'
import { useT } from '../../../shared/i18n'
import { getPlan, type PlanKey } from '../../../../shared/premium-plans'

/** Imkoniyat qatorlari — ikonkalar NEYTRAL (rang intizomi, qoida 8) */
const FEATURES = [
  { icon: Lightbulb, key: 'closedGroupFeat1' as const },
  { icon: Users,     key: 'closedGroupFeat2' as const },
  { icon: Megaphone, key: 'closedGroupFeat3' as const },
]

/** Guruh ochiladigan tariflar (skrinshot: Malibu + Gelik kartalari).
 *  Nom SSOT — shared/premium-plans.ts (tierName) dan olinadi. */
const GROUP_PLANS: PlanKey[] = ['year', 'lifetime']

// ── Bottom sheet — yopiq guruh upsell (premium tariflarga yo'naltiradi) ──
export function ClosedGroupSheet({ onClose, onGetPlan }: {
  onClose: () => void
  /** Tarif kartasi yoki umumiy CTA bosildi (key'siz = default highlight tarif) */
  onGetPlan: (planKey?: PlanKey) => void
}) {
  const lang = useAppStore((s) => s.settings.language)
  const tt = useT(lang)

  return (
    <DialogOverlay onClose={onClose} backdropClassName="bg-black/60" labelId="closed-group-title">
      <div className="relative w-full rounded-t-sheet border-t border-pline bg-psurface px-5 pt-3 pb-8">
        <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-plineStrong" />

        {/* Brend ikonkasi — neytral blok + qulf badge'i */}
        <div className="relative mx-auto mb-4 w-fit">
          <div className="grid size-16 place-items-center rounded-[20px] border border-pline bg-pcard">
            <Users size={30} strokeWidth={1.75} className="text-pmuted" />
          </div>
          <div className="absolute -bottom-1.5 -right-1.5 grid size-6 place-items-center rounded-full border border-pline bg-pcard">
            <Lock size={12} strokeWidth={2} className="text-psubtle" />
          </div>
        </div>

        <p id="closed-group-title" className="text-center text-[17px] font-bold text-pfg">
          {tt('closedGroupTitle')}
        </p>

        {/* Imkoniyatlar — neytral qatorlar */}
        <div className="mt-5 flex flex-col gap-2.5">
          {FEATURES.map((f) => (
            <div
              key={f.key}
              className="flex items-center gap-3 rounded-container border border-pline bg-pcard px-4 py-3"
            >
              <f.icon size={18} strokeWidth={1.75} className="flex-none text-pmuted" />
              <p className="text-[13px] font-semibold text-pfg">{tt(f.key)}</p>
            </div>
          ))}
        </div>

        {/* Guruh ochiladigan tariflar */}
        <p className="mt-5 mb-2.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-psubtle">
          {tt('closedGroupPlansHint')}
        </p>
        <div className="grid grid-cols-2 gap-3">
          {GROUP_PLANS.map((key) => {
            const plan = getPlan(key)
            if (!plan) return null
            return (
              <button
                key={key}
                onClick={() => onGetPlan(key)}
                className="flex items-center gap-2.5 rounded-container border border-pline bg-pcard p-3.5 text-left transition-transform active:scale-[0.97]"
              >
                {/* Obuna modalidagi tarif ikonkasi (YAGONA MANBA) — neytral rang */}
                <ClaudeTreeIcon className="size-9 flex-none text-pmuted" />
                <div className="min-w-0">
                  <p className="truncate text-[15px] font-bold text-pfg">
                    {lang === 'ru' ? plan.tierNameRu : plan.tierNameUz}
                  </p>
                  <p className="text-[10.5px] text-psubtle">
                    {lang === 'ru' ? plan.titleRu : plan.titleUz}
                  </p>
                </div>
              </button>
            )
          })}
        </div>

        {/* CTA */}
        <Button block size="lg" className="mt-5" onClick={() => onGetPlan()}>
          {tt('closedGroupCta')}
        </Button>
      </div>
    </DialogOverlay>
  )
}
