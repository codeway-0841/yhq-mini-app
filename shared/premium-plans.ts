/**
 * Premium tarif rejalari — YAGONA MANBA (frontend ↔ backend umumiy).
 *
 * Narxlar Telegram Stars'da. Bot invoicelar ham, Premium sahifa kartalari ham
 * SHU konfigdan quriladi (desync bo'lmasligi uchun consistency test bor:
 * tests/unit/config/premium-plans.test.ts).
 *
 * Semantika:
 *  - muddatli tarif (month/year) → DB `users.premium_until = max(now, premium_until) + days`
 *    (payment.repository.complete CTE — eski muddat ustiga yig'iladi)
 *  - lifetime → DB `users.tariff = 'premium'` (muddat cheksiz)
 */

export type PlanKey = 'month' | 'year' | 'lifetime'

export interface PremiumPlan {
  key:              PlanKey
  /** Telegram Stars narxi */
  stars:            number
  /** O'zbek so'midagi narx (UZS) */
  priceUzs:         number
  /** Necha kun davom etadi (null = umrbod) */
  days:             number | null
  titleUz:          string
  titleRu:          string
  periodUz:         string
  periodRu:         string
  /** Brendlangan daraja nomi (Gentra / Malibu / Gelik) */
  tierNameUz:       string
  tierNameRu:       string
  /** Kichik teg/badge (masalan: 👑 Premium, 🎓 Video darslar, 🎧 Ovozli sharh) */
  badgeUz:          string
  badgeRu:          string
  /** Chegirmasiz asl narx (so'mda, ustidan chizish uchun) */
  originalPriceUzs: number
  /** Chegirma foizi (masalan: 25) */
  discountPercent:  number
  /** Imkoniyatlar ro'yxati (har bir kartada ochiladigan checklist) */
  featuresUz:       string[]
  featuresRu:       string[]
}

export const PREMIUM_PLANS: PremiumPlan[] = [
  {
    key: 'month',
    stars: 99,
    priceUzs: 29_000,
    days: 30,
    titleUz: 'Oylik',
    titleRu: 'Месяц',
    periodUz: '1 oylik',
    periodRu: '1 месяц',
    tierNameUz: 'Plus',
    tierNameRu: 'Plus',
    badgeUz: 'Ovozli sharh',
    badgeRu: 'Аудиокомментарий',
    originalPriceUzs: 39_000,
    discountPercent: 25,
    featuresUz: [
      "Barcha test savollari uchun mutaxassis yozgan ovozli sharh",
      "Qoidasini ko'rish tugmasi — tegishli qonun bandi",
      "Reklamasiz to'liq va tezkor ilova tajribasi",
    ],
    featuresRu: [
      'Аудиокомментарии специалистов к каждому вопросу теста',
      'Просмотр правил — соответствующий пункт ПДД',
      'Быстрый интерфейс полностью без рекламы',
    ],
  },
  {
    key: 'year',
    stars: 250,
    priceUzs: 79_000,
    days: 365,
    titleUz: 'Yillik',
    titleRu: 'Год',
    periodUz: '1 yillik',
    periodRu: '1 год',
    tierNameUz: 'Pro',
    tierNameRu: 'Pro',
    badgeUz: 'Video darslar',
    badgeRu: 'Видеоуроки',
    originalPriceUzs: 105_000,
    discountPercent: 25,
    featuresUz: [
      "Plus tarifining barcha imkoniyatlari",
      "Tajribali ustoz yozgan chuqur video darslar",
      "Har bir video dars uchun mustahkamlovchi amaliy mashqlar",
      "Barcha eksklyuziv premium temalar va yutuqlar",
    ],
    featuresRu: [
      'Все возможности тарифа Plus',
      'Углубленные видеоуроки от опытного преподавателя',
      'Практические упражнения для закрепления каждого урока',
      'Все эксклюзивные премиум темы и достижения',
    ],
  },
  {
    key: 'lifetime',
    stars: 500,
    priceUzs: 149_000,
    days: null,
    titleUz: 'Umrbod',
    titleRu: 'Навсегда',
    periodUz: 'cheksiz muddat',
    periodRu: 'бессрочно',
    tierNameUz: 'Premium',
    tierNameRu: 'Premium',
    badgeUz: 'VIP imkoniyatlar',
    badgeRu: 'VIP доступ',
    originalPriceUzs: 199_000,
    discountPercent: 25,
    featuresUz: [
      "Pro tarifining barcha imkoniyatlari",
      "Har bir test uchun video darsdan qisqa video javob",
      "Haftada 6 kun (9:00–21:00) ustoz bilan jonli chatda yordam",
      "Yopiq muhokama guruhi — boshqa o'quvchilar bilan muloqot",
      "Cheksiz muddat — bir martalik to'lov bilan butun umrga",
    ],
    featuresRu: [
      'Все возможности тарифа Pro',
      'Короткие видеоответы к каждому тестовому вопросу',
      'Помощь преподавателя в чате 6 дней в неделю (9:00–21:00)',
      'Закрытая группа обсуждений с другими учениками',
      'Бессрочный доступ навсегда за один платёж',
    ],
  },
]

/** Ommaviy ko'rsatish uchun — "Eng mashhur" badge qo'yiladigan tarif */
export const HIGHLIGHT_PLAN: PlanKey = 'year'

export function getPlan(key: string): PremiumPlan | null {
  return PREMIUM_PLANS.find((p) => p.key === key) ?? null
}

/** So'm narxini chiroyli formatlash: 29000 -> "29 000 so'm" */
export function formatUzs(amount: number, lang: 'uz' | 'ru' = 'uz'): string {
  const formatted = amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
  return lang === 'ru' ? `${formatted} сум` : `${formatted} so'm`
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
