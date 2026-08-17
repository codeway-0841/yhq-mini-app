import { describe, it, expect, vi } from 'vitest'
import { createReadinessHandler } from '../../../server/middleware/readiness'

describe('createReadinessHandler', () => {
  it('returns 200 { status: "ready" } when ping succeeds', async () => {
    const ping = vi.fn().mockResolvedValue(true)
    const handler = createReadinessHandler(ping, 1000)

    const req = {} as any
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    } as any

    await handler(req, res)

    expect(ping).toHaveBeenCalledTimes(1)
    expect(res.json).toHaveBeenCalledWith({ status: 'ready' })
  })

  it('returns 503 { status: "not_ready", reason: "db_error" } when ping fails with general error', async () => {
    const ping = vi.fn().mockRejectedValue(new Error('Connection terminated'))
    const handler = createReadinessHandler(ping, 1000)

    const req = {} as any
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    } as any

    await handler(req, res)

    expect(res.status).toHaveBeenCalledWith(503)
    expect(res.json).toHaveBeenCalledWith({ status: 'not_ready', reason: 'db_error' })
  })

  it('returns 503 { status: "not_ready", reason: "pool_not_loaded" } when Question pool error occurs', async () => {
    const ping = vi.fn().mockRejectedValue(new Error('Question pool empty'))
    const handler = createReadinessHandler(ping, 1000)

    const req = {} as any
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    } as any

    await handler(req, res)

    expect(res.status).toHaveBeenCalledWith(503)
    expect(res.json).toHaveBeenCalledWith({ status: 'not_ready', reason: 'pool_not_loaded' })
  })

  it('returns 503 { status: "not_ready", reason: "timeout" } when ping hangs longer than timeoutMs', async () => {
    const ping = vi.fn().mockImplementation(() => new Promise((resolve) => setTimeout(resolve, 500)))
    const handler = createReadinessHandler(ping, 50)

    const req = {} as any
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    } as any

    await handler(req, res)

    expect(res.status).toHaveBeenCalledWith(503)
    expect(res.json).toHaveBeenCalledWith({ status: 'not_ready', reason: 'timeout' })
  })
})
