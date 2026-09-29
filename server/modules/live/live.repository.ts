/**
 * Live repository — jonli dars control-plane DB qatlami.
 *
 * ATOMIKLIK:
 *  - join: participant UPSERT (PK room+user) — parallel join serialize;
 *    qayta join joinedAt'ni yangilaydi, leftAt'ni tozalaydi.
 *  - leave: leftAt + durationSec bitta UPDATE (joinedAt'dan hisob).
 *  - end: status='live' guard bilan (qayta end no-op).
 *  - message: room membership guard service/router'da (bu yerda sof yozish).
 */
import { sql } from 'drizzle-orm'
import { executeRows } from '../../db/connection'
import { liveRoomName, type LiveRole, type LiveStatus } from '../../../shared/live'

export interface LiveRoomRow {
  id: number
  subject_id: string
  teacher_id: string
  teacher_name: string | null
  title: string
  description: string | null
  status: LiveStatus
  scheduled_at: string | null
  started_at: string | null
  ended_at: string | null
  room_name: string
  participant_count: number
  created_at: string
}

export interface LiveMessageRow {
  id: number
  room_id: number
  user_id: string
  user_name: string | null
  role: string
  body: string
  created_at: string
}

export const liveRepository = {
  async getPrivilegesForUser(userId: string): Promise<{ isAdmin: boolean; isTeacher: boolean } | null> {
    const rows = await executeRows<{ is_admin: boolean; is_teacher: boolean }>(sql`
      SELECT COALESCE(is_admin, false) AS is_admin, COALESCE(is_teacher, false) AS is_teacher
      FROM users WHERE id = ${userId} LIMIT 1
    `)
    const r = rows[0]
    if (!r) return null
    return { isAdmin: r.is_admin, isTeacher: r.is_teacher }
  },

  async createRoom(args: {
    subjectId: string
    teacherId: string
    title: string
    description: string | null
    scheduledAt: string | null
  }): Promise<LiveRoomRow | null> {
    // room_name UNIQUE — deterministik bo'lgani uchun avval placeholder,
    // id chiqqach `live_<id>` ga yangilanadi (2 statement, lekin idempotent emas —
    // create kam chaqiriladi, race yo'q).
    const rows = await executeRows<{ id: number }>(sql`
      INSERT INTO live_rooms (subject_id, teacher_id, title, description, scheduled_at, room_name)
      VALUES (${args.subjectId}, ${args.teacherId}, ${args.title}, ${args.description}, ${args.scheduledAt}::timestamptz, 'pending:' || extract(epoch from now())::bigint || ':' || ${args.teacherId})
      RETURNING id
    `)
    const id = rows[0]?.id
    if (!id) return null
    await executeRows(sql`
      UPDATE live_rooms SET room_name = ${liveRoomName(id)}, updated_at = now() WHERE id = ${id}
    `)
    return this.getRoom(id)
  },

  async getRoom(id: number): Promise<LiveRoomRow | null> {
    const rows = await executeRows<LiveRoomRow>(sql`
      SELECT r.id, r.subject_id, r.teacher_id,
             (SELECT u.first_name FROM users u WHERE u.id = r.teacher_id) AS teacher_name,
             r.title, r.description, r.status,
             r.scheduled_at, r.started_at, r.ended_at, r.room_name, r.created_at,
             (SELECT COUNT(*)::int FROM live_participants p WHERE p.room_id = r.id) AS participant_count
      FROM live_rooms r WHERE r.id = ${id} LIMIT 1
    `)
    return rows[0] ?? null
  },

  async listRooms(filter: { subjectId?: string; status?: LiveStatus; limit: number }): Promise<LiveRoomRow[]> {
    const limit = Math.min(50, Math.max(1, filter.limit))
    if (filter.subjectId && filter.status) {
      return executeRows<LiveRoomRow>(sql`
        SELECT r.id, r.subject_id, r.teacher_id,
               (SELECT u.first_name FROM users u WHERE u.id = r.teacher_id) AS teacher_name,
               r.title, r.description, r.status,
               r.scheduled_at, r.started_at, r.ended_at, r.room_name, r.created_at,
               (SELECT COUNT(*)::int FROM live_participants p WHERE p.room_id = r.id) AS participant_count
        FROM live_rooms r
        WHERE r.subject_id = ${filter.subjectId} AND r.status = ${filter.status}
        ORDER BY r.scheduled_at NULLS LAST, r.id DESC LIMIT ${limit}
      `)
    }
    if (filter.subjectId) {
      return executeRows<LiveRoomRow>(sql`
        SELECT r.id, r.subject_id, r.teacher_id,
               (SELECT u.first_name FROM users u WHERE u.id = r.teacher_id) AS teacher_name,
               r.title, r.description, r.status,
               r.scheduled_at, r.started_at, r.ended_at, r.room_name, r.created_at,
               (SELECT COUNT(*)::int FROM live_participants p WHERE p.room_id = r.id) AS participant_count
        FROM live_rooms r
        WHERE r.subject_id = ${filter.subjectId}
        ORDER BY r.scheduled_at NULLS LAST, r.id DESC LIMIT ${limit}
      `)
    }
    if (filter.status) {
      return executeRows<LiveRoomRow>(sql`
        SELECT r.id, r.subject_id, r.teacher_id,
               (SELECT u.first_name FROM users u WHERE u.id = r.teacher_id) AS teacher_name,
               r.title, r.description, r.status,
               r.scheduled_at, r.started_at, r.ended_at, r.room_name, r.created_at,
               (SELECT COUNT(*)::int FROM live_participants p WHERE p.room_id = r.id) AS participant_count
        FROM live_rooms r
        WHERE r.status = ${filter.status}
        ORDER BY r.scheduled_at NULLS LAST, r.id DESC LIMIT ${limit}
      `)
    }
    return executeRows<LiveRoomRow>(sql`
      SELECT r.id, r.subject_id, r.teacher_id,
             (SELECT u.first_name FROM users u WHERE u.id = r.teacher_id) AS teacher_name,
             r.title, r.description, r.status,
             r.scheduled_at, r.started_at, r.ended_at, r.room_name, r.created_at,
             (SELECT COUNT(*)::int FROM live_participants p WHERE p.room_id = r.id) AS participant_count
      FROM live_rooms r
      ORDER BY r.scheduled_at NULLS LAST, r.id DESC LIMIT ${limit}
    `)
  },

  /** Xona egasi yoki admin ekanligini tekshirish (start/end guard). */
  async getPrivileges(roomId: number, userId: string): Promise<{ isOwner: boolean; isAdmin: boolean; isTeacher: boolean } | null> {    const rows = await executeRows<{ teacher_id: string; is_admin: boolean; is_teacher: boolean }>(sql`
      SELECT r.teacher_id, COALESCE(u.is_admin, false) AS is_admin, COALESCE(u.is_teacher, false) AS is_teacher
      FROM live_rooms r
      LEFT JOIN users u ON u.id = ${userId}
      WHERE r.id = ${roomId} LIMIT 1
    `)
    const r = rows[0]
    if (!r) return null
    return { isOwner: r.teacher_id === userId, isAdmin: r.is_admin, isTeacher: r.is_teacher }
  },

  async startRoom(id: number): Promise<boolean> {
    const rows = await executeRows<{ id: number }>(sql`
      UPDATE live_rooms SET status = 'live', started_at = now(), updated_at = now()
      WHERE id = ${id} AND status = 'scheduled'
      RETURNING id
    `)
    return rows.length > 0
  },

  async endRoom(id: number): Promise<boolean> {
    const rows = await executeRows<{ id: number }>(sql`
      UPDATE live_rooms SET status = 'ended', ended_at = now(), updated_at = now()
      WHERE id = ${id} AND status <> 'ended'
      RETURNING id
    `)
    if (rows.length === 0) return false
    // Xonada qolgan participant'larning davomatini yopish (qayta join left_at'ni tozalaydi).
    await executeRows(sql`
      UPDATE live_participants SET
        left_at = now(),
        duration_sec = duration_sec + GREATEST(0, EXTRACT(EPOCH FROM (now() - joined_at))::int)
      WHERE room_id = ${id} AND left_at IS NULL
    `)
    return true
  },

  async joinRoom(roomId: number, userId: string, role: LiveRole): Promise<{ canSpeak: boolean }> {
    // Qayta join can_speak'ni O'CHIRMAYDI (approve qilingan student qaytsa ham gapiradi).
    // Teacher roli har doim can_speak=true. Avval approved qo'l bilan kirsa ham true.
    const rows = await executeRows<{ can_speak: boolean }>(sql`
      INSERT INTO live_participants (room_id, user_id, role, can_speak, joined_at, left_at)
      VALUES (${roomId}, ${userId}, ${role},
        (${role} = 'teacher' OR EXISTS (
          SELECT 1 FROM live_hand_raises h
          WHERE h.room_id = ${roomId} AND h.user_id = ${userId} AND h.status = 'approved'
        )), now(), NULL)
      ON CONFLICT (room_id, user_id) DO UPDATE SET
        role = EXCLUDED.role,
        can_speak = (live_participants.can_speak OR EXCLUDED.can_speak),
        joined_at = now(), left_at = NULL
      RETURNING can_speak
    `)
    return { canSpeak: rows[0]?.can_speak ?? role === 'teacher' }
  },

  async leaveRoom(roomId: number, userId: string): Promise<void> {
    await executeRows(sql`
      UPDATE live_participants SET
        left_at = now(),
        duration_sec = duration_sec + GREATEST(0, EXTRACT(EPOCH FROM (now() - joined_at))::int)
      WHERE room_id = ${roomId} AND user_id = ${userId} AND left_at IS NULL
    `)
  },

  async listParticipants(roomId: number): Promise<{ userId: string; userName: string | null; role: string; canSpeak: boolean; joinedAt: string }[]> {
    return executeRows<{ user_id: string; user_name: string | null; role: string; can_speak: boolean; joined_at: string }>(sql`
      SELECT p.user_id, u.first_name AS user_name, p.role, p.can_speak, p.joined_at
      FROM live_participants p LEFT JOIN users u ON u.id = p.user_id
      WHERE p.room_id = ${roomId} AND p.left_at IS NULL
      ORDER BY p.joined_at
    `).then((rows) => rows.map((r) => ({ userId: r.user_id, userName: r.user_name, role: r.role, canSpeak: r.can_speak, joinedAt: r.joined_at })))
  },

  async isParticipant(roomId: number, userId: string): Promise<boolean> {
    // Chiqqan (left_at o'rnatilgan) user participant EMAS — chat/raise eshiklari shunga tayanadi.
    const rows = await executeRows<{ n: number }>(sql`
      SELECT 1 AS n FROM live_participants
      WHERE room_id = ${roomId} AND user_id = ${userId} AND left_at IS NULL LIMIT 1
    `)
    return rows.length > 0
  },

  // ── Qo'l ko'tarish (raise-hand) ──────────────────────────────────────────
  /** Student so'rov yuboradi — approved holatni qayta pending'ga tushirmaydi. */
  async raiseHand(roomId: number, userId: string): Promise<'pending' | 'approved'> {
    const rows = await executeRows<{ status: string }>(sql`
      INSERT INTO live_hand_raises (room_id, user_id, status)
      VALUES (${roomId}, ${userId}, 'pending')
      ON CONFLICT (room_id, user_id) DO UPDATE SET
        status = CASE WHEN live_hand_raises.status = 'approved' THEN 'approved' ELSE 'pending' END,
        updated_at = now()
      RETURNING status
    `)
    return rows[0]?.status === 'approved' ? 'approved' : 'pending'
  },

  async listHands(roomId: number, onlyPending: boolean): Promise<{ userId: string; userName: string | null; status: string; createdAt: string }[]> {
    if (onlyPending) {
      return executeRows<{ user_id: string; user_name: string | null; status: string; created_at: string }>(sql`
        SELECT h.user_id, u.first_name AS user_name, h.status, h.created_at
        FROM live_hand_raises h LEFT JOIN users u ON u.id = h.user_id
        WHERE h.room_id = ${roomId} AND h.status = 'pending'
        ORDER BY h.created_at
      `).then((rows) => rows.map((r) => ({ userId: r.user_id, userName: r.user_name, status: r.status, createdAt: r.created_at })))
    }
    return executeRows<{ user_id: string; user_name: string | null; status: string; created_at: string }>(sql`
      SELECT h.user_id, u.first_name AS user_name, h.status, h.created_at
      FROM live_hand_raises h LEFT JOIN users u ON u.id = h.user_id
      WHERE h.room_id = ${roomId}
      ORDER BY h.created_at
    `).then((rows) => rows.map((r) => ({ userId: r.user_id, userName: r.user_name, status: r.status, createdAt: r.created_at })))
  },

  /** Teacher qarori — approve can_speak=true, reject can_speak=false (atomik). */
  async resolveHand(roomId: number, targetUserId: string, approve: boolean): Promise<boolean> {
    const rows = await executeRows<{ user_id: string }>(sql`
      WITH upd AS (
        UPDATE live_hand_raises SET status = ${approve ? 'approved' : 'rejected'}, updated_at = now()
        WHERE room_id = ${roomId} AND user_id = ${targetUserId} AND status = 'pending'
        RETURNING user_id
      ), spk AS (
        UPDATE live_participants SET can_speak = ${approve}
        WHERE room_id = ${roomId} AND user_id = ${targetUserId}
          AND EXISTS (SELECT 1 FROM upd)
        RETURNING user_id
      )
      SELECT user_id FROM upd
    `)
    return rows.length > 0
  },

  /** Qo'lni tushirish (student o'zi) — pending so'rov bekor qilinadi. */
  async lowerHand(roomId: number, userId: string): Promise<void> {
    await executeRows(sql`
      DELETE FROM live_hand_raises WHERE room_id = ${roomId} AND user_id = ${userId} AND status = 'pending'
    `)
  },

  // ── Yozuvlar (Egress → R2) ─────────────────────────────────────────────
  async createRecording(roomId: number, egressId: string): Promise<void> {
    await executeRows(sql`
      INSERT INTO live_recordings (room_id, egress_id, status)
      VALUES (${roomId}, ${egressId}, 'started')
      ON CONFLICT (egress_id) DO NOTHING
    `)
  },

  async getActiveRecording(roomId: number): Promise<{ id: number; egressId: string } | null> {
    const rows = await executeRows<{ id: number; egress_id: string }>(sql`
      SELECT id, egress_id FROM live_recordings
      WHERE room_id = ${roomId} AND status = 'started'
      ORDER BY id DESC LIMIT 1
    `)
    const r = rows[0]
    return r ? { id: r.id, egressId: r.egress_id } : null
  },

  /** Webhook idempotent: egressId bo'yicha (roomId nomuvofiq bo'lsa ham topiladi). */
  async finishRecording(egressId: string, ready: boolean, r2Key: string | null): Promise<void> {
    await executeRows(sql`
      UPDATE live_recordings SET status = ${ready && r2Key ? 'ready' : 'failed'}, r2_key = ${r2Key}
      WHERE egress_id = ${egressId} AND status = 'started'
    `)
  },

  async listRecordings(limit: number): Promise<{ id: number; room_id: number; room_title: string; subject_id: string; teacher_name: string | null; r2_key: string | null; status: string; created_at: string }[]> {
    const lim = Math.min(50, Math.max(1, limit))
    return executeRows<{ id: number; room_id: number; room_title: string; subject_id: string; teacher_name: string | null; r2_key: string | null; status: string; created_at: string }>(sql`
      SELECT rec.id, rec.room_id, r.title AS room_title, r.subject_id,
             (SELECT u.first_name FROM users u WHERE u.id = r.teacher_id) AS teacher_name,
             rec.r2_key, rec.status, rec.created_at
      FROM live_recordings rec JOIN live_rooms r ON r.id = rec.room_id
      WHERE rec.status = 'ready'
      ORDER BY rec.id DESC LIMIT ${lim}
    `)
  },

  async postMessage(roomId: number, userId: string, body: string): Promise<LiveMessageRow | null> {
    const rows = await executeRows<LiveMessageRow>(sql`
      INSERT INTO live_messages (room_id, user_id, body)
      VALUES (${roomId}, ${userId}, ${body})
      RETURNING id, room_id, user_id,
        (SELECT first_name FROM users WHERE id = ${userId}) AS user_name,
        (SELECT role FROM live_participants WHERE room_id = ${roomId} AND user_id = ${userId}) AS role,
        body, created_at
    `)
    return rows[0] ?? null
  },

  async listMessages(roomId: number, afterId: number, limit: number): Promise<LiveMessageRow[]> {
    const lim = Math.min(100, Math.max(1, limit))
    return executeRows<LiveMessageRow>(sql`
      SELECT m.id, m.room_id, m.user_id, u.first_name AS user_name,
             COALESCE(p.role, 'student') AS role, m.body, m.created_at
      FROM live_messages m
      LEFT JOIN users u ON u.id = m.user_id
      LEFT JOIN live_participants p ON p.room_id = m.room_id AND p.user_id = m.user_id
      WHERE m.room_id = ${roomId} AND m.id > ${afterId}
      ORDER BY m.id ASC LIMIT ${lim}
    `)
  },
}
