import { createHash } from 'node:crypto'
import type { DarslikCheck } from '../../../shared/darslik-mastery'

/**
 * Darslik testi keshi uchun kontent fingerprint'i.
 *
 * Nega hash: `darslik_checks` doimiy kesh. Curated dars matni tuzatilsa
 * (masalan, xato javob kaliti), qator yangilanmasa foydalanuvchilar eski
 * darsni ko'raveradi. Har `/check`da hash solishtiriladi va farq bo'lsa
 * curated qator majburiy upsert qilinadi.
 *
 * Kanoniklashtirish obyekt kalitlarini saralaydi: bir xil mazmun har xil
 * literal tartibida yozilsa ham hash o'zgarmaydi. Massiv tartibi mazmunning
 * bir qismi (variantlar/answer ketma-ketligi), shuning uchun saqlanadi.
 */
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical)
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, item]) => item !== undefined)
        .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
        .map(([key, item]) => [key, canonical(item)]),
    )
  }
  return value
}

export function darslikCheckHash(check: DarslikCheck): string {
  return createHash('sha256').update(JSON.stringify(canonical(check))).digest('hex')
}
