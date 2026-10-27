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
import type { LiveRole, LiveStatus } from '../../../shared/live'

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
    // Sequence id va deterministik room_name bitta INSERT'da: parallel create
    // placeholder UNIQUE collision yoki yarim yozilgan xona qoldirmaydi.
    const rows = await executeRows<{ id: number }>(sql`
      WITH next_id AS (SELECT nextval(pg_get_serial_sequence('live_rooms', 'id')) AS id)
      INSERT INTO live_rooms (id, subject_id, teacher_id, title, description, scheduled_at, room_name)
      SELECT next_id.id, ${args.subjectId}, ${args.teacherId}, ${args.title}, ${args.description},
             ${args.scheduledAt}::timestamptz, 'live_' || next_id.id::text
      FROM next_id
      RETURNING id
    `)
    const id = rows[0]?.id
    if (!id) return null
    return this.getRoom(id)
  },

  async getRoom(id: number): Promise<LiveRoomRow | null> {
    const rows = await executeRows<LiveRoomRow>(sql`
      SELECT r.id, r.subject_id, r.teacher_id,
             COALESCE((SELECT NULLIF(TRIM(CONCAT(u.first_name, ' ', COALESCE(u.last_name, ''))), '') FROM users u WHERE u.id = r.teacher_id), 'Diana Mustafaeva') AS teacher_name,
             r.title, r.description, r.status,
             r.scheduled_at, r.started_at, r.ended_at, r.room_name, r.created_at,
             (SELECT COUNT(*)::int FROM live_participants p WHERE p.room_id = r.id AND p.left_at IS NULL) AS participant_count
      FROM live_rooms r WHERE r.id = ${id} AND r.archived_at IS NULL LIMIT 1
    `)
    return rows[0] ?? null
  },

  async listRooms(filter: { subjectId?: string; status?: LiveStatus; limit: number }): Promise<LiveRoomRow[]> {
    const limit = Math.min(50, Math.max(1, filter.limit))
    if (filter.subjectId && filter.status) {
      return executeRows<LiveRoomRow>(sql`
        SELECT r.id, r.subject_id, r.teacher_id,
               COALESCE((SELECT NULLIF(TRIM(CONCAT(u.first_name, ' ', COALESCE(u.last_name, ''))), '') FROM users u WHERE u.id = r.teacher_id), 'Diana Mustafaeva') AS teacher_name,
               r.title, r.description, r.status,
               r.scheduled_at, r.started_at, r.ended_at, r.room_name, r.created_at,
               (SELECT COUNT(*)::int FROM live_participants p WHERE p.room_id = r.id AND p.left_at IS NULL) AS participant_count
        FROM live_rooms r
        WHERE r.subject_id = ${filter.subjectId} AND r.status = ${filter.status} AND r.archived_at IS NULL
        ORDER BY r.scheduled_at NULLS LAST, r.id DESC LIMIT ${limit}
      `)
    }
    if (filter.subjectId) {
      return executeRows<LiveRoomRow>(sql`
        SELECT r.id, r.subject_id, r.teacher_id,
               COALESCE((SELECT NULLIF(TRIM(CONCAT(u.first_name, ' ', COALESCE(u.last_name, ''))), '') FROM users u WHERE u.id = r.teacher_id), 'Diana Mustafaeva') AS teacher_name,
               r.title, r.description, r.status,
               r.scheduled_at, r.started_at, r.ended_at, r.room_name, r.created_at,
               (SELECT COUNT(*)::int FROM live_participants p WHERE p.room_id = r.id AND p.left_at IS NULL) AS participant_count
        FROM live_rooms r
        WHERE r.subject_id = ${filter.subjectId} AND r.archived_at IS NULL
        ORDER BY r.scheduled_at NULLS LAST, r.id DESC LIMIT ${limit}
      `)
    }
    if (filter.status) {
      return executeRows<LiveRoomRow>(sql`
        SELECT r.id, r.subject_id, r.teacher_id,
               COALESCE((SELECT NULLIF(TRIM(CONCAT(u.first_name, ' ', COALESCE(u.last_name, ''))), '') FROM users u WHERE u.id = r.teacher_id), 'Diana Mustafaeva') AS teacher_name,
               r.title, r.description, r.status,
               r.scheduled_at, r.started_at, r.ended_at, r.room_name, r.created_at,
               (SELECT COUNT(*)::int FROM live_participants p WHERE p.room_id = r.id AND p.left_at IS NULL) AS participant_count
        FROM live_rooms r
        WHERE r.status = ${filter.status} AND r.archived_at IS NULL
        ORDER BY r.scheduled_at NULLS LAST, r.id DESC LIMIT ${limit}
      `)
    }
    return executeRows<LiveRoomRow>(sql`
      SELECT r.id, r.subject_id, r.teacher_id,
             COALESCE((SELECT NULLIF(TRIM(CONCAT(u.first_name, ' ', COALESCE(u.last_name, ''))), '') FROM users u WHERE u.id = r.teacher_id), 'Diana Mustafaeva') AS teacher_name,
             r.title, r.description, r.status,
             r.scheduled_at, r.started_at, r.ended_at, r.room_name, r.created_at,
             (SELECT COUNT(*)::int FROM live_participants p WHERE p.room_id = r.id AND p.left_at IS NULL) AS participant_count
      FROM live_rooms r WHERE r.archived_at IS NULL
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
      WHERE id = ${id} AND status = 'scheduled' AND archived_at IS NULL
        AND (scheduled_at IS NULL OR scheduled_at <= now())
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

  /** End-flow 1-qadam: `ending` — yangi join darhol bloklanadi (idempotent). */
  async markEnding(id: number): Promise<boolean> {
    const rows = await executeRows<{ id: number }>(sql`
      UPDATE live_rooms SET status = 'ending', updated_at = now()
      WHERE id = ${id} AND status IN ('scheduled', 'live') AND archived_at IS NULL
      RETURNING id
    `)
    return rows.length > 0
  },

  /** End-flow yakuni: `ending` → `ended` + davomat yopish (idempotent retry). */
  async markEnded(id: number): Promise<boolean> {
    const rows = await executeRows<{ id: number }>(sql`
      UPDATE live_rooms SET status = 'ended', ended_at = now(), updated_at = now()
      WHERE id = ${id} AND status IN ('live', 'ending', 'scheduled')
      RETURNING id
    `)
    if (rows.length === 0) return false
    await executeRows(sql`
      UPDATE live_participants SET
        left_at = now(),
        duration_sec = duration_sec + GREATEST(0, EXTRACT(EPOCH FROM (now() - joined_at))::int)
      WHERE room_id = ${id} AND left_at IS NULL
    `)
    return true
  },

  /** Idempotent soft-delete: faqat tugagan xona yashiriladi. */
  async archiveRoom(id: number): Promise<boolean> {
    const rows = await executeRows<{ id: number }>(sql`
      UPDATE live_rooms SET archived_at = now(), updated_at = now()
      WHERE id = ${id} AND status = 'ended' AND archived_at IS NULL
      RETURNING id
    `)
    return rows.length > 0
  },

  async getArchiveState(id: number): Promise<{ status: LiveStatus; archived: boolean } | null> {
    const rows = await executeRows<{ status: LiveStatus; archived: boolean }>(sql`
      SELECT status, (archived_at IS NOT NULL) AS archived FROM live_rooms WHERE id = ${id} LIMIT 1
    `)
    return rows[0] ?? null
  },

  async joinRoom(roomId: number, userId: string, role: LiveRole): Promise<{ canSpeak: boolean } | null> {
    // Huquq har join'da tasdiqlangan qo'l/rol manbasidan qayta hisoblanadi.
    const rows = await executeRows<{ can_speak: boolean }>(sql`
      INSERT INTO live_participants (room_id, user_id, role, can_speak, joined_at, left_at)
      SELECT r.id, ${userId}, ${role},
        (${role} = 'teacher' OR EXISTS (
          SELECT 1 FROM live_hand_raises h
          WHERE h.room_id = ${roomId} AND h.user_id = ${userId} AND h.status = 'approved'
        )), now(), NULL
      FROM live_rooms r WHERE r.id = ${roomId} AND r.archived_at IS NULL
        AND (r.status = 'live' OR (${role} = 'teacher' AND r.status = 'scheduled'))
      FOR UPDATE OF r
      ON CONFLICT (room_id, user_id) DO UPDATE SET
        role = EXCLUDED.role,
        can_speak = EXCLUDED.can_speak,
        joined_at = now(), left_at = NULL
      RETURNING can_speak
    `)
    return rows[0] ? { canSpeak: rows[0].can_speak } : null
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

  /** Kech kelgan webhook yangi join davomatini yopmasligi kerak. */
  async leaveRoomFromWebhook(roomId: number, userId: string, eventSeconds: number): Promise<void> {
    await executeRows(sql`
      UPDATE live_participants SET
        left_at = to_timestamp(${eventSeconds})::timestamp,
        duration_sec = duration_sec + GREATEST(0, EXTRACT(EPOCH FROM (to_timestamp(${eventSeconds})::timestamp - joined_at))::int)
      WHERE room_id = ${roomId} AND user_id = ${userId} AND left_at IS NULL
        AND joined_at <= to_timestamp(${eventSeconds})::timestamp
    `)
  },

  async getParticipantState(roomId: number, userId: string): Promise<{ active: boolean; canSpeak: boolean }> {
    const rows = await executeRows<{ active: boolean; can_speak: boolean }>(sql`
      SELECT (left_at IS NULL) AS active, can_speak FROM live_participants
      WHERE room_id = ${roomId} AND user_id = ${userId} LIMIT 1
    `)
    return { active: rows[0]?.active ?? false, canSpeak: rows[0]?.can_speak ?? false }
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

  /** Revoke approved holatini ham bekor qiladi; bitta DB statement. */
  async revokeSpeaker(roomId: number, userId: string): Promise<void> {
    await executeRows(sql`
      WITH hand AS (
        UPDATE live_hand_raises SET status = 'rejected', updated_at = now()
        WHERE room_id = ${roomId} AND user_id = ${userId}
      )
      UPDATE live_participants SET can_speak = false
      WHERE room_id = ${roomId} AND user_id = ${userId}
    `)
  },

  /** /me uchun o'z qo'l holati (qator yo'q = 'none'). */
  async getHandStatus(roomId: number, userId: string): Promise<'pending' | 'approved' | 'rejected' | 'none'> {
    const rows = await executeRows<{ status: string }>(sql`
      SELECT status FROM live_hand_raises WHERE room_id = ${roomId} AND user_id = ${userId} LIMIT 1
    `)
    const s = rows[0]?.status
    return s === 'pending' || s === 'approved' || s === 'rejected' ? s : 'none'
  },

  // ── Yozuvlar (Egress → R2) ─────────────────────────────────────────────
  async createRecording(roomId: number, egressId: string): Promise<void> {
    await executeRows(sql`
      INSERT INTO live_recordings (room_id, egress_id, status)
      VALUES (${roomId}, ${egressId}, 'started')
      ON CONFLICT (egress_id) DO NOTHING
    `)
  },

  /**
   * ATOMIK reservation (§8): faqat faol recording YO'Q bo'lsa `starting`
   * qatori yaratiladi. Parallel start'lardan bittasi g'olib (qaytgani null).
   */
  async reserveRecording(roomId: number): Promise<{ id: number } | null> {
    const rows = await executeRows<{ id: number }>(sql`
      INSERT INTO live_recordings (room_id, egress_id, status)
      SELECT ${roomId}, 'pending:' || gen_random_uuid()::text, 'starting'
      WHERE NOT EXISTS (
        SELECT 1 FROM live_recordings
        WHERE room_id = ${roomId} AND status IN ('starting', 'started', 'stopping')
      )
      RETURNING id
    `)
    return rows[0] ?? null
  },

  async activateRecording(id: number, egressId: string): Promise<void> {
    await executeRows(sql`
      UPDATE live_recordings SET egress_id = ${egressId}, status = 'started', updated_at = now()
      WHERE id = ${id} AND status = 'starting'
    `)
  },

  async markStopping(id: number): Promise<boolean> {
    const rows = await executeRows<{ id: number }>(sql`
      UPDATE live_recordings SET status = 'stopping', updated_at = now()
      WHERE id = ${id} AND status IN ('starting', 'started')
      RETURNING id
    `)
    return rows.length > 0
  },

  async failRecording(id: number): Promise<void> {
    await executeRows(sql`
      UPDATE live_recordings SET status = 'failed', updated_at = now()
      WHERE id = ${id} AND status IN ('starting', 'started', 'stopping')
    `)
  },

  async getRecordingStatusById(id: number): Promise<'starting' | 'started' | 'stopping' | null> {
    const rows = await executeRows<{ status: string }>(sql`
      SELECT status FROM live_recordings WHERE id = ${id} LIMIT 1
    `)
    const s = rows[0]?.status
    return s === 'starting' || s === 'started' || s === 'stopping' ? s : null
  },

  async getActiveRecording(roomId: number): Promise<{ id: number; egressId: string; status: 'starting' | 'started' | 'stopping'; updatedAt: string } | null> {
    const rows = await executeRows<{ id: number; egress_id: string; status: 'starting' | 'started' | 'stopping'; updated_at: string }>(sql`
      SELECT id, egress_id, status, updated_at FROM live_recordings
      WHERE room_id = ${roomId} AND status IN ('starting', 'started', 'stopping')
      ORDER BY id DESC LIMIT 1
    `)
    const r = rows[0]
    return r ? { id: r.id, egressId: r.egress_id, status: r.status, updatedAt: r.updated_at } : null
  },

  /** Ko'p serverless instance'da bitta reconcile g'olib bo'ladi; retry 60s backoff. */
  async claimStaleRecording(id: number): Promise<boolean> {
    const rows = await executeRows<{ id: number }>(sql`
      UPDATE live_recordings SET updated_at = now()
      WHERE id = ${id} AND status IN ('starting', 'started', 'stopping')
        AND updated_at < now() - interval '60 seconds'
      RETURNING id
    `)
    return rows.length > 0
  },

  /** Webhook idempotent: egressId bo'yicha (roomId nomuvofiq bo'lsa ham topiladi). */
  async finishRecording(egressId: string, ready: boolean, r2Key: string | null): Promise<void> {
    await executeRows(sql`
      UPDATE live_recordings SET status = ${ready && r2Key ? 'ready' : 'failed'}, r2_key = ${r2Key}, updated_at = now()
      WHERE egress_id = ${egressId} AND status IN ('starting', 'started', 'stopping')
    `)
  },

  async listRecordings(limit: number): Promise<{ id: number; room_id: number; room_title: string; subject_id: string; teacher_name: string | null; r2_key: string | null; status: string; created_at: string }[]> {
    const lim = Math.min(50, Math.max(1, limit))
    return executeRows<{ id: number; room_id: number; room_title: string; subject_id: string; teacher_name: string | null; r2_key: string | null; status: string; created_at: string }>(sql`
      SELECT rec.id, rec.room_id, r.title AS room_title, r.subject_id,
             COALESCE((SELECT NULLIF(TRIM(CONCAT(u.first_name, ' ', COALESCE(u.last_name, ''))), '') FROM users u WHERE u.id = r.teacher_id), 'Diana Mustafaeva') AS teacher_name,
             rec.r2_key, rec.status, rec.created_at
      FROM live_recordings rec JOIN live_rooms r ON r.id = rec.room_id
      WHERE rec.status = 'ready' AND r.archived_at IS NULL
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
