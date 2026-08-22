/**
 * Streak coin-save — kunlik seriya uzilganda coin evaziga saqlash qoidasi.
 *
 * Bosqichlar (gapDays = ketma-ket TO'LIQ o'tkazib yuborilgan kunlar soni):
 *   gapDays 0                → oddiy davomiylik (kecha faol bo'lgan)
 *   gapDays 1 + premium      → BEPUL saqlanadi (mavjud premium imtiyozi)
 *   gapDays 1 + premium emas → STREAK_SAVE_COST coin evaziga saqlanadi
 *   gapDays 2 + premium      → coin evaziga saqlanadi (bepul kun ishlatilgan)
 *   qolgan barcha holat      → reset (coin TEGILMAYDI)
 *
 * Server SQL (`server/modules/daily/streak-save-sql.ts`) shu jadval bilan
 * BIR XIL qaror beradi — biri o'zgarsa ikkinchisi ham o'zgarishi shart.
 */

export const STREAK_SAVE_COST = 50

export type StreakOutcome = 'continue' | 'coin_save' | 'reset'

/** `gapDays` shu bosqichda umuman coin sinoviga tushadimi (balansdan qat'iy nazar) */
export function isCoinSaveStage(gapDays: number, premium: boolean): boolean {
  return (gapDays === 1 && !premium) || (gapDays === 2 && premium)
}

export function decideStreakOutcome(input: {
  gapDays: number
  premium: boolean
  balance: number
}): StreakOutcome {
  const { gapDays, premium, balance } = input
  if (gapDays <= 0) return 'continue'
  if (gapDays === 1 && premium) return 'continue'
  if (!isCoinSaveStage(gapDays, premium)) return 'reset'
  return balance >= STREAK_SAVE_COST ? 'coin_save' : 'reset'
}
