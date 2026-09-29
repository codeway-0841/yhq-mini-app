/**
 * Live router — jonli dars control-plane (Faza 0).
 *
 * Trust boundary:
 *  - userId FAQAT telegramAuth'dan (req.userId) — client id'ga ishonilmaydi.
 *  - Rol server resolve qiladi: xona egasi (teacherId) yoki is_teacher/is_admin
 *    bo'lsa 'teacher', aks holda 'student'. Join-token shu rolni imzolaydi.
 *  - Yaratish/start/end: admin YOKI ustoz (is_teacher) — student 403.
 *  - Chat yozish/o'qish: faqat join qilgan participant (membership gate).
 */
import { Router } from 'express'
import { z } from 'zod'
import { wrap, AppError } from '../../middleware/error-handler'
import { validate } from '../../middleware/validate'
import { dbRateLimit as rateLimit } from '../../middleware/db-rate-limiter'
import { identityKey } from '../../middleware/rate-limiter'
import { config } from '../../config'
import { SUBJECT_BASES } from '../../../shared/subjects'
import { isLiveJoinable, LIVE_MESSAGE_MAX_LEN, LIVE_TITLE_MAX_LEN } from '../../../shared/live'
import { liveRepository } from './live.repository'
import { issueLiveJoinToken } from './live.token'
import { buildLivekitToken, verifyLivekitWebhook } from './livekit'
import { parseEgressEnded, startRoomEgress, stopRoomEgress } from './egress'

const router = Router()

const SUBJECT_IDS = new Set((SUBJECT_BASES as readonly { id: string }[]).map((s) => s.id))

function requireUserId(req: unknown): string {
  const userId = (req as { userId?: string }).userId
  if (!userId || userId === '0') throw new AppError(401, 'AUTH_REQUIRED')
  return userId
}

const createLimiter = rateLimit({ maxPerMinute: 10, bucket: 'live:create', keyFn: identityKey })
const joinLimiter = rateLimit({ maxPerMinute: 20, bucket: 'live:join', keyFn: identityKey })
const messageLimiter = rateLimit({ maxPerMinute: 30, bucket: 'live:message', keyFn: identityKey })

const CreateRoomBodySchema = z.object({
  subjectId: z.string().min(1).max(32),
  title: z.string().trim().min(3).max(LIVE_TITLE_MAX_LEN),
  description: z.string().trim().max(500).nullable().optional(),
  scheduledAt: z.string().datetime({ offset: true }).nullable().optional(),
})

