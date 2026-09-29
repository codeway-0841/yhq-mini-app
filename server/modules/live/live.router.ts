/**
 * Live router — yupqa qatlam (§3): zod validation → auth → service → HTTP.
 * Biznes-logika `live.service.ts`da; rol/kapabiliti server hisoblaydi.
 */
import { Router } from 'express'
import { z } from 'zod'
import { wrap, AppError } from '../../middleware/error-handler'
import { validate } from '../../middleware/validate'
import { dbRateLimit as rateLimit } from '../../middleware/db-rate-limiter'
import { identityKey } from '../../middleware/rate-limiter'
import { config } from '../../config'
import { LIVE_MESSAGE_MAX_LEN, LIVE_TITLE_MAX_LEN } from '../../../shared/live'
import { liveRepository } from './live.repository'
import { getCachedCloudHealth, isLiveEnabled, isManager, liveService, type ServiceError } from './live.service'
import { verifyLivekitWebhook } from './livekit'
import { parseEgressEnded } from './egress'

const router = Router()

// Master switch (rollback) — webhook har doim ochiq (in-flight egress yakunlanishi uchun).
router.use((req, res, next) => {
  if (isLiveEnabled() || req.path === '/live/webhook') {
    next()
    return
  }
  res.status(503).json({ error: 'LIVE_DISABLED' })
})

const ERROR_MAP: Record<ServiceError, { status: number; code: string }> = {
  NOT_FOUND: { status: 404, code: 'LIVE_NOT_FOUND' },
  FORBIDDEN: { status: 403, code: 'FORBIDDEN' },
  TEACHER_REQUIRED: { status: 403, code: 'TEACHER_REQUIRED' },
  INVALID_SUBJECT: { status: 400, code: 'INVALID_SUBJECT' },
  NOT_SCHEDULED: { status: 409, code: 'LIVE_NOT_SCHEDULED' },
  ENDED: { status: 409, code: 'LIVE_ENDED' },
  JOIN_REQUIRED: { status: 403, code: 'LIVE_JOIN_REQUIRED' },
  ALREADY_SPEAKER: { status: 409, code: 'ALREADY_SPEAKER' },
  HAND_NOT_PENDING: { status: 409, code: 'HAND_NOT_PENDING' },
  MEDIA_NOT_CONFIGURED: { status: 503, code: 'LIVE_MEDIA_NOT_CONFIGURED' },
  STORAGE_NOT_CONFIGURED: { status: 503, code: 'RECORDING_STORAGE_NOT_CONFIGURED' },
  RECORDING_DISABLED: { status: 503, code: 'RECORDING_DISABLED' },
  RECORDING_CONFLICT: { status: 409, code: 'RECORDING_ALREADY_ACTIVE' },
  RECORDING_NOT_ACTIVE: { status: 409, code: 'RECORDING_NOT_ACTIVE' },
  NOT_LIVE: { status: 409, code: 'LIVE_NOT_LIVE' },
  CREATE_FAILED: { status: 500, code: 'LIVE_CREATE_FAILED' },
  LIVE_DISABLED: { status: 503, code: 'LIVE_DISABLED' },
}

function fail(error: ServiceError): never {
  const m = ERROR_MAP[error]
  throw new AppError(m.status, m.code)
}

function requireUserId(req: unknown): string {
  const userId = (req as { userId?: string }).userId
  if (!userId || userId === '0') throw new AppError(401, 'AUTH_REQUIRED')
  return userId
}

/** Manager guard: xona egasi yoki admin (oddiy teacher YO'Q — §5). */
async function requireManager(roomId: number, userId: string): Promise<void> {
  const priv = await liveRepository.getPrivileges(roomId, userId)
  if (!priv) throw new AppError(404, 'LIVE_NOT_FOUND')
  if (!isManager(priv)) throw new AppError(403, 'TEACHER_REQUIRED')
}

