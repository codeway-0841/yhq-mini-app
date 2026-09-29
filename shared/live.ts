/**
 * Jonli dars (Live) — YAGONA MANBA (frontend + backend umumiy).
 *
 * Faza 0 (control-plane): jadval + xona + chat + davomat + join-token.
 * Media-plane (LiveKit SFU video/audio) Faza 1b — token/roomName interfeysi
 * hozirdan LiveKit'ga mos (`live_<id>` deterministik room).
 *
 * Qoidalar:
 *  - Rolni client HECH QACHON aytmaydi — server DB'dan resolve qiladi
 *    (scoring trust boundary kabi). Token ichidagi rol server imzolagan.
 *  - Fan id `shared/subjects.ts` dagi SubjectId bo'lishi shart.
 */

export const LIVE_ROLES = ['teacher', 'student'] as const
export type LiveRole = (typeof LIVE_ROLES)[number]

export const LIVE_STATUSES = ['scheduled', 'live', 'ending', 'ended'] as const
export type LiveStatus = (typeof LIVE_STATUSES)[number]

/** Qo'l ko'tarish holati — ovoz ruxsati so'rovi */
export const LIVE_HAND_STATUSES = ['pending', 'approved', 'rejected'] as const
export type LiveHandStatus = (typeof LIVE_HAND_STATUSES)[number]

export interface LiveHandRaise {
  roomId: number
  userId: string
  userName: string | null
  status: LiveHandStatus
  createdAt: string
}

export interface LiveRoomPublic {
  id: number
  subjectId: string
  teacherId: string
  teacherName: string | null
  title: string
  description: string | null
  status: LiveStatus
  scheduledAt: string | null
  startedAt: string | null
  endedAt: string | null
  roomName: string
  participantCount: number
  createdAt: string
}

export interface LiveMessagePublic {
  id: number
  roomId: number
  userId: string
  userName: string | null
  role: LiveRole
  body: string
  createdAt: string
}

/** Deterministik SFU xona nomi — LiveKit roomName bilan 1:1. */
export function liveRoomName(roomId: number | string): string {
  return `live_${roomId}`
}

export function isLiveRole(v: unknown): v is LiveRole {
  return v === 'teacher' || v === 'student'
}

export function isLiveStatus(v: unknown): v is LiveStatus {
  return v === 'scheduled' || v === 'live' || v === 'ending' || v === 'ended'
}

/** Xonaga kirish mumkinmi (ro'yxat/join gate). `ending` — yopilmoqda, join YO'Q. */
export function isLiveJoinable(status: LiveStatus): boolean {
  return status === 'scheduled' || status === 'live'
}

/** Qo'l holati — /me javobida (qator yo'q = 'none'). */
export const LIVE_HAND_STATES = ['none', 'pending', 'approved', 'rejected'] as const
export type LiveHandState = (typeof LIVE_HAND_STATES)[number]

/** Server hisoblagan capability — client rol taxmin QILMAYDI (§5).
 *  canManage/canModerate/canRecord: FAQAT xona egasi yoki admin
 *  (global isTeacher boshqa xonada moderator EMAS). */
export interface LiveCapabilities {
  canManage: boolean
  canModerate: boolean
  canRecord: boolean
  canPublish: boolean
}

export function capabilitiesFor(args: {
  isOwner: boolean
  isAdmin: boolean
  role: LiveRole
  canSpeak: boolean
}): LiveCapabilities {
  const manager = args.isOwner || args.isAdmin
  return {
    canManage: manager,
    canModerate: manager,
    canRecord: manager,
    canPublish: args.role === 'teacher' || args.canSpeak,
  }
}

/** /me javobi — student holat polling'i (3–5s) shu orqali. */
export interface LiveMeState {
  roomStatus: LiveStatus
  role: LiveRole
  active: boolean
  canSpeak: boolean
  handStatus: LiveHandState
  recordingStatus: 'starting' | 'started' | 'stopping' | null
  capabilities: LiveCapabilities
}

/** Join-token payload — server imzolaydi, client o'qimaydi (opaque).
 *  `spk` = gapirish ruxsati (teacher har doim true; student faqat approve'dan keyin). */
export interface LiveJoinClaims {
  room: string
  roomId: number
  sub: string
  role: LiveRole
  spk: boolean
  exp: number
}

/** Yozuv holati */
export const LIVE_RECORDING_STATUSES = ['starting', 'started', 'stopping', 'ready', 'failed'] as const
export type LiveRecordingStatus = (typeof LIVE_RECORDING_STATUSES)[number]

export interface LiveRecordingPublic {
  id: number
  roomId: number
  roomTitle: string
  subjectId: string
  teacherName: string | null
  playbackUrl: string | null
  status: LiveRecordingStatus
  createdAt: string
}
export const LIVE_JOIN_TOKEN_TTL_SECONDS = 600
export const LIVE_MESSAGE_MAX_LEN = 500
export const LIVE_TITLE_MAX_LEN = 120
