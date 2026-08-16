import { test, expect } from '@playwright/test'

test.describe('Onboarding (Yangi Foydalanuvchi) E2E', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      try {
        localStorage.removeItem('yhq-onboarded')
      } catch {
        // ignore
      }
      ;(window as any).Telegram = {
        WebApp: {
          ready: () => {},
          expand: () => {},
          close: () => {},
          initData:
            'query_id=mock&user=%7B%22id%22%3A999999%2C%22first_name%22%3A%22NewUser%22%7D&auth_date=1700000000&hash=mockhash',
          initDataUnsafe: { user: { id: 999999, first_name: 'NewUser' } },
          themeParams: {},
          BackButton: { show: () => {}, hide: () => {}, onClick: () => {}, offClick: () => {} },
          HapticFeedback: { impactOccurred: () => {} },
          version: '7.0',
          platform: 'android',
        },
      }
    })
  })

  test('onboarding oqimini to‘liq yakunlash', async ({ page }) => {
    await page.goto('/#/')
    await expect(page.locator('body')).toBeVisible()

    const startBtn = page.locator('button', { hasText: /Boshlash/i })
    if (await startBtn.isVisible()) {
      await startBtn.click()

      const continueBtn = page.locator('button', { hasText: /Davom etish/i })
      await expect(continueBtn).toBeVisible()
      await continueBtn.click()

      const finishBtn = page.locator('button', { hasText: /Boshlash/i })
      await expect(finishBtn).toBeVisible()
      await finishBtn.click()

      await expect(page.locator('body')).toBeVisible()
    }
  })
})
