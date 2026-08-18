/**
 * Graceful shutdown uchun markaziy interval registry (FIXPLAN #21):
 * modul-level setInterval'lar process'ni uzoq tirik ushlab qolmasligi VA
 * shutdown'da toza to'xtashi shart. Neon HTTP uchun alohida handler KERAK
 * EMAS — connection pool'siz per-request driver (db/connection.ts hujjati).
 */
const timers = new Set<ReturnType<typeof setInterval>>()

export function registerInterval(timer: ReturnType<typeof setInterval>): void {
  timers.add(timer)
}

/** shutdown'da chaqiriladi — barcha modul interval/taymerlarini to'xtatadi. */
export function stopAllIntervals(): void {
  for (const t of timers) clearInterval(t)
  timers.clear()
}