const createLimiter = rateLimit({ maxPerMinute: 10, bucket: 'live:create', keyFn: identityKey })
const joinLimiter = rateLimit({ maxPerMinute: 20, bucket: 'live:join', keyFn: identityKey })
const messageLimiter = rateLimit({ maxPerMinute: 30, bucket: 'live:message', keyFn: identityKey })
const raiseLimiter = rateLimit({ maxPerMinute: 10, bucket: 'live:raise', keyFn: identityKey })
const handsLimiter = rateLimit({ maxPerMinute: 20, bucket: 'live:hands', keyFn: identityKey })
const recordLimiter = rateLimit({ maxPerMinute: 5, bucket: 'live:record', keyFn: identityKey })
const healthLimiter = rateLimit({ maxPerMinute: 10, bucket: 'live:health', keyFn: identityKey })

const CreateRoomBodySchema = z.object({
  subjectId: z.string().min(1).max(32),
  title: z.string().trim().min(3).max(LIVE_TITLE_MAX_LEN),
  description: z.string().trim().max(500).nullable().optional(),
  scheduledAt: z.string().datetime({ offset: true }).nullable().optional(),
})

const ListRoomsQuerySchema = z.object({
  subject: z.string().min(1).max(32).optional(),
  status: z.enum(['scheduled', 'live', 'ending', 'ended']).optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
})

const RoomIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
})

const PostMessageBodySchema = z.object({
  body: z.string().trim().min(1).max(LIVE_MESSAGE_MAX_LEN),
})

const ListMessagesQuerySchema = z.object({
  after: z.coerce.number().int().min(0).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
})

const HandTargetParamSchema = z.object({
  id: z.coerce.number().int().positive(),
  userId: z.string().min(1).max(64),
})

// GET /api/live/rooms?subject=&status=&limit=
router.get(
  '/live/rooms',
  validate({ query: ListRoomsQuerySchema }),
  wrap(async (req, res) => {
    requireUserId(req)
    const q = req.query as z.infer<typeof ListRoomsQuerySchema>
    const rooms = await liveService.listRooms({ subjectId: q.subject, status: q.status, limit: q.limit ?? 20 })
    res.json({ ok: true, rooms, mediaEnabled: config.live.mediaEnabled, recordingEnabled: config.live.recordingEnabled })
  }),
)

// POST /api/live/rooms — admin/ustoz yaratadi (o'zi teacher bo'ladi)
router.post(
  '/live/rooms',
  createLimiter,
  validate({ body: CreateRoomBodySchema }),
  wrap(async (req, res) => {
    const userId = requireUserId(req)
    const body = req.body as z.infer<typeof CreateRoomBodySchema>
    const r = await liveService.createRoom(userId, {
      subjectId: body.subjectId,
      title: body.title,
      description: body.description ?? null,
      scheduledAt: body.scheduledAt ?? null,
    })
    if (!r.ok) fail(r.error)
    res.json({ ok: true, room: r.room })
  }),
)

// GET /api/live/rooms/:id
router.get(
  '/live/rooms/:id',
  validate({ params: RoomIdParamSchema }),
  wrap(async (req, res) => {
    requireUserId(req)
    const { id } = req.params as unknown as { id: number }
    const d = await liveService.getRoomDetails(id)
    if (!d) fail('NOT_FOUND')
    res.json({
      ok: true, room: d.room, mediaEnabled: config.live.mediaEnabled,
      recordingEnabled: config.live.recordingEnabled, recordingActive: d.recordingActive,
    })
  }),
)

// POST /api/live/rooms/:id/start — faqat manager
router.post(
  '/live/rooms/:id/start',
  validate({ params: RoomIdParamSchema }),
  wrap(async (req, res) => {
    const userId = requireUserId(req)
    const { id } = req.params as unknown as { id: number }
    await requireManager(id, userId)
    const r = await liveService.startRoom(id)
    if (!r.ok) fail(r.error)
    const d = await liveService.getRoomDetails(id)
    res.json({ ok: true, room: d?.room ?? null })
  }),
)

