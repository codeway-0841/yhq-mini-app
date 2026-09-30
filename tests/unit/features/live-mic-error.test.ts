import { describe, it, expect } from 'vitest'
import { mapMicError } from '../../../src/features/live/hooks/useVoiceRoom'

describe('mapMicError (mic xato farqi)', () => {
  it('denied: faqat aniq ruxsat rad etish', () => {
    expect(mapMicError({ name: 'NotAllowedError' })).toBe('denied')
    expect(mapMicError({ name: 'SecurityError' })).toBe('denied')
  })

  it('nodevice: qurilma xatolari', () => {
    expect(mapMicError({ name: 'NotFoundError' })).toBe('nodevice')
    expect(mapMicError({ name: 'OverconstrainedError' })).toBe('nodevice')
    expect(mapMicError({ name: 'NotReadableError' })).toBe('nodevice')
  })

  it('failed: publish/network/noma’lum — denied deb yashirilmaydi', () => {
    expect(mapMicError(new Error('x'))).toBe('failed')
    expect(mapMicError(null)).toBe('failed')
    expect(mapMicError({ name: 'TrackInvalidError' })).toBe('failed')
    expect(mapMicError({ name: 'AbortError' })).toBe('failed')
    expect(mapMicError({ name: '' })).toBe('failed')
  })
})
