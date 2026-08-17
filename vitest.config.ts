import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'url'
import path from 'path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  test: {
    globals: false,
    environment: 'jsdom',
    include: ['tests/**/*.test.{ts,tsx}'],
    setupFiles: ['tests/setup.ts', 'tests/unit/setup.ts'],
    // Integration tests hit a remote Neon DB — network latency can exceed the default 5 s
    testTimeout: 15_000,
    hookTimeout: 20_000,
    // retry: 0 (unit/api) — flaky testlar MASKALANMASIN, CI'da ochiq yiqilsin.
    // Integration uchun network-flake retry'lari: vitest.integration.config.ts
    // (npm run test:integration shu configni ishlatadi).
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: [
        'src/shared/**',
        'src/platform/**',
        'src/features/**',
        'shared/**',
        'server/modules/**',
        'server/middleware/**',
        'server/providers/**',
        'server/utils/**',
      ],
      exclude: ['**/*.test.{ts,tsx}', '**/*.d.ts'],
    },
  },
})
