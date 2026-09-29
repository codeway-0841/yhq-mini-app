/**
 * LiveKit interop — tashqi `livekit-server-sdk`'siz minimal JWT.
 *
 * Nega qo'lda: token issue (HS256 sign) + webhook verify uchun 60 qator kifoya;
 * yangi server dependency (va uning transitive daraxti) serverless bundle'ga
 * kirmaydi. LiveKit AccessToken formati: header.alg=HS256, payload {iss=apiKey,
 * sub=identity, nbf, exp, video={roomJoin, room, canPublish, canSubscribe,
 * canPublishData}}.
 *
 * Webhook verify (LiveKit docs): `Authorization: Bearer <jwt>`, payload'da
 * `sha256` = raw body hex digest. Tekshiruv: imzo + hash + exp, fail-closed.
 */
import { createHash, createHmac, timingSafeEqual } from 'node:crypto'

function b64urlEncode(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function b64urlDecode(s: string): Buffer {
  return Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64')
}

function signHs256(secret: string, signingInput: string): Buffer {
  return createHmac('sha256', secret).update(signingInput).digest()
}

export interface LivekitGrant {
  roomJoin: boolean
  room: string
  canPublish: boolean
  canSubscribe: boolean
  canPublishData: boolean
}

export function buildLivekitToken(args: {
  apiKey: string
  apiSecret: string
  identity: string
  room: string
  canPublish: boolean
  ttlSeconds: number
  name?: string
  nowMs?: number
}): string {
  const nowSec = Math.floor((args.nowMs ?? Date.now()) / 1000)
  const grant: LivekitGrant = {
    roomJoin: true,
    room: args.room,
    canPublish: args.canPublish,
    canSubscribe: true,
    canPublishData: true,
  }
  const payload: Record<string, unknown> = {
    iss: args.apiKey,
    sub: args.identity,
    nbf: nowSec,
    exp: nowSec + args.ttlSeconds,
    video: grant,
  }
  if (args.name) payload['name'] = args.name
  const header = b64urlEncode(Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' }), 'utf8'))
  const body = b64urlEncode(Buffer.from(JSON.stringify(payload), 'utf8'))
  const sig = b64urlEncode(signHs256(args.apiSecret, `${header}.${body}`))
  return `${header}.${body}.${sig}`
}

export interface LivekitWebhookEvent {
  event: string
  room?: { name?: string }
  participant?: { identity?: string }
}

/**
 * LiveKit webhook tekshiruvi. Qaytadi: { event } yoki null (fail-closed).
 * `rawBody` — Express json parser'dan OLDINGI xom string bo'lishi shart
 * (hash body'ning aynan kelgan baytlaridan hisoblanadi).
 * Qat'iy qoidalar (§2): iss API key'ga teng, exp MAJBURIY va kelajakda.
 */
export function verifyLivekitWebhook(
  apiSecret: string,
  rawBody: string,
  authHeader: string | undefined,
  opts: { expectedIss?: string; nowMs?: number } = {},
): LivekitWebhookEvent | null {
  if (!authHeader?.startsWith('Bearer ')) return null
  const token = authHeader.slice(7).trim()
  const parts = token.split('.')
  if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) return null
  const [header, body, sig] = parts as [string, string, string]
  let sigBuf: Buffer
  let expBuf: Buffer
  try {
    sigBuf = b64urlDecode(sig)
    expBuf = signHs256(apiSecret, `${header}.${body}`)
  } catch {
    return null
  }
  if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) return null
  let claims: { sha256?: unknown; exp?: unknown; iss?: unknown }
  try {
    claims = JSON.parse(b64urlDecode(body).toString('utf8')) as { sha256?: unknown; exp?: unknown; iss?: unknown }
  } catch {
    return null
  }
  if (opts.expectedIss !== undefined && claims.iss !== opts.expectedIss) return null
  if (typeof claims.exp !== 'number') return null
  const nowSec = Math.floor((opts.nowMs ?? Date.now()) / 1000)
  if (claims.exp <= nowSec) return null
  if (typeof claims.sha256 !== 'string') return null
  const actual = createHash('sha256').update(rawBody, 'utf8').digest('hex')
  let hashOk: boolean
  try {
    hashOk = timingSafeEqual(Buffer.from(claims.sha256, 'utf8'), Buffer.from(actual, 'utf8'))
  } catch {
    return null
  }
  if (!hashOk) return null
  try {
    const evt = JSON.parse(rawBody) as LivekitWebhookEvent
    if (!evt || typeof evt.event !== 'string') return null
    return evt
  } catch {
    return null
  }
}
