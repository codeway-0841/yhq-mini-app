/**
 * Order'ga bog'langan chegirma promokodini to'lov COMPLETION'da ishlatilgan
 * deb belgilash — Click (handleClickComplete) va Payme (performTransaction)
 * UMUMIY qatlami. Best-effort: premium allaqachon berilgan bo'ladi, xato
 * faqat loglanadi (Sentry) — to'lov oqimini sindirmaydi.
 */
import { promoRepository } from '../promo/promo.repository'
import { Sentry } from '../../utils/sentry'

type OrderLike = { userId: string; rawDetails?: Record<string, unknown> | null }

export async function redeemOrderPromo(order: OrderLike): Promise<void> {
  const code = ((order.rawDetails ?? {}) as { promoCode?: unknown }).promoCode
  if (typeof code !== 'string' || !code) return
  try {
    const promo = await promoRepository.findByCode(code)
    if (!promo || promo.type !== 'discount_percent') return
    await promoRepository.markRedeemed(promo.id, order.userId)
  } catch (err) {
    Sentry.captureException(err)
    console.error('[promo] order completion redemption xatosi (davom etadi):', err)
  }
}