// POST /api/live/rooms/:id/end — faqat manager (ending → media → ended)
router.post(
  '/live/rooms/:id/end',
  validate({ params: RoomIdParamSchema }),
  wrap(async (req, res) => {
    const userId = requireUserId(req)
    const { id } = req.params as unknown as { id: number }
    await requireManager(id, userId)
    const r = await liveService.endRoom(id)
    if (!r.ok) fail(r.error)
    const d = await liveService.getRoomDetails(id)
    res.json({ ok: true, room: d?.room ?? null })
  }),
)

// POST /api/live/rooms/:id/join — participant upsert + tokenlar + capability
router.post(
  '/live/rooms/:id/join',
  joinLimiter,
  validate({ params: RoomIdParamSchema }),
  wrap(async (req, res) => {
    const userId = requireUserId(req)
    const { id } = req.params as unknown as { id: number }
    const r = await liveService.joinRoom(id, userId)
    if (!r.ok) fail(r.error)
    res.json({
      ok: true,
      role: r.role,
      canSpeak: r.canSpeak,
      capabilities: r.capabilities,
      roomName: r.roomName,
      token: r.token,
      expiresIn: config.live.joinTokenTtlSeconds,
      mediaEnabled: config.live.mediaEnabled,
      mediaUrl: config.live.url ?? null,
      livekitToken: r.livekitToken,
    })
  }),
)

// POST /api/live/rooms/:id/leave — davomat + LiveKit remove (idempotent)
router.post(
  '/live/rooms/:id/leave',
  validate({ params: RoomIdParamSchema }),
  wrap(async (req, res) => {
    const userId = requireUserId(req)
    const { id } = req.params as unknown as { id: number }
    await liveService.leaveRoom(id, userId)
    res.json({ ok: true })
  }),
)

// GET /api/live/rooms/:id/me — o'z holatim (student polling shu orqali)
router.get(
  '/live/rooms/:id/me',
  validate({ params: RoomIdParamSchema }),
  wrap(async (req, res) => {
    const userId = requireUserId(req)
    const { id } = req.params as unknown as { id: number }
    const r = await liveService.getMe(id, userId)
    if (!r.ok) fail(r.error)
    res.json({ ok: true, me: r.me })
  }),
)

// GET /api/live/rooms/:id/participants — faqat faol participant ko'radi
router.get(
  '/live/rooms/:id/participants',
  validate({ params: RoomIdParamSchema }),
  wrap(async (req, res) => {
    const userId = requireUserId(req)
    const { id } = req.params as unknown as { id: number }
    if (!(await liveRepository.isParticipant(id, userId))) fail('JOIN_REQUIRED')
    const rows = await liveRepository.listParticipants(id)
    res.json({ ok: true, participants: rows })
  }),
)

// GET /api/live/rooms/:id/messages?after=&limit= — faqat faol participant
router.get(
  '/live/rooms/:id/messages',
  validate({ params: RoomIdParamSchema, query: ListMessagesQuerySchema }),
  wrap(async (req, res) => {
    const userId = requireUserId(req)
    const { id } = req.params as unknown as { id: number }
    const q = req.query as unknown as { after?: number; limit?: number }
    if (!(await liveRepository.isParticipant(id, userId))) fail('JOIN_REQUIRED')
    const rows = await liveRepository.listMessages(id, q.after ?? 0, q.limit ?? 50)
    res.json({
      ok: true,
      messages: rows.map((m) => ({
        id: m.id, roomId: m.room_id, userId: m.user_id, userName: m.user_name,
        role: m.role, body: m.body, createdAt: m.created_at,
      })),
    })
  }),
)

