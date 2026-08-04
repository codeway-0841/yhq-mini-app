/**
 * Daily Challenge repository — `daily_records` + `daily_streaks` (fan bo'yicha).
 *
 * Streak semantikasi (har fan uchun MUSTAQIL):
 *  - lastDailyDate == bugun    → o'zgarishsiz (bir kunda qayta complete)
 *  - lastDailyDate == kecha    → streak + 1 (seriya davom etdi)
 *  - aks holda (uzilish/ilk)   → streak = 1
 *  - O'qishda: oxirgi sana kechadan ham eski bo'lsa → 0 (kun o'tkazilgan)
 *
 * Bir fandan boshqasiga o'tilsa, streak o'sha fanga tegishli qoladi:
 * (user_id, subject_id) juftligi bo'yicha alohida saqlanadi.
 */

import { and, asc, eq, sql } from 'drizzle-orm'
import { db }                      from '../../db/connection'
import { dailyRecords, dailyStreaks } from '../../schema'

/** 'YYYY-MM-DD' dan oldingi kun (UTC parse — vaqt zonasi tushunchasiz) */
export function prevDate(date: string): string {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() - 1)
  return d.toISOString().slice(0, 10)
}

/** Yangi dailyStreak qiymati (sofun funksiya — unit test uchun ajratilgan) */
export function calcNextStreak(lastDailyDate: string | null, date: string, current: number): number {
  if (lastDailyDate === date)             return current      // shu kun allaqachon hisoblangan
  if (lastDailyDate === prevDate(date))   return current + 1  // seriya davomiy
  return 1                                                    // uzilishdan keyin qayta boshlash
}

/**
 * O'qishdagi streak: bir kun o'tkazib yuborilsa 0 ko'rsatadi (bazani yozmaydi —
 * keyingi complete'da calcNextStreak o'zi 1 dan qayta boshlaydi).
 */
export function effectiveStreak(lastDailyDate: string | null, today: string, current: number): number {
  if (!lastDailyDate) return 0
  if (lastDailyDate < prevDate(today)) return 0  // kamida 1 kun o'tkazilgan
  return current
}

/** Sanalar ro'yxatidagi eng uzun ketma-ket kunlar seriyasi (saralangan, unikal) */
export function calcBestStreak(dates: string[]): number {
  let best = 0, run = 0, prev = ''
  for (const d of dates) {
    run = (prev && prevDate(d) === prev) ? run + 1 : 1
    if (run > best) best = run
    prev = d
  }
  return best
}

export interface DailyRecordRow {
  date: string
  subjectId: string
  answered: number
  correct: number
}

export interface DailyHistoryRow extends DailyRecordRow {
  fixed: number
}

/** Shu (user, subject) uchun streak qatorini o'qiydi */
async function readStreak(userId: bigint, subjectId: string) {
  const [row] = await db.select({
    streak:        dailyStreaks.streak,
    lastDailyDate: dailyStreaks.lastDailyDate,
  }).from(dailyStreaks).where(
    and(eq(dailyStreaks.userId, userId), eq(dailyStreaks.subjectId, subjectId)),
  )
  return row ?? null
}

