import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: [['html', { open: 'never' }], ['list']],
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  // Visual baseline'lar OS'dan mustaqil: CI (linux) va dev (win32) BITTA
  // to'plamni ishlatadi (2026-09-16: `-linux` snapshot yo'qligi uchun e2e qizil edi).
  // Shrift raster farqlari maxDiffPixels/maxDiffPixelRatio tolerantliklarida.
  // (TOP-LEVEL shart — `use` ichida e'tiborsiz qoldiriladi!)
  snapshotPathTemplate: '{testFileDir}/{testFileName}-snapshots/{arg}-{projectName}{ext}',
  projects: [
    {
      name: 'telegram-webview-android',
      use: { ...devices['Pixel 7'] },
    },
    {
      name: 'desktop-chrome',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
