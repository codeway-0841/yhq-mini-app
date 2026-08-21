/**
 * Belgilar o'yini — SOF o'yin logikasi (UI'dan ajratilgan, deterministik test qilinadi).
 * `rand` inject qilinadi (default Math.random) — testlar seeded rand bilan.
 */
import type { GameSign } from '../../content/signs-game'

export interface SpeedRound {
  /** Ko'rsatiladigan belgi */
  sign: GameSign
  /** 4 variant (jumladan to'g'risi) — TASODIFIY TARTIBDA */
  options: GameSign[]
}

export interface MatchTile {
  uid: string
  signId: string
  kind: 'icon' | 'name'
}

export function shuffled<T>(arr: readonly T[], rand: () => number = Math.random): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/**
 * Tezkor raundlar: har round'da unikal belgi + 3 ta boshqa distraktor.
 * signs kamida 4 ta bo'lishi shart (aks holda options kam bo'ladi).
 */
export function buildSpeedRounds(signs: readonly GameSign[], count: number, rand: () => number = Math.random): SpeedRound[] {
  const pool = shuffled(signs, rand)
  const rounds: SpeedRound[] = []
  const n = Math.min(count, pool.length)
  for (let i = 0; i < n; i++) {
    const sign = pool[i]
    const distractors = shuffled(pool.filter((s) => s.id !== sign.id), rand).slice(0, 3)
    rounds.push({ sign, options: shuffled([sign, ...distractors], rand) })
  }
  return rounds
}

/** Juftlash maydoni: pairCount juft (icon + name) tile — aralashtirilgan. */
export function buildMatchPairs(signs: readonly GameSign[], pairCount: number, rand: () => number = Math.random): MatchTile[] {
  const picked = shuffled(signs, rand).slice(0, Math.min(pairCount, signs.length))
  const tiles: MatchTile[] = picked.flatMap((s) => [
    { uid: `icon-${s.id}`, signId: s.id, kind: 'icon' as const },
    { uid: `name-${s.id}`, signId: s.id, kind: 'name' as const },
  ])
  return shuffled(tiles, rand)
}
