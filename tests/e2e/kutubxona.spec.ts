import { test, expect } from '@playwright/test'
import { injectTelegramWebApp } from './helpers/telegram'

function makePdfFixture(): Buffer {
  const stream = 'BT /F1 36 Tf 72 700 Td (KIVVI PDF reader) Tj ET'
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
  ]
  const offsets = [0]
  let pdf = '%PDF-1.4\n'
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(pdf))
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`
  })
  const xrefOffset = Buffer.byteLength(pdf)
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  pdf += offsets.slice(1).map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`
  return Buffer.from(pdf)
}

/**
 * Kutubxona sahifasi E2E: katalog ochilishi, sinf filtri, qidiruv (ru fan nomi)
 * va kitob sheet'i. Skrinshotlar `test-results/`ga tushadi (dark + light) — vizual QA.
 */
test('kutubxona: katalog, qidiruv, sinf filtri va kitob sheet', async ({ page }) => {
  await injectTelegramWebApp(page, {}, { onboarded: true })
  await page.route('**/kutubxona/pdf/1-sinf/1-sinf-alifbe.pdf', (route) => route.fulfill({
    status: 200,
    contentType: 'application/pdf',
    body: makePdfFixture(),
  }))

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
  await expect(page.getByRole('button', { name: 'Ilovada o‘qish' })).toBeVisible()
  await page.waitForTimeout(350) // sheet slide-in animatsiyasi tugasin (skrinshot uchun)
  await page.screenshot({ path: `test-results/kutubxona-sheet-${test.info().project.name}.png` })

  // Ichki reader — haqiqiy PDF.js worker + canvas render.
  await page.getByRole('button', { name: 'Ilovada o‘qish' }).click()
  await expect(page).toHaveURL(/#\/kutubxona\/kitob\/1-sinf-alifbe$/)
  const firstPage = page.getByLabel('PDF — 1-bet')
  await expect(firstPage).toBeVisible({ timeout: 20_000 })
  await expect.poll(async () => Number(await firstPage.getAttribute('width'))).toBeGreaterThan(0)
  await expect(page.locator('[data-pdf-rendering]')).toHaveAttribute('data-pdf-rendering', 'false', { timeout: 20_000 })
  await expect(page.getByRole('navigation', { name: 'Asosiy navigatsiya' })).toHaveCount(0)
  await page.screenshot({ path: `test-results/kutubxona-reader-${test.info().project.name}.png` })

  // Light rejim — dizayn tokenlari ikkala temada ham ishlashi shart
  await page.getByRole('button', { name: 'Orqaga' }).click()
  await expect(page.getByRole('heading', { name: 'Kutubxona' })).toBeVisible()
  await page.evaluate(() => {
    document.body.dataset.theme = 'light'
  })
  await page.waitForTimeout(200)
  await page.screenshot({ path: `test-results/kutubxona-light-${test.info().project.name}.png` })
})
