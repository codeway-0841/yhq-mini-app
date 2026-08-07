import { parsePaymentPayload, type PremiumPlan } from '../../../shared/premium-plans'

export interface PremiumPaymentInput {
  payerId: string
  payload: string
  currency: string
  totalAmount: number
}

export type PaymentValidation =
  | { ok: true; userId: bigint; plan: PremiumPlan }
  | { ok: false; reason: 'invalid_payload' | 'payer_mismatch' | 'invalid_currency' | 'invalid_amount' }

/** Telegram invoice qiymatlarini shared tarif konfiguratsiyasiga qarshi tekshiradi. */
export function validatePremiumPayment(input: PremiumPaymentInput): PaymentValidation {
  const parsed = parsePaymentPayload(input.payload)
  if (!parsed) return { ok: false, reason: 'invalid_payload' }
  if (parsed.userId !== input.payerId) return { ok: false, reason: 'payer_mismatch' }
  if (input.currency !== 'XTR') return { ok: false, reason: 'invalid_currency' }
  if (!Number.isInteger(input.totalAmount) || input.totalAmount !== parsed.plan.stars) {
    return { ok: false, reason: 'invalid_amount' }
  }

  try {
    return { ok: true, userId: BigInt(parsed.userId), plan: parsed.plan }
  } catch {
    return { ok: false, reason: 'invalid_payload' }
  }
}

export function paymentErrorMessage(reason: Exclude<PaymentValidation, { ok: true }>['reason']): string {
  switch (reason) {
    case 'payer_mismatch': return "Invoice boshqa foydalanuvchiga tegishli"
    case 'invalid_currency': return "To'lov valyutasi noto'g'ri"
    case 'invalid_amount': return "To'lov summasi tarifga mos emas"
    default: return "Invoice ma'lumoti noto'g'ri"
  }
}
