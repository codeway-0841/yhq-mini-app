import { useEffect } from 'react'
import { useDailyStore } from '../../../shared/store/useDailyStore'
import { useAppStore } from '../../../shared/store/useAppStore'
import { useToast } from '../../../shared/components/ToastContainer'
import { BrilliantStreakModal } from '../../../shared/components/BrilliantStreakModal'
import { useT } from '../../../shared/i18n'

/**
 * Streak himoyasi va tabrik oynasi:
 * 1) Server uzilgan seriyani coin evaziga saqlaganda (`useDailyStore.coinSaved`) toast ko'rsatadi.
 * 2) Kunlik birinchi faollikda seriya oshganda (`useDailyStore.celebrationStreak`) Brilliant Streak + Streak Charge animatsiyasini chiqaradi.
 */
export default function StreakSaveToast() {
  const coinSaved         = useDailyStore((s) => s.coinSaved)
  const clearCoinSaved    = useDailyStore((s) => s.clearCoinSaved)
  const celebrationStreak = useDailyStore((s) => s.celebrationStreak)
  const celebrationMeta   = useDailyStore((s) => s.celebrationMeta)
  const clearCelebration  = useDailyStore((s) => s.clearCelebration)
  const language          = useAppStore((s) => s.settings.language)
  const { info } = useToast()
  const tt = useT(language)

  useEffect(() => {
    if (!coinSaved) return
    info(tt('streakSavedToast'))
    clearCoinSaved()
  }, [coinSaved, clearCoinSaved, info, tt])

  if (celebrationStreak !== null) {
    return (
      <BrilliantStreakModal
        streak={celebrationStreak}
        initialView="streak"
        showCharge={celebrationMeta?.showCharge ?? true}
        charges={celebrationMeta?.charges}
        chargeSaved={celebrationMeta?.chargeSaved}
        chargeEarned={celebrationMeta?.chargeEarned}
        onClose={clearCelebration}
      />
    )
  }

  return null
}
