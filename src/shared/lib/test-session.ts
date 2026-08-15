/**
 * Test sessiyasi snapshot'i va sof resume-helper'lar.
 *
 * Maqsad: Telegram WebView restart/reload'da test yo'qolmasin.
 * Sessiya descriptori (savol TARTIBI + javoblar + joriy indeks + start vaqti)
 * persist store'da saqlanadi; shu descriptor bo'yicha sahifa qayta ochilganda
 * davom ettiriladi. Timer wall-clock asosida: start vaqtdan qolgan soniya
 * hisoblanadi (reload orqali vaqtni "aldash" imkonsiz).
 *
 * SOF funksiyalar — React/store'dan mustaqil (unit-test uchun).
 */

export interface TestSessionSnapshot {
  /** Descriptor kaliti — makeSessionKey() bilan hosil qilinadi */
  key:             string
  /** Sessiya qaysi fanga tegishli (fan almashsa sessiya bekor) */
  subjectId:       string
  mode:            string | null
  title:           string | undefined
  /** Savollarning YAKUNIY tartibi (bir marta shuffle qilingan) */
  questionIds:     number[]
  current:         number
  /** 'correct' | 'wrong' | 'unanswered' | 'pending' | null */
  answers:         (string | null)[]
  /** Tanlangan variant id'lari (UI'da qayta ko'rsatish uchun) */
  selected:        (string | null)[]
  /** Server'dan reveal qilingan TO'G'RI variant id'lari (javobgacha null).
   *  Reload'da xato javoblar uchun "to'g'ri javob highlight" qayta ko'rinadi. */
  correctOptions?: (string | null)[]
  cheatViolations?: number
  startedAt:       number
  finished:        boolean
}

/**
 * Sessiya kaliti: kirish nuqtasi (mode yoki aniq savol ro'yxati) bo'yicha.
 * Bir xil kalitli TUGATILMAGAN sessiya topilsa → resume, aks holda yangi sessiya.
 */
export function makeSessionKey(mode: string | null, questionIds: number[] | undefined): string {
  if (mode) return `mode:${mode}`
  if (questionIds?.length) return `ids:${questionIds.join(',')}`
  return 'all'
}

/** Sessiya davom ettirivchi shartlar: tugatilmagan + kalit va fan mos. */
export function isResumable(
  session: TestSessionSnapshot | null | undefined,
  key: string,
  subjectId: string,
): session is TestSessionSnapshot {
  return !!session && !session.finished && session.key === key && session.subjectId === subjectId
}

/** Resume paytida timer uchun qolgan sekundlar (wall-clock). 0 → darhol time-up. */
export function remainingSeconds(startedAt: number, totalSeconds: number, now = Date.now()): number {
  return Math.max(0, totalSeconds - Math.floor((now - startedAt) / 1000))
}

export function clampIndex(i: number, length: number): number {
  return Math.min(Math.max(0, i), Math.max(0, length - 1))
}
