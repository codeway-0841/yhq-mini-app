import { chromium } from 'playwright'
import fs from 'fs'
import path from 'path'

async function run() {
  const outDir = path.resolve('public/images/screenshots')
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true })

  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    viewport: { width: 1080, height: 1920 },
    deviceScaleFactor: 1,
  })

  const page = await context.newPage()

  try {
    console.log('Navigating to https://kivvi.uz...')
    await page.goto('https://kivvi.uz', { waitUntil: 'networkidle', timeout: 15000 })
    await page.waitForTimeout(1000)
    await page.screenshot({ path: path.join(outDir, 'screenshot_1.png') })
    console.log('Saved screenshot_1.png (Hero)')

    // Scroll to features
    await page.evaluate(() => {
      globalThis.scrollBy(0, 900)
    })
    await page.waitForTimeout(1000)
    await page.screenshot({ path: path.join(outDir, 'screenshot_2.png') })
    console.log('Saved screenshot_2.png (Features)')

    // Scroll further to stats / modes
    await page.evaluate(() => {
      globalThis.scrollBy(0, 900)
    })
    await page.waitForTimeout(1000)
    await page.screenshot({ path: path.join(outDir, 'screenshot_3.png') })
    console.log('Saved screenshot_3.png (Modes & Stats)')
  } catch (e) {
    console.error('Error on kivvi.uz:', e.message)
  }

  try {
    console.log('Navigating to https://app.kivvi.uz...')
    await page.goto('https://app.kivvi.uz', { waitUntil: 'networkidle', timeout: 15000 })
    await page.waitForTimeout(1000)
    await page.screenshot({ path: path.join(outDir, 'screenshot_4.png') })
    console.log('Saved screenshot_4.png (App Entry)')
  } catch (e) {
    console.error('Error on app.kivvi.uz:', e.message)
  }

  await browser.close()
  console.log('Done!')
}

run()
