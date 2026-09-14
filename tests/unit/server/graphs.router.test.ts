import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import express from 'express'
import request from 'supertest'
import { errorHandler } from '../../../server/middleware/error-handler'
import graphsRouter from '../../../server/modules/graphs/graphs.router'
import { graphsRepository } from '../../../server/modules/graphs/graphs.repository'

const UID = '777000260001'
const GID = '11111111-1111-4111-8111-111111111111'

function makeApp(userId: string | null) {
  const app = express()
  app.use(express.json())
  app.use((req, _res, next) => {
    if (userId) (req as { userId?: string }).userId = userId
    next()
  })
  app.use('/api', graphsRouter)
  app.use(errorHandler)
  return app
}

const validPayload = {
  expressions: [{ expr: 'sin(x)', colorIdx: 0, visible: true }],
  xVar: 'x',
  vars: {},
  viewport: { cx: 0, cy: 0, unitsPerPx: 0.05 },
}

beforeEach(() => {
  vi.restoreAllMocks()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('graphs.router', () => {
  it('auth yo‘q — 401', async () => {
    const res = await request(makeApp(null)).get('/api/graphs')
    expect(res.status).toBe(401)
  })

  it('GET /graphs — ro‘yxat qaytaradi', async () => {
    vi.spyOn(graphsRepository, 'list').mockResolvedValue([
      { id: GID, title: 'A', exprPreview: 'sin(x)', updatedAt: new Date().toISOString() },
    ])
    const res = await request(makeApp(UID)).get('/api/graphs')
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
    expect(res.body.graphs).toHaveLength(1)
  })

  it('POST /graphs — zod xato 400', async () => {
    const res = await request(makeApp(UID))
      .post('/api/graphs')
      .send({ title: '', payload: validPayload })
    expect(res.status).toBe(400)
    expect(res.body.error).toBe('Validation failed')
  })

  it('POST /graphs — yaratiladi (201)', async () => {
    vi.spyOn(graphsRepository, 'create').mockResolvedValue({
      id: GID, title: 'Mening grafigim', exprPreview: 'sin(x)',
      updatedAt: new Date().toISOString(), payload: validPayload, shareCode: null,
    })
    const res = await request(makeApp(UID))
      .post('/api/graphs')
      .send({ title: 'Mening grafigim', payload: validPayload })
    expect(res.status).toBe(201)
    expect(res.body.graph.id).toBe(GID)
  })

  it('POST /graphs — limit to‘lgan (409 GRAPH_LIMIT_REACHED)', async () => {
    vi.spyOn(graphsRepository, 'create').mockResolvedValue(null)
    const res = await request(makeApp(UID))
      .post('/api/graphs')
      .send({ title: 'X', payload: validPayload })
    expect(res.status).toBe(409)
    expect(res.body.error).toBe('GRAPH_LIMIT_REACHED')
  })

  it('GET /graphs/:id — topilmasa 404', async () => {
    vi.spyOn(graphsRepository, 'get').mockResolvedValue(null)
    const res = await request(makeApp(UID)).get(`/api/graphs/${GID}`)
    expect(res.status).toBe(404)
    expect(res.body.error).toBe('GRAPH_NOT_FOUND')
  })

  it('GET /graphs/:id — uuid emas 400', async () => {
    const res = await request(makeApp(UID)).get('/api/graphs/not-a-uuid')
    expect(res.status).toBe(400)
  })

  it('PATCH /graphs/:id — bo‘sh patch 400, to‘g‘ri patch 200', async () => {
    const app = makeApp(UID)
    const bad = await request(app).patch(`/api/graphs/${GID}`).send({})
    expect(bad.status).toBe(400)

    vi.spyOn(graphsRepository, 'update').mockResolvedValue({
      id: GID, title: 'Yangi', exprPreview: 'x', updatedAt: new Date().toISOString(),
      payload: validPayload, shareCode: null,
    })
    const ok = await request(app).patch(`/api/graphs/${GID}`).send({ title: 'Yangi' })
    expect(ok.status).toBe(200)
    expect(ok.body.graph.title).toBe('Yangi')
  })

  it('DELETE /graphs/:id — 204', async () => {
    vi.spyOn(graphsRepository, 'remove').mockResolvedValue(true)
    const res = await request(makeApp(UID)).delete(`/api/graphs/${GID}`)
    expect(res.status).toBe(204)
  })

  it('POST /graphs/:id/share — idempotent kod qaytadi', async () => {
    vi.spyOn(graphsRepository, 'mintShareCode').mockResolvedValue('AbCdEf123456')
    const res = await request(makeApp(UID)).post(`/api/graphs/${GID}/share`)
    expect(res.status).toBe(200)
    expect(res.body.shareCode).toBe('AbCdEf123456')
  })

  it('GET /graphs/share/:code — mavjud kod 200, yo‘q kod 404', async () => {
    const app = makeApp(UID)
    const spy = vi.spyOn(graphsRepository, 'getByShareCode')
    spy.mockResolvedValueOnce({
      id: GID, title: 'Ulashilgan', exprPreview: 'x', updatedAt: new Date().toISOString(),
      payload: validPayload, shareCode: 'AbCdEf123456',
    })
    const ok = await request(app).get('/api/graphs/share/AbCdEf123456')
    expect(ok.status).toBe(200)
    expect(ok.body.graph.title).toBe('Ulashilgan')

    spy.mockResolvedValueOnce(null)
    const missing = await request(app).get('/api/graphs/share/AbCdEf123456')
    expect(missing.status).toBe(404)
  })

  it('GET /graphs/share/:code — noto‘g‘ri kod formati 400', async () => {
    const res = await request(makeApp(UID)).get('/api/graphs/share/!')
    expect(res.status).toBe(400)
  })
})
