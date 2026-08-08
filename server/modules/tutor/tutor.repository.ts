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
  async tryConsume(userId: string, date: string, limit: number): Promise<boolean> {
    const rows = await executeRows<{ count: number }>(sql`
      INSERT INTO tutor_usage (user_id, date, count)
      VALUES (${userId}, ${date}, 1)
      ON CONFLICT (user_id, date) DO UPDATE SET count = tutor_usage.count + 1
      RETURNING count
    `)
    return Number(rows[0]?.count) <= limit
  },
}
