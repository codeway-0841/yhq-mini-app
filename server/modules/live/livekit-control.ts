/**
 * LiveKit control-client — server → LiveKit Cloud Twirp API (1-qatlam).
 *
 * Hamma service grant/token/URL shu yerda: egress.ts faqat recording
 * payload/parser vazifasida qoladi. Tashqi `livekit-server-sdk` YO'Q
 * (serverless bundle toza; rasmiy SDK granti bilan 1:1 — ListRooms/roomList
 * kabi metod-grant mosligi Twirp 401 sababi edi).
 */
import { createHmac } from 'node:crypto'
import type { EgressS3Config } from './egress'

export interface ControlConfig {
  /** wss:// shaklida ham berilaveradi — ichida https:// ga normalizatsiya */
  url: string
  apiKey: string
  apiSecret: string
  /** Twirp timeout (ms) — default 9000 (Vercel 60s limit ichida) */
  timeoutMs?: number
}

function b64urlEncode(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** wss:// URL'ni Twirp/fetch uchun https:// ga o'tkazadi. */
export function livekitHttpUrl(wssUrl: string): string {
  return wssUrl.replace(/^wss:/, 'https:').replace(/^ws:/, 'http:').replace(/\/+$/, '')
}

/** Twirp manzil — servis nomi HAR DOIM aniq (`livekit.Egress` / `livekit.RoomService`). */
export function twirpUrl(baseUrl: string, service: string, method: string): string {
  return `${livekitHttpUrl(baseUrl)}/twirp/${service}/${method}`
}

/** Service JWT — grant metodga qarab (rasmiy SDK ServiceBase.authHeader bilan 1:1). */
export function buildServiceToken(args: {
  apiKey: string
  apiSecret: string
  grant: Record<string, unknown>
  ttlSeconds: number
  nowMs?: number
}): string {
  const nowSec = Math.floor((args.nowMs ?? Date.now()) / 1000)
  const payload = {
    iss: args.apiKey,
    sub: args.apiKey,
    nbf: nowSec,
    exp: nowSec + args.ttlSeconds,
    video: args.grant,
  }
  const header = b64urlEncode(Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' }), 'utf8'))
  const body = b64urlEncode(Buffer.from(JSON.stringify(payload), 'utf8'))
  const sig = b64urlEncode(createHmac('sha256', args.apiSecret).update(`${header}.${body}`).digest())
  return `${header}.${body}.${sig}`
}

export class LivekitControlError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly timeout: boolean,
  ) {
    super(message)
    this.name = 'LivekitControlError'
  }
}

async function twirpCall(
  cfg: ControlConfig,
  service: string,
  method: string,
  grant: Record<string, unknown>,
  body: unknown,
): Promise<unknown> {
  const token = buildServiceToken({ apiKey: cfg.apiKey, apiSecret: cfg.apiSecret, grant, ttlSeconds: 120 })
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), cfg.timeoutMs ?? 9000)
  try {
    const res = await fetch(twirpUrl(cfg.url, service, method), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    })
    const text = await res.text()
    if (!res.ok) throw new LivekitControlError(`${service}/${method}: ${res.status} ${text.slice(0, 200)}`, res.status, false)
    try {
      return JSON.parse(text) as unknown
    } catch {
      throw new LivekitControlError(`${service}/${method}: bad_response`, res.status, false)
    }
  } catch (err) {
    if (err instanceof LivekitControlError) throw err
    const aborted = ctrl.signal.aborted || (err as { name?: string })?.name === 'AbortError'
    throw new LivekitControlError(`${service}/${method}: ${aborted ? 'timeout' : 'network'}`, 0, aborted)
  } finally {
    clearTimeout(timer)
  }
}

/** Xona ishtirokchilari (diagnostika) — grant: roomAdmin+room. */
export async function listParticipants(cfg: ControlConfig, room: string): Promise<{ participants?: unknown[] }> {
  const out = (await twirpCall(cfg, 'livekit.RoomService', 'ListParticipants', { roomAdmin: true, room }, { room })) as {
    participants?: unknown[]
  }
  return { participants: Array.isArray(out.participants) ? out.participants : [] }
}

/** Speaker permission jonli yangilash (qayta ulanishsiz) — grant: roomAdmin+room. */
export async function updateParticipantPermission(
  cfg: ControlConfig,
  room: string,
  identity: string,
  canPublish: boolean,
): Promise<void> {
  await twirpCall(
    cfg,
    'livekit.RoomService',
    'UpdateParticipant',
    { roomAdmin: true, room },
    { room, identity, permission: { canPublish } },
  )
}

/** Participant'ni xonadan uzish (leave/revoke/end) — grant: roomAdmin+room. */
export async function removeParticipant(cfg: ControlConfig, room: string, identity: string): Promise<void> {
  await twirpCall(cfg, 'livekit.RoomService', 'RemoveParticipant', { roomAdmin: true, room }, { room, identity })
}

/** Xonani yopish (barcha uziladi) — grant: roomCreate (rasmiy SDK bilan 1:1). */
export async function deleteRoom(cfg: ControlConfig, room: string): Promise<void> {
  await twirpCall(cfg, 'livekit.RoomService', 'DeleteRoom', { roomCreate: true }, { room })
}

/** RoomComposite egress start — qaytadi: egressId. Grant: roomRecord+room. */
export async function startEgress(
  cfg: ControlConfig,
  room: string,
  filepathPrefix: string,
  s3: EgressS3Config,
): Promise<string> {
  const out = (await twirpCall(
    cfg,
    'livekit.Egress',
    'StartRoomCompositeEgress',
    { roomRecord: true, room },
    {
      roomName: room,
      layout: 'speaker',
      audioOnly: false,
      fileOutputs: [{
        fileType: 'MP4',
        filepath: `${filepathPrefix}/{time}`,
        s3: {
          endpoint: s3.endpoint,
          region: s3.region,
          accessKey: s3.accessKey,
          secret: s3.secret,
          bucket: s3.bucket,
        },
      }],
    },
  )) as { egressId?: unknown }
  if (typeof out.egressId !== 'string' || out.egressId.length === 0) {
    throw new LivekitControlError('StartRoomCompositeEgress: no_egress_id', 0, false)
  }
  return out.egressId
}

/** Egress stop — grant: roomRecord. */
export async function stopEgress(cfg: ControlConfig, egressId: string): Promise<void> {
  await twirpCall(cfg, 'livekit.Egress', 'StopEgress', { roomRecord: true }, { egressId })
}
