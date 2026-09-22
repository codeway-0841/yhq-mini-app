/**
 * CamAi E2E — setup render + to'liq o'yin oqimi (kamerasiz fallback orqali).
 *
 * Headless Chromium'da kamera qurilmasi yo'q → getUserMedia NotFoundError →
 * 'denied' holati → "Kamerasiz rejim" fallback kartasi. Shu orqali ruletka →
 * savol → baholash zanjirini real (mock'lanmagan) UI'da tekshiramiz.
 * MediaPipe WASM/model dev-server public/'dan real yuklanadi.
 */
import { test, expect } from '@playwright/test'
import { injectTelegramWebApp } from './helpers/telegram'

test.describe('CamAi E2E', () => {
  test.beforeEach(async ({ page }) => {
    await injectTelegramWebApp(page)
  })

  test("setup sahifasi render bo'ladi (manba + fan + son tanlash)", async ({ page }) => {
    await page.goto('/app.html#/camai')
    await expect(page.getByRole('heading', { name: 'CamAi' })).toBeVisible({ timeout: 15000 })
    await expect(page.getByRole('button', { name: 'Savol banki', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: "O'z savollarim" })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Boshlash' })).toBeVisible()
  })

  test("custom savollar bo'sh bo'lsa boshlamaydi", async ({ page }) => {
    await page.goto('/app.html#/camai')
    await page.getByRole('button', { name: "O'z savollarim" }).click()
    await page.getByRole('button', { name: 'Boshlash' }).click()
    // Setup'da qoladi (o'yin fazasiga o'tmaydi)
    await expect(page.getByRole('button', { name: 'Boshlash' })).toBeVisible()
  })

  test("bank + kamerasiz rejim: ruletka → savol → to'g'ri baho → ochko → yakunlash", async ({ page }) => {
    await page.goto('/app.html#/camai')
    await page.getByRole('button', { name: 'Boshlash' }).click()

    // Headless'da kamera yo'q → MediaPipe yuklangach 'denied' → fallback karta
    await expect(page.getByText('Kamerasiz rejim')).toBeVisible({ timeout: 25000 })
    await page.getByRole('button', { name: 'Kamerasiz davom etish' }).click()

    // Raqamli slotlar grid + tasodifiy tanlash
    const pickBtn = page.getByRole('button', { name: 'Tasodifiy tanlash' })
    await expect(pickBtn).toBeEnabled()
    await pickBtn.click()

    // Ruletka (~2-4s) tugagach savol kartasi ochiladi
    await expect(page.getByText(/Test savol/)).toBeVisible({ timeout: 15000 })
    await page.getByRole('button', { name: "To'g'ri" }).click()

    // Hisob taxtasida slot ochkosi ko'rinadi — o'yin cheksiz davom etadi (auto-done YO'Q)
    await expect(page.getByText(/O'quvchi \d+: 1/)).toBeVisible()
    await expect(pickBtn).toBeVisible()

    // O'qituvchi o'zi yakunlaydi → reyting jadvali
    await page.getByRole('button', { name: 'Yakunlash' }).click()
    await expect(page.getByText("O'yin tugadi!")).toBeVisible()
    // Sidebar'da ham "Reyting" nav-tugmasi bor — faqat jadval sarlavhasi (<p>)
    await expect(page.locator('p', { hasText: 'Reyting' })).toBeVisible()
    // 1-o'rin medal + ✓ ustuni
    await expect(page.getByText('🥇')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Qayta boshlash' })).toBeVisible()
  })

  test("scoreboard chip'iga bosib o'quvchiga ism yozish", async ({ page }) => {
    await page.goto('/app.html#/camai')
    await page.getByRole('button', { name: 'Boshlash' }).click()
    await expect(page.getByText('Kamerasiz rejim')).toBeVisible({ timeout: 25000 })
    await page.getByRole('button', { name: 'Kamerasiz davom etish' }).click()
    await page.getByRole('button', { name: 'Tasodifiy tanlash' }).click()
    await expect(page.getByText(/Test savol/)).toBeVisible({ timeout: 15000 })
    await page.getByRole('button', { name: "To'g'ri" }).click()

    // Chip paydo bo'ladi → bosish — ism dialogi
    await page.getByRole('button', { name: /O'quvchi \d+: 1✓/ }).click()
    await expect(page.getByText('Ism yozish')).toBeVisible()
    await page.getByPlaceholder(/O'quvchi \d+/).fill('Jasur')
    await page.getByRole('button', { name: 'Saqlash' }).click()

    // Chip endi ism bilan
    await expect(page.getByRole('button', { name: /Jasur: 1✓/ })).toBeVisible()
  })

  test("custom savollar bilan o'yin (erkin matn + kutilgan javob toggle)", async ({ page }) => {
    await page.goto('/app.html#/camai')
    await page.getByRole('button', { name: "O'z savollarim" }).click()
    await page.locator('textarea').fill('2+2 nechaga teng? || 4\nO‘zbekiston poytaxti? || Toshkent')
    await page.getByRole('button', { name: 'Boshlash' }).click()

    await expect(page.getByText('Kamerasiz rejim')).toBeVisible({ timeout: 25000 })
    await page.getByRole('button', { name: 'Kamerasiz davom etish' }).click()
    await page.getByRole('button', { name: 'Tasodifiy tanlash' }).click()

    // Savollar aralashgan — ikkalasidan biri ko'rinadi; variantlar ro'yxati YO'Q
    await expect(page.getByText(/2\+2 nechaga teng\?|O‘zbekiston poytaxti\?/)).toBeVisible({ timeout: 15000 })
    await expect(page.getByText('Variant A')).toHaveCount(0)

    // Kutilgan javob yashirin — toggle ochguncha ko'rinmaydi (proyektor xavfsizligi)
    await expect(page.getByText('Javob:')).toHaveCount(0)
    await page.getByRole('button', { name: "Javobni ko'rsatish" }).click()
    await expect(page.getByText(/Javob: (4|Toshkent)/)).toBeVisible()

    await page.getByRole('button', { name: 'Xato' }).click()
    // Xato = 0 ball → hisob taxtasi bo'sh qoladi, keyingi savol/idle holati
    await expect(page.getByRole('button', { name: 'Tasodifiy tanlash' })).toBeVisible()
  })
})
