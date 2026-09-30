/**
 * LiveKit control-client testlari (§1, §10): URL routing, timeout, xato mapping.
 * Network stub — haqiqiy LiveKit chaqirilmaydi.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  LivekitControlError,
  buildServiceToken,
  deleteRoom,
  listParticipants,
  livekitHttpUrl,
  removeParticipant,
  startEgress,
  stopEgress,
  twirpUrl,
  updateParticipantPermission,
} from '../../../server/modules/live/livekit-control'

const CFG = { url: 'wss://x.livekit.cloud', apiKey: 'APIkey123', apiSecret: 'secret-32chars-minimum-0000000000' }

function okJson(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('livekit-control URL routing', () => {
  it('wss→https + servis aniq (Egress/RoomService aralashmaydi)', () => {
    expect(twirpUrl(CFG.url, 'livekit.Egress', 'StartRoomCompositeEgress')).toBe(
      'https://x.livekit.cloud/twirp/livekit.Egress/StartRoomCompositeEgress',
    )
    expect(twirpUrl(CFG.url, 'livekit.RoomService', 'ListParticipants')).toBe(
      'https://x.livekit.cloud/twirp/livekit.RoomService/ListParticipants',
    )
    expect(livekitHttpUrl('ws://h/')).toBe('http://h')
  })

  it('service token grant passthrough (metod-grant mosligi)', () => {
    const t = buildServiceToken({ apiKey: CFG.apiKey, apiSecret: CFG.apiSecret, grant: { roomList: true }, ttlSeconds: 60 })
    const payload = JSON.parse(Buffer.from(t.split('.')[1]!.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')) as {
      iss: string
      video: Record<string, unknown>
    }
    expect(payload.iss).toBe(CFG.apiKey)
    expect(payload.video).toMatchObject({ roomList: true })
  })
})

describe('livekit-control transport', () => {
  it('listParticipants to‘g‘ri URL + grant bilan chaqiradi', async () => {
    const seen: string[] = []
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      seen.push(String(url))
      return okJson({ participants: [] })
    }))
    const out = await listParticipants(CFG, 'live_5')
    expect(out).toEqual({ participants: [] })
    expect(seen[0]).toBe('https://x.livekit.cloud/twirp/livekit.RoomService/ListParticipants')
  })

  it('updatePermission — to‘liq permission kontrakti (canSubscribe/canPublishData saqlanadi)', async () => {
    const bodies: unknown[] = []
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init?: { body?: unknown }) => {
      try {
        bodies.push(JSON.parse(String(init?.body ?? '{}')) as unknown)
      } catch {
        bodies.push({})
      }
      return okJson({})
    }))
    await updateParticipantPermission(CFG, 'live_5', 'u1', true)
    await updateParticipantPermission(CFG, 'live_5', 'u2', false)
    // UpdateParticipant to'liq almashtiradi — revoke'da ham subscribe/data qolishi SHART
    expect(bodies).toEqual([
      { room: 'live_5', identity: 'u1', permission: { canPublish: true, canSubscribe: true, canPublishData: true } },
      { room: 'live_5', identity: 'u2', permission: { canPublish: false, canSubscribe: true, canPublishData: true } },
    ])
  })

  it('update/remove/delete/start/stop — servis yo‘llari', async () => {
    const seen: string[] = []
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      seen.push(String(url))
      return okJson({ egressId: 'eg_1' })
    }))
    await updateParticipantPermission(CFG, 'live_5', 'u1', true)
    await removeParticipant(CFG, 'live_5', 'u1')
    await deleteRoom(CFG, 'live_5')
    await startEgress(CFG, 'live_5', 'p', { endpoint: 'e', region: 'r', accessKey: 'a', secret: 's', bucket: 'b' })
    await stopEgress(CFG, 'eg_1')
    expect(seen).toEqual([
      'https://x.livekit.cloud/twirp/livekit.RoomService/UpdateParticipant',
      'https://x.livekit.cloud/twirp/livekit.RoomService/RemoveParticipant',
      'https://x.livekit.cloud/twirp/livekit.RoomService/DeleteRoom',
      'https://x.livekit.cloud/twirp/livekit.Egress/StartRoomCompositeEgress',
      'https://x.livekit.cloud/twirp/livekit.Egress/StopEgress',
    ])
  })

  it('startEgress egressId yo‘q bo‘lsa xato', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => okJson({})))
    await expect(startEgress(CFG, 'live_5', 'p', { endpoint: 'e', region: 'r', accessKey: 'a', secret: 's', bucket: 'b' }))
      .rejects.toThrow(/no_egress_id/)
  })

  it('4xx/5xx status saqlanadi', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{"code":7}', { status: 403 })))
    const err = await listParticipants(CFG, 'live_5').catch((e: unknown) => e)
    expect(err).toBeInstanceOf(LivekitControlError)
    expect((err as LivekitControlError).status).toBe(403)
    expect((err as LivekitControlError).timeout).toBe(false)
  })

  it('timeout: osilgan so‘rov AbortController bilan uziladi', async () => {
    vi.stubGlobal('fetch', vi.fn((_url: string, init?: { signal?: AbortSignal }) => new Promise<Response>((_res, rej) => {
      init?.signal?.addEventListener('abort', () => {
        const e = new Error('aborted')
        e.name = 'AbortError'
        rej(e)
      })
    })))
    const err = await listParticipants({ ...CFG, timeoutMs: 30 }, 'live_5').catch((e: unknown) => e)
    expect(err).toBeInstanceOf(LivekitControlError)
    expect((err as LivekitControlError).timeout).toBe(true)
  })
})
