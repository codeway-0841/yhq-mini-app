import { useEffect } from 'react'
import { useDailyStore } from '../../../shared/store/useDailyStore'
import { useAppStore } from '../../../shared/store/useAppStore'
import { useToast } from '../../../shared/components/ToastContainer'
import { useT } from '../../../shared/i18n'

/**
 * Streak coin-save bildirishnomasi — server uzilgan seriyani coin evaziga
 * saqlaganda (`useDailyStore.coinSaved`) bir martalik toast ko'rsatadi.
 */
export default function StreakSaveToast() {
  const coinSaved      = useDailyStore((s) => s.coinSaved)
  const clearCoinSaved = useDailyStore((s) => s.clearCoinSaved)
  const language       = useAppStore((s) => s.settings.language)
  const { info } = useToast()
  const tt = useT(language)

  useEffect(() => {
    if (!coinSaved) return
    info(tt('streakSavedToast'))
    clearCoinSaved()
  }, [coinSaved, clearCoinSaved, info, tt])

  return null
}
