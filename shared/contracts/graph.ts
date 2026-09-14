/**
 * Grafik quruvchi — client ↔ server umumiy kontrakt (yagona manba).
 *
 * Server matematikani HISOBLAMAYDI — faqat ifoda matni + viewport + slayder
 * qiymatlarini saqlaydi (payload). Shuning uchun sxema ikki tomonda bir xil
 * bo'lishi shart: client `SavedGraphInputSchema` bilan yuboradi, server shu
 * sxema bilan validatsiya qiladi.
 */
import { z } from 'zod'

export const GRAPH_MAX_EXPRESSIONS = 6
export const GRAPH_MAX_EXPR_LENGTH = 200
export const GRAPH_MAX_TITLE_LENGTH = 60
export const GRAPH_MAX_SAVED = 20

export const GraphExpressionSchema = z.object({
  expr: z.string().min(1).max(GRAPH_MAX_EXPR_LENGTH),
  colorIdx: z.number().int().min(0).max(5),
  visible: z.boolean(),
})

export const GraphViewportSchema = z.object({
  cx: z.number().finite(),
  cy: z.number().finite(),
  unitsPerPx: z.number().finite().positive().max(1e6),
})

export const GraphPayloadSchema = z.object({
  expressions: z.array(GraphExpressionSchema).min(1).max(GRAPH_MAX_EXPRESSIONS),
  xVar: z.string().min(1).max(16),
  vars: z.record(z.string().max(16), z.number().finite()),
  viewport: GraphViewportSchema,
})

export const SavedGraphInputSchema = z.object({
  title: z.string().trim().min(1).max(GRAPH_MAX_TITLE_LENGTH),
  payload: GraphPayloadSchema,
})

/** PATCH — kamida bitta maydon bo'lishi shart */
export const SavedGraphUpdateSchema = z
  .object({
    title: z.string().trim().min(1).max(GRAPH_MAX_TITLE_LENGTH).optional(),
    payload: GraphPayloadSchema.optional(),
  })
  .refine((v) => v.title !== undefined || v.payload !== undefined, {
    message: 'title yoki payload kerak',
  })

export type GraphExpression = z.infer<typeof GraphExpressionSchema>
export type GraphViewport = z.infer<typeof GraphViewportSchema>
export type GraphPayload = z.infer<typeof GraphPayloadSchema>
export type SavedGraphInput = z.infer<typeof SavedGraphInputSchema>

/** Ro'yxat uchun yengil shakl (payload'siz) */
export interface SavedGraphSummary {
  id: string
  title: string
  /** Birinchi ifoda (karta ko'rinishi uchun qisqartirilgan) */
  exprPreview: string
  updatedAt: string
}

/** To'liq grafik (ochilganda) */
export interface SavedGraph extends SavedGraphSummary {
  payload: GraphPayload
  shareCode: string | null
}
