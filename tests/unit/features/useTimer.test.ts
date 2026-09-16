import { describe, it, expect } from 'vitest'
import { parseTimerLeft, formatTimerLeft } from '../../../src/features/test/useTimer'

describe('parseTimerLeft (island-timer urgency)', () => {
  it('mm:ss ni soniyaga aylantiradi', () => {
    expect(parseTimerLeft('25:00')).toBe(1500)
    expect(parseTimerLeft('04:37')).toBe(277)
    expect(parseTimerLeft('00:00')).toBe(0)
  })

  it('h:mm:ss ni soniyaga aylantiradi (marafon)', () => {
    expect(parseTimerLeft('5:00:00')).toBe(18000)
    expect(parseTimerLeft('1:02:03')).toBe(3723)
  })

  it('noto‘g‘ri format xavfsiz 0 qaytaradi', () => {
    expect(parseTimerLeft('')).toBe(0)
    expect(parseTimerLeft('abc')).toBe(0)
  })
})

describe('formatTimerLeft', () => {
  it('60 daqiqagacha mm:ss', () => {
    expect(formatTimerLeft(1500)).toBe('25:00')
    expect(formatTimerLeft(277)).toBe('04:37')
    expect(formatTimerLeft(0)).toBe('00:00')
  })

  it('60+ daqiqada h:mm:ss', () => {
    expect(formatTimerLeft(18000)).toBe('5:00:00')
    expect(formatTimerLeft(3723)).toBe('1:02:03')
  })
})
