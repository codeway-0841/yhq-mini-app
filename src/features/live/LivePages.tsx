import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Hand, Mic, MicOff, MonitorUp, Radio, Send, Users, Video, VideoOff } from 'lucide-react'
import { PageHeader } from '@/shared/components/ui/page-header'
import { Card, CardContent } from '@/shared/components/ui/card'
import { Badge } from '@/shared/components/ui/badge'
import { Button } from '@/shared/components/ui/button'
import { useT } from '@/shared/i18n'
import { useAppStore } from '@/shared/store/useAppStore'
import { useSubjectStore } from '@/shared/store/useSubjectStore'
import { api } from '@/shared/api'
import { goBack } from '@/shared/lib/navigation'
import type { LiveRoomPublic } from '../../../shared/live'
import { useLiveMessages } from './hooks/useLiveMessages'
import { useMediaRoom } from './hooks/useVoiceRoom'
import { VideoView } from './components/MediaTiles'

export default function LiveListPage() {
  const navigate = useNavigate()
  const lang = useAppStore((s) => s.settings.language)
  const user = useAppStore((s) => s.user)
  const subjectId = useSubjectStore((s) => s.subjectId)
  const tt = useT(lang)
  const [rooms, setRooms] = useState<LiveRoomPublic[]>([])
  const [recordings, setRecordings] = useState<import('../../../shared/live').LiveRecordingPublic[]>([])
  const [loading, setLoading] = useState(true)
  const [title, setTitle] = useState('')
  const [creating, setCreating] = useState(false)
  const canCreate = user?.isAdmin === true || user?.isTeacher === true

  const reload = () => {
    setLoading(true)
    api.listLiveRooms({ limit: 20 })
      .then((r) => setRooms(r.rooms))
      .catch(() => setRooms([]))
      .finally(() => setLoading(false))
    api.listLiveRecordings().then((r) => setRecordings(r.recordings)).catch(() => {})
  }

  useEffect(() => {
    let alive = true
    api.listLiveRooms({ limit: 20 })
      .then((r) => { if (alive) setRooms(r.rooms) })
      .catch(() => { if (alive) setRooms([]) })
      .finally(() => { if (alive) setLoading(false) })
    api.listLiveRecordings()
      .then((r) => { if (alive) setRecordings(r.recordings) })
      .catch(() => {})
    return () => { alive = false }
  }, [])

  const handleCreate = async () => {
    const t = title.trim()
    if (t.length < 3 || creating) return
    setCreating(true)
    try {
      const r = await api.createLiveRoom({ subjectId, title: t })
      setTitle('')
      setRooms((prev) => [r.room, ...prev])
    } catch {
      // 403 = huquq yo'q — forma ko'rinmay qoladi (canCreate false bo'lganda)
    } finally {
      setCreating(false)
      void reload()
    }
  }

  return (
    <div className="flex flex-1 flex-col px-4 pb-8">
      <PageHeader title={tt('liveTitle')} subtitle={tt('liveSubtitle')} size="md" onBack={() => goBack(navigate)} />
      {canCreate && (
        <Card>
          <CardContent className="flex flex-col gap-2 p-4">
            <span className="text-sm font-semibold text-pfg">{tt('liveCreateTitle')}</span>
            <div className="flex items-center gap-2">
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') void handleCreate() }}
                placeholder={tt('liveCreatePlaceholder')}
                maxLength={120}
                className="h-11 min-w-0 flex-1 rounded-2xl bg-psurface px-4 text-[15px] text-pfg outline-none placeholder:text-pmuted focus:ring-2 focus:ring-pprimary"
              />
              <Button loading={creating} disabled={title.trim().length < 3} onClick={handleCreate}>
                {tt('liveCreateBtn')}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
      <div className="flex flex-col gap-3 pt-2">
        {loading && <Card><CardContent className="p-4 text-sm text-pmuted">...</CardContent></Card>}
        {!loading && rooms.length === 0 && (
          <Card><CardContent className="p-4 text-sm text-pmuted">{tt('liveEmpty')}</CardContent></Card>
        )}
        {rooms.map((r) => (
          <Card key={r.id} interactive onClick={() => navigate(`/live/${r.id}`)}>
            <CardContent className="flex items-center gap-3 p-4">
              <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-psurface text-pmuted">
                <Radio size={20} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-semibold text-pfg">{r.title}</span>
                <span className="mt-0.5 flex items-center gap-2 text-xs text-pmuted">
                  <Badge variant={r.status === 'live' ? 'danger' : r.status === 'scheduled' ? 'accent' : 'default'}>
                    {r.status === 'live' ? tt('liveStatusLive') : r.status === 'scheduled' ? tt('liveStatusScheduled') : tt('liveStatusEnded')}
                  </Badge>
                  <span className="inline-flex items-center gap-1"><Users size={13} />{r.participantCount}</span>
                </span>
              </span>
            </CardContent>
          </Card>
        ))}
        {recordings.length > 0 && (
          <div className="flex flex-col gap-2 pt-2">
            <span className="text-sm font-semibold text-pfg">{tt('liveRecordings')}</span>
            {recordings.map((rec) => (
              <Card key={rec.id}>
                <CardContent className="flex flex-col gap-2 p-4">
                  <span className="truncate text-[15px] font-semibold text-pfg">{rec.roomTitle}</span>
                  <span className="text-xs text-pmuted">{rec.teacherName ?? ''}</span>
                  {rec.playbackUrl && (
                    <video controls preload="metadata" src={rec.playbackUrl} className="aspect-video w-full rounded-xl bg-black" />
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export function LiveRoomRoute() {
  return <LiveRoomPage />
}

function LiveRoomPage() {
  const { id } = useParams<{ id: string }>()
  const roomId = Number(id)
  const navigate = useNavigate()
  const lang = useAppStore((s) => s.settings.language)
  const user = useAppStore((s) => s.user)
  const tt = useT(lang)
  const [room, setRoom] = useState<LiveRoomPublic | null>(null)
  const [role, setRole] = useState<'teacher' | 'student' | null>(null)
  const [canSpeak, setCanSpeak] = useState(false)
  const [livekitToken, setLivekitToken] = useState<string | null>(null)
  const [mediaUrl, setMediaUrl] = useState<string | null>(null)
  const [mediaEnabled, setMediaEnabled] = useState(false)
  const [joined, setJoined] = useState(false)
  const [busy, setBusy] = useState(false)
  const [draft, setDraft] = useState('')
  const [handStatus, setHandStatus] = useState<'none' | 'pending' | 'approved'>('none')
  const [hands, setHands] = useState<{ userId: string; userName: string | null; status: string; createdAt: string }[]>([])
  const { messages, send } = useLiveMessages(roomId, joined, room?.status === 'ended')
  const voice = useMediaRoom({ mediaUrl, livekitToken, canSpeak, canPublishVideo: canSpeak, enabled: joined && mediaEnabled })

  // Teacher: kutilayotgan qo'llar ro'yxati (5s polling)
  useEffect(() => {
    if (!joined || role !== 'teacher') return
    let alive = true
    const load = () => {
      api.listLiveHands(roomId).then((r) => { if (alive) setHands(r.hands) }).catch(() => {})
    }
    load()
    const t = setInterval(load, 5000)
    return () => { alive = false; clearInterval(t) }
  }, [joined, role, roomId])

  useEffect(() => {
    if (!Number.isInteger(roomId) || roomId <= 0) return
    let alive = true
    api.getLiveRoom(roomId)
      .then((r) => { if (alive) setRoom(r.room) })
      .catch(() => { if (alive) setRoom(null) })
    return () => { alive = false }
  }, [roomId])

  const handleJoin = async () => {
    setBusy(true)
    try {
      const r = await api.joinLiveRoom(roomId)
      setRole(r.role)
      setCanSpeak(r.role === 'teacher' || r.canSpeak)
      setLivekitToken(r.livekitToken)
      setMediaUrl(r.mediaUrl)
      setMediaEnabled(r.mediaEnabled)
      setJoined(true)
    } finally {
      setBusy(false)
    }
  }

  const handleLeave = async () => {
    try { await api.leaveLiveRoom(roomId) } catch { /* ignore */ }
    setJoined(false)
    setRole(null)
    setCanSpeak(false)
    setLivekitToken(null)
    setHandStatus('none')
  }

  const handleRaise = async () => {
    try {
      const r = await api.raiseLiveHand(roomId)
      setHandStatus(r.status)
      if (r.status === 'approved') setCanSpeak(true)
    } catch { /* ignore */ }
  }

  const handleLower = async () => {
    try { await api.lowerLiveHand(roomId) } catch { /* ignore */ }
    setHandStatus('none')
  }

  const handleSend = async () => {
    const body = draft.trim()
    if (!body) return
    setDraft('')
    try { await send(body) } catch { setDraft(body) }
  }

  if (!room) {
    return (
      <div className="flex flex-1 flex-col px-4 pb-8">
        <PageHeader title={tt('liveTitle')} size="md" onBack={() => goBack(navigate)} />
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col px-4 pb-[calc(1rem+var(--safe-bottom,0px))]">
      <PageHeader
        title={room.title}
        subtitle={room.teacherName ?? undefined}
        size="md"
        onBack={() => goBack(navigate)}
        actions={
          <Badge variant={room.status === 'live' ? 'danger' : room.status === 'scheduled' ? 'accent' : 'default'}>
            {room.status === 'live' ? tt('liveStatusLive') : room.status === 'scheduled' ? tt('liveStatusScheduled') : tt('liveStatusEnded')}
          </Badge>
        }
      />
      {/* Media paneli — LiveKit ovoz+kamera+screen (Faza 1c). Media o'chiq bo'lsa chat rejimi. */}
      <Card>
        <CardContent className="flex flex-col items-center gap-2 p-4 text-center">
          {!joined || !mediaEnabled ? (
            <>
              <Radio size={28} className="text-pmuted" />
              <p className="text-sm text-pmuted">{tt('liveVideoSoon')}</p>
            </>
          ) : voice.state === 'connected' ? (
            <>
              {/* Screen-share katta tile */}
              {voice.videos.filter((v) => v.source === 'screen').map((v) => (
                <VideoView key={v.sid} track={v.track} label={v.identity} large />
              ))}
              {/* Kamera grid: lokal + uzoq */}
              {(voice.localVideo || voice.videos.some((v) => v.source === 'camera')) && (
                <div className="grid w-full grid-cols-2 gap-2">
                  {voice.localVideo && (
                    <VideoView track={voice.localVideo} label="Siz" muted speaking={voice.speakers.includes(user?.id ?? '')} />
                  )}
                  {voice.videos.filter((v) => v.source === 'camera').slice(0, 3).map((v) => (
                    <VideoView key={v.sid} track={v.track} label={v.identity} speaking={voice.speakers.includes(v.identity)} />
                  ))}
                </div>
              )}
              <div className="flex items-center gap-2">
                {canSpeak ? (
                  <>
                    <Button
                      size="icon"
                      variant={voice.micOn ? 'default' : 'secondary'}
                      aria-label={voice.micOn ? tt('liveMicOn') : tt('liveMicOff')}
                      onClick={() => void voice.toggleMic()}
                    >
                      {voice.micOn ? <Mic size={18} /> : <MicOff size={18} />}
                    </Button>
                    <Button
                      size="icon"
                      variant={voice.cameraOn ? 'default' : 'secondary'}
                      aria-label="kamera"
                      onClick={() => void voice.toggleCamera()}
                    >
                      {voice.cameraOn ? <Video size={18} /> : <VideoOff size={18} />}
                    </Button>
                    {role === 'teacher' && (
                      <Button
                        size="icon"
                        variant={voice.screenOn ? 'default' : 'secondary'}
                        aria-label="screen"
                        onClick={() => void voice.toggleScreen()}
                      >
                        <MonitorUp size={18} />
                      </Button>
                    )}
                  </>
                ) : role === 'student' && (
                  handStatus === 'pending'
                    ? <Button variant="secondary" size="sm" onClick={handleLower}><Hand size={15} />{tt('liveLowerHand')}</Button>
                    : <Button variant="secondary" size="sm" onClick={handleRaise}><Hand size={15} />{tt('liveRaiseHand')}</Button>
                )}
              </div>
              <p className="text-xs text-pmuted">
                {canSpeak
                  ? (voice.micOn ? tt('liveMicOn') : tt('liveMicOff'))
                  : handStatus === 'pending' ? tt('liveHandPending') : tt('liveVideoSoon')}
              </p>
              {voice.micBlocked && <p className="text-xs text-pdanger">{tt('liveMicBlocked')}</p>}
              {voice.speakers.length > 0 && (
                <p className="text-xs text-psuccess">{voice.speakers.slice(0, 3).join(', ')} {tt('liveSpeaking')}</p>
              )}
            </>
          ) : voice.state === 'failed' ? (
            <p className="text-sm text-pmuted">{tt('liveVideoSoon')}</p>
          ) : (
            <p className="text-sm text-pmuted">{tt('liveVoiceConnecting')}</p>
          )}
          {room.status === 'ended' && <p className="text-xs text-pmuted">{tt('liveEndedHint')}</p>}
        </CardContent>
      </Card>

      {!joined ? (
        <Button block className="mt-3" loading={busy} disabled={room.status === 'ended'} onClick={handleJoin}>
          {tt('liveJoin')}
        </Button>
      ) : (
        <div className="mt-3 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-pfg">{tt('liveChat')}</span>
            <Button variant="ghost" size="sm" onClick={handleLeave}>{tt('liveLeave')}</Button>
          </div>
          <div className="flex max-h-72 flex-col gap-2 overflow-y-auto">
            {messages.length === 0 && <p className="text-sm text-pmuted">{tt('liveChatEmpty')}</p>}
            {messages.map((m) => (
              <div key={m.id} className="rounded-xl bg-psurface px-3 py-2">
                <div className="text-[11px] font-semibold text-pmuted">{m.userName ?? m.userId}{m.role === 'teacher' ? ' · ustoz' : ''}</div>
                <div className="text-sm text-pfg">{m.body}</div>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') void handleSend() }}
              placeholder={tt('liveChatPlaceholder')}
              maxLength={500}
              className="h-11 min-w-0 flex-1 rounded-2xl bg-psurface px-4 text-[15px] text-pfg outline-none placeholder:text-pmuted focus:ring-2 focus:ring-pprimary"
            />
            <Button size="icon" aria-label="send" onClick={handleSend} disabled={!draft.trim()}>
              <Send size={18} />
            </Button>
          </div>
          {role === 'teacher' && room.status !== 'ended' && (
            <>
              <TeacherControls roomId={roomId} status={room.status} onChanged={setRoom} />
              <HandsPanel
                roomId={roomId}
                hands={hands}
                onResolved={(targetUserId, approved) => {
                  setHands((prev) => prev.filter((h) => h.userId !== targetUserId))
                  if (approved) void api.listLiveParticipants(roomId).catch(() => {})
                }}
              />
            </>
          )}
        </div>
      )}
    </div>
  )
}

function TeacherControls({ roomId, status, onChanged }: { roomId: number; status: string; onChanged: (r: LiveRoomPublic) => void }) {
  const lang = useAppStore((s) => s.settings.language)
  const tt = useT(lang)
  const [busy, setBusy] = useState(false)
  const [recording, setRecording] = useState(false)
  const [recBusy, setRecBusy] = useState(false)
  const toggleRecord = async () => {
    setRecBusy(true)
    try {
      if (recording) {
        await api.stopLiveRecording(roomId)
        setRecording(false)
      } else {
        await api.startLiveRecording(roomId)
        setRecording(true)
      }
    } catch { /* 503 = media/R2 sozlanmagan — jim qolamiz */ } finally {
      setRecBusy(false)
    }
  }
  return (
    <div className="flex flex-wrap gap-2">
      {status === 'scheduled' && (
        <Button variant="secondary" loading={busy} onClick={async () => {
          setBusy(true)
          try { const r = await api.startLiveRoom(roomId); if (r.room) onChanged(r.room) } finally { setBusy(false) }
        }}>
          {tt('liveStart')}
        </Button>
      )}
      {status !== 'ended' && (
        <Button variant="destructive" loading={busy} onClick={async () => {
          setBusy(true)
          try { const r = await api.endLiveRoom(roomId); if (r.room) onChanged(r.room) } finally { setBusy(false) }
        }}>
          {tt('liveEnd')}
        </Button>
      )}
      {status === 'live' && (
        <Button variant="secondary" loading={recBusy} onClick={toggleRecord}>
          {recording ? tt('liveStopRecord') : tt('liveRecord')}
        </Button>
      )}
      {recording && <Badge variant="danger">{tt('liveRecording')}</Badge>}
    </div>
  )
}

function HandsPanel({ roomId, hands, onResolved }: {
  roomId: number
  hands: { userId: string; userName: string | null; status: string; createdAt: string }[]
  onResolved: (targetUserId: string, approved: boolean) => void
}) {
  const lang = useAppStore((s) => s.settings.language)
  const tt = useT(lang)
  const [busyId, setBusyId] = useState<string | null>(null)
  if (hands.length === 0) return null
  const decide = async (targetUserId: string, approve: boolean) => {
    setBusyId(targetUserId)
    try {
      if (approve) await api.approveLiveHand(roomId, targetUserId)
      else await api.rejectLiveHand(roomId, targetUserId)
      onResolved(targetUserId, approve)
    } catch { /* ignore */ } finally {
      setBusyId(null)
    }
  }
  return (
    <Card>
      <CardContent className="flex flex-col gap-2 p-4">
        <span className="text-sm font-semibold text-pfg">{tt('liveHandsTitle')} ({hands.length})</span>
        {hands.map((h) => (
          <div key={h.userId} className="flex items-center gap-2">
            <span className="min-w-0 flex-1 truncate text-sm text-pfg">
              <Hand size={14} className="mr-1 inline text-pmuted" />{h.userName ?? h.userId}
            </span>
            <Button variant="secondary" size="sm" loading={busyId === h.userId} onClick={() => void decide(h.userId, true)}>
              {tt('liveApprove')}
            </Button>
            <Button variant="ghost" size="sm" disabled={busyId === h.userId} onClick={() => void decide(h.userId, false)}>
              {tt('liveReject')}
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
