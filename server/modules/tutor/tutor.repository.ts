/**
 * AI Tutor cost control — kunlik kvota ledger.
 *
 * Har bir /tutor/explain chaqirig'i Gemini API'ga pul sarflaydi, shuning uchun:
 *  - USER limit (premium bo'lsa ham) — bitta user kvotani yeb qo'ymasligi uchun;
 *  - GLOBAL limit (user_id=0 qatori) — umumiy kunlik byudjet shifti.
 *
 * tryConsume ATOMIK (INSERT ... ON CONFLICT DO UPDATE RETURNING) — parallel
 * requestlar limitni chetlab o'tolmaydi. Limitdan oshsa ham count oshib boradi
 * (zalolatkor urinishlarni ko'rsatadi), lekin javob 429 qaytariladi.
 */

import { sql }  from 'drizzle-orm'
import { executeRows } from '../../db/connection'

/** Har bir premium user uchun kunlik tushuntirish limiti */
export const TUTOR_DAILY_USER_LIMIT = 20
/** Butun ilova bo'yicha kunlik Gemini chaqiruvlari shiftı (cost cap) */
export const TUTOR_DAILY_GLOBAL_LIMIT = 500
/** Global byudjet qatorining maxsus user_id'si (haqiqiy user emas) */
export const TUTOR_GLOBAL_USER_ID = '0'

export const tutorUsageRepository = {
  /**
   * Bir kvota sarflashga urinadi: limit ICHIDA bo'lsa true (count ++),
   * limitdan oshgan bo'lsa false (count baribir oshadi — abuse ko'rinadi).
   */
  async tryConsume(key: string, date: string, limit: number): Promise<boolean> {
    const rows = await executeRows<{ count: number }>(sql`
      INSERT INTO tutor_usage (user_id, date, count)
      VALUES (${key}, ${date}, 1)
      ON CONFLICT (user_id, date) DO UPDATE SET count = tutor_usage.count + 1
      RETURNING count
    `)
    return Number(rows[0]?.count) <= limit
  },

  /** Joriy kunda ishlatilgan miqdor (hisoblagichni oshirmasdan) */
  async getCount(key: string, date: string): Promise<number> {
    const rows = await executeRows<{ count: number }>(sql`
      SELECT count FROM tutor_usage
      WHERE user_id = ${key} AND date = ${date}
    `)
    return Number(rows[0]?.count ?? 0)
  },

  /** Foydalanuvchining bugungi kvota holatini olish */
  async getUserQuotaStatus(userId: string, date: string, isPremium: boolean) {
    const photoKey = `${userId}:photo`
    const chatKey = `${userId}:chat`

    const [usedPhotos, usedChat] = await Promise.all([
      this.getCount(photoKey, date),
      this.getCount(chatKey, date),
    ])

    const photoLimit = isPremium ? 30 : 2
    const chatLimit = isPremium ? 100 : 5

    return {
      isPremium,
      photoSolvesUsed: usedPhotos,
      photoSolvesLimit: photoLimit,
      photoSolvesRemaining: Math.max(0, photoLimit - usedPhotos),
      chatMessagesUsed: usedChat,
      chatMessagesLimit: chatLimit,
      chatMessagesRemaining: Math.max(0, chatLimit - usedChat),
    }
  },
}
