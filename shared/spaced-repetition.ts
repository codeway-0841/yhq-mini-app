/**
 * SM-2 spaced repetition — server + client UMUMIY qatlam (question-bank-protection v2).
 *
 * Nega root `shared/`'da: server adaptive session'da SM-2'ni O'ZI hisoblashi
 * shart (client untrusted — SR parametrlarini client'dan qabul qilib bo'lmaydi),
 * client'dagi legacy Adaptive oqimi ham shu formuladan foydalanadi. Ikkala
 * tomon bitta formuladan olishi — desync'ni yo'qotadi.
 *
 * Sof funksiyalar (DB/IO yo'q); `nowMs` default `Date.now()` — testlar
 * deterministik vaqt beradi.
 *
 * EF formula: EF' = EF + (0.1 - (5-q)*(0.08 + (5-q)*0.02))
 * Binary quality maps to SM-2: correct→q=4, wrong→q=1
 */

export interface SRCard {
  questionId: number
  /** easiness factor, clamped to [1.3, 2.5] */
  ef: number
  /** scheduled days between reviews (used for next-interval math) */
  interval: number
  /** unix ms — when this card is next due */
  dueAt: number
  /** consecutive correct answers since last wrong */
  reps: number
}

const EF_DEFAULT = 2.5
const EF_MIN     = 1.3
const EF_MAX     = 2.5

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v))
}

function sm2ef(ef: number, q: number): number {
  return clamp(ef + 0.1 - (5 - q) * (0.08 + (5 - q) * 0.02), EF_MIN, EF_MAX)
}

export function createCard(questionId: number): SRCard {
  return { questionId, ef: EF_DEFAULT, interval: 1, dueAt: 0, reps: 0 }
}

/**
 * Return an updated card after an answer. Does NOT mutate the input card.
 *
 * Interval schedule (correct streak):
 *   rep 1 → 1 day, rep 2 → 6 days, rep 3+ → prev_interval × EF
 *
 * After a wrong answer the card reappears in 60 s; the `interval` field is
 * reset to 1 so the subsequent-correct chain starts cleanly from rep-1.
 */
export function updateCard(card: SRCard, quality: 0 | 1, nowMs: number = Date.now()): SRCard {
  if (quality === 0) {
    // wrong: decrease EF (q=1 in SM-2), reset streak, re-queue in 60 s
    return {
      ...card,
      ef:       sm2ef(card.ef, 1),
      reps:     0,
      interval: 1,           // clean baseline for next correct chain
      dueAt:    nowMs + 60_000,
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
    dueAt: nowMs + interval * 86_400_000,
  }
}

/** Server adaptive ordering uchun minimal card signali (DB'dan). */
export interface AdaptiveSignal {
  questionId: number
  ef: number
  reps: number
  /** unix ms */
  dueAt: number
}

type CardLookup =
  | ReadonlyMap<number, AdaptiveSignal>
  | Record<number, AdaptiveSignal | undefined>

function isCardMap(cards: CardLookup): cards is ReadonlyMap<number, AdaptiveSignal> {
  return cards instanceof Map
}

/**
 * Server-owned adaptive tartib (deterministik, testable):
 *   1. due kartalar (dueAt <= now, dueAt ASC),
 *   2. kuchsiz kartalar (reps > 0, hali due emas, ef ASC),
 *   3. hali ko'rilmagan savollar (progress_questions'da yo'q, id ASC),
 *   4. qolgan ko'rilganlar (id ASC).
 *
 * Kirish ro'yxati allaqachon semantic-dedup'langan bo'lishi kerak
 * (service `candidateQuestionIds` orqali). Hech qanday savol tushib
 * qolmaydi va takrorlanmaydi — faqat tartib o'zgaradi.
 */
export function orderAdaptiveIds(
  candidateIds: readonly number[],
  cards: CardLookup,
  answeredIds: ReadonlySet<number> | readonly number[],
  nowMs: number = Date.now(),
): number[] {
  const answered = answeredIds instanceof Set ? answeredIds : new Set(answeredIds)
  const get = (id: number): AdaptiveSignal | undefined => {
    if (isCardMap(cards)) return cards.get(id)
    return cards[id]
  }

  const due: Array<{ id: number; dueAt: number }> = []
  const weak: Array<{ id: number; ef: number }> = []
  const unseen: number[] = []
  const seen: number[] = []

  for (const id of candidateIds) {
    const card = get(id)
    if (!card) {
      if (answered.has(id)) seen.push(id)
      else unseen.push(id)
    } else if (card.dueAt <= nowMs) {
      due.push({ id, dueAt: card.dueAt })
    } else if (card.reps > 0) {
      weak.push({ id, ef: card.ef })
    } else {
      // Karta bor, lekin due emas va reps=0 (kelajak due'li yangi karta) —
      // seen oxirida, tartib buzilmaydi.
      seen.push(id)
    }
  }

  due.sort((a, b) => a.dueAt - b.dueAt || a.id - b.id)
  weak.sort((a, b) => a.ef - b.ef || a.id - b.id)
  unseen.sort((a, b) => a - b)
  seen.sort((a, b) => a - b)

  return [
    ...due.map((d) => d.id),
    ...weak.map((w) => w.id),
    ...unseen,
    ...seen,
  ]
}
