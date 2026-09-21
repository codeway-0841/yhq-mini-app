/**
 * Math Board — jonli qadam tekshiruvi (Faza 3).
 *
 * Byudjet (v2): debounce 150–200ms + lokal check p95 <50ms → total <300ms.
 * Async race himoyasi: har rejalashtirish `revisionId` oladi; eskirgan
 * natija (`revisionRef.current !== r`) tashlanadi — stale status ko'rinmaydi.
 *
 * Birinchi-qadam yumshatishi ENGINE ichida (`first` flag): yopiq-rost ochilish
 * FAQAT semantik bog'liqlikda (qiymat-e'lon yoki log↔exp) qabul qilinadi —
 * hook hech qanday coercion qilmaydi (P1-4).
 */

import { useEffect, useRef, useState } from 'react'
import { checkStep, type CheckResult, type Problem } from '../../../shared/math-engine'

export const STEP_DEBOUNCE_MS = 180

export type LiveStatus = CheckResult | { status: 'idle' | 'checking'; detail: string }

const IDLE: LiveStatus = { status: 'idle', detail: 'empty_input' }

export function useStepCheck(
  inputAscii: string,
  problem: Problem,
  previousAscii: string,
  isFirst: boolean,
): LiveStatus {
  const [live, setLive] = useState<LiveStatus>(IDLE)
  const revisionRef = useRef(0)

  useEffect(() => {
    const ascii = inputAscii.trim()
    if (!ascii) {
      revisionRef.current++
      setLive(IDLE)
      return
    }
    const revision = ++revisionRef.current
    setLive({ status: 'checking', detail: 'debounced' })
    const timer = setTimeout(() => {
      let result: CheckResult
      try {
        result = checkStep({ problem, previousAcceptedStep: previousAscii, candidateStep: ascii, first: isFirst })
      } catch {
        result = { status: 'unknown', detail: 'exception' }
      }
      if (revisionRef.current === revision) setLive(result)
    }, STEP_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [inputAscii, problem, previousAscii, isFirst])

  return live
}
