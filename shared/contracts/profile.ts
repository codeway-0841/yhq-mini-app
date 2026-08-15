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
  solvedQuestions: z.array(z.string()).optional(),
})

export const ApiSettingsSchema = z.object({
  autoNextCorrect:   z.boolean(),
  autoNextWrong:     z.boolean(),
  noAnimation:       z.boolean(),
  shuffleOptions:    z.boolean(),
  fontSize:          z.enum(['small', 'medium', 'large']),
  fontStyle:         z.enum(['default', 'serif', 'mono']),
  language:          z.enum(['uz', 'ru']),
  theme:             z.enum(['dark', 'light', 'system']),
  offlineMode:       z.boolean(),
  dailyReminder:     z.boolean().optional().default(true),
  dailyReminderTime: z.string().optional().default('20:00'),
})

export const FullProfileSchema = z.object({
  user:           ApiUserSchema,
  progress:       ApiProgressSchema,
  settings:       ApiSettingsSchema,
  /** Composite kalitlar: '<subjectId>:<questionId>' */
  savedQuestions: z.array(z.string()),
})

/**
 * Auth sessiya profili — GET /api/auth/me javobi (FullProfile + ulangan provider'lar).
 * "providers" — Hozirgi akkauntga ulangan login usullari (Profil "Hisobni bog'lash").
 */
export const AuthSessionSchema = FullProfileSchema.extend({
  providers: z.array(z.enum(['telegram', 'phone'])),
})

/** POST /api/auth/(phone/register|phone/login|telegram) javobi. */
export const AuthResponseSchema = AuthSessionSchema.extend({
  /** Opaque Bearer token — localStorage'da saqlanadi, 401 da o'chiriladi */
  sessionToken: z.string().min(32),
})

/**
 * POST /api/auth/phone/link javobi — AuthResponse + link natijasi:
 * 'attached' (yangi identity no-op/bo'shga) yoki 'adopted' (adopt-merge:
 * yakuniy user id o'zgarishi mumkin — client ensureAccountOwner chaqirishi shart).
 */
export const LinkResponseSchema = AuthResponseSchema.extend({
  status: z.enum(['attached', 'adopted']),
})

export type AuthSessionContract  = z.infer<typeof AuthSessionSchema>
export type AuthResponseContract = z.infer<typeof AuthResponseSchema>
export type LinkResponseContract = z.infer<typeof LinkResponseSchema>

export type ApiUserContract     = z.infer<typeof ApiUserSchema>
export type ApiProgressContract = z.infer<typeof ApiProgressSchema>
export type ApiSettingsContract = z.infer<typeof ApiSettingsSchema>
export type FullProfileContract = z.infer<typeof FullProfileSchema>
