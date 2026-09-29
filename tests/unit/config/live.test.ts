import { describe, it, expect } from 'vitest'
import { SUBJECT_BASES } from '../../../shared/subjects'
import { ApiUserSchema } from '../../../shared/contracts/profile'
import { LIVE_ROLES, LIVE_STATUSES, isLiveJoinable, isLiveRole, isLiveStatus, liveRoomName } from '../../../shared/live'

describe('live SSOT (shared/live.ts)', () => {
  it('room name deterministik va LiveKit-safe', () => {
    expect(liveRoomName(7)).toBe('live_7')
    expect(liveRoomName('7')).toBe('live_7')
  })

  it('rol/status guardlar', () => {
    expect(isLiveRole('teacher')).toBe(true)
    expect(isLiveRole('student')).toBe(true)
    expect(isLiveRole('admin')).toBe(false)
    expect(isLiveStatus('live')).toBe(true)
    expect(isLiveStatus('paused')).toBe(false)
    expect(LIVE_ROLES).toContain('teacher')
    expect(LIVE_STATUSES).toContain('ended')
  })

  it('join gate: scheduled/live kiradi, ended kirmaydi', () => {
    expect(isLiveJoinable('scheduled')).toBe(true)
    expect(isLiveJoinable('live')).toBe(true)
    expect(isLiveJoinable('ended')).toBe(false)
  })

  it("fan idlar shared/subjects bilan sinxron (desync guard)", () => {
    const ids = new Set(SUBJECT_BASES.map((s) => s.id))
    for (const id of ['yhq', 'rustili', 'fizika', 'matematika']) {
      expect(ids.has(id as never)).toBe(true)
    }
  })

  it('profile kontrakt isTeacher ni tashlab yubormaydi (zod strip guard)', () => {
    const parsed = ApiUserSchema.parse({ id: '1', firstName: 'A', tariff: 'free', isTeacher: true })
    expect(parsed.isTeacher).toBe(true)
  })
})
