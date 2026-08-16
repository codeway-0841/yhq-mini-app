import { test, expect } from '@playwright/test'
import { injectTelegramWebApp } from './helpers/telegram'

test.describe('Dashboard (Bosh sahifa) E2E', () => {
  test.beforeEach(async ({ page }) => {
    await injectTelegramWebApp(page)
  })

  test('sahifa yuklanadi va asosiy elementlar ko‘rinadi', async ({ page }) => {
    await page.goto('/#/')
    await expect(page.locator('.route-page')).toBeVisible({ timeout: 15000 })
    await expect(page.locator('body')).toBeVisible()
  })

  test('navigatsiya orqali biletlar va belgilar sahifasiga o‘tish mumkin', async ({ page }) => {
    await page.goto('/#/')
    await expect(page.locator('.route-page')).toBeVisible({ timeout: 15000 })

    // Navigate to Biletlar
    await page.goto('/#/biletlar')
    await expect(page.locator('.route-page')).toBeVisible({ timeout: 15000 })

    // Navigate to Belgilar
    await page.goto('/#/belgilar')
    await expect(page.locator('.route-page')).toBeVisible({ timeout: 15000 })
  })
})
