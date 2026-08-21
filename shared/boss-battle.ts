/**
 * BOSS BATTLE (haftalik jamoaviy jang) — YAGONA MANBA (frontend + server).
 *
 * Mexanika:
 *  - Har Tashkent haftasiga (dushanba 00:00 → keyingi dushanba) bitta boss;
 *    HP umumiy — platformadagi har bir YANGI to'g'ri javob (progress /result
 *    gate'dan o'tgan) boss'ga zarar beradi (damagePerCorrect).
 *  - HP 0 ga tushsa → 'defeated': hafta yakunida ishtirokchilarga coin mukofot
 *    (cron /cron/boss-rollover, ledger reason='boss_reward', ref UNIQUE =
 *    retry-safe). Vaqt o'tib ketsa → 'escaped' (mukofot yo'q).
 *  - Anti-farm: zarar FAQAT gate'dan o'tgan fresh to'g'ri javoblarga bog'langan
 *    (har savol 1 marta + kunlik kredit) — coin mint bilan bir chegarada.
 *
 * QOIDALAR:
 *  - Roster rotatsiyasi DETERMINISTIK (period indeksi bo'yicha) — desync yo'q.
 *  - `id` boss_battles.boss_id'ga yoziladi — UNIKAL va O'ZGARMAS.
 *  - HP/mukofot balansi: iqtisod byudjeti (weekly mint ≈ roster*participation)
 *    tests/unit/config/boss-battle.test.ts'da ushlanadi.
 */

export interface BossDef {
  id: string
  name: { uz: string; ru: string }
  emoji: string
  /** umumiy HP (barcha userlarning yig'indi zarari) */
  hp: number
  /** UI'ning asosiy rangi (card atmosfera) */
  color: string
}

/** 1 fresh TO'G'RI javob = boss'ga shuncha zarar. */
export const BOSS_DAMAGE_PER_CORRECT = 5

/** Mukofotlar (coin) — faqat 'defeated' da, rollover'da atomik taqsimlanadi. */
export const BOSS_REWARDS = {
  /** Ishtirok mukofoti: shuncha zarar yig'gan har kimga */
  participationMinDamage: 10,
  participationCoins: 25,
  /** Top-3 bonus: [1-o'rin, 2-o'rin, 3-o'rin] */
  topCoins: [100, 60, 40] as const,
}

export const BOSS_ROSTER: readonly BossDef[] = [
  { id: 'xavf-timsoli',    name: { uz: 'Xavf Timsoli',      ru: 'Опасный Крокодил'   }, emoji: '🐊', hp: 200_000, color: '#16a34a' },
  { id: 'sirpanchiq-ajdar', name: { uz: 'Sirpanchiq Ajdar', ru: 'Скользкий Дракон'    }, emoji: '🐉', hp: 200_000, color: '#f97316' },
  { id: 'qoida-sheri',     name: { uz: 'Qoida Sheri',       ru: 'Лев Правил'          }, emoji: '🦁', hp: 200_000, color: '#facc15' },
  { id: 'tirbandlik-maxluq', name: { uz: 'Tirbandlik Maxluqi', ru: 'Монстр Пробок'    }, emoji: '🦏', hp: 200_000, color: '#8b5cf6' },
]

/**
 * Hafta kaliti — Tashkent kalendaridagi DUSHANBA kuni ('YYYY-MM-DD').
 * Deterministic va TZ-bardoshli (league weekStart bilan bir xil mantiq).
 */
export function bossPeriodKey(now: Date = new Date()): string {
  const tDate = now.toLocaleDateString('sv-SE', { timeZone: 'Asia/Tashkent' }) // 'YYYY-MM-DD'
  const d = new Date(`${tDate}T00:00:00Z`)
  const weekday = d.getUTCDay()                // 0=yakshanba
  const diff = (weekday + 6) % 7               // dushanbadan o'tgan kunlar
  d.setUTCDate(d.getUTCDate() - diff)
  return d.toISOString().slice(0, 10)
}

/** Hafta oxiri — periodKey + 7 kun (keyingi dushanba, FAQAT UI hisob-kitobi uchun) */
export function bossPeriodEndDate(periodKey: string): Date {
  const d = new Date(`${periodKey}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + 7)
  return d
}

/** Shu hafta uchun boss — DETERMINISTIK rotatsiya (period indeksidan). */
export function bossForPeriod(periodKey: string): BossDef {
  const days = Math.floor(Date.parse(`${periodKey}T00:00:00Z`) / 86_400_000)
  return BOSS_ROSTER[Math.abs(days) % BOSS_ROSTER.length]
}

export function getBossDef(id: string): BossDef | null {
  return BOSS_ROSTER.find((b) => b.id === id) ?? null
}
