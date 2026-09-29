/**
 * LiveKit Egress — dars yozuvi (RoomComposite MP4 → R2).
 *
 * Nega qo'lda Twirp: `livekit-server-sdk` butun SDK daraxtini serverless
 * bundle'ga tortadi; bizga 2 ta POST (Start/Stop) + JWT kifoya.
 * API: POST {LIVEKIT_URL}/twirp/livekit.Egress/StartRoomCompositeEgress
 * Auth: HS256 JWT {iss=apiKey, sub=apiKey, nbf, exp, video={roomRecord:true, room}}.
 */
import { createHmac } from 'node:crypto'

function b64urlEncode(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function buildEgressToken(args: {
  apiKey: string
  apiSecret: string
  room: string
  ttlSeconds: number
  nowMs?: number
}): string {
  const nowSec = Math.floor((args.nowMs ?? Date.now()) / 1000)
  const payload = {
    iss: args.apiKey,
    sub: args.apiKey,
    nbf: nowSec,
    exp: nowSec + args.ttlSeconds,
    video: { roomRecord: true, room: args.room },
  }
  const header = b64urlEncode(Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' }), 'utf8'))
  const body = b64urlEncode(Buffer.from(JSON.stringify(payload), 'utf8'))
  const sig = b64urlEncode(createHmac('sha256', args.apiSecret).update(`${header}.${body}`).digest())
  return `${header}.${body}.${sig}`
}

export interface EgressS3Config {
  endpoint: string
  region: string
  accessKey: string
  secret: string
  bucket: string
}

async function twirpPost(baseUrl: string, method: string, token: string, body: unknown): Promise<unknown> {
  const url = `${baseUrl.replace(/\/+$/, '')}/twirp/livekit.Egress/${method}`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`egress ${method} failed: ${res.status} ${text.slice(0, 200)}`)
  try {
    return JSON.parse(text) as unknown
  } catch {
    throw new Error(`egress ${method}: bad_response`)
  }
}

/** Yozuvni boshlash — qaytadi: LiveKit egressId. */
export async function startRoomEgress(args: {
  livekitUrl: string
  apiKey: string
  apiSecret: string
  room: string
  filepathPrefix: string
  s3: EgressS3Config
}): Promise<string> {
  const token = buildEgressToken({ apiKey: args.apiKey, apiSecret: args.apiSecret, room: args.room, ttlSeconds: 300 })
  const out = (await twirpPost(args.livekitUrl, 'StartRoomCompositeEgress', token, {
    roomName: args.room,
    layout: 'speaker',
    audioOnly: false,
    fileOutputs: [{
      fileType: 'MP4',
      filepath: `${args.filepathPrefix}/{time}`,
      s3: {
        endpoint: args.s3.endpoint,
        region: args.s3.region,
        accessKey: args.s3.accessKey,
        secret: args.s3.secret,
        bucket: args.s3.bucket,
      },
    }],
  })) as { egressId?: unknown }
  if (typeof out.egressId !== 'string' || out.egressId.length === 0) throw new Error('egress: no_egress_id')
  return out.egressId
}

/** Yozuvni to'xtatish (yakuniy MP4 R2'ga yuklanadi, webhook keladi). */
export async function stopRoomEgress(args: {
  livekitUrl: string
  apiKey: string
  apiSecret: string
  room: string
  egressId: string
}): Promise<void> {
  const token = buildEgressToken({ apiKey: args.apiKey, apiSecret: args.apiSecret, room: args.room, ttlSeconds: 300 })
  await twirpPost(args.livekitUrl, 'StopEgress', token, { egressId: args.egressId })
}

/** `live_<id>` room nomidan room id — webhook reconcile uchun. */
export function parseLiveRoomName(roomName: string): number | null {
  const m = /^live_(\d+)$/.exec(roomName)
  if (!m) return null
  const id = Number(m[1])
  return Number.isInteger(id) && id > 0 ? id : null
}

export interface EgressEndedInfo {
  egressId: string
  roomId: number | null
  ready: boolean
  r2Key: string | null
}

/**
 * egress_ended webhook body parse (defensive — LiveKit versiyalari farq qiladi).
 * R2 key `fileResults[0].location` (s3://bucket/key yoki https) yoki filename'dan.
 */
export function parseEgressEnded(rawBody: string): EgressEndedInfo | null {
  let body: Record<string, unknown>
  try {
    body = JSON.parse(rawBody) as Record<string, unknown>
  } catch {
    return null
  }
  const info = body['egressInfo'] as Record<string, unknown> | undefined
  if (!info || typeof info['egressId'] !== 'string') return null
  const roomName = typeof info['roomName'] === 'string' ? info['roomName'] : ''
  const status = typeof info['status'] === 'number' ? info['status'] : -1
  // EgressStatus: COMPLETE=3 → ready; qolgan yakuniy holatlar failed.
  const ready = status === 3
  let r2Key: string | null = null
  const files = info['fileResults']
  if (Array.isArray(files) && files.length > 0) {
    const f = files[0] as Record<string, unknown>
    const loc = typeof f['location'] === 'string' ? f['location'] : (typeof f['filename'] === 'string' ? f['filename'] : '')
    r2Key = extractR2Key(loc)
  }
  return { egressId: info['egressId'] as string, roomId: parseLiveRoomName(roomName), ready, r2Key }
}

function extractR2Key(location: string): string | null {
  if (!location) return null
  // s3://bucket/key
  const s3 = /^s3:\/\/[^/]+\/(.+)$/.exec(location)
  if (s3?.[1]) return s3[1]
  // https://<account>.r2.cloudflarestorage.com/bucket/key yoki public URL/bucket/key
  const m = /^https?:\/\/[^/]+\/[^/]+\/(.+)$/.exec(location)
  if (m?.[1]) return m[1]
  // yalang'och key
  if (!location.includes('://') && location.length < 300) return location
  return null
}
