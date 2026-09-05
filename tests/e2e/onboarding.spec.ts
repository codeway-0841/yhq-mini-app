import { test, expect } from '@playwright/test'
import { injectTelegramWebApp } from './helpers/telegram'

async function expectDocumentToFitViewport(page: import('@playwright/test').Page) {
  const dimensions = await page.evaluate(() => ({
    viewportHeight: document.documentElement.clientHeight,
    documentHeight: document.documentElement.scrollHeight,
    bodyHeight: document.body.scrollHeight,
  }))
  expect(dimensions.documentHeight).toBeLessThanOrEqual(dimensions.viewportHeight + 1)
  expect(dimensions.bodyHeight).toBeLessThanOrEqual(dimensions.viewportHeight + 1)
}

async function expectControlInViewport(control: import('@playwright/test').Locator) {
  const box = await control.boundingBox()
  expect(box).not.toBeNull()
  const viewport = control.page().viewportSize()
  expect(viewport).not.toBeNull()
  expect(box!.y).toBeGreaterThanOrEqual(0)
  expect(box!.y + box!.height).toBeLessThanOrEqual(viewport!.height)
}

test.describe('Onboarding (Yangi Foydalanuvchi) E2E', () => {
  test.use({ viewport: { width: 360, height: 640 } })

  test.beforeEach(async ({ page }) => {
    await injectTelegramWebApp(page, {}, { onboarded: false })
  })

  test('kichik ekranda document scrollsiz onboarding oqimini yakunlaydi', async ({ page }) => {
    await page.goto('/app.html#/')
    await expect(page.getByRole('heading', { name: /Xush kelibsiz/i })).toBeVisible()
    await expectDocumentToFitViewport(page)

    const start = page.getByRole('button', { name: /Boshlash/i })
    await expectControlInViewport(start)
    await start.click()
    await expect(page.getByRole('heading', { name: /Qaysi fanni/i })).toBeVisible()
    await expectDocumentToFitViewport(page)

    const continueButton = page.getByRole('button', { name: /Davom etish/i })
    await expectControlInViewport(continueButton)
    await continueButton.click()
    await expect(page.getByRole('heading', { name: /Kuniga qancha vaqt/i })).toBeVisible()
    await expectDocumentToFitViewport(page)

    const finish = page.getByRole('button', { name: /Boshlash/i })
    await expectControlInViewport(finish)
    await finish.click()
    await expect(page.locator('main.first-launch-screen')).toHaveCount(0)
  })
})

test.describe('Login first-launch layout', () => {
  test.use({ viewport: { width: 360, height: 640 } })

  test.beforeEach(async ({ page }) => {
    await page.route('https://telegram.org/js/telegram-web-app.js', (route) =>
      route.fulfill({ status: 200, contentType: 'application/javascript', body: '' }),
    )
    await page.route(
      (url) => url.pathname.startsWith('/api/') && !url.pathname.includes('/src/'),
      async (route) => {
        const pathname = new URL(route.request().url()).pathname
        const body = pathname.includes('/questions') || pathname.includes('/topics') ? [] : { ok: true }
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })
      },
    )
    await page.addInitScript(() => {
      localStorage.clear()
      delete (window as { Telegram?: unknown }).Telegram
    })
  })

  test('kichik ekranda login document scroll yaratmaydi', async ({ page }) => {
    await page.goto('/app.html#/')
    await expect(page.getByRole('heading', { name: /KIVVI'ga xush kelibsiz/i })).toBeVisible()
    await expect(page.getByText(/Progressingiz xavfsiz saqlanishi uchun/i)).toBeVisible()
    await expect(page.getByText(/Xavfsiz kirish · parol talab qilinmaydi/i)).toBeVisible()
    await expect(page.getByRole('button', { name: /Telegram orqali kirish/i })).toBeVisible()
    await expectDocumentToFitViewport(page)
  })
})
