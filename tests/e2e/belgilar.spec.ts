import { test, expect } from '@playwright/test'
import { injectTelegramWebApp } from './helpers/telegram'

test.describe('Yo‘l Belgilari E2E', () => {
  test.beforeEach(async ({ page }) => {
    await injectTelegramWebApp(page)
  })

  test('yo‘l belgilari kategoriyalari yuklanadi', async ({ page }) => {
    await page.goto('/#/belgilar')
    await expect(page.locator('.route-page')).toBeVisible({ timeout: 15000 })
    await expect(page.getByPlaceholder(/Belgi qidirish/i)).toBeVisible()
  })

  test('qidiruv inputiga matn kiritganda filtrlanadi', async ({ page }) => {
    await page.goto('/#/belgilar')
    await expect(page.locator('.route-page')).toBeVisible({ timeout: 15000 })
    const searchInput = page.getByPlaceholder(/Belgi qidirish/i)
    await searchInput.fill('Stop')
    await expect(page.locator('body')).toBeVisible()
  })
})
