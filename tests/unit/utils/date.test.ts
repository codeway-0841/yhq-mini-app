import { describe, expect, it } from 'vitest'
import { isCalendarDate, tashkentDate } from '../../../server/utils/date'

describe('calendar date utilities', () => {
  it('real calendar sanalarini qat’iy tekshiradi', () => {
    expect(isCalendarDate('2028-02-29')).toBe(true)
    expect(isCalendarDate('2027-02-29')).toBe(false)
    expect(isCalendarDate('2026-99-99')).toBe(false)
    expect(isCalendarDate('2026-8-7')).toBe(false)
  })

  it('Toshkent timezone bo‘yicha kun chegarasini hisoblaydi', () => {
    expect(tashkentDate(new Date('2026-08-06T20:00:00Z'))).toBe('2026-08-07')
  })
})
