import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Hand, Mic, MicOff, MonitorUp, Radio, Send, Trash2, Users, Video, VideoOff } from 'lucide-react'
import { PageHeader } from '@/shared/components/ui/page-header'
import { Card, CardContent } from '@/shared/components/ui/card'
import { Badge } from '@/shared/components/ui/badge'
import { Button } from '@/shared/components/ui/button'
import { ConfirmDialog } from '@/shared/components/ui/dialog'
import { useT } from '@/shared/i18n'
import { useAppStore } from '@/shared/store/useAppStore'
import { useSubjectStore } from '@/shared/store/useSubjectStore'
import { api } from '@/shared/api'
import { goBack } from '@/shared/lib/navigation'
import type { LiveCapabilities, LiveRoomPublic } from '../../../shared/live'
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
  const [recordingEnabled, setRecordingEnabled] = useState(false)
  const [loading, setLoading] = useState(true)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [scheduledAt, setScheduledAt] = useState('')
  const [creating, setCreating] = useState(false)
  const [archiveTarget, setArchiveTarget] = useState<LiveRoomPublic | null>(null)
  const [archiving, setArchiving] = useState(false)
  const [error, setError] = useState('')
  const canCreate = user?.isAdmin === true || user?.isTeacher === true

  useEffect(() => {
    let alive = true
    api.listLiveRooms({ limit: 20 })
      .then((r) => { if (alive) { setRooms(r.rooms); setRecordingEnabled(r.recordingEnabled) } })
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
    setError('')
    try {
      const r = await api.createLiveRoom({
        subjectId, title: t, description: description.trim() || null,
        scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : null,
      })
      setTitle('')
      setDescription('')
      setScheduledAt('')
      setRooms((prev) => [r.room, ...prev])
    } catch {
      setError(tt('liveActionFailed'))
    } finally {
      setCreating(false)
    }
  }

  const handleArchive = async () => {
    if (!archiveTarget || archiving) return
    setArchiving(true)
    setError('')
    try {
      await api.archiveLiveRoom(archiveTarget.id)
      setRooms((prev) => prev.filter((room) => room.id !== archiveTarget.id))
      setArchiveTarget(null)
    } catch {
      setError(tt('liveActionFailed'))
    } finally {
      setArchiving(false)
    }
  }

  return (
    <div className="flex flex-1 flex-col px-4 pb-8">
      <PageHeader title={tt('liveTitle')} subtitle={tt('liveSubtitle')} size="md" onBack={() => goBack(navigate)} />
      {error && <p role="alert" className="mb-3 rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-600">{error}</p>}
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
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={tt('liveDescriptionPlaceholder')}
              maxLength={500}
              className="h-11 rounded-2xl bg-psurface px-4 text-[15px] text-pfg outline-none placeholder:text-pmuted focus:ring-2 focus:ring-pprimary"
            />
            <label className="flex flex-col gap-1 text-xs text-pmuted">
              {tt('liveScheduleLabel')}
              <input
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                className="h-11 rounded-2xl bg-psurface px-4 text-[15px] text-pfg outline-none focus:ring-2 focus:ring-pprimary"
              />
            </label>
          </CardContent>
        </Card>
      )}
      <div className="flex flex-col gap-3 pt-2">
        {loading && <Card><CardContent className="p-4 text-sm text-pmuted">...</CardContent></Card>}
        {!loading && rooms.length === 0 && (
          <Card><CardContent className="p-4 text-sm text-pmuted">{tt('liveEmpty')}</CardContent></Card>
        )}
        {rooms.map((r) => (
          <Card key={r.id}>
            <CardContent className="flex items-center gap-3 p-4">
              <button type="button" onClick={() => navigate(`/live/${r.id}`)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
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
                  {r.scheduledAt && <span className="mt-1 block text-xs text-pmuted">{new Date(r.scheduledAt).toLocaleString(lang === 'ru' ? 'ru-RU' : 'uz-UZ')}</span>}
                </span>
              </button>
              {(user?.isAdmin || user?.id === r.teacherId) && (
                <button
                  type="button"
                  aria-label={tt('liveArchive')}
                  title={r.status === 'live' || r.status === 'ending' ? tt('liveArchiveActive') : tt('liveArchive')}
                  disabled={r.status === 'live' || r.status === 'ending'}
                  onClick={() => setArchiveTarget(r)}
                  className="grid size-10 shrink-0 place-items-center rounded-xl text-pmuted hover:bg-red-500/10 hover:text-red-600 disabled:opacity-40"
                ><Trash2 size={18} /></button>
              )}
            </CardContent>
          </Card>
        ))}
        {recordingEnabled && recordings.length > 0 && (
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
      <ConfirmDialog
        open={archiveTarget !== null}
        title={archiveTarget?.title ?? tt('liveArchive')}
        description={tt('liveArchiveConfirm')}
        confirmLabel={tt('liveArchive')}
        cancelLabel={tt('liveCancel')}
        loading={archiving}
        destructive
        onConfirm={() => { void handleArchive() }}
        onClose={() => { if (!archiving) setArchiveTarget(null) }}
      />
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
  const [recordingEnabled, setRecordingEnabled] = useState(false)
  const [recordingStatus, setRecordingStatus] = useState<'starting' | 'started' | 'stopping' | null>(null)
  const [canSpeak, setCanSpeak] = useState(false)
  const [caps, setCaps] = useState<LiveCapabilities>({ canManage: false, canModerate: false, canRecord: false, canPublish: false })
  const [livekitToken, setLivekitToken] = useState<string | null>(null)
  const [mediaUrl, setMediaUrl] = useState<string | null>(null)
  const [mediaEnabled, setMediaEnabled] = useState(false)
  const [joined, setJoined] = useState(false)
  const [busy, setBusy] = useState(false)
  const [roomError, setRoomError] = useState('')
  const [draft, setDraft] = useState('')
  const [handStatus, setHandStatus] = useState<'none' | 'pending' | 'approved' | 'rejected'>('none')
  const [cloud, setCloud] = useState<{ participants: { identity: string; audioTracks: number; audioMuted: boolean; videoTracks: number }[] } | { error: true } | null>(null)
  const [hands, setHands] = useState<{ userId: string; userName: string | null; status: string; createdAt: string }[]>([])
  const isRoomManager = user?.isAdmin === true || user?.id === room?.teacherId
  const voice = useMediaRoom({ mediaUrl, livekitToken, canSpeak, canPublishVideo: canSpeak, enabled: joined && mediaEnabled })
  const { messages, send } = useLiveMessages(roomId, joined, room?.status === 'ended' || room?.status === 'ending', voice.chatSignalVersion, voice.state === 'connected')

  // Manager: qo'llar ro'yxati (5s polling) — capability bo'yicha, rol taxmini YO'Q
  useEffect(() => {
    if (!joined || !caps.canModerate) return
    let alive = true
    const load = () => {
      api.listLiveHands(roomId, false).then((r) => { if (alive) setHands(r.hands) }).catch(() => {})
    }
    load()
    const t = setInterval(load, voice.state === 'connected' ? 30_000 : 5_000)
    return () => { alive = false; clearInterval(t) }
  }, [joined, caps.canModerate, roomId, voice.stateSignalVersion, voice.state])

  // /me polling (5s, barcha joined): canSpeak/hand/role/capability/roomStatus.
  // Approve server'da LiveKit permission'ni ham yangilaydi — qayta ulanish SHART EMAS.
  useEffect(() => {
    if (!joined) return
    let alive = true
    const load = async () => {
      try {
        const r = await api.getLiveMe(roomId)
        if (!alive) return
        const me = r.me
        setCanSpeak(me.canSpeak)
        setHandStatus(me.handStatus)
        setCaps(me.capabilities)
        setRecordingStatus(me.recordingStatus)
        setRoom((prev) => (prev && prev.status !== me.roomStatus ? { ...prev, status: me.roomStatus } : prev))
        if (me.roomStatus === 'ended') {
          try { await api.leaveLiveRoom(roomId) } catch { /* ignore */ }
          if (!alive) return
          setJoined(false)
          setCanSpeak(false)
          setLivekitToken(null)
          setHandStatus('none')
        }
      } catch { /* ignore */ }
    }
    load()
    const t = setInterval(load, voice.state === 'connected' ? 30_000 : 5_000)
    return () => { alive = false; clearInterval(t) }
  }, [joined, roomId, voice.stateSignalVersion, voice.state])

  // Manager: Cloud diagnostika (10s polling) — xato jim yutilmaydi
  useEffect(() => {
    if (!joined || !caps.canModerate) {
      setCloud(null)
      return
    }
    let alive = true
    const load = () => {
      api.getLiveCloudHealth(roomId)
        .then((r) => { if (alive) setCloud({ participants: r.participants }) })
        .catch(() => { if (alive) setCloud({ error: true }) })
    }
    load()
    const t = setInterval(load, voice.state === 'connected' ? 30_000 : 10_000)
    return () => { alive = false; clearInterval(t) }
  }, [joined, caps.canModerate, roomId, voice.state])

  useEffect(() => {
    if (!joined || !caps.canManage || recordingStatus === null) return
    let alive = true
    const reconcile = () => {
      api.reconcileLiveRecording(roomId)
        .then((result) => {
          if (!alive) return
          const status = result.status
          setRecordingStatus(status === 'starting' || status === 'started' || status === 'stopping' ? status : null)
        })
        .catch(() => {})
    }
    reconcile()
    const timer = window.setInterval(reconcile, 60_000)
    return () => { alive = false; window.clearInterval(timer) }
  }, [joined, caps.canManage, recordingStatus, roomId])

  useEffect(() => {
    if (!Number.isInteger(roomId) || roomId <= 0) return
    let alive = true
    api.getLiveRoom(roomId)
      .then((r) => { if (alive) { setRoom(r.room); setRecordingEnabled(r.recordingEnabled); setRecordingStatus(r.recordingStatus) } })
      .catch(() => { if (alive) setRoom(null) })
    return () => { alive = false }
  }, [roomId])

  // Student efir boshlanishini kutayotganda hali LiveKit signaliga ulanmagan.
  useEffect(() => {
    if (joined || room?.status !== 'scheduled') return
    let alive = true
    const timer = window.setInterval(() => {
      api.getLiveRoom(roomId)
        .then((result) => { if (alive) setRoom(result.room) })
        .catch(() => {})
    }, 15_000)
    return () => { alive = false; window.clearInterval(timer) }
  }, [joined, room?.status, roomId])

  const handleJoin = async () => {
    setBusy(true)
    setRoomError('')
    try {
      const r = await api.joinLiveRoom(roomId)
      setCanSpeak(r.role === 'teacher' || r.canSpeak)
      setCaps(r.capabilities)
      setLivekitToken(r.livekitToken)
      setMediaUrl(r.mediaUrl)
      setMediaEnabled(r.mediaEnabled)
      setJoined(true)
    } catch {
      setRoomError(tt('liveActionFailed'))
    } finally {
      setBusy(false)
    }
  }

  const handleLeave = async () => {
    try { await api.leaveLiveRoom(roomId) } catch { /* ignore */ }
    setJoined(false)
    setCanSpeak(false)
    setCaps({ canManage: false, canModerate: false, canRecord: false, canPublish: false })
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
          <Badge variant={room.status === 'live' ? 'danger' : room.status === 'scheduled' ? 'accent' : room.status === 'ending' ? 'warning' : 'default'}>
            {room.status === 'live' ? tt('liveStatusLive') : room.status === 'scheduled' ? tt('liveStatusScheduled') : room.status === 'ending' ? tt('liveStatusEnding') : tt('liveStatusEnded')}
          </Badge>
        }
      />
      {roomError && <p role="alert" className="mb-3 rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-600">{roomError}</p>}
      {room.status === 'scheduled' && !isRoomManager && (
        <p className="mb-3 text-sm text-pmuted">{tt('liveWaitForStart')}</p>
      )}
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
                      disabled={voice.micPending}
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
                    {caps.canManage && (
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
                ) : (
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
              {voice.micBlocked && !voice.micOn && (
                <p className="text-xs text-pdanger">
                  {voice.micError === 'nodevice' ? tt('liveMicNoDevice') : voice.micError === 'failed' ? tt('liveMicFailed') : tt('liveMicBlocked')}
                </p>
              )}
              {voice.speakers.length > 0 && (
                <p className="text-xs text-psuccess">{voice.speakers.slice(0, 3).join(', ')} {tt('liveSpeaking')}</p>
              )}
              {voice.audioBlocked && (
                <Button size="sm" onClick={() => void voice.unlockAudio()}>
                  {tt('liveEnableAudio')}
                </Button>
              )}
              {/* Diagnostika qatori — muammo qayerdaligini ko'rsatadi */}
              <p className="text-[11px] text-pmuted">
                {tt('liveDbgRemote')}: {voice.remoteCount} · {tt('liveDbgAudio')}: {voice.remoteAudioCount}{voice.connState ? ` · ${voice.connState}` : ''}{voice.localPub ? ` · pub:${voice.localPub}` : ''}
                {cloud ? ('error' in cloud ? ` · ${tt('liveCloudError')}` : ` · ${tt('liveDbgCloud')}: ${cloud.participants.map((p) => `…${p.identity.slice(-4)}:a${p.audioTracks}${p.audioMuted ? '(m)' : ''}`).join(' ')}`) : ''}
              </p>
              {voice.micOn && (
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-psurface" aria-hidden="true">
                  <div className="h-full rounded-full bg-psuccess" style={{ width: `${Math.round(voice.micLevel * 100)}%` }} />
                </div>
              )}
            </>
          ) : voice.state === 'failed' ? (
            <p className="text-sm text-pmuted">{tt('liveVideoSoon')}</p>
          ) : (
            <p className="text-sm text-pmuted">{tt('liveVoiceConnecting')}</p>
          )}
          {room.status === 'ended' && <p className="text-xs text-pmuted">{tt('liveEndedHint')}</p>}
          {room.status === 'ending' && <p className="text-xs text-pmuted">{tt('liveEndingHint')}</p>}
        </CardContent>
      </Card>

      {!joined ? (
        <Button block className="mt-3" loading={busy} disabled={room.status !== 'live' && !(room.status === 'scheduled' && isRoomManager)} onClick={handleJoin}>
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
          {caps.canManage && room.status !== 'ended' && (
            <>
              <TeacherControls roomId={roomId} status={room.status} scheduledAt={room.scheduledAt} onChanged={setRoom} recordingEnabled={recordingEnabled} recordingStatus={recordingStatus} onRecordingChanged={setRecordingStatus} />
              {room.status !== 'ending' && <HandsPanel
                roomId={roomId}
                hands={hands}
                onResolved={(targetUserId, approved) => {
                  setHands((prev) => prev.filter((h) => h.userId !== targetUserId))
                  if (approved) void api.listLiveParticipants(roomId).catch(() => {})
                }}
              />}
            </>
          )}
        </div>
      )}
    </div>
  )
}

function TeacherControls({ roomId, status, scheduledAt, onChanged, recordingEnabled, recordingStatus, onRecordingChanged }: {
  roomId: number; status: string; scheduledAt: string | null; onChanged: (r: LiveRoomPublic) => void; recordingEnabled: boolean; recordingStatus: 'starting' | 'started' | 'stopping' | null; onRecordingChanged: (status: 'starting' | 'started' | 'stopping' | null) => void
}) {
  const lang = useAppStore((s) => s.settings.language)
  const tt = useT(lang)
  const [busy, setBusy] = useState(false)
  const [nowMs, setNowMs] = useState(() => Date.now())
  const [error, setError] = useState('')
  const tooEarly = status === 'scheduled' && scheduledAt !== null && new Date(scheduledAt).getTime() > nowMs
  useEffect(() => {
    if (status !== 'scheduled' || !scheduledAt) return
    const timer = window.setInterval(() => setNowMs(Date.now()), 15_000)
    return () => window.clearInterval(timer)
  }, [status, scheduledAt])
  const [recBusy, setRecBusy] = useState(false)
  const toggleRecord = async () => {
    setRecBusy(true)
    setError('')
    try {
      if (recordingStatus === 'started') {
        await api.stopLiveRecording(roomId)
        onRecordingChanged('stopping')
      } else {
        await api.startLiveRecording(roomId)
        onRecordingChanged('started')
      }
    } catch { setError(tt('liveActionFailed')) } finally {
      setRecBusy(false)
    }
  }
  return (
    <div className="flex flex-wrap gap-2">
      {error && <p role="alert" className="w-full text-sm text-red-600">{error}</p>}
      {status === 'scheduled' && (
        <Button variant="secondary" loading={busy} disabled={tooEarly} onClick={async () => {
          setBusy(true); setError('')
          try { const r = await api.startLiveRoom(roomId); if (r.room) onChanged(r.room) }
          catch { setError(tt('liveActionFailed')) }
          finally { setBusy(false) }
        }}>
          {tt('liveStart')}
        </Button>
      )}
      {tooEarly && <p className="w-full text-xs text-pmuted">{tt('liveTooEarly')}</p>}
      {status !== 'ended' && (
        <Button variant="destructive" loading={busy} onClick={async () => {
          setBusy(true); setError('')
          try { const r = await api.endLiveRoom(roomId); if (r.room) onChanged(r.room) }
          catch { setError(tt('liveActionFailed')) }
          finally { setBusy(false) }
        }}>
          {status === 'ending' ? tt('liveRetryEnd') : tt('liveEnd')}
        </Button>
      )}
      {status === 'live' && recordingEnabled && (
        <Button variant="secondary" loading={recBusy} disabled={recordingStatus === 'starting' || recordingStatus === 'stopping'} onClick={toggleRecord}>
          {recordingStatus === 'started' ? tt('liveStopRecord') : tt('liveRecord')}
        </Button>
      )}
      {recordingStatus && recordingEnabled && <Badge variant={recordingStatus === 'stopping' ? 'warning' : 'danger'}>{recordingStatus === 'stopping' ? tt('liveRecordingStopping') : tt('liveRecording')}</Badge>}
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
  const revoke = async (targetUserId: string) => {
    setBusyId(targetUserId)
    try {
      await api.revokeLiveHand(roomId, targetUserId)
      onResolved(targetUserId, false)
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
              {h.status === 'approved' ? ' · ✓' : ''}
            </span>
            {h.status === 'pending' ? (
              <>
                <Button variant="secondary" size="sm" loading={busyId === h.userId} onClick={() => void decide(h.userId, true)}>
                  {tt('liveApprove')}
                </Button>
                <Button variant="ghost" size="sm" disabled={busyId === h.userId} onClick={() => void decide(h.userId, false)}>
                  {tt('liveReject')}
                </Button>
              </>
            ) : (
              <Button variant="ghost" size="sm" disabled={busyId === h.userId} onClick={() => void revoke(h.userId)}>
                {tt('liveRevoke')}
              </Button>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
