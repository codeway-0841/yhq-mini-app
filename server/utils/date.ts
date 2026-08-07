/** Server-authoritative calendar date for the product's primary timezone. */
export function tashkentDate(now = new Date()): string {
  return now.toLocaleDateString('sv-SE', { timeZone: 'Asia/Tashkent' })
}

/** Strict YYYY-MM-DD calendar validation for read-only history queries. */
export function isCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00Z`)
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
}
