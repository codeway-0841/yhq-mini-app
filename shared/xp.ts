/**
 * XP VA KUNLIK CHEKLOVLAR — YAGONA MANBA (server + client bir xil qiymatni ko'radi).
 *
 * Muammo (2026-08-23 audit): XP, level, liga bali va coin — to'rttasi ham BITTA
 * raqamdan (`totalCorrect`) chiqardi. Natijada bilgan savolni qayta bosish
 * yangi mavzuni o'rganish bilan teng edi, ko'p vaqt o'tirgan g'olib bo'lardi.
 *
 * Yechim: XP o'rganish HODISASIGA qarab beriladi, kuniga esa shift qo'yiladi.
 * Savol qiyiligi hisobga OLINMAYDI (qo'lda ajratib bo'lmaydi) — javob vaqti
 * alohida yig'iladi (`progress_questions.first_ms`) va keyinchalik shu vazifani
 * bajaradi.
 */

/** Birinchi marta to'g'ri yechilgan savol */
export const XP_FIRST_CORRECT = 10
/** Avval XATO qilingan savol endi to'g'ri yechildi — eng qimmatli hodisa */
export const XP_MISTAKE_FIXED = 15
/** Xato javob — jarima yo'q (jasorat jazolanmaydi), lekin XP ham yo'q */
export const XP_WRONG = 0

/**
 * Kunlik XP shifti. Sababi: cheklovsiz "kim ko'p vaqt o'tirsa, o'sha g'olib"
 * bo'lardi (hisob-kitob: grinder oyiga ~60 000 XP, oddiy o'quvchi ~8 000 —
 * 7 barobar farq). Shift bilan farq ~2 barobar.
 *
 * MUHIM: shiftdan keyin mashq DAVOM ETADI — faqat XP to'xtaydi.
 */
export const XP_DAILY_CAP = 500

/**
 * Javoblardan kuniga olinadigan maksimal coin. Kunlik vazifalar (35c) va
 * boshqa manbalar bu shiftga KIRMAYDI.
 *
 * Nega hozir kerak: keyinroq balanslar shishib ketsa, yagona chora narxni
 * ma'nosiz ko'tarish yoki balansni nolga tushirish bo'lardi — ikkalasi ham yomon.
 */
export const COINS_DAILY_ANSWER_CAP = 100

/**
 * Level chegarasi: `n`-levelga chiqish uchun kerak bo'lgan JAMI XP.
 * 250 × n^1.5 — oddiy o'quvchi 1 oyda ~10-level, ~2 yilda 50-level.
 * (Avvalgi `totalCorrect / 50` formulasi bir haftada 40-level berardi.)
 */
export function xpForLevel(level: number): number {
  if (!Number.isFinite(level) || level <= 1) return 0
  // Math.ceil (round EMAS): pastga yaxlitlansa chegara XP'sida level hali
  // ko'tarilmay qolardi — levelFromXp(xpForLevel(n)) === n buzilardi.
  return Math.ceil(250 * Math.pow(level, 1.5))
}

/** Jami XP → joriy level (1 dan boshlanadi) */
export function levelFromXp(xp: number): number {
  if (!Number.isFinite(xp) || xp <= 0) return 1
  // + epsilon: 250 × n^1.5 ni qaytarishda suzuvchi nuqta xatosi chegara
  // XP'sida levelni bittaga kam ko'rsatardi (masalan 2000 XP → 3, kerak 4).
  const level = Math.floor(Math.pow(xp / 250, 2 / 3) + 1e-9)
  return Math.max(1, level)
}

/** Keyingi levelgacha qolgan XP va shu levelning progressi (0..1) */
export function levelProgress(xp: number): { level: number; current: number; needed: number; ratio: number } {
  const level = levelFromXp(xp)
  const base  = xpForLevel(level)
  const next  = xpForLevel(level + 1)
  const span  = Math.max(1, next - base)
  const current = Math.max(0, xp - base)
  return { level, current, needed: span, ratio: Math.min(1, current / span) }
}
