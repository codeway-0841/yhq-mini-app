/**
 * Daily Challenge repository — `daily_records` + progress.dailyStreak.
 *
 * Streak semantikasi:
 *  - lastDailyDate == bugun    → o'zgarishsiz (bir kunda qayta complete)
 *  - lastDailyDate == kecha    → streak + 1 (seriya davom etdi)
 *  - aks holda (uzilish/ilk)   → streak = 1
 */

import { and, eq }               from 'drizzle-orm'
import { db }                    from '../../db/connection'
import { dailyRecords, progress } from '../../schema'

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

export interface DailyRecordRow {
  date: string
  subjectId: string
  answered: number
  correct: number
}

export const dailyRepository = {
  /** Bugungi yozuv (yo'q bo'lsa null) + joriy dailyStreak */
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

    const [prog] = await db.select({ dailyStreak: progress.dailyStreak })
      .from(progress).where(eq(progress.userId, userId))

    return { record: record ?? null, dailyStreak: prog?.dailyStreak ?? 0 }
  },

  /**
   * Kunlik topshiriq yakuni. Idempotent: bir xil (user,date,subject) juftligini
   * qayta yuborsa natijalar yangilanadi, streak esa faqat sana o'zgarsa hisoblanadi.
   * Yangilangan dailyStreak qaytaradi.
   *
   * Eslatma: neon-http driver tranzaksiyani qo'llamaydi — ketma-ket 3 so'rov
   * (upsert → read → update). Bir foydalanuvchi bir vaqtda 2 qurilmadan
   * complete qilishi ehtimoli past, streak drifti esa eng yomon holatda ±1.
   */
  async complete(
    userId:    bigint,
    date:      string,
    subjectId: string,
    answered:  number,
    correct:   number,
  ): Promise<{ dailyStreak: number }> {
    // 1) Yozuv upsert
    await db.insert(dailyRecords).values({ userId, date, subjectId, answered, correct })
      .onConflictDoUpdate({
        target: [dailyRecords.userId, dailyRecords.date, dailyRecords.subjectId],
        set:    { answered, correct, completedAt: new Date() },
      })

    // 2) Streak — progress qatorini o'qib, JS'da yangi qiymat aniqlanadi
    const [prog] = await db.select({
      dailyStreak:   progress.dailyStreak,
      lastDailyDate: progress.lastDailyDate,
    }).from(progress).where(eq(progress.userId, userId))

    const cur = prog ?? { dailyStreak: 0, lastDailyDate: null as string | null }
    const nextStreak = calcNextStreak(cur.lastDailyDate, date, cur.dailyStreak)

    await db.update(progress).set({
      dailyStreak:   nextStreak,
      lastDailyDate: date,
      updatedAt:     new Date(),
    }).where(eq(progress.userId, userId))

    return { dailyStreak: nextStreak }
  },
}
