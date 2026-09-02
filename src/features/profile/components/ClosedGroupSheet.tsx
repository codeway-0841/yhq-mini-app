import { useState } from 'react'
import { ExternalLink, Lightbulb, Lock, Megaphone, Sparkles, Users } from 'lucide-react'
import DialogOverlay from '../../../shared/components/DialogOverlay'
import { ClaudeTreeIcon } from '../../../shared/components/ClaudeTreeIcon'
import { Button } from '../../../shared/components/ui/button'
import { useAppStore } from '../../../shared/store/useAppStore'
import { useSubjectStore } from '../../../shared/store/useSubjectStore'
import { getSubject } from '../../../shared/config/subjects'
import { getSubjectClosedGroupUrl } from '../../../../shared/subjects'
import { api } from '../../../shared/api'
import { openTelegramLink } from '../../../platform/telegram'
import { haptics } from '../../../platform/haptics'
import { useT } from '../../../shared/i18n'
import { getPlan, type PlanKey } from '../../../../shared/premium-plans'

/** Imkoniyat qatorlari — ikonkalar NEYTRAL (rang intizomi, qoida 8) */
const FEATURES = [
  { icon: Lightbulb, key: 'closedGroupFeat1' as const },
  { icon: Users,     key: 'closedGroupFeat2' as const },
  { icon: Megaphone, key: 'closedGroupFeat3' as const },
]

/** Guruh ochiladigan tariflar (Malibu + Gelik kartalari).
 *  Nom SSOT — shared/premium-plans.ts (tierName) dan olinadi. */
const GROUP_PLANS: PlanKey[] = ['year', 'lifetime']

export interface ClosedGroupSheetProps {
  onClose: () => void
  /** Free user: tarif kartasi yoki umumiy CTA bosildi (key'siz = default highlight tarif) */
  onGetPlan: (planKey?: PlanKey) => void
  /** Obuna faol bo'lsa true (fanlar bo'yicha guruhlar ro'yxati ochiladi) */
  isSubscribed?: boolean
}

// ── Bottom sheet — Yopiq guruh (Subscribed: fan guruhlariga kirish / Free: upsell) ──
export function ClosedGroupSheet({ onClose, onGetPlan, isSubscribed = false }: ClosedGroupSheetProps) {
  const lang = useAppStore((s) => s.settings.language)
  const currentSubjectId = useSubjectStore((s) => s.subjectId)
  const currentSubject = getSubject(currentSubjectId)
  const tt = useT(lang)
  const [loading, setLoading] = useState(false)

  const handleJoinGroup = async (subjectId: string, customUrl?: string) => {
    haptics.impact('light')
    setLoading(true)
    try {
      const res = await api.getClosedGroupInvite(subjectId)
      if (res?.inviteLink) {
        openTelegramLink(res.inviteLink)
        return
      }
    } catch {
      // API xatolik bersa — statik konfiguratsiya qilingan havolaga fallback
    } finally {
      setLoading(false)
    }

    const url = customUrl || getSubjectClosedGroupUrl(subjectId)
    openTelegramLink(url)
  }

  return (
    <DialogOverlay onClose={onClose} backdropClassName="bg-black/60" labelId="closed-group-title">
      <div className="relative max-h-[85vh] w-full overflow-y-auto rounded-t-sheet border-t border-pline bg-psurface px-5 pt-3 pb-[calc(1.75rem+var(--safe-bottom,0px))]">
        <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-plineStrong" />

        {/* ── OBUNA BO'LGAN FOYDALANUVCHILAR UCHUN: Faqat joriy fan guruhi ── */}
        {isSubscribed ? (
          <div>
            {/* Header */}
            <div className="relative mx-auto mb-3 w-fit">
              <div className="grid size-14 place-items-center rounded-2xl bg-pcard shadow-xs">
                <Users size={26} strokeWidth={1.75} className="text-pprimary" />
              </div>
              <div className="absolute -bottom-1 -right-1 grid size-5 place-items-center rounded-full bg-pcard shadow-xs">
                <Sparkles size={11} strokeWidth={2} className="text-pgold" />
              </div>
            </div>

            <p id="closed-group-title" className="text-center text-[17px] font-bold text-pfg">
              {tt('closedGroupTitle')}
            </p>
            <p className="mt-1 text-center text-[12px] text-pmuted">
              {lang === 'ru'
                ? `Закрытая VIP группа по предмету «${currentSubject.nameRu}»`
                : `«${currentSubject.name}» fani bo'yicha yopiq VIP guruh`}
            </p>

            {/* Joriy faol fan kartasi (katta, markaziy karta) */}
            <div className="mt-4 rounded-2xl bg-pwash/40 p-4">
              <div className="flex items-center gap-3.5">
                <div
                  className="grid size-12 flex-none place-items-center rounded-xl text-white shadow-sm"
                  style={{ backgroundColor: currentSubject.color }}
                >
                  <currentSubject.icon size={24} strokeWidth={2} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-[10.5px] font-bold uppercase tracking-wider text-pprimary">
                      {tt('closedGroupCurrentSubject')}
                    </span>
                    <span className="inline-flex size-2 rounded-full bg-psuccess animate-pulse" />
                  </div>
                  <p className="truncate text-[15px] font-bold text-pfg">
                    {lang === 'ru' ? currentSubject.nameRu : currentSubject.name}
                  </p>
                </div>
              </div>

              <Button
                block
                size="lg"
                loading={loading}
                className="mt-4 font-bold shadow-sm"
                onClick={() => handleJoinGroup(currentSubject.id, currentSubject.closedGroupUrl)}
              >
                <span>{tt('closedGroupEnterBtn')}</span>
                <ExternalLink size={15} strokeWidth={2} className="ml-1.5" />
              </Button>
            </div>

            {/* Imkoniyatlar */}
            <div className="mt-4 flex flex-col gap-2">
              {FEATURES.map((f) => (
                <div
                  key={f.key}
                  className="flex items-center gap-3 rounded-2xl bg-pcard px-3.5 py-2.5 shadow-xs"
                >
                  <f.icon size={16} strokeWidth={1.75} className="flex-none text-pmuted" />
                  <p className="text-[12.5px] font-semibold text-pfg">{tt(f.key)}</p>
                </div>
              ))}
            </div>

            {/* Eslatma */}
            <p className="mt-4 text-center text-[11px] text-psubtle leading-relaxed">
              {tt('closedGroupNotice')}
            </p>
          </div>
        ) : (
          /* ── BEPUL FOYDALANUVCHILAR UCHUN: UPSELL SHEET ── */
          <div>
            {/* Brend ikonkasi — neytral blok + qulf badge'i */}
            <div className="relative mx-auto mb-4 w-fit">
              <div className="grid size-16 place-items-center rounded-2xl bg-pcard shadow-xs">
                <Users size={30} strokeWidth={1.75} className="text-pmuted" />
              </div>
              <div className="absolute -bottom-1.5 -right-1.5 grid size-6 place-items-center rounded-full bg-pcard shadow-xs">
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
                  className="flex items-center gap-3 rounded-2xl bg-pcard px-4 py-3 shadow-xs"
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
                    className="flex items-center gap-2.5 rounded-2xl bg-pcard p-3.5 text-left transition-transform active:scale-[0.97] shadow-xs"
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
            <Button block size="lg" className="mt-5 shadow-sm font-bold" onClick={() => onGetPlan()}>
              {tt('closedGroupCta')}
            </Button>
          </div>
        )}
      </div>
    </DialogOverlay>
  )
}
