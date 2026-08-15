import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockCheckPermissions = vi.fn()
const mockRequestPermissions = vi.fn()
const mockCreateChannel = vi.fn()
const mockCancel = vi.fn()
const mockSchedule = vi.fn()

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: vi.fn(() => true),
  },
}))

vi.mock('@capacitor/local-notifications', () => ({
  LocalNotifications: {
    checkPermissions: mockCheckPermissions,
    requestPermissions: mockRequestPermissions,
    createChannel: mockCreateChannel,
    cancel: mockCancel,
    schedule: mockSchedule,
  },
}))

describe('Local Notifications & Streak Reminder Platform Adapter', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCheckPermissions.mockResolvedValue({ display: 'granted' })
    mockRequestPermissions.mockResolvedValue({ display: 'granted' })
    mockCreateChannel.mockResolvedValue(undefined)
    mockCancel.mockResolvedValue(undefined)
    mockSchedule.mockResolvedValue(undefined)
  })

  it('validates time format correctly and rejects invalid times', async () => {
    const { scheduleDailyStreakReminder } = await import('../../../src/platform/native')

    expect(await scheduleDailyStreakReminder('invalid')).toBe(false)
    expect(await scheduleDailyStreakReminder('25:00')).toBe(false)
    expect(await scheduleDailyStreakReminder('12:65')).toBe(false)
    expect(mockSchedule).not.toHaveBeenCalled()
  })

  it('schedules daily notification with correct hour, minute, and channel in UZ', async () => {
    const { scheduleDailyStreakReminder } = await import('../../../src/platform/native')

    const res = await scheduleDailyStreakReminder('20:30', 'uz')
    expect(res).toBe(true)

    expect(mockCreateChannel).toHaveBeenCalledWith(expect.objectContaining({
      id: 'daily_streak',
      importance: 4,
    }))

    expect(mockCancel).toHaveBeenCalledWith({ notifications: [{ id: 1001 }] })

    expect(mockSchedule).toHaveBeenCalledWith({
      notifications: [
        expect.objectContaining({
          id: 1001,
          title: "🔥 Seriyangizni yo'qotmang!",
          channelId: 'daily_streak',
          schedule: {
            on: {
              hour: 20,
              minute: 30,
            },
            repeats: true,
            allowWhileIdle: true,
          },
        }),
      ],
    })
  })

  it('schedules daily notification in RU when language is ru', async () => {
    const { scheduleDailyStreakReminder } = await import('../../../src/platform/native')

    const res = await scheduleDailyStreakReminder('09:15', 'ru')
    expect(res).toBe(true)

    expect(mockSchedule).toHaveBeenCalledWith({
      notifications: [
        expect.objectContaining({
          id: 1001,
          title: '🔥 Не потеряйте вашу серию!',
          body: 'Решите сегодня 5 вопросов и сохраните ударный режим!',
          schedule: {
            on: {
              hour: 9,
              minute: 15,
            },
            repeats: true,
            allowWhileIdle: true,
          },
        }),
      ],
    })
  })

  it('cancels scheduled notification when cancelDailyStreakReminder is called', async () => {
    const { cancelDailyStreakReminder } = await import('../../../src/platform/native')

    await cancelDailyStreakReminder()
    expect(mockCancel).toHaveBeenCalledWith({ notifications: [{ id: 1001 }] })
  })

  it('returns false if permission is denied', async () => {
    mockCheckPermissions.mockResolvedValue({ display: 'denied' })
    mockRequestPermissions.mockResolvedValue({ display: 'denied' })

    const { scheduleDailyStreakReminder } = await import('../../../src/platform/native')

    const res = await scheduleDailyStreakReminder('20:00', 'uz')
    expect(res).toBe(false)
    expect(mockSchedule).not.toHaveBeenCalled()
  })
})
