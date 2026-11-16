import { useCallback, useEffect, useState } from 'react'

export type RiveDisplayStatus = 'loading' | 'ready' | 'error'

const DEFAULT_FALLBACK_DELAY_MS = 160

/**
 * Rive yuklash holatini boshqaradi:
 * - Lokal APK / CacheStorage hits (<160ms) da fallback miltillamasdan to'g'ridan-to'g'ri chiziladi.
 * - Tarmoq sekinlashsa (>160ms) bo'sh joy o'rniga `fallback`/`poster` chiqadi, tayyor bo'lgach silliq almashadi.
 * - Xato yuz bersa `fallback`/`poster` doimiy ko'rinib turadi.
 */
export function useRiveFallbackState(delayMs = DEFAULT_FALLBACK_DELAY_MS) {
  const [state, setState] = useState<{
    status: RiveDisplayStatus
    deferred: boolean
    epoch: number
  }>({ status: 'loading', deferred: false, epoch: 0 })

  const beginLoading = useCallback(() => {
    setState((prev) =>
      prev.epoch === 0 && prev.status === 'loading' && !prev.deferred
        ? prev
        : { status: 'loading', deferred: false, epoch: prev.epoch + 1 },
    )
  }, [])

  const markReady = useCallback(() => {
    setState((prev) => (prev.status === 'ready' ? prev : { ...prev, status: 'ready' }))
  }, [])

  const markError = useCallback(() => {
    setState((prev) => (prev.status === 'error' ? prev : { ...prev, status: 'error' }))
  }, [])

  useEffect(() => {
    if (state.status !== 'loading') return
    const timer = setTimeout(() => {
      setState((prev) => (prev.status === 'loading' && !prev.deferred ? { ...prev, deferred: true } : prev))
    }, delayMs)
    return () => clearTimeout(timer)
  }, [state.status, state.epoch, delayMs])

  const showFallback = state.status === 'error' || (state.status === 'loading' && state.deferred)
  const shouldFadeIn = state.status === 'ready' && state.deferred

  const canvasVisibilityClass =
    state.status === 'ready'
      ? shouldFadeIn
        ? 'opacity-100 transition-opacity duration-150 motion-reduce:transition-none'
        : 'opacity-100'
      : 'opacity-0'

  return {
    status: state.status,
    showFallback,
    shouldFadeIn,
    canvasVisibilityClass,
    beginLoading,
    markReady,
    markError,
  }
}
