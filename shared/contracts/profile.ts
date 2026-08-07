/**
 * API contractlar — server JAVOBLARINING runtime zod skhemalari (yagona manba).
 *
 * Frontend `lib/api.ts` response'ni shu skhemalar bilan tekshiradi
 * (schema.parse) — server javob formati sukut saqlab o'zgarsa, client
 *"toza" xatolik (bad_response) bilan biladi, jimgina buzilishi o'rniga.
 *
 * QOIDA: server tomoni shu shakllarni o'zgartirsa — avval SHU FAYL yangilanadi.
 */
import { z } from 'zod'

export const ApiUserSchema = z.object({
  id:        z.string(),
  firstName: z.string(),
  lastName:  z.string().optional(),
  username:  z.string().optional(),
  photoUrl:  z.string().optional(),
  phone:     z.string().nullable().optional(),
  tariff:    z.enum(['free', 'premium']),
  isAdmin:   z.boolean().optional(),
})

export const ApiProgressSchema = z.object({
  totalCorrect:  z.number(),
  totalWrong:    z.number(),
  totalAnswered: z.number(),
  streak:        z.number(),
  /** Composite kalitlar: '<subjectId>:<questionId>' */
  wrongByTicket: z.record(z.string(), z.number()),
})

export const ApiSettingsSchema = z.object({
  autoNextCorrect: z.boolean(),
  autoNextWrong:   z.boolean(),
  noAnimation:     z.boolean(),
  shuffleOptions:  z.boolean(),
  fontSize:        z.enum(['small', 'medium', 'large']),
  fontStyle:       z.enum(['default', 'serif', 'mono']),
  language:        z.enum(['uz', 'ru']),
  theme:           z.enum(['dark', 'light', 'system']),
  offlineMode:     z.boolean(),
})

export const FullProfileSchema = z.object({
  user:           ApiUserSchema,
  progress:       ApiProgressSchema,
  settings:       ApiSettingsSchema,
  /** Composite kalitlar: '<subjectId>:<questionId>' */
  savedQuestions: z.array(z.string()),
})

export type ApiUserContract     = z.infer<typeof ApiUserSchema>
export type ApiProgressContract = z.infer<typeof ApiProgressSchema>
export type ApiSettingsContract = z.infer<typeof ApiSettingsSchema>
export type FullProfileContract = z.infer<typeof FullProfileSchema>
