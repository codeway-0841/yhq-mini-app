import { describe, it, expect } from 'vitest'
import { SUBJECT_BASES } from '../../../shared/subjects'
import { ApiUserSchema } from '../../../shared/contracts/profile'
import { config } from '../../../server/config'
import { LIVE_ROLES, LIVE_STATUSES, capabilitiesFor, isLiveJoinable, isLiveRole, isLiveStatus, liveRoomName } from '../../../shared/live'

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

  it("recording flag env'dan (default OFF — kutubxona VOD keyin)", () => {
    expect(config.live.recordingEnabled).toBe(process.env['LIVE_RECORDING_ENABLED'] === 'true')
  })

  it("join gate: ending kirmaydi (yopilmoqda), status guard 'ending'ni taniydi", () => {
    expect(isLiveJoinable('ending')).toBe(false)
    expect(isLiveStatus('ending')).toBe(true)
    expect(LIVE_STATUSES).toContain('ending')
  })

  it('capabilities: faqat owner/admin manager (§5)', () => {
    const owner = capabilitiesFor({ isOwner: true, isAdmin: false, role: 'teacher', canSpeak: true })
    expect(owner).toMatchObject({ canManage: true, canModerate: true, canRecord: true, canPublish: true })
    const admin = capabilitiesFor({ isOwner: false, isAdmin: true, role: 'teacher', canSpeak: true })
    expect(admin.canManage).toBe(true)
    // Global teacher boshqa xonada moderator EMAS
    const guestTeacher = capabilitiesFor({ isOwner: false, isAdmin: false, role: 'student', canSpeak: false })
    expect(guestTeacher).toMatchObject({ canManage: false, canModerate: false, canRecord: false, canPublish: false })
    // Approved student gapiradi, lekin boshqara olmaydi
    const speaker = capabilitiesFor({ isOwner: false, isAdmin: false, role: 'student', canSpeak: true })
    expect(speaker).toMatchObject({ canManage: false, canPublish: true })
  })
})