const ListRoomsQuerySchema = z.object({
  subject: z.string().min(1).max(32).optional(),
  status: z.enum(['scheduled', 'live', 'ended']).optional(),
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

function toPublicRow(r: {
  id: number; subject_id: string; teacher_id: string; teacher_name: string | null
  title: string; description: string | null; status: string
  scheduled_at: string | null; started_at: string | null; ended_at: string | null
  room_name: string; participant_count: number; created_at: string
}) {
  return {
    id: r.id,
    subjectId: r.subject_id,
    teacherId: r.teacher_id,
    teacherName: r.teacher_name,
    title: r.title,
    description: r.description,
    status: r.status,
    scheduledAt: r.scheduled_at,
    startedAt: r.started_at,
    endedAt: r.ended_at,
    roomName: r.room_name,
    participantCount: Number(r.participant_count ?? 0),
    createdAt: r.created_at,
  }
}

// GET /api/live/rooms?subject=&status=&limit=
router.get(
  '/live/rooms',
  validate({ query: ListRoomsQuerySchema }),
  wrap(async (req, res) => {
    requireUserId(req)
    const q = req.query as z.infer<typeof ListRoomsQuerySchema>
    if (q.subject && !SUBJECT_IDS.has(q.subject)) throw new AppError(400, 'INVALID_SUBJECT')
    const rows = await liveRepository.listRooms({ subjectId: q.subject, status: q.status, limit: q.limit ?? 20 })
    res.json({ ok: true, rooms: rows.map(toPublicRow), mediaEnabled: config.live.mediaEnabled, recordingEnabled: config.live.recordingEnabled })
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
    if (!SUBJECT_IDS.has(body.subjectId)) throw new AppError(400, 'INVALID_SUBJECT')
    const priv = await liveRepository.getPrivilegesForUser(userId)
    if (!priv || (!priv.isAdmin && !priv.isTeacher)) throw new AppError(403, 'TEACHER_REQUIRED')
    const room = await liveRepository.createRoom({
      subjectId: body.subjectId,
      teacherId: userId,
      title: body.title,
      description: body.description ?? null,
      scheduledAt: body.scheduledAt ?? null,
    })
    if (!room) throw new AppError(500, 'LIVE_CREATE_FAILED')
    res.json({ ok: true, room: toPublicRow(room) })
  }),
)

// GET /api/live/rooms/:id
router.get(
  '/live/rooms/:id',
  validate({ params: RoomIdParamSchema }),
  wrap(async (req, res) => {
    requireUserId(req)
    const { id } = req.params as unknown as { id: number }
    const room = await liveRepository.getRoom(id)
    if (!room) throw new AppError(404, 'LIVE_NOT_FOUND')
    res.json({ ok: true, room: toPublicRow(room), mediaEnabled: config.live.mediaEnabled, recordingEnabled: config.live.recordingEnabled })
  }),
)

// POST /api/live/rooms/:id/start — faqat xona egasi yoki admin
router.post(
  '/live/rooms/:id/start',
  validate({ params: RoomIdParamSchema }),
  wrap(async (req, res) => {
    const userId = requireUserId(req)
    const { id } = req.params as unknown as { id: number }
    const priv = await liveRepository.getPrivileges(id, userId)
    if (!priv) throw new AppError(404, 'LIVE_NOT_FOUND')
    if (!priv.isOwner && !priv.isAdmin) throw new AppError(403, 'TEACHER_REQUIRED')
    const ok = await liveRepository.startRoom(id)
    if (!ok) throw new AppError(409, 'LIVE_NOT_SCHEDULED')
    const room = await liveRepository.getRoom(id)
    res.json({ ok: true, room: room ? toPublicRow(room) : null })
  }),
)

// POST /api/live/rooms/:id/end — faqat xona egasi yoki admin
router.post(
  '/live/rooms/:id/end',
  validate({ params: RoomIdParamSchema }),
  wrap(async (req, res) => {
    const userId = requireUserId(req)
    const { id } = req.params as unknown as { id: number }
    const priv = await liveRepository.getPrivileges(id, userId)
    if (!priv) throw new AppError(404, 'LIVE_NOT_FOUND')
    if (!priv.isOwner && !priv.isAdmin) throw new AppError(403, 'TEACHER_REQUIRED')
    await liveRepository.endRoom(id)
    const room = await liveRepository.getRoom(id)
    res.json({ ok: true, room: room ? toPublicRow(room) : null })
  }),
)

// POST /api/live/rooms/:id/join — participant upsert + imzolangan join-token
// + LiveKit JWT (media yoqilgan bo'lsa; canPublish = teacher yoki approved student)
router.post(
  '/live/rooms/:id/join',
  joinLimiter,
  validate({ params: RoomIdParamSchema }),
  wrap(async (req, res) => {
    const userId = requireUserId(req)
    const { id } = req.params as unknown as { id: number }
    const room = await liveRepository.getRoom(id)
    if (!room) throw new AppError(404, 'LIVE_NOT_FOUND')
    if (!isLiveJoinable(room.status)) throw new AppError(409, 'LIVE_ENDED')
    const priv = await liveRepository.getPrivileges(id, userId)
    const role = priv && (priv.isOwner || priv.isAdmin || priv.isTeacher) ? 'teacher' : 'student'
    const { canSpeak } = await liveRepository.joinRoom(id, userId, role)
    const secret = config.live.joinTokenSecret
    const token = secret
      ? issueLiveJoinToken(secret, {
          roomId: id, room: room.room_name, sub: userId, role, canSpeak, ttlSeconds: config.live.joinTokenTtlSeconds,
        })
      : `dev:${id}:${userId}:${role}`
    const canPublish = role === 'teacher' || canSpeak
    const livekitToken = config.live.mediaEnabled && config.live.apiKey && config.live.apiSecret
      ? buildLivekitToken({
          apiKey: config.live.apiKey,
          apiSecret: config.live.apiSecret,
          identity: userId,
          room: room.room_name,
          canPublish,
          ttlSeconds: config.live.joinTokenTtlSeconds,
        })
      : null
    res.json({
      ok: true,
      role,
      canSpeak,
      roomName: room.room_name,
      token,
      expiresIn: config.live.joinTokenTtlSeconds,
      mediaEnabled: config.live.mediaEnabled,
      mediaUrl: config.live.url ?? null,
      livekitToken,
    })
  }),
)

// POST /api/live/rooms/:id/leave — davomat yoziladi
router.post(
  '/live/rooms/:id/leave',
  validate({ params: RoomIdParamSchema }),
  wrap(async (req, res) => {
    const userId = requireUserId(req)
    const { id } = req.params as unknown as { id: number }
    await liveRepository.leaveRoom(id, userId)
    res.json({ ok: true })
  }),
)

// GET /api/live/rooms/:id/participants — faqat participant ko'radi
router.get(
  '/live/rooms/:id/participants',
  validate({ params: RoomIdParamSchema }),
  wrap(async (req, res) => {
    const userId = requireUserId(req)
    const { id } = req.params as unknown as { id: number }
    const room = await liveRepository.getRoom(id)
    if (!room) throw new AppError(404, 'LIVE_NOT_FOUND')
    if (!(await liveRepository.isParticipant(id, userId))) throw new AppError(403, 'LIVE_JOIN_REQUIRED')
    const rows = await liveRepository.listParticipants(id)
    res.json({ ok: true, participants: rows })
  }),
)

// GET /api/live/rooms/:id/messages?after=&limit= — faqat participant
router.get(
  '/live/rooms/:id/messages',
  validate({ params: RoomIdParamSchema, query: ListMessagesQuerySchema }),
  wrap(async (req, res) => {
    const userId = requireUserId(req)
    const { id } = req.params as unknown as { id: number }
    const q = req.query as unknown as { after?: number; limit?: number }
    if (!(await liveRepository.isParticipant(id, userId))) throw new AppError(403, 'LIVE_JOIN_REQUIRED')
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

// POST /api/live/rooms/:id/messages — faqat participant yozadi
router.post(
  '/live/rooms/:id/messages',
  messageLimiter,
  validate({ params: RoomIdParamSchema, body: PostMessageBodySchema }),
  wrap(async (req, res) => {
    const userId = requireUserId(req)
    const { id } = req.params as unknown as { id: number }
    const body = req.body as z.infer<typeof PostMessageBodySchema>
    const room = await liveRepository.getRoom(id)
    if (!room) throw new AppError(404, 'LIVE_NOT_FOUND')
    if (room.status === 'ended') throw new AppError(409, 'LIVE_ENDED')
    if (!(await liveRepository.isParticipant(id, userId))) throw new AppError(403, 'LIVE_JOIN_REQUIRED')
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

const raiseLimiter = rateLimit({ maxPerMinute: 10, bucket: 'live:raise', keyFn: identityKey })
const handsLimiter = rateLimit({ maxPerMinute: 20, bucket: 'live:hands', keyFn: identityKey })
const recordLimiter = rateLimit({ maxPerMinute: 5, bucket: 'live:record', keyFn: identityKey })

const HandTargetParamSchema = z.object({
  id: z.coerce.number().int().positive(),
  userId: z.string().min(1).max(64),
})

async function requireRoomTeacher(roomId: number, userId: string): Promise<void> {
  const priv = await liveRepository.getPrivileges(roomId, userId)
  if (!priv) throw new AppError(404, 'LIVE_NOT_FOUND')
  if (!priv.isOwner && !priv.isAdmin && !priv.isTeacher) throw new AppError(403, 'TEACHER_REQUIRED')
}

// POST /api/live/rooms/:id/raise — student qo'l ko'taradi (ovoz so'rovi)
router.post(
  '/live/rooms/:id/raise',
  raiseLimiter,
  validate({ params: RoomIdParamSchema }),
  wrap(async (req, res) => {
    const userId = requireUserId(req)
    const { id } = req.params as unknown as { id: number }
    const room = await liveRepository.getRoom(id)
    if (!room) throw new AppError(404, 'LIVE_NOT_FOUND')
    if (room.status === 'ended') throw new AppError(409, 'LIVE_ENDED')
    if (!(await liveRepository.isParticipant(id, userId))) throw new AppError(403, 'LIVE_JOIN_REQUIRED')
    const priv = await liveRepository.getPrivileges(id, userId)
    if (priv && (priv.isOwner || priv.isAdmin || priv.isTeacher)) throw new AppError(409, 'ALREADY_SPEAKER')
    const status = await liveRepository.raiseHand(id, userId)
    res.json({ ok: true, status })
  }),
)

// DELETE /api/live/rooms/:id/raise — qo'lni tushirish (o'z pending so'rovi)
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

// GET /api/live/rooms/:id/hands?pendingOnly= — faqat teacher ko'radi
router.get(
  '/live/rooms/:id/hands',
  validate({ params: RoomIdParamSchema }),
  wrap(async (req, res) => {
    const userId = requireUserId(req)
    const { id } = req.params as unknown as { id: number }
    await requireRoomTeacher(id, userId)
    const pendingOnly = req.query['pendingOnly'] !== 'false'
    const rows = await liveRepository.listHands(id, pendingOnly)
    res.json({ ok: true, hands: rows })
  }),
)

// POST /api/live/rooms/:id/hands/:userId/approve — teacher ruxsat beradi (can_speak=true)
router.post(
  '/live/rooms/:id/hands/:userId/approve',
  handsLimiter,
  validate({ params: HandTargetParamSchema }),
  wrap(async (req, res) => {
    const userId = requireUserId(req)
    const { id, userId: target } = req.params as unknown as { id: number; userId: string }
    await requireRoomTeacher(id, userId)
    const ok = await liveRepository.resolveHand(id, target, true)
    if (!ok) throw new AppError(409, 'HAND_NOT_PENDING')
    res.json({ ok: true, status: 'approved' })
  }),
)

// POST /api/live/rooms/:id/hands/:userId/reject — teacher rad etadi
router.post(
  '/live/rooms/:id/hands/:userId/reject',
  handsLimiter,
  validate({ params: HandTargetParamSchema }),
  wrap(async (req, res) => {
    const userId = requireUserId(req)
    const { id, userId: target } = req.params as unknown as { id: number; userId: string }
    await requireRoomTeacher(id, userId)
    const ok = await liveRepository.resolveHand(id, target, false)
    if (!ok) throw new AppError(409, 'HAND_NOT_PENDING')
    res.json({ ok: true, status: 'rejected' })
  }),
)

// POST /api/live/webhook — LiveKit server webhook (imzo bilan, credentials'siz).
// DIQQAT: telegramAuth'dan OLDIN o'tishi uchun auth.ts PUBLIC_LIVE_WEBHOOK'da;
// raw body app.ts'da express.raw bilan ushlanadi (hash aynan kelgan baytlardan).
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
    const evt = verifyLivekitWebhook(secret, raw, auth)
    if (!evt) {
      res.status(401).json({ error: 'INVALID_WEBHOOK_SIGNATURE' })
      return
    }
    // Yozuv yakuni — R2 key DB'ga (idempotent, best-effort).
    if (evt.event === 'egress_ended') {
      const info = parseEgressEnded(raw)
      if (info) {
        try {
          await liveRepository.finishRecording(info.egressId, info.ready, info.r2Key)
        } catch { /* best-effort — LiveKit retry qilmasligi uchun baribir 200 */ }
      }
    }
    // Best-effort kuzatuv — noma'lum event'lar ham 200 (LiveKit retry qilmasligi uchun).
    res.json({ ok: true, event: evt.event })
  }),
)

// GET /api/live/recordings — tayyor yozuvlar (VOD ro'yxati; flag o'chiq bo'lsa bo'sh)
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

function requireLiveMedia(): { url: string; apiKey: string; apiSecret: string } {
  const { url, apiKey, apiSecret, mediaEnabled } = config.live
  if (!mediaEnabled || !url || !apiKey || !apiSecret) throw new AppError(503, 'LIVE_MEDIA_NOT_CONFIGURED')
  return { url, apiKey, apiSecret }
}

function requireR2(): { accountId: string; accessKey: string; secretKey: string; bucket: string } {
  const r = config.r2
  if (!r.isConfigured || !r.accountId || !r.accessKeyId || !r.secretAccessKey || !r.bucket) {
    throw new AppError(503, 'RECORDING_STORAGE_NOT_CONFIGURED')
  }
  return { accountId: r.accountId, accessKey: r.accessKeyId, secretKey: r.secretAccessKey, bucket: r.bucket }
}

// POST /api/live/rooms/:id/record/start — faqat teacher (jonli efirda)
router.post(
  '/live/rooms/:id/record/start',
  recordLimiter,
  validate({ params: RoomIdParamSchema }),
  wrap(async (req, res) => {
    const userId = requireUserId(req)
    const { id } = req.params as unknown as { id: number }
    if (!config.live.recordingEnabled) throw new AppError(503, 'RECORDING_DISABLED')
    await requireRoomTeacher(id, userId)
    const room = await liveRepository.getRoom(id)
    if (!room) throw new AppError(404, 'LIVE_NOT_FOUND')
    if (room.status !== 'live') throw new AppError(409, 'LIVE_NOT_LIVE')
    if (await liveRepository.getActiveRecording(id)) throw new AppError(409, 'RECORDING_ALREADY_ACTIVE')
    const media = requireLiveMedia()
    const r2 = requireR2()
    const egressId = await startRoomEgress({
      livekitUrl: media.url,
      apiKey: media.apiKey,
      apiSecret: media.apiSecret,
      room: room.room_name,
      filepathPrefix: `live-recordings/${room.room_name}`,
      s3: {
        endpoint: `https://${r2.accountId}.r2.cloudflarestorage.com`,
        region: 'auto',
        accessKey: r2.accessKey,
        secret: r2.secretKey,
        bucket: r2.bucket,
      },
    })
    await liveRepository.createRecording(id, egressId)
    res.json({ ok: true, egressId })
  }),
)

// POST /api/live/rooms/:id/record/stop — faqat teacher
router.post(
  '/live/rooms/:id/record/stop',
  recordLimiter,
  validate({ params: RoomIdParamSchema }),
  wrap(async (req, res) => {
    const userId = requireUserId(req)
    const { id } = req.params as unknown as { id: number }
    if (!config.live.recordingEnabled) throw new AppError(503, 'RECORDING_DISABLED')
    await requireRoomTeacher(id, userId)
    const room = await liveRepository.getRoom(id)
    if (!room) throw new AppError(404, 'LIVE_NOT_FOUND')
    const active = await liveRepository.getActiveRecording(id)
    if (!active) throw new AppError(409, 'RECORDING_NOT_ACTIVE')
    const media = requireLiveMedia()
    await stopRoomEgress({
      livekitUrl: media.url, apiKey: media.apiKey, apiSecret: media.apiSecret,
      room: room.room_name, egressId: active.egressId,
    })
    res.json({ ok: true, egressId: active.egressId })
  }),
)

export default router
