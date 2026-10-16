import { beforeEach, describe, expect, it, vi } from 'vitest'

const repository = vi.hoisted(() => ({
  getArchiveState: vi.fn(),
  archiveRoom: vi.fn(),
  markEnding: vi.fn(),
  markEnded: vi.fn(),
  markStopping: vi.fn(),
  getRoom: vi.fn(),
  startRoom: vi.fn(),
  joinRoom: vi.fn(),
  getActiveRecording: vi.fn(),
  claimStaleRecording: vi.fn(),
  finishRecording: vi.fn(),
  getPrivileges: vi.fn(),
  revokeSpeaker: vi.fn(),
  reserveRecording: vi.fn(),
  activateRecording: vi.fn(),
  failRecording: vi.fn(),
}))
const settings = vi.hoisted(() => ({
  live: {
    enabled: true, mediaEnabled: false, recordingEnabled: true,
    url: 'wss://example.test', apiKey: 'key', apiSecret: 'secret',
  },
  r2: {
    isConfigured: true, accountId: 'account', accessKeyId: 'access', secretAccessKey: 'secret', bucket: 'bucket',
  },
}))
const control = vi.hoisted(() => ({
  startEgress: vi.fn(), stopEgress: vi.fn(),
  listEgress: vi.fn(), sendRoomRefresh: vi.fn(), deleteRoom: vi.fn(),
  updateParticipantPermission: vi.fn(), removeParticipant: vi.fn(),
}))
vi.mock('../../../server/modules/live/live.repository', () => ({ liveRepository: repository }))
vi.mock('../../../server/config', () => ({ config: settings }))
vi.mock('../../../server/modules/live/livekit-control', () => ({
  startEgress: control.startEgress,
  stopEgress: control.stopEgress,
  listEgress: control.listEgress, sendRoomRefresh: control.sendRoomRefresh,
  deleteRoom: control.deleteRoom, listParticipants: vi.fn(),
  removeParticipant: control.removeParticipant, updateParticipantPermission: control.updateParticipantPermission,
}))

import { liveService } from '../../../server/modules/live/live.service'

beforeEach(() => {
  vi.resetAllMocks()
  settings.live.mediaEnabled = false
  repository.getArchiveState.mockResolvedValue({ status: 'ended', archived: false })
  repository.archiveRoom.mockResolvedValue(true)
  repository.markEnding.mockResolvedValue(true)
  repository.markEnded.mockResolvedValue(true)
  repository.markStopping.mockResolvedValue(true)
  repository.getRoom.mockResolvedValue({ id: 5, status: 'ending', room_name: 'live_5' })
  repository.startRoom.mockResolvedValue(false)
  repository.joinRoom.mockResolvedValue(null)
  repository.getPrivileges.mockResolvedValue(null)
  repository.revokeSpeaker.mockResolvedValue(undefined)
  repository.reserveRecording.mockResolvedValue({ id: 9 })
  repository.failRecording.mockResolvedValue(undefined)
  repository.getActiveRecording.mockResolvedValue(null)
  repository.claimStaleRecording.mockResolvedValue(true)
  control.sendRoomRefresh.mockResolvedValue(undefined)
  control.deleteRoom.mockResolvedValue(undefined)
})

