import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { and, eq, inArray } from 'drizzle-orm'
import { db } from '../../../server/db/connection'
import { paymentOrders, promoCodes, users } from '../../../server/schema'
import { promoRepository } from '../../../server/modules/promo/promo.repository'

const suffix = Date.now().toString(36)
const code = `AUDIT-CONC-${suffix}`
const userIds = [`audit-promo-a-${suffix}`, `audit-promo-b-${suffix}`]
const orderIds = [`audit-order-a-${suffix}`, `audit-order-b-${suffix}`]

describe('discount order reservation concurrency', () => {
  beforeAll(async () => {
    await db.insert(users).values(userIds.map((id) => ({
      id,
      firstName: id,
      lastName: '',
      username: '',
      photoUrl: '',
    })))
    await db.insert(promoCodes).values({
      code,
      type: 'discount_percent',
      value: 10,
      maxUses: 1,
    })
  })

  afterAll(async () => {
    await db.delete(paymentOrders).where(inArray(paymentOrders.orderId, orderIds))
    await db.delete(promoCodes).where(eq(promoCodes.code, code))
    await db.delete(users).where(inArray(users.id, userIds))
  })

  it('allows only one pending order for a single-use code', async () => {
    const base = {
      plan: 'month',
      amountUzs: 26_100,
      provider: 'click',
      rawDetails: { promoCode: code, discountPercent: 10 },
    }
    const results = await Promise.all(userIds.map((userId, index) => promoRepository.createDiscountPaymentOrder(code, {
      ...base,
      orderId: orderIds[index],
      userId,
    })))

    expect(results.map((result) => result.status).sort()).toEqual(['created', 'limit_reached'])
    const rows = await db.select({ id: paymentOrders.id })
      .from(paymentOrders)
      .where(and(eq(paymentOrders.status, 'pending'), inArray(paymentOrders.orderId, orderIds)))
    expect(rows).toHaveLength(1)
  })
})
