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
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    setupFiles: ['tests/setup.ts'],
    // Integration tests hit a remote Neon DB — network latency can exceed the default 5 s
    testTimeout: 15_000,
    // Network flakes shouldn't fail the suite outright
    retry: 2,
    coverage: {
      provider: 'v8',
      include: ['src/lib/**', 'server/middleware/**', 'server/modules/**'],
      exclude: ['**/*.test.ts'],
    },
  },
})
