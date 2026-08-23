/**
 * Ommaviy xabarnoma payload validatsiyasi — SERVERDAGI haqiqiy zod sxemalari
 * ustidan (`admin.router.ts`). Yuborish oqimining o'zi
 * tests/integration/api/admin-broadcast.test.ts'da.
 */
import { describe, it, expect } from 'vitest'
import { BroadcastSchema, BroadcastPreviewSchema } from '../../../server/modules/admin/admin.router'

const base = { target: 'all' as const, text: 'Yangi aksiya boshlandi!' }

describe('BroadcastSchema', () => {
  it('to\'liq payloadni (yuklangan rasm + tugma) qabul qiladi', () => {
    const res = BroadcastSchema.safeParse({
      ...base,
      imageData: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD',
      buttonText: 'Ilovani ochish',
      buttonUrl: 'https://t.me/kiwi_app_bot/start',
    })
    expect(res.success).toBe(true)
  })

  it('rasm/tugmasiz minimal payload ham yaroqli', () => {
    expect(BroadcastSchema.safeParse(base).success).toBe(true)
  })

  it('noma\'lum target rad etiladi', () => {
    expect(BroadcastSchema.safeParse({ ...base, target: 'vip' }).success).toBe(false)
    expect(BroadcastSchema.safeParse({ ...base, target: 'inactive_7d' }).success).toBe(true)
    expect(BroadcastSchema.safeParse({ ...base, target: 'active_today' }).success).toBe(true)
  })

  it('matn chegaralari: 1 belgi kam, 4000 chegara, 4001 ko\'p', () => {
    expect(BroadcastSchema.safeParse({ ...base, text: 'a' }).success).toBe(false)
    expect(BroadcastSchema.safeParse({ ...base, text: 'ab' }).success).toBe(true)
    expect(BroadcastSchema.safeParse({ ...base, text: 'a'.repeat(4000) }).success).toBe(true)
    expect(BroadcastSchema.safeParse({ ...base, text: 'a'.repeat(4001) }).success).toBe(false)
  })

  it('imageUrl URL bo\'lishi shart, null ruxsat etiladi', () => {
    expect(BroadcastSchema.safeParse({ ...base, imageUrl: 'not-a-url' }).success).toBe(false)
    expect(BroadcastSchema.safeParse({ ...base, imageUrl: 'https://cdn.example.com/a.jpg' }).success).toBe(true)
    expect(BroadcastSchema.safeParse({ ...base, imageUrl: null }).success).toBe(true)
  })

  it('tugma matni 64 belgidan oshmaydi', () => {
    expect(BroadcastSchema.safeParse({ ...base, buttonText: 'a'.repeat(64) }).success).toBe(true)
    expect(BroadcastSchema.safeParse({ ...base, buttonText: 'a'.repeat(65) }).success).toBe(false)
  })

  it('testTelegramId string ham, raqam ham bo\'la oladi', () => {
    expect(BroadcastSchema.safeParse({ ...base, testTelegramId: 12345678 }).success).toBe(true)
    expect(BroadcastSchema.safeParse({ ...base, testTelegramId: '12345678' }).success).toBe(true)
    expect(BroadcastSchema.safeParse({ ...base, testTelegramId: null }).success).toBe(true)
  })
})

describe('BroadcastPreviewSchema', () => {
  it('faqat targetni talab qiladi', () => {
    expect(BroadcastPreviewSchema.safeParse({ target: 'premium' }).success).toBe(true)
    expect(BroadcastPreviewSchema.safeParse({}).success).toBe(false)
    expect(BroadcastPreviewSchema.safeParse({ target: 'nobody' }).success).toBe(false)
  })
})