// POST /api/live/rooms/:id/messages — faqat faol participant yozadi
router.post(
  '/live/rooms/:id/messages',
  messageLimiter,
  validate({ params: RoomIdParamSchema, body: PostMessageBodySchema }),
  wrap(async (req, res) => {
    const userId = requireUserId(req)
    const { id } = req.params as unknown as { id: number }
    const body = req.body as z.infer<typeof PostMessageBodySchema>
    const room = await liveService.getRoom(id)
    if (!room) fail('NOT_FOUND')
    if (room.status === 'ended' || room.status === 'ending') fail('ENDED')
    if (!(await liveRepository.isParticipant(id, userId))) fail('JOIN_REQUIRED')
    const m = await liveRepository.postMessage(id, userId, body.body)
    if (!m) throw new AppError(500, 'LIVE_MESSAGE_FAILED')
    res.json({
      ok: true,
      message: {
        id: m.id, roomId: m.room_id, userId: m.user_id, userName: m.user_name,
        role: m.role, body: m.body, createdAt: m.created_at,
      },
    })
  }),
)

// POST /api/live/rooms/:id/raise — student qo'l ko'taradi
router.post(
  '/live/rooms/:id/raise',
  raiseLimiter,
  validate({ params: RoomIdParamSchema }),
  wrap(async (req, res) => {
    const userId = requireUserId(req)
    const { id } = req.params as unknown as { id: number }
    const r = await liveService.raiseHand(id, userId)
    if (!r.ok) fail(r.error)
    res.json({ ok: true, status: r.status })
  }),
)

// DELETE /api/live/rooms/:id/raise — qo'lni tushirish
router.delete(
  '/live/rooms/:id/raise',
  validate({ params: RoomIdParamSchema }),
  wrap(async (req, res) => {
    const userId = requireUserId(req)
    const { id } = req.params as unknown as { id: number }
    await liveRepository.lowerHand(id, userId)
    res.json({ ok: true })
  }),
)

// GET /api/live/rooms/:id/hands — faqat manager
router.get(
  '/live/rooms/:id/hands',
  validate({ params: RoomIdParamSchema }),
  wrap(async (req, res) => {
    const userId = requireUserId(req)
    const { id } = req.params as unknown as { id: number }
    await requireManager(id, userId)
    const pendingOnly = req.query['pendingOnly'] !== 'false'
    const rows = await liveRepository.listHands(id, pendingOnly)
    res.json({ ok: true, hands: rows })
  }),
)

// POST /api/live/rooms/:id/hands/:userId/approve — faqat manager
router.post(
  '/live/rooms/:id/hands/:userId/approve',
  handsLimiter,
  validate({ params: HandTargetParamSchema }),
  wrap(async (req, res) => {
    const userId = requireUserId(req)
    const { id, userId: target } = req.params as unknown as { id: number; userId: string }
    await requireManager(id, userId)
    const r = await liveService.approveHand(id, target)
    if (!r.ok) fail(r.error)
    res.json({ ok: true, status: 'approved' })
  }),
)

// POST /api/live/rooms/:id/hands/:userId/reject — faqat manager
router.post(
  '/live/rooms/:id/hands/:userId/reject',
  handsLimiter,
  validate({ params: HandTargetParamSchema }),
  wrap(async (req, res) => {
    const userId = requireUserId(req)
    const { id, userId: target } = req.params as unknown as { id: number; userId: string }
    await requireManager(id, userId)
    const r = await liveService.rejectHand(id, target)
    if (!r.ok) fail(r.error)
    res.json({ ok: true, status: 'rejected' })
  }),
)

// POST /api/live/rooms/:id/participants/:userId/revoke — speaker huquqni qaytarish (manager)
router.post(
  '/live/rooms/:id/participants/:userId/revoke',
  handsLimiter,
  validate({ params: HandTargetParamSchema }),
  wrap(async (req, res) => {
    const userId = requireUserId(req)
    const { id, userId: target } = req.params as unknown as { id: number; userId: string }
    await requireManager(id, userId)
    const r = await liveService.revokeSpeaker(id, target)
    if (!r.ok) fail(r.error)
    res.json({ ok: true, status: 'revoked' })
  }),
)

