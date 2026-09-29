/**
 * Live recording payload/parser qatlami (3-qatlam reja §1).
 *
 * Transport (Twirp/JWT/URL) `livekit-control.ts`da — bu faylda FAQAT:
 * recording R2 sozlamasi tipi, egress JWT wrapper, webhook parse helperlar.
 */
import { buildServiceToken } from './livekit-control'

export interface EgressS3Config {
  endpoint: string
  region: string
  accessKey: string
  secret: string
  bucket: string
}

/** Egress JWT — roomRecord grant (control builder ustida, testlar shu yerda). */
export function buildEgressToken(args: {
  apiKey: string
  apiSecret: string
  room: string
  ttlSeconds: number
  nowMs?: number
}): string {
  return buildServiceToken({
    apiKey: args.apiKey,
    apiSecret: args.apiSecret,
    grant: { roomRecord: true, room: args.room },
    ttlSeconds: args.ttlSeconds,
    nowMs: args.nowMs,
  })
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

/** EgressStatus: numeric (3=COMPLETE) YOKI string ('EGRESS_COMPLETE'). */
function isEgressComplete(status: unknown): boolean {
  return status === 3 || status === 'EGRESS_COMPLETE' || status === 'COMPLETE'
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
  const ready = isEgressComplete(info['status'])
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

export interface CloudParticipantSummary {
  identity: string
  name: string
  audioTracks: number
  audioMuted: boolean
  videoTracks: number
  joinedAt: string
}

/** ListParticipants javobini xavfsiz parse (Twirp JSON: TrackType AUDIO=0 VIDEO=1 DATA=2). */
export function summarizeParticipants(out: { participants?: unknown[] }): CloudParticipantSummary[] {
  if (!out || !Array.isArray(out.participants)) return []
  const rows: CloudParticipantSummary[] = []
  for (const p of out.participants) {
    const r = p as Record<string, unknown>
    if (typeof r['identity'] !== 'string') continue
    const tracks = Array.isArray(r['tracks']) ? (r['tracks'] as Record<string, unknown>[]) : []
    let audio = 0
    let muted = true
    let video = 0
    for (const t of tracks) {
      // Protobuf TrackType: AUDIO=0, VIDEO=1, DATA=2 (Twirp JSON'da raqam; ba'zi
      // proksi/versiyalar string ko'rinishda ham yuborishi mumkin).
      if (t['type'] === 0 || t['type'] === 'AUDIO') {
        audio += 1
        if (t['muted'] === false) muted = false
      } else if (t['type'] === 1 || t['type'] === 'VIDEO') {
        video += 1
      }
    }
    rows.push({
      identity: r['identity'] as string,
      name: typeof r['name'] === 'string' ? (r['name'] as string) : '',
      audioTracks: audio,
      audioMuted: audio === 0 ? true : muted,
      videoTracks: video,
      joinedAt: typeof r['joinedAt'] === 'string' ? (r['joinedAt'] as string) : '',
    })
  }
  return rows
}
