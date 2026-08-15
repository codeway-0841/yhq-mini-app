import { describe, it, expect } from 'vitest'
import { z } from 'zod'

const BroadcastSchema = z.object({
  target: z.enum(['all', 'free', 'premium', 'inactive_7d', 'active_today']),
  text: z.string().min(2).max(4000),
  imageUrl: z.string().url().max(1000).nullable().optional(),
  buttonText: z.string().max(64).nullable().optional(),
  buttonUrl: z.string().max(1000).nullable().optional(),
  testTelegramId: z.union([z.string(), z.number()]).nullable().optional(),
})

describe('Admin Broadcast Module', () => {
  it('validates a valid broadcast announcement payload', () => {
    const valid = {
      target: 'all' as const,
      text: '🔥 Yangi aksiya boshlandi!\n\nBarcha imtihonlarni bepul yeching!',
      imageUrl: 'https://example.com/banner.png',
      buttonText: '🚀 Ilovani ochish',
      buttonUrl: 'https://t.me/kiwi_app_bot/start',
    }
    const res = BroadcastSchema.safeParse(valid)
    expect(res.success).toBe(true)
  })

  it('rejects empty text or invalid target', () => {
    const invalidText = {
      target: 'free' as const,
      text: '',
    }
    expect(BroadcastSchema.safeParse(invalidText).success).toBe(false)

    const invalidTarget = {
      target: 'random_group' as any,
      text: 'Xabar matni',
    }
    expect(BroadcastSchema.safeParse(invalidTarget).success).toBe(false)
  })

  it('correctly calculates chunk batches for rate-limited Telegram sending', () => {
    const totalUsers = 120
    const chunkSize = 25
    const chunks: number[][] = []

    const userIds = Array.from({ length: totalUsers }, (_, i) => 100000 + i)
    for (let i = 0; i < userIds.length; i += chunkSize) {
      chunks.push(userIds.slice(i, i + chunkSize))
    }

    expect(chunks.length).toBe(5) // 25, 25, 25, 25, 20
    expect(chunks[0].length).toBe(25)
    expect(chunks[4].length).toBe(20)
  })

  it('distinguishes free vs premium target filtering logic', () => {
    const now = new Date()
    const sampleUsers = [
      { id: '1001', tariff: 'free', premiumUntil: null },
      { id: '1002', tariff: 'premium', premiumUntil: null }, // lifetime
      { id: '1003', tariff: 'free', premiumUntil: new Date(now.getTime() + 86400000) }, // active trial
      { id: '1004', tariff: 'free', premiumUntil: new Date(now.getTime() - 86400000) }, // expired
    ]

    const premiumUsers = sampleUsers.filter(
      (u) => u.tariff === 'premium' || (u.premiumUntil && new Date(u.premiumUntil) > now)
    )
    const freeUsers = sampleUsers.filter(
      (u) => u.tariff === 'free' && (!u.premiumUntil || new Date(u.premiumUntil) <= now)
    )

    expect(premiumUsers.map((u) => u.id)).toEqual(['1002', '1003'])
    expect(freeUsers.map((u) => u.id)).toEqual(['1001', '1004'])
  })
})
