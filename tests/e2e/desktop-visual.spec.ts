/**
 * Desktop VISUAL REGRESSION (production gate).
 *
 * Har bir sahifa deterministik mock'da (helpers/telegram) render bo'lib,
 * PNG snapshot bilan solishtiriladi. Mobilga TEGMAYDI — faqat desktop shell.
 *
 * Baseline yaratish (birinchi marta / ataylab UI o'zgarganda, DIQQAT bilan):
 *   npx playwright test tests/e2e/desktop-visual.spec.ts --project=desktop-chrome --update-snapshots
 * Tekshirish:
 *   npx playwright test tests/e2e/desktop-visual.spec.ts --project=desktop-chrome
 *
 * Qoidalar:
 *  - Snapshot'lar REVIEW'siz yangilanmaydi (`--update-snapshots` diff'ni ko'r-ko'rona
 *    qabul qiladi — avval `npx playwright show-report` da farqni ko'ring).
 *  - Dinamik kontent (Streak kalendari, reyting, vaqt) — BU spec'da YO'Q
 *    (oy/sana o'zgarganda qizil bo'ladi — ularni alohida mask'lab qo'shing).
 *  - `animations: 'disabled'` + count-up tugashini kutish (900ms) majburiy.
 */
import { test, expect, type Page } from '@playwright/test'
import { injectTelegramWebApp } from './helpers/telegram'

test.use({ viewport: { width: 1440, height: 900 } })

// Visual testlar yuk ostida flaky bo'ladi (shrift rasterizatsiya + CSS
// animatsiyani pauza nuqtasi) — real regressiya deterministik 3 marta ham
// qizil bo'ladi, shovqin esa retry'da o'tadi.
test.describe.configure({ retries: 2 })

// 1200px = 0.09% kadr (AA shovqin o'tadi, layout sinishi 10k+ beradi).
const SHOT_OPTS = { animations: 'disabled', maxDiffPixels: 1200 } as const

test.beforeEach(async ({ page: _page }, testInfo) => {
  void _page
  test.skip(
    testInfo.project.name !== 'desktop-chrome',
    'visual baseline faqat desktop-chrome loyihasida',
  )
})

async function gotoSettled(page: Page, hash: string) {
  await page.goto(`/app.html#${hash}`)
  await expect(page.locator('.route-page')).toBeVisible({ timeout: 15000 })
  // Count-up (900ms) + prefetch tugashini kutamiz — aks holda raqamlar
  // yarim yo'lda ushlanib snapshot flaky bo'ladi.
  await page.waitForTimeout(1800)
  await page.evaluate(() => document.fonts.ready.catch(() => {}))
}

test.describe('Desktop visual baseline', () => {
  test('dashboard — sidebar + progress + shortcutlar', async ({ page }) => {
    await injectTelegramWebApp(page, {}, { onboarded: true })
    await gotoSettled(page, '/')
    await expect(page.locator('aside[aria-label="Desktop navigatsiya"]')).toBeVisible()
    await expect(page).toHaveScreenshot('dashboard.png', SHOT_OPTS)
  })

  test('testlar — 2-ustun karta grid', async ({ page }) => {
    await injectTelegramWebApp(page, {}, { onboarded: true })
    await gotoSettled(page, '/testlar')
    await expect(page).toHaveScreenshot('testlar.png', SHOT_OPTS)
  })

  test('shop — 4-ustun tema grid', async ({ page }) => {
    await injectTelegramWebApp(page, {}, { onboarded: true })
    await gotoSettled(page, '/shop')
    await expect(page).toHaveScreenshot('shop.png', SHOT_OPTS)
  })

  test('profil — tor markaziy ustun', async ({ page }) => {
    await injectTelegramWebApp(page, {}, { onboarded: true })
    await gotoSettled(page, '/profil')
    await expect(page).toHaveScreenshot('profil.png', SHOT_OPTS)
  })

  test('onboarding fan tanlash — 2-ustun grid', async ({ page }) => {
    await injectTelegramWebApp(page, {}, { onboarded: false })
    await page.goto('/app.html#/')
    await page.getByRole('button', { name: 'Boshlash' }).first().click()
    await page.waitForTimeout(1200)
    await expect(page).toHaveScreenshot('onboarding-subjects.png', SHOT_OPTS)
  })

  test('login — fullscreen split (mehmon)', async ({ page }) => {
    // Telegram'siz mehmon — LoginPage (API mock'siz: fallback zanjiri login'ga tushadi)
    await page.route('https://telegram.org/js/telegram-web-app.js', (route) =>
      route.fulfill({ status: 200, contentType: 'application/javascript', body: '' }),
    )
    await page.goto('/app.html#/')
    await expect(
      page.getByRole('button', { name: /Telegram orqali kirish/i }),
    ).toBeVisible({ timeout: 20000 })
    await page.waitForTimeout(1000)
    await expect(page).toHaveScreenshot('login.png', SHOT_OPTS)
  })
})
