/**
 * Live service — jonli dars biznes-logikasi (3-qatlam reja §3).
 *
 * Router FAQAT: zod validation → auth → service → HTTP response.
 * DB ↔ LiveKit yarim bajarilgan operatsiyalar SHU YERDA markazlashgan:
 *  - end: DB ending → recording stop → room delete → DB ended (idempotent retry)
 *  - approve: DB desired-state + LiveKit permission best-effort
 *  - recording: atomic reservation → egress → activate (parallel-safe)
 */
import { config } from '../../config'
import { SUBJECT_BASES } from '../../../shared/subjects'
import {
  capabilitiesFor,
  isLiveJoinable,
  type LiveCapabilities,
  type LiveHandState,
  type LiveMeState,
  type LiveRole,
  type LiveRoomPublic,
  type LiveStatus,
} from '../../../shared/live'
import { liveRepository, type LiveRoomRow } from './live.repository'
import { issueLiveJoinToken } from './live.token'
import { buildLivekitToken } from './livekit'
import {
  deleteRoom as controlDeleteRoom,
  listEgress as controlListEgress,
  listParticipants as controlListParticipants,
  removeParticipant as controlRemoveParticipant,
  sendRoomRefresh as controlSendRoomRefresh,
  startEgress as controlStartEgress,
  stopEgress as controlStopEgress,
  updateParticipantPermission as controlUpdatePermission,
  type ControlConfig,
} from './livekit-control'
import { isEgressTerminal, parseEgressEnded, type CloudParticipantSummary } from './egress'

const SUBJECT_IDS = new Set((SUBJECT_BASES as readonly { id: string }[]).map((s) => s.id))

export function isValidSubject(id: string): boolean {
  return SUBJECT_IDS.has(id)
}

export interface Privileges {
  isOwner: boolean
  isAdmin: boolean
  isTeacher: boolean
}

/** Manager = xona egasi yoki admin (oddiy teacher boshqa xonada moderator EMAS — §5). */
export function isManager(p: Privileges): boolean {
  return p.isOwner || p.isAdmin
}

/** Join'dagi rol: teacher faqat owner/admin; global teacher boshqa xonada student. */
export function resolveJoinRole(p: Privileges | null): LiveRole {
  return p && (p.isOwner || p.isAdmin) ? 'teacher' : 'student'
}

function controlConfig(): ControlConfig | null {
  const l = config.live
  if (!l.mediaEnabled || !l.url || !l.apiKey || !l.apiSecret) return null
  return { url: l.url, apiKey: l.apiKey, apiSecret: l.apiSecret }
}

async function notifyRoomRefresh(roomName: string, kind: 'state' | 'chat' = 'state'): Promise<void> {
  const cfg = controlConfig()
  if (!cfg) return
  try {
    await controlSendRoomRefresh(cfg, roomName, kind)
  } catch {
    // HTTP polling fallback davom etadi; signal xatosi mutation'ni rollback qilmaydi.
    console.warn('[live] room refresh signal failed', roomName)
  }
}

function toPublicRow(r: LiveRoomRow): LiveRoomPublic {
  return {
    id: r.id,
    subjectId: r.subject_id,
    teacherId: r.teacher_id,
    teacherName: r.teacher_name,
    title: r.title,
    description: r.description,
    status: r.status,
    scheduledAt: r.scheduled_at ? new Date(r.scheduled_at).toISOString() : null,
    startedAt: r.started_at,
    endedAt: r.ended_at,
    roomName: r.room_name,
    participantCount: Number(r.participant_count ?? 0),
    createdAt: r.created_at,
  }
}

export type ServiceError =
  | 'NOT_FOUND'
  | 'FORBIDDEN'
  | 'TEACHER_REQUIRED'
  | 'INVALID_SUBJECT'
  | 'NOT_SCHEDULED'
  | 'ENDED'
  | 'JOIN_REQUIRED'
  | 'ALREADY_SPEAKER'
  | 'HAND_NOT_PENDING'
  | 'MEDIA_NOT_CONFIGURED'
  | 'STORAGE_NOT_CONFIGURED'
  | 'RECORDING_DISABLED'
  | 'RECORDING_CONFLICT'
  | 'RECORDING_NOT_ACTIVE'
  | 'NOT_LIVE'
  | 'CREATE_FAILED'
  | 'LIVE_DISABLED'
  | 'ARCHIVE_REQUIRES_END'
  | 'MEDIA_CONTROL_FAILED'
  | 'TOO_EARLY'

