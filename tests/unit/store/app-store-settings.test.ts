import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useAppStore } from '../../../src/shared/store/useAppStore'
import { api } from '../../../src/shared/api'
import * as native from '../../../src/platform/native'

describe('useAppStore.updateSettings (Characterization)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAppStore.setState({
      user: { id: '123456789', firstName: 'Test' } as any,
      settings: {
        autoNextCorrect: true,
        autoNextWrong: false,
        noAnimation: false,
        shuffleOptions: false,
        fontSize: 'medium',
        fontStyle: 'default',
        language: 'uz',
        theme: 'dark',
        offlineMode: true,
        dailyReminder: true,
        dailyReminderTime: '20:00',
      },
    })
  })

  it('schedules native reminder when reminder settings change', async () => {
    const scheduleSpy = vi.spyOn(native, 'scheduleDailyStreakReminder').mockResolvedValue()
    vi.spyOn(api, 'patchSettings').mockResolvedValue({} as any)

    useAppStore.getState().updateSettings({ dailyReminderTime: '21:30' })

    expect(scheduleSpy).toHaveBeenCalledWith('21:30', 'uz')
    expect(useAppStore.getState().settings.dailyReminderTime).toBe('21:30')
  })

  it('cancels native reminder when dailyReminder is set to false', async () => {
    const cancelSpy = vi.spyOn(native, 'cancelDailyStreakReminder').mockResolvedValue()
    vi.spyOn(api, 'patchSettings').mockResolvedValue({} as any)

    useAppStore.getState().updateSettings({ dailyReminder: false })

    expect(cancelSpy).toHaveBeenCalled()
    expect(useAppStore.getState().settings.dailyReminder).toBe(false)
  })

  it('rolls back settings if patchSettings fails with 400 validation error', async () => {
    vi.spyOn(api, 'patchSettings').mockRejectedValue(new Error('HTTP 400 Bad Request'))

    useAppStore.getState().updateSettings({ fontSize: 'large' })

    // Wait for promise microtasks
    await Promise.resolve()

    expect(useAppStore.getState().settings.fontSize).toBe('medium')
  })

  it('product default (2026-09-24): auto-advance after WRONG answers is ON for fresh installs', async () => {
    vi.resetModules()
    localStorage.clear()
    const fresh = await import('../../../src/shared/store/useAppStore')
    expect(fresh.useAppStore.getState().settings.autoNextWrong).toBe(true)
    expect(fresh.useAppStore.getState().settings.autoNextCorrect).toBe(true)
  })
})
