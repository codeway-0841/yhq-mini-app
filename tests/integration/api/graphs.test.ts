/**
 * Integration — /api/graphs to'liq oqim (real DB):
 * CRUD, ownership izolyatsiyasi, limit (20), share mint/read/revoke.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import { inArray } from 'drizzle-orm'
import { createApp } from '../../../server/app'
import { db } from '../../../server/db/connection'
import { users, sessions, savedGraphs } from '../../../server/schema'
import { authRepository } from '../../../server/modules/auth/auth.repository'
import { usersRepository } from '../../../server/modules/users/users.repository'
import { GRAPH_MAX_SAVED } from '../../../shared/contracts/graph'

const app = createApp()

const UID_A = '777000260101'
const UID_B = '777000260102'
const TOKEN_A = 'itest_graphs_0001'
const TOKEN_B = 'itest_graphs_0002'
const IDS = [UID_A, UID_B]

const asA = (r: request.Test) => r.set('Authorization', `Bearer ${TOKEN_A}`)
const asB = (r: request.Test) => r.set('Authorization', `Bearer ${TOKEN_B}`)

const payload = (expr = 'sin(x)') => ({
  expressions: [{ expr, colorIdx: 0, visible: true }],
  xVar: 'x',
  vars: { a: 1 },
  viewport: { cx: 0, cy: 0, unitsPerPx: 0.05 },
})

async function cleanup() {
  await db.delete(savedGraphs).where(inArray(savedGraphs.userId, IDS))
  await db.delete(sessions).where(inArray(sessions.userId, IDS))
  await db.delete(users).where(inArray(users.id, IDS))
}

beforeAll(async () => {
  await cleanup()
  await usersRepository.initAtomic({ id: UID_A, firstName: 'Graph', lastName: 'A', username: '', photoUrl: '' })
  await usersRepository.initAtomic({ id: UID_B, firstName: 'Graph', lastName: 'B', username: '', photoUrl: '' })
  const expiresAt = new Date(Date.now() + 3_600_000)
  await authRepository.createSession({ token: TOKEN_A, userId: UID_A, provider: 'phone', expiresAt })
  await authRepository.createSession({ token: TOKEN_B, userId: UID_B, provider: 'phone', expiresAt })
})

afterAll(cleanup)

describe('integration: /api/graphs', () => {
  let graphId = ''

  it('POST — grafik yaratiladi', async () => {
    const res = await asA(request(app).post('/api/graphs'))
      .send({ title: 'Birinchi grafik', payload: payload() })
    expect(res.status).toBe(201)
    expect(res.body.graph.title).toBe('Birinchi grafik')
    expect(res.body.graph.shareCode).toBeNull()
    graphId = res.body.graph.id
  })

  it('GET ro‘yxat — preview va tartib', async () => {
    const res = await asA(request(app).get('/api/graphs'))
    expect(res.status).toBe(200)
    expect(res.body.graphs).toHaveLength(1)
    expect(res.body.graphs[0].exprPreview).toBe('sin(x)')
  })

  it('GET :id — to‘liq payload qaytadi', async () => {
    const res = await asA(request(app).get(`/api/graphs/${graphId}`))
    expect(res.status).toBe(200)
    expect(res.body.graph.payload.expressions[0].expr).toBe('sin(x)')
  })

  it('PATCH — yangilanadi', async () => {
    const res = await asA(request(app).patch(`/api/graphs/${graphId}`))
      .send({ title: 'Yangilangan', payload: payload('cos(x)') })
    expect(res.status).toBe(200)
    expect(res.body.graph.title).toBe('Yangilangan')
    expect(res.body.graph.exprPreview).toBe('cos(x)')
  })

  it('B user A grafigini ko‘ra/cho‘za OLMAYDI (404)', async () => {
    const get = await asB(request(app).get(`/api/graphs/${graphId}`))
    expect(get.status).toBe(404)
    const patch = await asB(request(app).patch(`/api/graphs/${graphId}`)).send({ title: 'Hack' })
    expect(patch.status).toBe(404)
    const del = await asB(request(app).delete(`/api/graphs/${graphId}`))
    expect(del.status).toBe(404)
  })

  it('B ro‘yxati bo‘sh (izolyatsiya)', async () => {
    const res = await asB(request(app).get('/api/graphs'))
    expect(res.status).toBe(200)
    expect(res.body.graphs).toHaveLength(0)
  })

  it('share → B kod orqali o‘qiy oladi → revoke → 404', async () => {
    const mint = await asA(request(app).post(`/api/graphs/${graphId}/share`))
    expect(mint.status).toBe(200)
    const code = mint.body.shareCode as string
    expect(code.length).toBeGreaterThanOrEqual(6)

    const mintAgain = await asA(request(app).post(`/api/graphs/${graphId}/share`))
    expect(mintAgain.body.shareCode).toBe(code)

    const shared = await asB(request(app).get(`/api/graphs/share/${code}`))
    expect(shared.status).toBe(200)
    expect(shared.body.graph.title).toBe('Yangilangan')

    const revoke = await asA(request(app).delete(`/api/graphs/${graphId}/share`))
    expect(revoke.status).toBe(200)

    const gone = await asB(request(app).get(`/api/graphs/share/${code}`))
    expect(gone.status).toBe(404)
  })

  it(`limit: ${GRAPH_MAX_SAVED} tadan keyin 409`, async () => {
    await db.delete(savedGraphs).where(inArray(savedGraphs.userId, [UID_A]))
    await db.insert(savedGraphs).values(
      Array.from({ length: GRAPH_MAX_SAVED }, (_, i) => ({
        id: `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
        userId: UID_A,
        title: `Grafik ${i}`,
        payload: payload(),
      })),
    )
    const res = await asA(request(app).post('/api/graphs'))
      .send({ title: 'Ortiqcha', payload: payload() })
    expect(res.status).toBe(409)
    expect(res.body.error).toBe('GRAPH_LIMIT_REACHED')
  })

  it('DELETE — 204 va ro‘yxatdan o‘chadi', async () => {
    const list = await asA(request(app).get('/api/graphs'))
    const id = list.body.graphs[0].id as string
    const del = await asA(request(app).delete(`/api/graphs/${id}`))
    expect(del.status).toBe(204)
    const after = await asA(request(app).get('/api/graphs'))
    expect(after.body.graphs.find((g: { id: string }) => g.id === id)).toBeUndefined()
  })
})
