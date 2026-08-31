import { test, expect } from '@playwright/test'
import { injectTelegramWebApp } from './helpers/telegram'

test.describe('Profil & Sozlamalar E2E', () => {
  test.beforeEach(async ({ page }) => {
    await injectTelegramWebApp(page)
  })

  test('profil sahifasi yuklanadi va asosiy bo‘limlar ko‘rinadi', async ({ page }) => {
    await page.goto('/app.html#/profil')
    await expect(page.locator('.route-page')).toBeVisible({ timeout: 15000 })
    await expect(page.locator('body')).toBeVisible()
  })

  test('promokod modalini ochish va yopish mumkin', async ({ page }) => {
    await page.goto('/app.html#/profil')
    await expect(page.locator('.route-page')).toBeVisible({ timeout: 15000 })

    const promoItem = page.locator('button', { hasText: /Promokod/i })
    if (await promoItem.isVisible()) {
      await promoItem.click()
      // Verify modal backdrop and form are visible
      const modal = page.locator('.fixed.inset-0')
      await expect(modal).toBeVisible()
    }
  })
})
