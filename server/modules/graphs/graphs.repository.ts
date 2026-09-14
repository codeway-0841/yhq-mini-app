/**
 * Grafik quruvchi repository — user saqlagan workspacelar (saved_graphs).
 *
 * Limit (20/user) BITTA atomik CTE'da tekshiriladi: Neon HTTP'da multi-step
 * oqim xavfsiz emas, shuning uchun count + insert bitta statement.
 */
import { and, desc, eq, sql } from 'drizzle-orm'
import { randomBytes, randomUUID } from 'node:crypto'
import { db, executeRows } from '../../db/connection'
import { savedGraphs } from '../../schema'
import type { GraphPayload, SavedGraph, SavedGraphSummary } from '../../../shared/contracts/graph'
import { GRAPH_MAX_SAVED } from '../../../shared/contracts/graph'

const PREVIEW_LEN = 48

function preview(payload: GraphPayload): string {
  const first = payload.expressions[0]?.expr ?? ''
  return first.length > PREVIEW_LEN ? `${first.slice(0, PREVIEW_LEN)}…` : first
}

type GraphRow = {
  id: string
  title: string
  payload: GraphPayload
  shareCode: string | null
  updatedAt: Date
}

function toSummary(row: GraphRow): SavedGraphSummary {
  return {
    id: row.id,
    title: row.title,
    exprPreview: preview(row.payload),
    updatedAt: row.updatedAt.toISOString(),
  }
}

function toFull(row: GraphRow): SavedGraph {
  return { ...toSummary(row), payload: row.payload, shareCode: row.shareCode }
}

export const graphsRepository = {
  async list(userId: string): Promise<SavedGraphSummary[]> {
    const rows = await db
      .select({
        id: savedGraphs.id,
        title: savedGraphs.title,
        payload: savedGraphs.payload,
        shareCode: savedGraphs.shareCode,
        updatedAt: savedGraphs.updatedAt,
      })
      .from(savedGraphs)
      .where(eq(savedGraphs.userId, userId))
      .orderBy(desc(savedGraphs.updatedAt))
      .limit(GRAPH_MAX_SAVED)
    return rows.map(toSummary)
  },

  async get(userId: string, id: string): Promise<SavedGraph | null> {
    const rows = await db
      .select()
      .from(savedGraphs)
      .where(and(eq(savedGraphs.id, id), eq(savedGraphs.userId, userId)))
      .limit(1)
    return rows[0] ? toFull(rows[0]) : null
  },

  async getByShareCode(code: string): Promise<SavedGraph | null> {
    const rows = await db
      .select()
      .from(savedGraphs)
      .where(eq(savedGraphs.shareCode, code))
      .limit(1)
    return rows[0] ? toFull(rows[0]) : null
  },

  /** null — limit to'lgan (GRAPH_MAX_SAVED) */
  async create(userId: string, title: string, payload: GraphPayload): Promise<SavedGraph | null> {
    const id = randomUUID()
    const rows = await executeRows<{ id: string }>(sql`
      WITH cnt AS (SELECT count(*)::int AS n FROM saved_graphs WHERE user_id = ${userId})
      INSERT INTO saved_graphs (id, user_id, title, payload)
      SELECT ${id}, ${userId}, ${title}, ${JSON.stringify(payload)}::jsonb
      FROM cnt WHERE cnt.n < ${GRAPH_MAX_SAVED}
      RETURNING id
    `)
    if (rows.length === 0) return null
    return {
      id,
      title,
      exprPreview: preview(payload),
      updatedAt: new Date().toISOString(),
      payload,
      shareCode: null,
    }
  },

  async update(
    userId: string,
    id: string,
    patch: { title?: string; payload?: GraphPayload },
  ): Promise<SavedGraph | null> {
    const rows = await db
      .update(savedGraphs)
      .set({
        ...(patch.title !== undefined ? { title: patch.title } : {}),
        ...(patch.payload !== undefined ? { payload: patch.payload } : {}),
      })
      .where(and(eq(savedGraphs.id, id), eq(savedGraphs.userId, userId)))
      .returning()
    return rows[0] ? toFull(rows[0]) : null
  },

  async remove(userId: string, id: string): Promise<boolean> {
    const rows = await db
      .delete(savedGraphs)
      .where(and(eq(savedGraphs.id, id), eq(savedGraphs.userId, userId)))
      .returning({ id: savedGraphs.id })
    return rows.length > 0
  },

  /**
   * Share kod — idempotent: mavjud bo'lsa o'sha qaytadi (COALESCE bitta
   * atomik UPDATE'da, parallel chaqiruvlar ham bir xil kod oladi).
   * null — grafik topilmadi (yoki boshqa user'niki).
   */
  async mintShareCode(userId: string, id: string): Promise<string | null> {
    const code = randomBytes(9).toString('base64url')
    const rows = await db
      .update(savedGraphs)
      .set({ shareCode: sql`COALESCE(${savedGraphs.shareCode}, ${code})` })
      .where(and(eq(savedGraphs.id, id), eq(savedGraphs.userId, userId)))
      .returning({ shareCode: savedGraphs.shareCode })
    return rows[0]?.shareCode ?? null
  },

  async revokeShareCode(userId: string, id: string): Promise<boolean> {
    const rows = await db
      .update(savedGraphs)
      .set({ shareCode: null })
      .where(and(eq(savedGraphs.id, id), eq(savedGraphs.userId, userId)))
      .returning({ id: savedGraphs.id })
    return rows.length > 0
  },
}