describe('live room lifecycle', () => {
  it('archives an ended room without deleting recordings or participant data', async () => {
    expect(await liveService.archiveRoom(5)).toEqual({ ok: true })
    expect(repository.archiveRoom).toHaveBeenCalledWith(5)
    expect(repository.markEnding).not.toHaveBeenCalled()
  })

  it('rejects starting a scheduled lesson before its UTC time', async () => {
    repository.getRoom.mockResolvedValue({ status: 'scheduled', scheduled_at: new Date(Date.now() + 60_000).toISOString() })
    expect(await liveService.startRoom(5)).toEqual({ ok: false, error: 'TOO_EARLY' })
  })

  it('rejects students from a scheduled lobby before live starts', async () => {
    repository.getRoom.mockResolvedValue({ id: 5, status: 'scheduled', room_name: 'live_5' })
    expect(await liveService.joinRoom(5, 'student')).toEqual({ ok: false, error: 'NOT_LIVE' })
  })

  it('closes a scheduled room before archiving', async () => {
    repository.getArchiveState.mockResolvedValue({ status: 'scheduled', archived: false })
    expect(await liveService.archiveRoom(5)).toEqual({ ok: true })
    expect(repository.markEnding).toHaveBeenCalledWith(5)
    expect(repository.markEnded).toHaveBeenCalledWith(5)
    expect(repository.archiveRoom).toHaveBeenCalledWith(5)
  })

  it('rejects archiving an active broadcast', async () => {
    repository.getArchiveState.mockResolvedValue({ status: 'live', archived: false })
    expect(await liveService.archiveRoom(5)).toEqual({ ok: false, error: 'ARCHIVE_REQUIRES_END' })
    expect(repository.archiveRoom).not.toHaveBeenCalled()
  })

  it('is idempotent for an already archived room', async () => {
    repository.getArchiveState.mockResolvedValue({ status: 'ended', archived: true })
    expect(await liveService.archiveRoom(5)).toEqual({ ok: true })
    expect(repository.archiveRoom).not.toHaveBeenCalled()
  })

  it('resumes a previously interrupted ending flow', async () => {
    repository.markEnding.mockResolvedValue(false)
    expect(await liveService.endRoom(5)).toEqual({ ok: true })
    expect(repository.markEnded).toHaveBeenCalledWith(5)
  })

  it('keeps room ending when LiveKit stop fails so teacher can retry', async () => {
    settings.live.mediaEnabled = true
    repository.getActiveRecording.mockResolvedValue({ id: 9, egressId: 'egress-1', status: 'started' })
    control.stopEgress.mockRejectedValue({ status: 503 })
    expect(await liveService.endRoom(5)).toEqual({ ok: false, error: 'MEDIA_CONTROL_FAILED' })
    expect(repository.markEnded).not.toHaveBeenCalled()
    expect(control.deleteRoom).not.toHaveBeenCalled()
  })

  it('recovers a stopped recording from LiveKit when the webhook was lost', async () => {
    settings.live.mediaEnabled = true
    repository.getActiveRecording.mockResolvedValue({ id: 9, egressId: 'egress-1', status: 'stopping' })
    control.listEgress.mockResolvedValue([{
      egressId: 'egress-1', roomName: 'live_5', status: 3,
      fileResults: [{ location: 's3://bucket/live-recordings/live_5-final.mp4' }],
    }])
    repository.finishRecording.mockResolvedValue(undefined)
    expect(await liveService.reconcileRecording(5)).toEqual({ ok: true, status: 'ready' })
    expect(repository.claimStaleRecording).toHaveBeenCalledWith(9)
    expect(repository.finishRecording).toHaveBeenCalledWith('egress-1', true, 'live-recordings/live_5-final.mp4')
  })

  it('recovers a started recording that finished without a webhook', async () => {
    settings.live.mediaEnabled = true
    repository.getActiveRecording.mockResolvedValue({ id: 9, egressId: 'egress-1', status: 'started' })
    control.listEgress.mockResolvedValue([{
      egressId: 'egress-1', roomName: 'live_5', status: 'EGRESS_COMPLETE',
      fileResults: [{ location: 's3://bucket/live-recordings/live_5-final.mp4' }],
    }])
    repository.finishRecording.mockResolvedValue(undefined)
    expect(await liveService.reconcileRecording(5)).toEqual({ ok: true, status: 'ready' })
    expect(repository.claimStaleRecording).toHaveBeenCalledWith(9)
    expect(repository.finishRecording).toHaveBeenCalledWith('egress-1', true, 'live-recordings/live_5-final.mp4')
  })

  it('cannot revoke an admin, and revoking a student uses the atomic repository action', async () => {
    repository.getPrivileges.mockResolvedValueOnce({ isOwner: false, isAdmin: true })
    expect(await liveService.revokeSpeaker(5, 'admin')).toEqual({ ok: false, error: 'FORBIDDEN' })
    expect(repository.revokeSpeaker).not.toHaveBeenCalled()
    repository.getPrivileges.mockResolvedValueOnce({ isOwner: false, isAdmin: false })
    expect(await liveService.revokeSpeaker(5, 'student')).toEqual({ ok: true })
    expect(repository.revokeSpeaker).toHaveBeenCalledWith(5, 'student')
  })

  it('stops an egress if DB activation fails after media creation', async () => {
    settings.live.mediaEnabled = true
    repository.getRoom.mockResolvedValue({ id: 5, status: 'live', room_name: 'live_5' })
    control.startEgress.mockResolvedValue('egress-1')
    control.stopEgress.mockResolvedValue(undefined)
    repository.activateRecording.mockRejectedValue(new Error('DB failed'))

    await expect(liveService.startRecording(5)).rejects.toThrow('DB failed')
    expect(control.stopEgress).toHaveBeenCalledWith(expect.any(Object), 'egress-1')
    expect(repository.failRecording).toHaveBeenCalledWith(9)
  })

  it('reports media control failure after DB revocation when fallback disconnect also fails', async () => {
    settings.live.mediaEnabled = true
    control.updateParticipantPermission.mockRejectedValue(new Error('network'))
    control.removeParticipant.mockRejectedValue(new Error('network'))
    expect(await liveService.revokeSpeaker(5, 'student')).toEqual({ ok: false, error: 'MEDIA_CONTROL_FAILED' })
    expect(repository.revokeSpeaker).toHaveBeenCalledWith(5, 'student')
    expect(control.removeParticipant).toHaveBeenCalled()
  })
})
