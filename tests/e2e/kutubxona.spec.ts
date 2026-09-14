import { test, expect } from '@playwright/test'
import { injectTelegramWebApp } from './helpers/telegram'

/**
 * Kutubxona sahifasi E2E: katalog ochilishi, sinf filtri, qidiruv (ru fan nomi)
 * va kitob sheet'i. Skrinshotlar `test-results/`ga tushadi (dark + light) — vizual QA.
 */
test('kutubxona: katalog, qidiruv, sinf filtri va kitob sheet', async ({ page }) => {
  await injectTelegramWebApp(page, {}, { onboarded: true })

  await page.goto('/app.html#/kutubxona')
  await expect(page.getByRole('heading', { name: 'Kutubxona' })).toBeVisible({ timeout: 20_000 })
  await expect(page.getByRole('button', { name: '1-sinf Alifbe' })).toBeVisible()

  await page.screenshot({ path: `test-results/kutubxona-dark-${test.info().project.name}.png` })

  // Sinf filtri — 5-sinf kitobi ko'rinadi, boshqa sinf yo'qoladi
  await page.getByRole('button', { name: '5-sinf', exact: true }).click()
  await expect(page.getByRole('button', { name: '5-sinf Matematika (1-qism)' })).toBeVisible()
  await expect(page.getByRole('button', { name: '1-sinf Alifbe' })).toHaveCount(0)

  // Filtrni bo'shatib, rus tilidagi fan nomi bilan qidiruv
  await page.getByRole('button', { name: 'Barchasi', exact: true }).click()
  await page.getByLabel('Kitob yoki fan qidirish...').fill('физика')
  await expect(page.getByRole('button', { name: '7-sinf Fizika' })).toBeVisible()
  await expect(page.getByRole('button', { name: '8-sinf Fizika' })).toBeVisible()
  await expect(page.getByRole('button', { name: '1-sinf Alifbe' })).toHaveCount(0)

  // Qidiruvni tozalab, kitob sheet'ini ochish
  await page.getByLabel('Qidiruvni tozalash').click()
  await page.getByRole('button', { name: '1-sinf Alifbe' }).click()
  await expect(page.getByRole('heading', { name: '1-sinf Alifbe' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'PDF ochish' })).toBeVisible()
  await page.waitForTimeout(350) // sheet slide-in animatsiyasi tugasin (skrinshot uchun)
  await page.screenshot({ path: `test-results/kutubxona-sheet-${test.info().project.name}.png` })

  // Light rejim — dizayn tokenlari ikkala temada ham ishlashi shart
  await page.keyboard.press('Escape')
  await page.evaluate(() => {
    document.body.dataset.theme = 'light'
  })
  await page.waitForTimeout(200)
  await page.screenshot({ path: `test-results/kutubxona-light-${test.info().project.name}.png` })
})
