/**
 * LiveKit webhook raw-body desync himoyasi (P1 regression).
 *
 * LiveKit webhook'lar `application/webhook+json` Content-Type yuboradi
 * (application/json EMAS). app.ts'dagi express.raw shu ikkalasini ham
 * ushlamasa — global json parser body'ni obyektga aylantiradi, imzo
 * tekshiruvi (xom baytlar hash'i) 401 yiqiladi va egress_ended hech qachon
 * recording'ni `ready`ga o'tkazmaydi.
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const APP = fs.readFileSync(path.resolve(__dirname, '../../../server/app.ts'), 'utf8')

describe('live webhook raw body (content-type desync)', () => {
  it("express.raw ikkala content-type'ni ham ushlaydi", () => {
    expect(APP).toContain('application/webhook+json')
    expect(APP).toContain('/api/live/webhook')
  })

  it('global json parser webhook yo‘lidan KEYIN keladi (raw birinchi)', () => {
    const rawIdx = APP.indexOf('/api/live/webhook')
    const jsonIdx = APP.indexOf("express.json({ limit: '300kb' })")
    expect(rawIdx).toBeGreaterThan(-1)
    expect(jsonIdx).toBeGreaterThan(-1)
    expect(rawIdx).toBeLessThan(jsonIdx)
  })
})
