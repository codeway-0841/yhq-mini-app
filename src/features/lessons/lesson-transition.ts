import { useSyncExternalStore } from 'react'
import { preloadBrilliantEndstateAssets } from '../../shared/components/BrilliantEndstateRive'
import type { Lang } from '../../shared/i18n'
import type { LaunchOrigin } from './LessonLaunch'

export type LessonTransitionKind = 'lesson' | 'warmup'

export interface LessonTransitionRequest {
  id: number
  kind: LessonTransitionKind
  origin?: LaunchOrigin
  lang: Lang
  accent?: string
  colorVariant?: number
  isLevel?: boolean
  isReady?: boolean
  onReveal: () => void
  onCancel?: () => void
}

/** Brilliant Rive color variant indices: 0=Green, 1=Blue, 2=Red, 3=Orange, 4=Yellow, 5=Purple */
export function resolveBrilliantRiveColor(accent?: string, colorVariant?: number): number {
  if (colorVariant !== undefined) return colorVariant
  const normalized = accent?.toLowerCase() ?? ''
  if (normalized === '#f6b31f' || normalized === 'var(--p-warning)') return 4
  if (normalized === '#8a4cff' || normalized === 'var(--p-purple)') return 5
  if (normalized === '#22c55e' || normalized === '#2e8b78' || normalized === 'var(--p-success)') return 0
  if (normalized === '#ef4444' || normalized === '#a8453c' || normalized === 'var(--p-danger)') return 2
  if (normalized === '#f97316' || normalized === '#b96b34') return 3
  return 1
}

let assetsPreloaded = false
export function preloadBrilliantTransitionAssets(): void {
  if (assetsPreloaded) return
  assetsPreloaded = true
  preloadBrilliantEndstateAssets(['lesson-loader', 'warm-up'])
}

export type LessonTransitionInput = Omit<LessonTransitionRequest, 'id'>

const DEFAULT_ORIGIN: LaunchOrigin = { x: 195, y: 420, size: 48, sink: 36 }

let nextTransitionId = 1
let hostMountCount = 0
let activeTransition: LessonTransitionRequest | null = null
const listeners = new Set<() => void>()

function emit() {
  for (const listener of listeners) {
    listener()
  }
}

export function subscribeLessonTransition(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function getLessonTransitionSnapshot(): LessonTransitionRequest | null {
  return activeTransition
}

export function useLessonTransitionSnapshot(): LessonTransitionRequest | null {
  return useSyncExternalStore(
    subscribeLessonTransition,
    getLessonTransitionSnapshot,
    () => null,
  )
}

export function registerLessonTransitionHost(): () => void {
  hostMountCount += 1
  return () => {
    hostMountCount = Math.max(0, hostMountCount - 1)
    if (hostMountCount === 0 && activeTransition) {
      activeTransition = null
      emit()
    }
  }
}

export function isLessonTransitionHostMounted(): boolean {
  return hostMountCount > 0
}

/**
 * Starts a root-hosted Brilliant LessonLaunch / PracticeWarmUpLaunch transition
 * so route navigation inside `onReveal` never unmounts the overlay mid-crossfade.
 * Returns `false` when no root host is mounted (e.g., standalone unit tests).
 */
export function startLessonTransition(input: LessonTransitionInput): boolean {
  if (hostMountCount === 0) return false
  const winW = typeof window !== 'undefined' ? window.innerWidth : 390
  const winH = typeof window !== 'undefined' ? window.innerHeight : 844
  activeTransition = {
    ...input,
    origin: input.origin ?? { ...DEFAULT_ORIGIN, x: winW / 2, y: winH * 0.45 },
    id: nextTransitionId++,
  }
  emit()
  return true
}

export function finishLessonTransition(id: number): void {
  if (activeTransition?.id !== id) return
  activeTransition = null
  emit()
}

export function cancelLessonTransition(id: number): void {
  if (activeTransition?.id !== id) return
  const onCancel = activeTransition.onCancel
  activeTransition = null
  emit()
  onCancel?.()
}
