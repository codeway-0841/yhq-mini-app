/**
 * OMAD G'ILDIRAGI (Lucky Spin) — YAGONA MANBA (frontend + server ikkalasi import qiladi).
 *
 * Kunlik 1 marta BEPUL aylantirish. Segment tanlovi FAQAT server'da
 * (crypto RNG + og'irliklar) — client hech qachon natijani tanlamaydi (scoring
 * trust boundary): g'ildirak UI server javobidagi segmentga "qonadi".
 *
 * QOIDALAR:
 * - `id` segmentlar bo'yicha UNIKAL — daily_spins.reward_id audit'iga yoziladi.
 * - 1/kun guard: `daily_spins` jadvali (PK user_id, atomik claim — claimTask
 *   pattern'i); coin yutuqlar qo'shimcha coin_transactions'da (reason='spin',
 *   ref 'spin:<date>') yoziladi — balans invaryanti ikki baravar himoyalangan.
 * - IQTISOD BYUDJETI: kutilgan qiymat (EV) ~17c/kun (~520c/oy) — kunlik vazifalar
 *   (35c/kun) va javob minti (~80c/kun) chegarasida qolishi shart; EV o'zgarishini
 *   tests/unit/config/lucky-spin.test.ts ushlaydi.
 */

export interface SpinSegment {
  id: string
  kind: 'coins' | 'premium-days'
  /** kind='coins' → tanga miqdori; kind='premium-days' → grant kunlari */
  amount: number
  /** Ehtimollik og'irligi (yig'indi = 100, SPIN_TOTAL_WEIGHT) */
  weight: number
}

export const SPIN_SEGMENTS: readonly SpinSegment[] = [
  { id: 'c5',   kind: 'coins',        amount: 5,   weight: 25 },
  { id: 'c10',  kind: 'coins',        amount: 10,  weight: 22 },
  { id: 'c15',  kind: 'coins',        amount: 15,  weight: 18 },
  { id: 'c20',  kind: 'coins',        amount: 20,  weight: 14 },
  { id: 'c30',  kind: 'coins',        amount: 30,  weight: 10 },
  { id: 'c50',  kind: 'coins',        amount: 50,  weight: 7  },
  { id: 'c100', kind: 'coins',        amount: 100, weight: 2  },
  { id: 'p1',   kind: 'premium-days', amount: 1,   weight: 2  },
] as const

export const SPIN_TOTAL_WEIGHT = SPIN_SEGMENTS.reduce((s, x) => s + x.weight, 0)

export function getSpinSegment(id: string): SpinSegment | null {
  return SPIN_SEGMENTS.find((s) => s.id === id) ?? null
}

/**
 * Og'irlikli tanlov — SOF funksiya (server crypto rand01 = randomInt/max beradi).
 * rand01 ∈ [0, 1). Kumulative oraliqlar bo'yicha birinchi urilgan segment.
 */
export function pickSpinSegment(rand01: number): SpinSegment {
  const r = Math.min(Math.max(rand01, 0), 1 - Number.EPSILON) * SPIN_TOTAL_WEIGHT
  let acc = 0
  for (const seg of SPIN_SEGMENTS) {
    acc += seg.weight
    if (r < acc) return seg
  }
  return SPIN_SEGMENTS[SPIN_SEGMENTS.length - 1]
}

/** Iqtisod nazorati uchun: bitta aylantirishning kutilgan coin qiymati (EV). */
export function spinExpectedValue(): number {
  return SPIN_SEGMENTS
    .filter((s) => s.kind === 'coins')
    .reduce((sum, s) => sum + (s.amount * s.weight) / SPIN_TOTAL_WEIGHT, 0)
}