// GET /api/live/rooms/:id/cloud-health — faqat manager (8s server cache)
router.get(
  '/live/rooms/:id/cloud-health',
  healthLimiter,
  validate({ params: RoomIdParamSchema }),
  wrap(async (req, res) => {
    const userId = requireUserId(req)
    const { id } = req.params as unknown as { id: number }
    await requireManager(id, userId)
    const room = await liveService.getRoom(id)
    if (!room) fail('NOT_FOUND')
    const r = await getCachedCloudHealth(id, room.roomName)
    if ('error' in r) fail('MEDIA_NOT_CONFIGURED')
    res.json({ ok: true, roomName: room.roomName, cached: r.cached, participants: r.participants })
  }),
)

// POST /api/live/rooms/:id/record/start — faqat manager (state machine)
router.post(
  '/live/rooms/:id/record/start',
  recordLimiter,
  validate({ params: RoomIdParamSchema }),
  wrap(async (req, res) => {
    const userId = requireUserId(req)
    const { id } = req.params as unknown as { id: number }
    await requireManager(id, userId)
    const r = await liveService.startRecording(id)
    if (!r.ok) fail(r.error)
    res.json({ ok: true, egressId: r.egressId })
  }),
)

// POST /api/live/rooms/:id/record/stop — faqat manager
router.post(
  '/live/rooms/:id/record/stop',
  recordLimiter,
  validate({ params: RoomIdParamSchema }),
  wrap(async (req, res) => {
    const userId = requireUserId(req)
    const { id } = req.params as unknown as { id: number }
    await requireManager(id, userId)
    const r = await liveService.stopRecording(id)
    if (!r.ok) fail(r.error)
    res.json({ ok: true, egressId: r.egressId })
  }),
)

// GET /api/live/recordings — tayyor yozuvlar (flag o'chiq bo'lsa bo'sh)
router.get(
  '/live/recordings',
  wrap(async (req, res) => {
    requireUserId(req)
    if (!config.live.recordingEnabled) {
      res.json({ ok: true, recordings: [] })
      return
    }
    const rows = await liveRepository.listRecordings(30)
    const base = config.r2.publicUrl?.replace(/\/+$/, '') ?? null
    res.json({
      ok: true,
      recordings: rows.map((r) => ({
        id: r.id,
        roomId: r.room_id,
        roomTitle: r.room_title,
        subjectId: r.subject_id,
        teacherName: r.teacher_name,
        status: r.status,
        playbackUrl: base && r.r2_key ? `${base}/${r.r2_key}` : null,
        createdAt: r.created_at,
      })),
    })
  }),
)

// POST /api/live/webhook — LiveKit server webhook (imzo bilan, credentials'siz).
// Master switch'dan MUSTASNO (in-flight egress yakunlanishi uchun).
router.post(
  '/live/webhook',
  wrap(async (req, res) => {
    const secret = config.live.webhookSecret ?? config.live.apiSecret
    if (!secret) {
      res.status(503).json({ error: 'LIVE_WEBHOOK_NOT_CONFIGURED' })
      return
    }
    const raw = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : JSON.stringify(req.body ?? {})
    const auth = Array.isArray(req.headers['authorization']) ? req.headers['authorization'][0] : req.headers['authorization']
    const evt = verifyLivekitWebhook(secret, raw, auth, { expectedIss: config.live.apiKey })
    if (!evt) {
      res.status(401).json({ error: 'INVALID_WEBHOOK_SIGNATURE' })
      return
    }
    if (evt.event === 'egress_ended') {
      const info = parseEgressEnded(raw)
      if (info) {
        try {
          await liveRepository.finishRecording(info.egressId, info.ready, info.r2Key)
        } catch { /* best-effort — LiveKit retry qilmasligi uchun baribir 200 */ }
      }
    }
    res.json({ ok: true, event: evt.event })
  }),
)

export default router
