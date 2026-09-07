import { createHmac, timingSafeEqual } from 'crypto'

export interface DeliveryProofClaims {
  userId: string
  sessionId: string
  subjectId: string
  position: number
  expiresAt: string
}

function canonical(claims: DeliveryProofClaims): string {
  return [
    'v1',
    claims.userId,
    claims.sessionId,
    claims.subjectId,
    String(claims.position),
    claims.expiresAt,
  ].join('\n')
}

export function createDeliveryToken(secret: string, claims: DeliveryProofClaims): string {
  const mac = createHmac('sha256', secret).update(canonical(claims)).digest('base64url')
  return `v1.${mac}`
}

export function verifyDeliveryToken(secret: string, claims: DeliveryProofClaims, token: string): boolean {
  const expected = Buffer.from(createDeliveryToken(secret, claims))
  const received = Buffer.from(token)
  return expected.length === received.length && timingSafeEqual(expected, received)
}
