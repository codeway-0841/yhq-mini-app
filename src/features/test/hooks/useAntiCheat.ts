import { useState, useEffect, useRef } from 'react'
import { playSound } from '../../../shared/lib/sounds'
import { haptics } from '../../../platform/haptics'

interface UseAntiCheatOptions {
  isOfficialExam: boolean
  isFinished:     boolean
  onDisqualify:   () => void
}

export function useAntiCheat({ isOfficialExam, isFinished, onDisqualify }: UseAntiCheatOptions) {
  const [cheatViolations, setCheatViolations]         = useState(0)
  const prevViolationsRef                             = useRef(0)
  const [activeStrike, setActiveStrike]               = useState<number | null>(null)
  const [disqualifiedByCheat, setDisqualifiedByCheat] = useState(false)
  const wasHiddenRef                                  = useRef(false)

  // ── Anti-Cheat: Rasmiy imtihonda tab switch / blur / background aniqlash ──
  useEffect(() => {
    if (!isOfficialExam || isFinished) return

    const handleLeave = () => {
      if (!isFinished) {
        wasHiddenRef.current = true
      }
    }

    const handleReturn = () => {
      if (wasHiddenRef.current && !isFinished) {
        wasHiddenRef.current = false
        // L11: updater sof — side-effect alohida effect'da
        setCheatViolations((prev) => prev + 1)
      }
    }

    const onVisibilityChange = () => {
      if (document.hidden) handleLeave()
      else handleReturn()
    }

    const onBlur = () => handleLeave()
    const onFocus = () => handleReturn()

    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('blur', onBlur)
    window.addEventListener('focus', onFocus)

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('blur', onBlur)
      window.removeEventListener('focus', onFocus)
    }
  }, [isOfficialExam, isFinished])

  // Strike effektlari — cheatViolations FAQAT o'sganda bir marta
  useEffect(() => {
    const prev = prevViolationsRef.current
    prevViolationsRef.current = cheatViolations
    if (cheatViolations <= prev || cheatViolations === 0) return

    if (cheatViolations >= 3) {
      // 3-ogohlantirish: imtihon darhol to'xtatiladi
      playSound('error')
      haptics.notify('error')
      setDisqualifiedByCheat(true)
      onDisqualify()
    } else {
      // 1 yoki 2-ogohlantirish: ogohlantirish modalini ko'rsatish
      playSound('error')
      haptics.notify('warning')
      setActiveStrike(cheatViolations)
    }
  }, [cheatViolations, onDisqualify])

  const dismissStrike = () => setActiveStrike(null)

  const resetViolations = (restoredViolations = 0) => {
    setCheatViolations(restoredViolations)
    prevViolationsRef.current = restoredViolations
    setActiveStrike(null)
    setDisqualifiedByCheat(false)
  }

  return {
    cheatViolations,
    activeStrike,
    disqualifiedByCheat,
    dismissStrike,
    resetViolations,
  }
}
