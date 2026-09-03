import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useState, useEffect, useRef } from 'react'

// Characterization for anti-cheat logic in TestPage
function useAntiCheatLogic(isOfficialExam: boolean, isFinished: boolean) {
  const [cheatViolations, setCheatViolations] = useState(0)
  const prevViolationsRef = useRef(0)
  const [activeStrike, setActiveStrike] = useState<number | null>(null)
  const [disqualifiedByCheat, setDisqualifiedByCheat] = useState(false)

  const wasHiddenRef = useRef(false)
  useEffect(() => {
    if (!isOfficialExam || isFinished) return

    const handleLeave = () => {
      if (!isFinished) wasHiddenRef.current = true
    }

    const handleReturn = () => {
      if (wasHiddenRef.current && !isFinished) {
        wasHiddenRef.current = false
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

  useEffect(() => {
    const prev = prevViolationsRef.current
    prevViolationsRef.current = cheatViolations
    if (cheatViolations <= prev || cheatViolations === 0) return
    if (cheatViolations >= 3) {
      setDisqualifiedByCheat(true)
    } else {
      setActiveStrike(cheatViolations)
    }
  }, [cheatViolations])

  return { cheatViolations, activeStrike, disqualifiedByCheat, setActiveStrike }
}

describe('Anti-Cheat Characterization', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('triggers strike 1 and strike 2 on leaving and returning', () => {
    const { result } = renderHook(() => useAntiCheatLogic(true, false))

    expect(result.current.cheatViolations).toBe(0)
    expect(result.current.activeStrike).toBeNull()

    // 1-marta chiqib ketdi va qaytdi
    act(() => {
      window.dispatchEvent(new Event('blur'))
      window.dispatchEvent(new Event('focus'))
    })

    expect(result.current.cheatViolations).toBe(1)
    expect(result.current.activeStrike).toBe(1)
    expect(result.current.disqualifiedByCheat).toBe(false)

    // 2-marta chiqib ketdi va qaytdi
    act(() => {
      window.dispatchEvent(new Event('blur'))
      window.dispatchEvent(new Event('focus'))
    })

    expect(result.current.cheatViolations).toBe(2)
    expect(result.current.activeStrike).toBe(2)
    expect(result.current.disqualifiedByCheat).toBe(false)
  })

  it('disqualifies on 3rd violation', () => {
    const { result } = renderHook(() => useAntiCheatLogic(true, false))

    act(() => {
      window.dispatchEvent(new Event('blur'))
      window.dispatchEvent(new Event('focus'))
    })
    act(() => {
      window.dispatchEvent(new Event('blur'))
      window.dispatchEvent(new Event('focus'))
    })
    act(() => {
      window.dispatchEvent(new Event('blur'))
      window.dispatchEvent(new Event('focus'))
    })

    expect(result.current.cheatViolations).toBe(3)
    expect(result.current.disqualifiedByCheat).toBe(true)
  })

  it('does nothing if not official exam or finished', () => {
    const { result } = renderHook(() => useAntiCheatLogic(false, false))

    act(() => {
      window.dispatchEvent(new Event('blur'))
      window.dispatchEvent(new Event('focus'))
    })

    expect(result.current.cheatViolations).toBe(0)
    expect(result.current.disqualifiedByCheat).toBe(false)
  })
})
