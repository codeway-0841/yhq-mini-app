/**
 * Integration testlar konfigi — npm run test:integration shu faylni ishlatadi.
 *
 * vitest.config.ts'dan farqi FAQAT retry: 2 — integration testlar HAQIQIY
 * remote Neon DB + WS serveriga ulanadi, tarmoq flake'lari real (va testning
 * o'ziga xos emas). Unit/api testlarida retry: 0 qoldi — flaky ochiq ko'rinsin.
 */
import { defineConfig, mergeConfig } from 'vitest/config'
import baseConfig from './vitest.config'

export default mergeConfig(
  baseConfig,
  defineConfig({
    test: {
      retry: 2,
    },
  }),
)