export const dailyRepository = {
  /** Bugungi yozuv (yo'q bo'lsa null) + SHU FANGA tegishli dailyStreak */
  async getToday(userId: bigint, date: string, subjectId: string): Promise<{
    record: DailyRecordRow | null
    dailyStreak: number
  }> {
    const [record] = await db.select({
      date:      dailyRecords.date,
      subjectId: dailyRecords.subjectId,
      answered:  dailyRecords.answered,
      correct:   dailyRecords.correct,
    }).from(dailyRecords).where(
      and(
        eq(dailyRecords.userId, userId),
        eq(dailyRecords.date, date),
        eq(dailyRecords.subjectId, subjectId),
      ),
    )

    const row = await readStreak(userId, subjectId)

    return {
      record:      record ?? null,
      dailyStreak: effectiveStreak(row?.lastDailyDate ?? null, date, row?.streak ?? 0),
    }
  },

  /**
   * Shu fanga tegishli barcha kunlik yozuvlar (sana bo'yicha o'suvchi) +
   * joriy streak (kun o'tkazilsa 0) + eng yaxshi (rekord) seriya.
   * "Intizom" sahifasi uchun.
   */
  async getHistory(userId: bigint, date: string, subjectId: string): Promise<{
    rows: DailyHistoryRow[]
    dailyStreak: number
    bestStreak: number
  }> {
    const rows = await db.select({
      date:      dailyRecords.date,
      subjectId: dailyRecords.subjectId,
      answered:  dailyRecords.answered,
      correct:   dailyRecords.correct,
      fixed:     dailyRecords.fixed,
    }).from(dailyRecords)
      .where(and(eq(dailyRecords.userId, userId), eq(dailyRecords.subjectId, subjectId)))
      .orderBy(asc(dailyRecords.date))

    const row = await readStreak(userId, subjectId)
    const activeDates = rows.filter((r) => r.answered > 0).map((r) => r.date)

    return {
      rows,
      dailyStreak: effectiveStreak(row?.lastDailyDate ?? null, date, row?.streak ?? 0),
      bestStreak:  calcBestStreak(activeDates),
    }
  },

  /**
   * Xato savol tuzatildi deb belgilash — shu kunning yozuviga fixed+1.
   * Kunlik test bajarilmagan kun ham yozuv yaratiladi (answered=0 bo'ladi,
   * kalendar faolligi va streak'ga ta'sir qilmaydi).
   */
  async addFixed(userId: bigint, date: string, subjectId: string): Promise<void> {
    await db.insert(dailyRecords)
      .values({ userId, date, subjectId, answered: 0, correct: 0, fixed: 1 })
      .onConflictDoUpdate({
        target: [dailyRecords.userId, dailyRecords.date, dailyRecords.subjectId],
        set:    { fixed: sql`${dailyRecords.fixed} + 1` },
      })
  },

  /**
   * Kunlik topshiriq yakuni. Idempotent: bir xil (user,date,subject) juftligini
   * qayta yuborsa natijalar yangilanadi, streak esa faqat sana o'zgarsa hisoblanadi.
   * Yangilangan (shu fanga tegishli) dailyStreak qaytaradi.
   *
   * Eslatma: neon-http driver tranzaksiyani qo'llamaydi — ketma-ket 3 so'rov
   * (upsert → read → upsert). Bir foydalanuvchi bir vaqtda 2 qurilmadan
   * complete qilishi ehtimoli past, streak drifti esa eng yomon holatda ±1.
   */
  async complete(
    userId:    bigint,
    date:      string,
    subjectId: string,
    answered:  number,
    correct:   number,
  ): Promise<{ dailyStreak: number }> {
    // 1) Yozuv upsert (fixed sonini saqlab qolish — addFixed yozgan bo'lishi mumkin)
    await db.insert(dailyRecords).values({ userId, date, subjectId, answered, correct })
      .onConflictDoUpdate({
        target: [dailyRecords.userId, dailyRecords.date, dailyRecords.subjectId],
        set:    { answered, correct, completedAt: new Date() },
      })

    // 2) Streak — shu fanning qatorini o'qib, JS'da yangi qiymat aniqlanadi
    const cur = await readStreak(userId, subjectId)
    const nextStreak = calcNextStreak(cur?.lastDailyDate ?? null, date, cur?.streak ?? 0)

    await db.insert(dailyStreaks).values({
      userId, subjectId, streak: nextStreak, lastDailyDate: date,
    }).onConflictDoUpdate({
      target: [dailyStreaks.userId, dailyStreaks.subjectId],
      set:    { streak: nextStreak, lastDailyDate: date, updatedAt: new Date() },
    })

    return { dailyStreak: nextStreak }
  },
}
