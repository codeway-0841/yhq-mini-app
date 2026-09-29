import { describe, it, expect } from 'vitest'
import { buildEgressToken, parseEgressEnded, parseLiveRoomName, summarizeParticipants } from '../../../server/modules/live/egress'
import { livekitHttpUrl, twirpUrl } from '../../../server/modules/live/livekit-control'

const KEY = 'devkey'
const SECRET = 'egress-test-secret-32chars-minimum!'

function decodePayload(token: string): Record<string, unknown> {
  const body = token.split('.')[1]!
  return JSON.parse(Buffer.from(body.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')) as Record<string, unknown>
}

describe('live egress (recording → R2)', () => {
  it('egress JWT roomRecord grant bilan', () => {
    const token = buildEgressToken({ apiKey: KEY, apiSecret: SECRET, room: 'live_5', ttlSeconds: 300 })
    const p = decodePayload(token)
    expect(p.iss).toBe(KEY)
    expect(p.video).toMatchObject({ roomRecord: true, room: 'live_5' })
  })

  it('parseLiveRoomName: live_<id> ↔ null', () => {
    expect(parseLiveRoomName('live_5')).toBe(5)
    expect(parseLiveRoomName('live_0')).toBeNull()
    expect(parseLiveRoomName('room_5')).toBeNull()
    expect(parseLiveRoomName('live_abc')).toBeNull()
  })

  it('egress_ended parse: ready + R2 key (s3/https/key formatlar)', () => {    const mk = (location: string, status = 3) => JSON.stringify({
      event: 'egress_ended',
      egressInfo: { egressId: 'eg_1', roomName: 'live_5', status, fileResults: [{ location }] },
    })
    expect(parseEgressEnded(mk('s3://kivvi-library/live-recordings/live_5-123.mp4')))
      .toMatchObject({ egressId: 'eg_1', roomId: 5, ready: true, r2Key: 'live-recordings/live_5-123.mp4' })
    expect(parseEgressEnded(mk('https://pub.r2.dev/kivvi-library/live-recordings/live_5-123.mp4')))
      .toMatchObject({ ready: true, r2Key: 'live-recordings/live_5-123.mp4' })
    expect(parseEgressEnded(mk('live-recordings/live_5-123.mp4')))
      .toMatchObject({ ready: true, r2Key: 'live-recordings/live_5-123.mp4' })
    // FAILED status → ready=false
    expect(parseEgressEnded(mk('s3://b/k.mp4', 4))?.ready).toBe(false)
    // buzuq body → null
    expect(parseEgressEnded('not-json')).toBeNull()
    expect(parseEgressEnded(JSON.stringify({ event: 'x' }))).toBeNull()
  })

  it('summarizeParticipants: tracklar + mute hisoblanadi (TrackType AUDIO=0 VIDEO=1)', () => {
    const rows = summarizeParticipants({
      participants: [
        { identity: 't1', name: 'Ustoz', tracks: [{ type: 0, muted: false }, { type: 1, muted: false }], joinedAt: 'x' },
        { identity: 's9', tracks: [{ type: 0, muted: true }], joinedAt: 'y' },
        { identity: 's10', tracks: [], joinedAt: 'z' },
        { identity: 's11', tracks: [{ type: 2 }], joinedAt: 'w' },
        { identity: 's12', tracks: [{ type: 'AUDIO', muted: false }, { type: 'VIDEO', muted: false }], joinedAt: 'v' },
        { nope: true },
      ],
    })
    expect(rows).toHaveLength(5)
    expect(rows[0]).toMatchObject({ identity: 't1', audioTracks: 1, audioMuted: false, videoTracks: 1 })
    expect(rows[1]).toMatchObject({ identity: 's9', audioTracks: 1, audioMuted: true })
    expect(rows[2]).toMatchObject({ identity: 's10', audioTracks: 0, audioMuted: true })
    expect(rows[3]).toMatchObject({ identity: 's11', audioTracks: 0, videoTracks: 0 })
    expect(rows[4]).toMatchObject({ identity: 's12', audioTracks: 1, audioMuted: false, videoTracks: 1 })
    expect(summarizeParticipants({})).toEqual([])
    expect(summarizeParticipants({ participants: 'x' as unknown as [] })).toEqual([])
  })

  it('twirpUrl: servis aniq + wss→https', () => {
    expect(twirpUrl('wss://x.livekit.cloud', 'livekit.Egress', 'StartRoomCompositeEgress'))
      .toBe('https://x.livekit.cloud/twirp/livekit.Egress/StartRoomCompositeEgress')
    expect(twirpUrl('wss://x.livekit.cloud/', 'livekit.RoomService', 'ListParticipants'))
      .toBe('https://x.livekit.cloud/twirp/livekit.RoomService/ListParticipants')
    // Helper servisni verbatim ishlatadi — caller to'g'ri juftlik berishi shart
    // (avvalgi bug: 'livekit.Egress' servisi + 'RoomService/...' metodi).
    expect(livekitHttpUrl('wss://a.b/')).toBe('https://a.b')
    expect(livekitHttpUrl('ws://a.b')).toBe('http://a.b')
  })
})
