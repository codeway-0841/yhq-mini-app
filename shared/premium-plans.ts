/**
 * Premium tarif rejalari — YAGONA MANBA (frontend ↔ backend umumiy).
 *
 * Narxlar Telegram Stars'da. Bot invoicelar ham, Premium sahifa kartalari ham
 * SHU konfigdan quriladi (desync bo'lmasligi uchun consistency test bor:
 * tests/unit/config/premium-plans.test.ts).
 *
 * Semantika:
 *  - muddatli tarif (month/year) → DB `users.premium_until = now + days`
 *    (extendPremium — eksa muddati ustiga yig'iladi)
 *  - lifetime → DB `users.tariff = 'premium'` (muddat cheksiz)
 */

export type PlanKey = 'month' | 'year' | 'lifetime'

export interface PremiumPlan {
  key:      PlanKey
  /** Telegram Stars narxi */
  stars:    number
  /** Necha kun davom etadi (null = umrbod) */
  days:     number | null
  titleUz:  string
  titleRu:  string
  periodUz: string
  periodRu: string
}

export const PREMIUM_PLANS: PremiumPlan[] = [
  { key: 'month',    stars: 99,  days: 30,  titleUz: 'Oylik',   titleRu: 'Месяц', periodUz: '30 kun',    periodRu: '30 дней'  },
  { key: 'year',     stars: 250, days: 365, titleUz: 'Yillik',  titleRu: 'Год',   periodUz: '12 oy',     periodRu: '12 месяцев' },
  { key: 'lifetime', stars: 500, days: null, titleUz: 'Umrbod', titleRu: 'Навсегда', periodUz: 'umrbod', periodRu: 'навсегда' },
]

/** Ommaviy ko'rsatish uchun — "Eng mashhur" badge qo'yiladigan tarif */
export const HIGHLIGHT_PLAN: PlanKey = 'year'

export function getPlan(key: string): PremiumPlan | null {
  return PREMIUM_PLANS.find((p) => p.key === key) ?? null
}

/** Telegram /start param → plan kaliti: 'premium' (umumiy), 'premium_month', ... */
export function parseStartParam(param: string): PlanKey | 'chooser' | null {
  if (param === 'premium') return 'chooser'
  const m = /^premium_(month|year|lifetime)$/.exec(param)
  return (m?.[1] as PlanKey | undefined) ?? null
}

/** Payment invoice payload ↔ plan: yangi format 'premium_<plan>_<uid>',
 *  ESKI format 'premium_<uid>' = umrbod (backward-compat). */
export function parsePaymentPayload(payload: string): { plan: PremiumPlan; userId: string } | null {
  const m = /^premium_(?:(month|year|lifetime)_)?(\d{1,19})$/.exec(payload)
  if (!m) return null
  return { plan: m[1] ? getPlan(m[1])! : getPlan('lifetime')!, userId: m[2] }
}
