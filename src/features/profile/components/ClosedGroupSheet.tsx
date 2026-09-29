import { useState } from 'react'
import { ExternalLink, Lightbulb, Megaphone, Users } from 'lucide-react'
import DialogOverlay from '../../../shared/components/DialogOverlay'
import ModalMathGrid from '../../../shared/components/ModalMathGrid'
import ModalHeaderRow from '../../../shared/components/ModalHeaderRow'
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
    <DialogOverlay onClose={onClose} backdropClassName="bg-black/60" labelId="closed-group-title" swipeToDismiss>
      <div className="relative max-h-[85vh] w-full overflow-y-auto rounded-t-sheet bg-psurface px-5 pt-3 pb-[calc(1.75rem+var(--safe-bottom,0px))] shadow-2xl overflow-hidden">
        <ModalMathGrid glow={false} height={380} />
        <div data-drag-handle className="mx-auto mb-2 h-1 w-9 rounded-full bg-gray-300 dark:bg-white/20 cursor-grab active:cursor-grabbing touch-none relative z-10" />
        <ModalHeaderRow onClose={onClose} label={tt('close')}>
          <h2 id="closed-group-title" className="text-[19px] font-bold text-pfg tracking-tight">
            {tt('closedGroupTitle')}
          </h2>
          <p className="mt-1 text-[13px] text-pmuted leading-relaxed max-w-xs mx-auto">
            {isSubscribed
              ? (lang === 'ru'
                ? `Закрытая VIP группа по предмету «${currentSubject.nameRu}»`
                : `«${currentSubject.name}» fani bo'yicha yopiq VIP guruh`)
              : (lang === 'ru'
                ? 'Эксклюзивное сообщество и прямая связь с преподавателями'
                : "Eksklyuziv hamjamiyat va ustozlar bilan bevosita muloqot")}
          </p>
        </ModalHeaderRow>

        {/* ── OBUNA BO'LGAN FOYDALANUVCHILAR UCHUN: Faqat joriy fan guruhi ── */}
        {isSubscribed ? (
          <div className="relative z-10">
            {/* Joriy faol fan kartasi */}
            <div className="rounded-2xl bg-pcard p-4 shadow-xs">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-pprimary">
                    {tt('closedGroupCurrentSubject')}
                  </span>
                  <span className="inline-flex size-2 rounded-full bg-psuccess animate-pulse" />
                </div>
                <p className="text-[17px] font-bold text-pfg">
                  {lang === 'ru' ? currentSubject.nameRu : currentSubject.name}
                </p>
              </div>

              <Button
                block
                size="lg"
                loading={loading}
                className="mt-4 font-bold rounded-xl shadow-xs"
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
                  className="flex items-center gap-3 rounded-2xl bg-pcard px-4 py-3 shadow-2xs"
                >
                  <f.icon size={16} strokeWidth={1.75} className="flex-none text-pprimary" />
                  <p className="text-[13px] font-medium text-pfg">{tt(f.key)}</p>
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
          <div className="relative z-10">
            {/* Imkoniyatlar — neytral qatorlar */}
            <div className="flex flex-col gap-2">
              {FEATURES.map((f) => (
                <div
                  key={f.key}
                  className="flex items-center gap-3 rounded-2xl bg-pcard px-4 py-3 shadow-2xs"
                >
                  <f.icon size={17} strokeWidth={1.75} className="flex-none text-pprimary" />
                  <p className="text-[13px] font-medium text-pfg">{tt(f.key)}</p>
                </div>
              ))}
            </div>

            {/* Guruh ochiladigan tariflar */}
            <p className="mt-5 mb-2.5 text-[10.5px] font-bold uppercase tracking-[0.12em] text-psubtle">
              {tt('closedGroupPlansHint')}
            </p>
            <div className="grid grid-cols-2 gap-2.5">
              {GROUP_PLANS.map((key) => {
                const plan = getPlan(key)
                if (!plan) return null
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => onGetPlan(key)}
                    className="rounded-2xl bg-pcard p-3.5 text-left transition-all active:scale-[0.97] shadow-2xs cursor-pointer"
                  >
                    <p className="truncate text-[15px] font-bold text-pfg">
                      {lang === 'ru' ? plan.tierNameRu : plan.tierNameUz}
                    </p>
                    <p className="text-[11px] text-psubtle mt-0.5">
                      {lang === 'ru' ? plan.titleRu : plan.titleUz}
                    </p>
                  </button>
                )
              })}
            </div>

            {/* CTA */}
            <Button block size="lg" className="mt-5 shadow-sm font-bold rounded-xl" onClick={() => onGetPlan()}>
              {tt('closedGroupCta')}
            </Button>
          </div>
        )}
      </div>
    </DialogOverlay>
  )
}
