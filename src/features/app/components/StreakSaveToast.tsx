import { useDailyStore } from '../../../shared/store/useDailyStore'
import { BrilliantStreakModal } from '../../../shared/components/BrilliantStreakModal'

/**
 * Kunlik birinchi faollikda seriya oshganda (`useDailyStore.celebrationStreak`)
 * Brilliant Streak + Streak Charge animatsiyasini chiqaradi.
 */
export default function StreakSaveToast() {
  const celebrationStreak = useDailyStore((s) => s.celebrationStreak)
  const celebrationMeta   = useDailyStore((s) => s.celebrationMeta)
  const clearCelebration  = useDailyStore((s) => s.clearCelebration)

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
