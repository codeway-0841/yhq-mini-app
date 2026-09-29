import { describe, it, expect } from 'vitest'
import { mapMicError } from '../../../src/features/live/hooks/useVoiceRoom'

describe('mapMicError (mic xato farqi)', () => {
  it('denied: ruxsat xatolari', () => {
    expect(mapMicError({ name: 'NotAllowedError' })).toBe('denied')
    expect(mapMicError({ name: 'SecurityError' })).toBe('denied')
    expect(mapMicError(new Error('x'))).toBe('denied')
    expect(mapMicError(null)).toBe('denied')
  })

  it('nodevice: qurilma xatolari', () => {
    expect(mapMicError({ name: 'NotFoundError' })).toBe('nodevice')
    expect(mapMicError({ name: 'OverconstrainedError' })).toBe('nodevice')
    expect(mapMicError({ name: 'NotReadableError' })).toBe('nodevice')
  })
})
