/**
 * SM-2 spaced repetition for adaptive test mode.
 *
 * Formula SSOT — root `shared/spaced-repetition.ts` (server adaptive session
 * ham shu formuladan hisoblaydi). Bu fayl re-export + legacy client-only
 * `pickNext` (full-bank Adaptive oqimi; v2 server session'da ishlatilmaydi).
 */

export type { SRCard, AdaptiveSignal } from '../../../shared/spaced-repetition'
export {
  createCard,
  updateCard,
  orderAdaptiveIds,
} from '../../../shared/spaced-repetition'
import { createCard } from '../../../shared/spaced-repetition'
import type { SRCard } from '../../../shared/spaced-repetition'

/**
 * Pick the next question ID from `allIds`, excluding `excludeId`.
 *
 * Priority: overdue cards (by dueAt asc) → lowest EF among non-due.
 *
 * Pure — reads the Map but never writes to it.
 * Returns `undefined` when `allIds` is empty or every ID equals `excludeId`.
 */
export function pickNext(
  cards: ReadonlyMap<number, SRCard>,
  allIds: number[],
  excludeId?: number,
): number | undefined {
  const candidates = allIds.filter((id) => id !== excludeId)
  if (candidates.length === 0) return undefined

  const now = Date.now()
  const get  = (id: number): SRCard => cards.get(id) ?? createCard(id)

  const overdue = candidates
    .filter((id) => get(id).dueAt <= now)
    .sort((a, b) => get(a).dueAt - get(b).dueAt)

  if (overdue.length > 0) return overdue[0]

  // Nothing overdue — surface weakest card (lowest EF = least mastered)
  return [...candidates].sort((a, b) => get(a).ef - get(b).ef)[0]
}
