/**
 * Live join-token — xona bileti (opaque, HMAC-SHA256).
 *
 * Format: base64url(payloadJSON).base64url(sig) — LiveKit JWT EMAS (Faza 1b'da
 * LiveKit AccessToken shu interfacening ortiga ulanadi). Rol client'dan
 * olinmaydi — issue() caller server resolve qilgan rolni imzolaydi.
 * Verify fail-closed: imzo/xona/muddat/rol buzilsa null.
 */
import { createHmac, timingSafeEqual } from 'node:crypto'
import {
  isLiveRole,
  type LiveJoinClaims,
  type LiveRole,
} from '../../../shared/live'

function b64urlEncode(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function b64urlDecode(s: string): Buffer {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/')
  return Buffer.from(b64, 'base64')
}

export function issueLiveJoinToken(
  secret: string,
  args: { roomId: number; room: string; sub: string; role: LiveRole; canSpeak: boolean; ttlSeconds: number; nowMs?: number },
): string {
  const now = args.nowMs ?? Date.now()
  const payload: LiveJoinClaims = {
    room: args.room,
    roomId: args.roomId,
    sub: args.sub,
    role: args.role,
    spk: args.canSpeak,
    exp: Math.floor(now / 1000) + args.ttlSeconds,
  }
  const body = b64urlEncode(Buffer.from(JSON.stringify(payload), 'utf8'))
  const sig = b64urlEncode(createHmac('sha256', secret).update(body).digest())
  return `${body}.${sig}`
}

export function verifyLiveJoinToken(
  secret: string,
  token: string,
  opts: { expectedRoomId?: number; expectedRoom?: string; nowMs?: number } = {},
): LiveJoinClaims | null {
  const parts = token.split('.')
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null
  const [body, sig] = parts as [string, string]
  let sigBuf: Buffer
  let expBuf: Buffer
  try {
    sigBuf = b64urlDecode(sig)
    expBuf = createHmac('sha256', secret).update(body).digest()
  } catch {
    return null
  }
  if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) return null
  let claims: LiveJoinClaims
  try {
    claims = JSON.parse(b64urlDecode(body).toString('utf8')) as LiveJoinClaims
  } catch {
    return null
  }
  if (!Number.isInteger(claims.roomId) || claims.roomId <= 0) return null
  if (typeof claims.room !== 'string' || claims.room.length === 0) return null
  if (typeof claims.sub !== 'string' || claims.sub.length === 0) return null
  if (!isLiveRole(claims.role)) return null
  if (typeof claims.spk !== 'boolean') return null
  if (!Number.isInteger(claims.exp)) return null
  const nowSec = Math.floor((opts.nowMs ?? Date.now()) / 1000)
  if (claims.exp <= nowSec) return null
  if (opts.expectedRoomId !== undefined && claims.roomId !== opts.expectedRoomId) return null
  if (opts.expectedRoom !== undefined && claims.room !== opts.expectedRoom) return null
  return claims
}
