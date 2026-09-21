/**
 * Math Board kvota config (P0-C):
 * - production default: kvota YOQILGAN (disabled=false);
 * - prod + disabled=true → router import'da BOOT FATAL.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'

const OLD_ENV = { ...process.env }

afterEach(() => {
  process.env = { ...OLD_ENV }
  vi.resetModules()
})

describe('math-board quota config', () => {
  it('default: kvota yoqilgan (disabled=false)', async () => {
    delete process.env.MATH_BOARD_QUOTA_DISABLED
    process.env.NODE_ENV = 'test'
    vi.resetModules()
    const { config } = await import('../../../server/config/index')
    expect(config.ai.mathBoardQuotaDisabled).toBe(false)
  })

  it('MATH_BOARD_QUOTA_DISABLED=true o‘qiladi', async () => {
    process.env.MATH_BOARD_QUOTA_DISABLED = 'true'
    process.env.NODE_ENV = 'test'
    vi.resetModules()
    const { config } = await import('../../../server/config/index')
    expect(config.ai.mathBoardQuotaDisabled).toBe(true)
  })

  it('prod + disabled=true → BOOT FATAL', async () => {
    process.env.MATH_BOARD_QUOTA_DISABLED = 'true'
    process.env.NODE_ENV = 'production'
    vi.resetModules()
    await expect(import('../../../server/modules/math-board/math-board.router')).rejects.toThrow(
      'MATH_BOARD_QUOTA_DISABLED=true in production',
    )
  })

  it('dev + disabled=true → fatal YO‘Q (warning bilan)', async () => {
    process.env.MATH_BOARD_QUOTA_DISABLED = 'true'
    process.env.NODE_ENV = 'development'
    vi.resetModules()
    const mod = await import('../../../server/modules/math-board/math-board.router')
    expect(mod.default).toBeTruthy()
  })
})
