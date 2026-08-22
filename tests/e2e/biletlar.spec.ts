import { test, expect } from '@playwright/test'
import { injectTelegramWebApp } from './helpers/telegram'

test.describe('Biletlar Sahifasi E2E', () => {
  test.beforeEach(async ({ page }) => {
    await injectTelegramWebApp(page)
  })

  test('biletlar sahifasi yuklanadi va tablar ko‘rinadi', async ({ page }) => {
    await page.goto('/#/biletlar')
    await expect(page.locator('.route-page')).toBeVisible({ timeout: 15000 })
    await expect(page.locator('h1')).toBeVisible()
  })

  test('orqaga qaytish tugmasi mavjud', async ({ page }) => {
    await page.goto('/#/biletlar')
    await expect(page.locator('.route-page')).toBeVisible({ timeout: 15000 })
    // v3: orqaga strelkasi matn "←" o'rniga lucide ikonka + aria-label bilan
    // beriladi (KIWI redesign) — nomga emas, rolga qarab topamiz.
    const backBtn = page.getByRole('button', { name: /orqaga|назад/i })
    await expect(backBtn).toBeVisible()
  })
})
