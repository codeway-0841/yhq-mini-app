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
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expectDocumentToFitViewport(page)

    const continueButton = page.getByRole('button', { name: /Continue|Davom etish/i })
    await expectControlInViewport(continueButton)
    await continueButton.click()

    await expect(page.getByText('Which describes you best?')).toBeVisible()
    await expectDocumentToFitViewport(page)

    // Persona tanlash
    await page.getByText('Student or soon to be enrolled').click()
    await continueButton.click()

    await expect(page.getByText('Which are you most interested in?')).toBeVisible()
    await expectDocumentToFitViewport(page)
    await page.getByText('Explore new topics').click()
    await continueButton.click()

    // 3. Place
    await expect(page.getByText("You're in the right place")).toBeVisible()
    await continueButton.click()

    // 4. Daily Goal
    await expect(page.getByText("What's your daily learning goal?")).toBeVisible()
    await page.getByText('Regular').click()
    await continueButton.click()

    // 5. Reminders
    await expect(page.getByText(/Reach your daily goal/i)).toBeVisible()
    await page.getByRole('button', { name: /Allow notifications/i }).click()

    // 6. Level
    await expect(page.getByText(/What is your programming/i)).toBeVisible()
    await page.getByText('Intermediate').click()
    await continueButton.click()

    // 7. Efficacy
    await expect(page.getByText('Learn 6x more effectively')).toBeVisible()
    await continueButton.click()

    // 8. Testimonial
    await expect(page.getByText("You're on your way!")).toBeVisible()
    await continueButton.click()

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
      localStorage.setItem('yhq-onboarded', '1')
      delete (window as { Telegram?: unknown }).Telegram
    })
  })

  test('kichik ekranda login document scroll yaratmaydi', async ({ page }) => {
    await page.goto('/app.html#/')
    // Responsive split: sarlavha/matnnisbat mobil (lg:hidden) va desktop
    // (hidden lg:flex) variantlarda takrorlanadi — kichik viewport'da MOBIL
    // nusxa ko'rinadi (telegram-login-title faqat mobil h1'da, max-w-[320px]
    // faqat mobil sub'da, telegram-login-trust faqat mobil ishonch qatorida).
    await expect(page.locator('h1.telegram-login-title')).toBeVisible()
    await expect(page.locator('section p.max-w-\\[320px\\]')).toContainText(/Progressingiz xavfsiz saqlanishi uchun/i)
    await expect(page.locator('p.telegram-login-trust')).toContainText(/Xavfsiz kirish · parol talab qilinmaydi/i)
    await expect(page.getByRole('button', { name: /Telegram orqali kirish/i })).toBeVisible()
    await expectDocumentToFitViewport(page)
  })
})
