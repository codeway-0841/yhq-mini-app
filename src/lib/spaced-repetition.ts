/**
 * SM-2 spaced repetition for adaptive test mode.
 *
 * EF formula: EF' = EF + (0.1 - (5-q)*(0.08 + (5-q)*0.02))
 * Binary quality maps to SM-2: correct→q=4, wrong→q=1
 *
 * pickNext is pure — it never mutates the cards Map.
 */

export interface SRCard {
  questionId: number
  ef: number       // easiness factor, clamped to [1.3, 2.5]
  interval: number // scheduled days between reviews (used for next-interval math)
  dueAt: number    // unix ms — when this card is next due
  reps: number     // consecutive correct answers since last wrong
}

const EF_DEFAULT = 2.5
const EF_MIN     = 1.3

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v))
}

function sm2ef(ef: number, q: number): number {
  return clamp(ef + 0.1 - (5 - q) * (0.08 + (5 - q) * 0.02), EF_MIN, 2.5)
}

export function createCard(questionId: number): SRCard {
  return { questionId, ef: EF_DEFAULT, interval: 1, dueAt: 0, reps: 0 }
}

/**
 * Return an updated card after an answer.
 * Does NOT mutate the input card.
 *
 * Interval schedule (correct streak):
 *   rep 1 → 1 day, rep 2 → 6 days, rep 3+ → prev_interval × EF
 *
 * After a wrong answer the card reappears in 60 s; the `interval` field is
 * reset to 1 so the subsequent-correct chain starts cleanly from rep-1.
 */
export function updateCard(card: SRCard, quality: 0 | 1): SRCard {
  if (quality === 0) {
    // wrong: decrease EF (q=1 in SM-2), reset streak, re-queue in 60 s
    return {
      ...card,
      ef:       sm2ef(card.ef, 1),
      reps:     0,
      interval: 1,           // clean baseline for next correct chain
      dueAt:    Date.now() + 60_000,
    }
  }

  // correct: q=4 in SM-2
  const ef   = sm2ef(card.ef, 4)
  const reps = card.reps + 1
  // Use the card's current interval only when reps ≥ 3 (stable chain)
  const interval =
    reps === 1 ? 1 :
    reps === 2 ? 6 :
    Math.round(card.interval * ef)
  return {
    ...card,
    ef,
    reps,
    interval,
    dueAt: Date.now() + interval * 86_400_000,
  }
}

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