export function isLiveEnabled(): boolean {
  return config.live.enabled
}

export const liveService = {
  capabilitiesFor,
  notifyRoomRefresh,

  async listRooms(filter: { subjectId?: string; status?: LiveStatus; limit: number }): Promise<LiveRoomPublic[]> {
    const rows = await liveRepository.listRooms(filter)
    return rows.map(toPublicRow)
  },

  async getRoom(id: number): Promise<LiveRoomPublic | null> {
    const room = await liveRepository.getRoom(id)
    return room ? toPublicRow(room) : null
  },

  async createRoom(teacherId: string, input: { subjectId: string; title: string; description: string | null; scheduledAt: string | null })
    : Promise<{ ok: true; room: LiveRoomPublic } | { ok: false; error: ServiceError }> {
    if (!isValidSubject(input.subjectId)) return { ok: false, error: 'INVALID_SUBJECT' }
    const priv = await liveRepository.getPrivilegesForUser(teacherId)
    if (!priv || (!priv.isAdmin && !priv.isTeacher)) return { ok: false, error: 'TEACHER_REQUIRED' }
    const room = await liveRepository.createRoom({ ...input, teacherId })
    if (!room) return { ok: false, error: 'CREATE_FAILED' }
    return { ok: true, room: toPublicRow(room) }
  },

  async startRoom(id: number): Promise<{ ok: true } | { ok: false; error: ServiceError }> {
    const ok = await liveRepository.startRoom(id)
    if (ok) {
      const room = await liveRepository.getRoom(id)
      if (room) await notifyRoomRefresh(room.room_name)
      return { ok: true }
    }
    const room = await liveRepository.getRoom(id)
    if (room?.status === 'scheduled' && room.scheduled_at && new Date(room.scheduled_at).getTime() > Date.now()) {
      return { ok: false, error: 'TOO_EARLY' }
    }
    return { ok: false, error: 'NOT_SCHEDULED' }
  },

  /**
   * End-flow (§4): ending (join blok) → recording stop → room delete → ended.
   * Har qadam idempotent — retry xavfsiz. Media sozlanmagan bo'lsa DB qismi baribir.
   */
  async endRoom(id: number): Promise<{ ok: true } | { ok: false; error: ServiceError }> {
    const marked = await liveRepository.markEnding(id)
    const room = await liveRepository.getRoom(id)
    if (!room) return { ok: false, error: 'NOT_FOUND' }
    if (!marked && room.status === 'ended') return { ok: true }
    if (!marked && room.status !== 'ending') return { ok: false, error: 'ENDED' }
    await notifyRoomRefresh(room.room_name)
    const cfg = controlConfig()
    if (cfg) {
      const active = await liveRepository.getActiveRecording(id)
      if (active) {
        if (active.egressId.startsWith('pending:')) {
          // Start javobi hali yo'q: noma'lum egress'ni to'xtata olmaymiz.
          if (Date.now() - new Date(active.updatedAt).getTime() < 60_000) {
            return { ok: false, error: 'MEDIA_CONTROL_FAILED' }
          }
          await liveRepository.failRecording(active.id)
        } else {
          await liveRepository.markStopping(active.id)
          try {
            await controlStopEgress(cfg, active.egressId)
          } catch (error) {
            if ((error as { status?: number }).status !== 404) {
              return { ok: false, error: 'MEDIA_CONTROL_FAILED' }
            }
          }
        }
      }
      try {
        await controlDeleteRoom(cfg, room.room_name)
      } catch (error) {
        if ((error as { status?: number }).status !== 404) {
          return { ok: false, error: 'MEDIA_CONTROL_FAILED' }
        }
      }
    }
    await liveRepository.markEnded(id)
    return { ok: true }
  },

  /** Scheduled xona yopiladi, jonli efir esa avval alohida yakunlanishi shart. */
  async archiveRoom(id: number): Promise<{ ok: true } | { ok: false; error: ServiceError }> {
    const state = await liveRepository.getArchiveState(id)
    if (!state) return { ok: false, error: 'NOT_FOUND' }
    if (state.archived) return { ok: true }
    if (state.status === 'live' || state.status === 'ending') return { ok: false, error: 'ARCHIVE_REQUIRES_END' }
    if (state.status === 'scheduled') {
      const ended = await this.endRoom(id)
      if (!ended.ok) return ended
    }
    const archived = await liveRepository.archiveRoom(id)
    if (archived || (await liveRepository.getArchiveState(id))?.archived) return { ok: true }
    return { ok: false, error: 'ARCHIVE_REQUIRES_END' }
  },

  async joinRoom(roomId: number, userId: string): Promise<
    | { ok: true; role: LiveRole; canSpeak: boolean; capabilities: LiveCapabilities; roomName: string; token: string; livekitToken: string | null }
    | { ok: false; error: ServiceError }
  > {
    const room = await liveRepository.getRoom(roomId)
    if (!room) return { ok: false, error: 'NOT_FOUND' }
    if (!isLiveJoinable(room.status)) return { ok: false, error: 'ENDED' }
    const priv = await liveRepository.getPrivileges(roomId, userId)
    const role = resolveJoinRole(priv)
    const joined = await liveRepository.joinRoom(roomId, userId, role)
    if (!joined) return { ok: false, error: room.status === 'scheduled' && role === 'student' ? 'NOT_LIVE' : 'ENDED' }
    const { canSpeak } = joined
    const capabilities = capabilitiesFor({
      isOwner: priv?.isOwner ?? false,
      isAdmin: priv?.isAdmin ?? false,
      role,
      canSpeak,
    })
    const secret = config.live.joinTokenSecret
    const token = secret
      ? issueLiveJoinToken(secret, {
          roomId, room: room.room_name, sub: userId, role, canSpeak, ttlSeconds: config.live.joinTokenTtlSeconds,
        })
      : `dev:${roomId}:${userId}:${role}`
    const canPublish = role === 'teacher' || canSpeak
    const livekitToken = controlConfig()
      ? buildLivekitToken({
          apiKey: config.live.apiKey!,
          apiSecret: config.live.apiSecret!,
          identity: userId,
          room: room.room_name,
          canPublish,
          ttlSeconds: config.live.joinTokenTtlSeconds,
        })
      : null
    return { ok: true, role, canSpeak, capabilities, roomName: room.room_name, token, livekitToken }
  },

  /** Leave: LiveKit remove (best-effort) + DB davomat. Idempotent no-op. */
  async leaveRoom(roomId: number, userId: string): Promise<void> {
    const cfg = controlConfig()
    const room = cfg ? await liveRepository.getRoom(roomId).catch(() => null) : null
    if (cfg && room) {
      await controlRemoveParticipant(cfg, room.room_name, userId).catch(() => {})
    }
    await liveRepository.leaveRoom(roomId, userId)
  },

  async getMe(roomId: number, userId: string): Promise<{ ok: true; me: LiveMeState } | { ok: false; error: ServiceError }> {
    const room = await liveRepository.getRoom(roomId)
    if (!room) return { ok: false, error: 'NOT_FOUND' }
    const priv = await liveRepository.getPrivileges(roomId, userId)
    const role = resolveJoinRole(priv)
    const [participant, handStatus, rec] = await Promise.all([
      liveRepository.getParticipantState(roomId, userId),
      liveRepository.getHandStatus(roomId, userId),
      liveRepository.getActiveRecording(roomId),
    ])
    const canSpeak = participant.active && (role === 'teacher' || participant.canSpeak)
    const capabilities = capabilitiesFor({
      isOwner: priv?.isOwner ?? false,
      isAdmin: priv?.isAdmin ?? false,
      role,
      canSpeak,
    })
    return {
      ok: true,
      me: {
        roomStatus: room.status,
        role,
        active: participant.active,
        canSpeak,
        handStatus: handStatus as LiveHandState,
        recordingStatus: rec?.status ?? null,
        capabilities,
      },
    }
  },

  async getRoomDetails(id: number): Promise<{
    room: LiveRoomPublic
    recordingActive: boolean
    recordingStatus: 'starting' | 'started' | 'stopping' | null
  } | null> {
    const room = await liveRepository.getRoom(id)
    if (!room) return null
    const rec = await liveRepository.getActiveRecording(id)
    const status = rec?.status ?? null
    return { room: toPublicRow(room), recordingActive: status !== null, recordingStatus: status }
  },

  async raiseHand(roomId: number, userId: string): Promise<{ ok: true; status: 'pending' | 'approved' } | { ok: false; error: ServiceError }> {
    const room = await liveRepository.getRoom(roomId)
    if (!room) return { ok: false, error: 'NOT_FOUND' }
    if (room.status === 'ended' || room.status === 'ending') return { ok: false, error: 'ENDED' }
    if (!(await liveRepository.isParticipant(roomId, userId))) return { ok: false, error: 'JOIN_REQUIRED' }
    const priv = await liveRepository.getPrivileges(roomId, userId)
    if (priv && (priv.isOwner || priv.isAdmin)) return { ok: false, error: 'ALREADY_SPEAKER' }
    const status = await liveRepository.raiseHand(roomId, userId)
    await notifyRoomRefresh(room.room_name)
    return { ok: true, status }
  },

  /**
   * Approve: DB desired-state + LiveKit permission best-effort.
   * Offline participant'da LiveKit yiqiladi — DB baribir true, keyingi join token yangi grant bilan.
   */
  async approveHand(roomId: number, targetUserId: string): Promise<{ ok: true } | { ok: false; error: ServiceError }> {
    const room = await liveRepository.getRoom(roomId)
    if (!room) return { ok: false, error: 'NOT_FOUND' }
    const ok = await liveRepository.resolveHand(roomId, targetUserId, true)
    if (!ok) return { ok: false, error: 'HAND_NOT_PENDING' }
    const cfg = controlConfig()
    if (cfg) {
      await controlUpdatePermission(cfg, room.room_name, targetUserId, true).catch(() => {})
    }
    await notifyRoomRefresh(room.room_name)
    return { ok: true }
  },

  async rejectHand(roomId: number, targetUserId: string): Promise<{ ok: true } | { ok: false; error: ServiceError }> {
    const ok = await liveRepository.resolveHand(roomId, targetUserId, false)
    if (ok) {
      const room = await liveRepository.getRoom(roomId)
      if (room) await notifyRoomRefresh(room.room_name)
    }
    return ok ? { ok: true } : { ok: false, error: 'HAND_NOT_PENDING' }
  },

  /** Revoke: DB false + LiveKit canPublish=false (best-effort) + qo'l rejected. */
  async revokeSpeaker(roomId: number, targetUserId: string): Promise<{ ok: true } | { ok: false; error: ServiceError }> {
    const room = await liveRepository.getRoom(roomId)
    if (!room) return { ok: false, error: 'NOT_FOUND' }
    const priv = await liveRepository.getPrivileges(roomId, targetUserId)
    if (priv?.isOwner || priv?.isAdmin) return { ok: false, error: 'FORBIDDEN' }
    await liveRepository.revokeSpeaker(roomId, targetUserId)
    const cfg = controlConfig()
    if (cfg) {
      try {
        await controlUpdatePermission(cfg, room.room_name, targetUserId, false)
      } catch (error) {
        // Offline participant 404 — DB desired-state keyingi join'da ishlaydi.
        if ((error as { status?: number }).status !== 404) {
          try {
            await controlRemoveParticipant(cfg, room.room_name, targetUserId)
          } catch (removeError) {
            if ((removeError as { status?: number }).status !== 404) {
              return { ok: false, error: 'MEDIA_CONTROL_FAILED' }
            }
          }
        }
      }
    }
    await notifyRoomRefresh(room.room_name)
    return { ok: true }
  },

  /** Recording start (§8): reservation → egress → activate. Parallel-safe. */
  async startRecording(roomId: number): Promise<{ ok: true; egressId: string } | { ok: false; error: ServiceError }> {
    if (!config.live.recordingEnabled) return { ok: false, error: 'RECORDING_DISABLED' }
    const room = await liveRepository.getRoom(roomId)
    if (!room) return { ok: false, error: 'NOT_FOUND' }
    if (room.status !== 'live') return { ok: false, error: 'NOT_LIVE' }
    const cfg = controlConfig()
    if (!cfg) return { ok: false, error: 'MEDIA_NOT_CONFIGURED' }
    const r2 = config.r2
    if (!r2.isConfigured || !r2.accountId || !r2.accessKeyId || !r2.secretAccessKey || !r2.bucket) {
      return { ok: false, error: 'STORAGE_NOT_CONFIGURED' }
    }
    let reserved: { id: number } | null
    try {
      reserved = await liveRepository.reserveRecording(roomId)
    } catch (e) {
      if ((e as { code?: string })?.code === '23505') return { ok: false, error: 'RECORDING_CONFLICT' }
      throw e
    }
    if (!reserved) return { ok: false, error: 'RECORDING_CONFLICT' }
    let egressId: string | null = null
    try {
      egressId = await controlStartEgress(cfg, room.room_name, `live-recordings/${room.room_name}`, {
        endpoint: `https://${r2.accountId}.r2.cloudflarestorage.com`,
        region: 'auto',
        accessKey: r2.accessKeyId,
        secret: r2.secretAccessKey,
        bucket: r2.bucket,
      })
      await liveRepository.activateRecording(reserved.id, egressId)
      await notifyRoomRefresh(room.room_name)
      return { ok: true, egressId }
    } catch (e) {
      // Egress yaratilib, DB aktivatsiya yiqilsa R2'ga yozishda davom etmasin.
      if (egressId) await controlStopEgress(cfg, egressId).catch(() => {})
      await liveRepository.failRecording(reserved.id).catch(() => {})
      throw e
    }
  },

  async stopRecording(roomId: number): Promise<{ ok: true; egressId: string } | { ok: false; error: ServiceError }> {
    if (!config.live.recordingEnabled) return { ok: false, error: 'RECORDING_DISABLED' }
    const room = await liveRepository.getRoom(roomId)
    if (!room) return { ok: false, error: 'NOT_FOUND' }
    const active = await liveRepository.getActiveRecording(roomId)
    if (!active) return { ok: false, error: 'RECORDING_NOT_ACTIVE' }
    const cfg = controlConfig()
    if (!cfg) return { ok: false, error: 'MEDIA_NOT_CONFIGURED' }
    if (active.egressId.startsWith('pending:')) return { ok: false, error: 'RECORDING_CONFLICT' }
    await liveRepository.markStopping(active.id)
    try {
      await controlStopEgress(cfg, active.egressId)
    } catch (error) {
      if ((error as { status?: number }).status !== 404) {
        return { ok: false, error: 'MEDIA_CONTROL_FAILED' }
      }
    }
    await notifyRoomRefresh(room.room_name)
    return { ok: true, egressId: active.egressId }
  },

  /** Webhook yo'qolsa manager sahifasi 60s backoff bilan cloud holatini tiklaydi. */
  async reconcileRecording(roomId: number): Promise<{ ok: true; status: string | null } | { ok: false; error: ServiceError }> {
    const room = await liveRepository.getRoom(roomId)
    if (!room) return { ok: false, error: 'NOT_FOUND' }
    const active = await liveRepository.getActiveRecording(roomId)
    if (!active) return { ok: true, status: null }
    if (!(await liveRepository.claimStaleRecording(active.id))) {
      return { ok: true, status: active.status }
    }
    if (active.status === 'starting' && active.egressId.startsWith('pending:')) {
      await liveRepository.failRecording(active.id)
      await notifyRoomRefresh(room.room_name)
      return { ok: true, status: 'failed' }
    }
    const cfg = controlConfig()
    if (!cfg) return { ok: false, error: 'MEDIA_NOT_CONFIGURED' }
    try {
      const infos = await controlListEgress(cfg, room.room_name, active.egressId)
      const info = infos.find((item) => item['egressId'] === active.egressId)
      if (info && isEgressTerminal(info['status'])) {
        const parsed = parseEgressEnded(JSON.stringify({ event: 'egress_ended', egressInfo: info }))
        if (parsed) {
          await liveRepository.finishRecording(parsed.egressId, parsed.ready, parsed.r2Key)
          await notifyRoomRefresh(room.room_name)
          return { ok: true, status: parsed.ready && parsed.r2Key ? 'ready' : 'failed' }
        }
      }
      if (info && active.status === 'stopping') {
        await controlStopEgress(cfg, active.egressId)
      }
      if (!info) console.warn('[live] egress not found during reconcile', room.room_name, active.id)
      return { ok: true, status: active.status }
    } catch {
      return { ok: false, error: 'MEDIA_CONTROL_FAILED' }
    }
  },
}

const CLOUD_CACHE_TTL_MS = 8000
const cloudCache = new Map<number, { at: number; data: CloudParticipantSummary[] }>()

/** Cloud diagnostika — 8s server cache (teacher polling yukini Cloud'ga uzatmaslik). */
export async function getCachedCloudHealth(
  roomId: number,
  roomName: string,
): Promise<{ cached: boolean; participants: CloudParticipantSummary[] } | { error: 'MEDIA_NOT_CONFIGURED' }> {
  const cfg = controlConfig()
  if (!cfg) return { error: 'MEDIA_NOT_CONFIGURED' }
  const hit = cloudCache.get(roomId)
  if (hit && Date.now() - hit.at < CLOUD_CACHE_TTL_MS) {
    return { cached: true, participants: hit.data }
  }
  const out = await controlListParticipants(cfg, roomName)
  const { summarizeParticipants } = await import('./egress')
  const data = summarizeParticipants(out)
  cloudCache.set(roomId, { at: Date.now(), data })
  return { cached: false, participants: data }
}
