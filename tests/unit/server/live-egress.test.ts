import { describe, it, expect } from 'vitest'
import { buildEgressToken, parseEgressEnded, parseLiveRoomName } from '../../../server/modules/live/egress'

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

  it('egress_ended parse: ready + R2 key (s3/https/key formatlar)', () => {
    const mk = (location: string, status = 3) => JSON.stringify({
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
})
