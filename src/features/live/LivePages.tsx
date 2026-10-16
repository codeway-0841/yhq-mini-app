import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { AlertCircle, CalendarClock, ChevronDown, Hand, Mic, MicOff, MonitorUp, Radio, RefreshCw, Send, Trash2, Users, Video, VideoOff } from 'lucide-react'
import { PageHeader } from '@/shared/components/ui/page-header'
import { Card, CardContent } from '@/shared/components/ui/card'
import { Badge } from '@/shared/components/ui/badge'
import { Button } from '@/shared/components/ui/button'
import { ConfirmDialog } from '@/shared/components/ui/dialog'
import { Skeleton } from '@/shared/components/ui/skeleton'
import { cn } from '@/shared/lib/cn'
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
  const [loadError, setLoadError] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [scheduledAt, setScheduledAt] = useState('')
  const [creating, setCreating] = useState(false)
  const [archiveTarget, setArchiveTarget] = useState<LiveRoomPublic | null>(null)
  const [archiving, setArchiving] = useState(false)
  const [error, setError] = useState('')
  const canCreate = user?.isAdmin === true || user?.isTeacher === true

  const loadPage = useCallback(async () => {
    setLoading(true)
    setLoadError(false)
    const [roomsResult, recordingsResult] = await Promise.allSettled([
      api.listLiveRooms({ limit: 20 }),
      api.listLiveRecordings(),
    ])
    if (roomsResult.status === 'fulfilled') {
      setRooms(roomsResult.value.rooms)
      setRecordingEnabled(roomsResult.value.recordingEnabled)
    } else {
      setRooms([])
      setLoadError(true)
    }
    if (recordingsResult.status === 'fulfilled') setRecordings(recordingsResult.value.recordings)
    setLoading(false)
  }, [])

  useEffect(() => {
    let alive = true
    void loadPage().catch(() => { if (alive) { setLoadError(true); setLoading(false) } })
    return () => { alive = false }
  }, [loadPage])

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
        <details className="group rounded-2xl bg-pcard shadow-xs">
          <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-4 text-sm font-semibold text-pfg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-pprimary [&::-webkit-details-marker]:hidden">
            <span className="inline-flex items-center gap-2"><Radio size={18} className="text-pprimary" />{tt('liveCreateTitle')}</span>
            <ChevronDown size={18} className="text-pmuted transition-transform group-open:rotate-180" aria-hidden="true" />
          </summary>
          <div className="border-t border-pline" />
          <div className="flex flex-col gap-3 p-4">
            <label className="flex flex-col gap-1.5 text-xs font-medium text-pmuted">
              {tt('liveTitleLabel')}
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') void handleCreate() }}
                placeholder={tt('liveCreatePlaceholder')}
                maxLength={120}
                className="h-11 min-w-0 rounded-2xl bg-psurface px-4 text-[15px] text-pfg outline-none placeholder:text-pmuted focus:ring-2 focus:ring-pprimary"
              />
            </label>
            <label className="flex flex-col gap-1.5 text-xs font-medium text-pmuted">
              {tt('liveDescriptionLabel')}
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={tt('liveDescriptionPlaceholder')}
                maxLength={500}
                rows={3}
                className="min-h-[88px] resize-y rounded-2xl bg-psurface px-4 py-3 text-[15px] text-pfg outline-none placeholder:text-pmuted focus:ring-2 focus:ring-pprimary"
              />
            </label>
            <label className="flex flex-col gap-1.5 text-xs font-medium text-pmuted">
              {tt('liveScheduleLabel')}
              <input
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                className="h-11 rounded-2xl bg-psurface px-4 text-[15px] text-pfg outline-none focus:ring-2 focus:ring-pprimary"
              />
            </label>
            <p className="text-xs leading-relaxed text-pmuted">{tt('liveScheduleHint')}</p>
            <Button block loading={creating} disabled={title.trim().length < 3} onClick={handleCreate}>
              {tt('liveCreateBtn')}
            </Button>
          </div>
        </details>
      )}
      <div className="flex flex-col gap-3 pt-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-pfg">{tt('liveRooms')}</h2>
          {!loading && <span className="text-xs tabular-nums text-pmuted">{rooms.length}</span>}
        </div>
        {loading && <LiveListSkeleton />}
        {!loading && loadError && (
          <Card><CardContent className="flex flex-col items-center gap-3 p-6 text-center">
            <span className="grid size-11 place-items-center rounded-2xl bg-[rgb(var(--p-danger-rgb)/0.10)] text-pdanger"><AlertCircle size={21} /></span>
            <div><p className="text-sm font-semibold text-pfg">{tt('liveLoadFailed')}</p><p className="mt-1 text-xs text-pmuted">{tt('liveLoadFailedHint')}</p></div>
            <Button variant="secondary" size="sm" onClick={() => void loadPage()}><RefreshCw size={15} />{tt('liveRetry')}</Button>
          </CardContent></Card>
        )}
        {!loading && !loadError && rooms.length === 0 && (
          <Card><CardContent className="flex flex-col items-center gap-2 p-7 text-center">
            <span className="grid size-12 place-items-center rounded-2xl bg-psurface text-pmuted"><CalendarClock size={22} /></span>
            <p className="text-sm font-semibold text-pfg">{tt('liveEmpty')}</p>
            <p className="max-w-xs text-xs leading-relaxed text-pmuted">{tt('liveEmptyHint')}</p>
          </CardContent></Card>
        )}
        {rooms.map((r) => (
          <Card key={r.id} className={cn(r.status === 'live' && 'border-[rgb(var(--p-danger-rgb)/0.35)]')}>
            <CardContent className="flex items-center gap-2 p-2">
              <button type="button" onClick={() => navigate(`/live/${r.id}`)} className="flex min-h-[64px] min-w-0 flex-1 items-center gap-3 rounded-xl px-2 text-left transition-colors hover:bg-psurface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pprimary">
                <span className={cn('grid size-11 shrink-0 place-items-center rounded-2xl bg-psurface text-pmuted', r.status === 'live' && 'bg-[rgb(var(--p-danger-rgb)/0.10)] text-pdanger')}>
                  <Radio size={20} className={cn(r.status === 'live' && 'motion-safe:animate-pulse')} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-semibold text-pfg">{r.title}</span>
                  <span className="mt-0.5 flex items-center gap-2 text-xs text-pmuted">
                    <Badge variant={r.status === 'live' ? 'danger' : r.status === 'scheduled' ? 'accent' : r.status === 'ending' ? 'warning' : 'default'}>
                      {r.status === 'live' ? tt('liveStatusLive') : r.status === 'scheduled' ? tt('liveStatusScheduled') : r.status === 'ending' ? tt('liveStatusEnding') : tt('liveStatusEnded')}
                    </Badge>
                    <span className="inline-flex items-center gap-1"><Users size={13} />{r.participantCount}</span>
                  </span>
                  {r.scheduledAt && <span className="mt-1 block text-xs text-pmuted">{formatLiveDate(r.scheduledAt, lang)}</span>}
                </span>
              </button>
              {(user?.isAdmin || user?.id === r.teacherId) && (
                <button
                  type="button"
                  aria-label={tt('liveArchive')}
                  title={r.status === 'live' || r.status === 'ending' ? tt('liveArchiveActive') : tt('liveArchive')}
                  disabled={r.status === 'live' || r.status === 'ending'}
                  onClick={() => setArchiveTarget(r)}
                  className="grid size-11 shrink-0 place-items-center rounded-xl text-pmuted transition-colors hover:bg-[rgb(var(--p-danger-rgb)/0.10)] hover:text-pdanger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pprimary disabled:opacity-40"
                ><Trash2 size={18} /></button>
              )}
            </CardContent>
          </Card>
        ))}
        {recordingEnabled && recordings.length > 0 && (
          <section className="flex flex-col gap-3 pt-3" aria-labelledby="live-recordings-heading">
            <div className="flex items-center justify-between"><h2 id="live-recordings-heading" className="text-sm font-semibold text-pfg">{tt('liveRecordings')}</h2><span className="text-xs tabular-nums text-pmuted">{recordings.length}</span></div>
            {recordings.map((rec) => (
              <Card key={rec.id}>
                <CardContent className="flex flex-col gap-3 p-3">
                  <div className="flex items-start justify-between gap-3 px-1">
                    <div className="min-w-0"><h3 className="truncate text-[15px] font-semibold text-pfg">{rec.roomTitle}</h3><p className="mt-0.5 text-xs text-pmuted">{[rec.teacherName, formatLiveDate(rec.createdAt, lang)].filter(Boolean).join(' · ')}</p></div>
                    <Badge variant="success">{tt('liveRecordingReady')}</Badge>
                  </div>
                  {rec.playbackUrl && (
                    <video controls playsInline preload="none" src={rec.playbackUrl} className="aspect-video w-full rounded-2xl bg-black" aria-label={`${rec.roomTitle} — ${tt('liveRecording')}`} />
                  )}
                </CardContent>
              </Card>
            ))}
          </section>
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

function formatLiveDate(value: string, lang: string) {
  return new Intl.DateTimeFormat(lang === 'ru' ? 'ru-RU' : 'uz-UZ', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  }).format(new Date(value))
}

function LiveListSkeleton() {
  return <div className="space-y-3" aria-label="Loading" aria-busy="true">{[0, 1, 2].map((item) => (
    <Card key={item}><CardContent className="flex items-center gap-3 p-4"><Skeleton className="size-11 shrink-0 rounded-2xl" /><div className="flex-1 space-y-2"><Skeleton className="h-4 w-2/3" /><Skeleton className="h-3 w-1/3" /></div></CardContent></Card>
  ))}</div>
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
  const [roomLoading, setRoomLoading] = useState(true)
  const [roomLoadError, setRoomLoadError] = useState(false)
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
  const [sending, setSending] = useState(false)
  const [interactionError, setInteractionError] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
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

  const loadRoom = useCallback(async () => {
    if (!Number.isInteger(roomId) || roomId <= 0) {
      setRoomLoadError(true)
      setRoomLoading(false)
      return
    }
    setRoomLoading(true)
    setRoomLoadError(false)
    try {
      const result = await api.getLiveRoom(roomId)
      setRoom(result.room)
      setRecordingEnabled(result.recordingEnabled)
      setRecordingStatus(result.recordingStatus)
    } catch {
      setRoom(null)
      setRoomLoadError(true)
    } finally {
      setRoomLoading(false)
    }
  }, [roomId])

  useEffect(() => {
    let alive = true
    void loadRoom().catch(() => { if (alive) { setRoomLoadError(true); setRoomLoading(false) } })
    return () => { alive = false }
  }, [loadRoom])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ block: 'nearest' })
  }, [messages])

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
    setInteractionError('')
    try {
      const r = await api.raiseLiveHand(roomId)
      setHandStatus(r.status)
      if (r.status === 'approved') setCanSpeak(true)
    } catch { setInteractionError(tt('liveHandFailed')) }
  }

  const handleLower = async () => {
    setInteractionError('')
    try { await api.lowerLiveHand(roomId); setHandStatus('none') }
    catch { setInteractionError(tt('liveHandFailed')) }
  }

  const handleSend = async () => {
    const body = draft.trim()
    if (!body || sending) return
    setSending(true)
    setInteractionError('')
    setDraft('')
    try { await send(body) }
    catch { setDraft(body); setInteractionError(tt('liveChatSendFailed')) }
    finally { setSending(false) }
  }

  if (roomLoading) {
    return (
      <div className="flex flex-1 flex-col px-4 pb-8">
        <PageHeader title={tt('liveTitle')} size="md" onBack={() => goBack(navigate)} />
        <div className="space-y-3" aria-busy="true"><Skeleton className="aspect-video w-full rounded-2xl" /><Skeleton className="h-11 w-full rounded-2xl" /><Skeleton className="h-40 w-full rounded-2xl" /></div>
      </div>
    )
  }

  if (!room || roomLoadError) return (
    <div className="flex flex-1 flex-col px-4 pb-8">
      <PageHeader title={tt('liveTitle')} size="md" onBack={() => goBack(navigate)} />
      <Card><CardContent className="flex flex-col items-center gap-3 p-7 text-center"><span className="grid size-12 place-items-center rounded-2xl bg-[rgb(var(--p-danger-rgb)/0.10)] text-pdanger"><AlertCircle size={22} /></span><div><p className="text-sm font-semibold text-pfg">{tt('liveRoomUnavailable')}</p><p className="mt-1 text-xs text-pmuted">{tt('liveLoadFailedHint')}</p></div><Button variant="secondary" onClick={() => void loadRoom()}><RefreshCw size={16} />{tt('liveRetry')}</Button></CardContent></Card>
    </div>
  )

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
      <div className="sr-only" aria-live="polite">{voice.state === 'connected' ? tt('liveConnected') : voice.state === 'failed' ? tt('liveConnectionFailed') : joined ? tt('liveVoiceConnecting') : ''}</div>
      {(roomError || interactionError) && <p role="alert" className="mb-3 rounded-xl bg-[rgb(var(--p-danger-rgb)/0.10)] px-4 py-3 text-sm text-pdanger">{roomError || interactionError}</p>}
      {room.status === 'scheduled' && !isRoomManager && (
        <div className="mb-3 flex items-start gap-3 rounded-2xl bg-psurface px-4 py-3"><CalendarClock size={18} className="mt-0.5 shrink-0 text-pprimary" /><div><p className="text-sm font-semibold text-pfg">{tt('liveStatusScheduled')}</p><p className="mt-0.5 text-xs leading-relaxed text-pmuted">{tt('liveWaitForStart')}</p>{room.scheduledAt && <p className="mt-1 text-xs font-medium text-pfg">{formatLiveDate(room.scheduledAt, lang)}</p>}</div></div>
      )}
      {/* Media paneli — LiveKit ovoz+kamera+screen (Faza 1c). Media o'chiq bo'lsa chat rejimi. */}
      <Card className="overflow-hidden border-black/10 bg-[#111827] text-white">
        <CardContent className="flex min-h-[220px] flex-col items-center justify-center gap-3 p-3 text-center sm:min-h-[300px]">
          {!joined || !mediaEnabled ? (
            <>
              <span className="grid size-14 place-items-center rounded-full bg-white/10"><Radio size={26} className={cn(room.status === 'live' ? 'text-red-400 motion-safe:animate-pulse' : 'text-white/60')} /></span>
              <div><p className="text-sm font-semibold text-white">{room.status === 'live' ? tt('liveBroadcastReady') : room.status === 'ended' ? tt('liveStatusEnded') : tt('liveWaitingRoom')}</p><p className="mt-1 max-w-sm text-xs leading-relaxed text-white/60">{room.status === 'ended' ? tt('liveEndedHint') : tt('liveMediaHint')}</p></div>
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
              <div className="flex flex-wrap items-center justify-center gap-2 rounded-2xl bg-black/30 p-2">
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
                      aria-label={voice.cameraOn ? tt('liveCameraOff') : tt('liveCameraOn')}
                      onClick={() => void voice.toggleCamera()}
                    >
                      {voice.cameraOn ? <Video size={18} /> : <VideoOff size={18} />}
                    </Button>
                    {caps.canManage && (
                      <Button
                        size="icon"
                        variant={voice.screenOn ? 'default' : 'secondary'}
                        aria-label={voice.screenOn ? tt('liveScreenOff') : tt('liveScreenOn')}
                        onClick={() => void voice.toggleScreen()}
                      >
                        <MonitorUp size={18} />
                      </Button>
                    )}
                  </>
                ) : (
                  handStatus === 'pending'
                    ? <Button variant="secondary" onClick={handleLower}><Hand size={16} />{tt('liveLowerHand')}</Button>
                    : <Button variant="secondary" onClick={handleRaise}><Hand size={16} />{tt('liveRaiseHand')}</Button>
                )}
              </div>
              <p className="text-xs text-white/65">
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
              {caps.canModerate && <details className="w-full rounded-xl bg-black/20 px-3 py-2 text-left"><summary className="cursor-pointer text-[11px] font-medium text-white/55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70">{tt('liveDiagnostics')}</summary><p className="mt-2 break-words text-[11px] text-white/55">{tt('liveDbgRemote')}: {voice.remoteCount} · {tt('liveDbgAudio')}: {voice.remoteAudioCount}{voice.connState ? ` · ${voice.connState}` : ''}{voice.localPub ? ` · pub:${voice.localPub}` : ''}{cloud ? ('error' in cloud ? ` · ${tt('liveCloudError')}` : ` · ${tt('liveDbgCloud')}: ${cloud.participants.map((p) => `…${p.identity.slice(-4)}:a${p.audioTracks}${p.audioMuted ? '(m)' : ''}`).join(' ')}`) : ''}</p></details>}
              {voice.micOn && (
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-psurface" aria-hidden="true">
                  <div className="h-full rounded-full bg-psuccess" style={{ width: `${Math.round(voice.micLevel * 100)}%` }} />
                </div>
              )}
            </>
          ) : voice.state === 'failed' ? (
            <div className="flex flex-col items-center gap-2"><AlertCircle size={24} className="text-red-400" /><p className="text-sm font-semibold text-white">{tt('liveConnectionFailed')}</p><p className="text-xs text-white/60">{tt('liveConnectionFailedHint')}</p></div>
          ) : (
            <div className="flex flex-col items-center gap-3"><span className="size-6 rounded-full border-2 border-white/30 border-t-white motion-safe:animate-spin" /><p className="text-sm text-white/70">{tt('liveVoiceConnecting')}</p></div>
          )}
          {room.status === 'ending' && <p className="text-xs text-amber-300">{tt('liveEndingHint')}</p>}
        </CardContent>
      </Card>

      {!joined ? (
        <div className="sticky bottom-[calc(0.75rem+var(--safe-bottom,0px))] z-20 mt-3 rounded-2xl bg-[rgb(var(--p-canvas-rgb)/0.90)] p-1 backdrop-blur-md"><Button block loading={busy} disabled={room.status !== 'live' && !(room.status === 'scheduled' && isRoomManager)} onClick={handleJoin}>
          {tt('liveJoin')}
        </Button></div>
      ) : (
        <div className="mt-3 flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <div><h2 className="text-sm font-semibold text-pfg">{tt('liveChat')}</h2><p className="mt-0.5 text-xs text-pmuted">{tt('liveChatHint')}</p></div>
            <Button variant="ghost" size="sm" onClick={handleLeave}>{tt('liveLeave')}</Button>
          </div>
          <div className="flex max-h-[42dvh] min-h-36 flex-col gap-2 overflow-y-auto rounded-2xl bg-pcard p-3 shadow-xs" aria-live="polite" aria-label={tt('liveChat')}>
            {messages.length === 0 && <p className="text-sm text-pmuted">{tt('liveChatEmpty')}</p>}
            {messages.map((m) => (
              <div key={m.id} className={cn('flex flex-col', m.userId === user?.id ? 'items-end' : 'items-start')}>
                <div className={cn('max-w-[88%] rounded-2xl px-3 py-2', m.userId === user?.id ? 'rounded-br-md bg-pprimary text-ponprimary' : 'rounded-bl-md bg-psurface text-pfg')}>
                  <div className={cn('flex items-center gap-1.5 text-[11px] font-semibold', m.userId === user?.id ? 'text-[rgb(var(--p-on-primary-rgb)/0.75)]' : 'text-pmuted')}><span className="truncate">{m.userName ?? m.userId}</span>{m.role === 'teacher' && <Badge variant="accent">{tt('liveTeacher')}</Badge>}<time className="font-normal tabular-nums" dateTime={m.createdAt}>{new Date(m.createdAt).toLocaleTimeString(lang === 'ru' ? 'ru-RU' : 'uz-UZ', { hour: '2-digit', minute: '2-digit' })}</time></div>
                  <div className="whitespace-pre-wrap break-words text-sm leading-relaxed">{m.body}</div>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
          <div className="flex items-end gap-2">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void handleSend() } }}
              placeholder={tt('liveChatPlaceholder')}
              maxLength={500}
              rows={1}
              aria-label={tt('liveChatPlaceholder')}
              className="max-h-28 min-h-11 min-w-0 flex-1 resize-y rounded-2xl bg-psurface px-4 py-3 text-[15px] leading-5 text-pfg outline-none placeholder:text-pmuted focus:ring-2 focus:ring-pprimary"
            />
            <Button size="icon" aria-label={tt('liveSend')} title={tt('liveSend')} loading={sending} onClick={handleSend} disabled={!draft.trim()}>
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
  const [confirmEnd, setConfirmEnd] = useState(false)
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
  const endRoom = async () => {
    setBusy(true); setError('')
    try { const result = await api.endLiveRoom(roomId); if (result.room) onChanged(result.room); setConfirmEnd(false) }
    catch { setError(tt('liveActionFailed')) }
    finally { setBusy(false) }
  }
  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-4">
      <div><h2 className="text-sm font-semibold text-pfg">{tt('liveTeacherControls')}</h2><p className="mt-0.5 text-xs text-pmuted">{tt('liveTeacherControlsHint')}</p></div>
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
        <Button variant="destructive" loading={busy} onClick={() => status === 'ending' ? void endRoom() : setConfirmEnd(true)}>
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
      </CardContent>
      <ConfirmDialog open={confirmEnd} title={tt('liveEndConfirmTitle')} description={tt('liveEndConfirmDescription')} confirmLabel={tt('liveEnd')} cancelLabel={tt('liveCancel')} destructive loading={busy} onConfirm={() => void endRoom()} onClose={() => { if (!busy) setConfirmEnd(false) }} />
    </Card>
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
  const [error, setError] = useState('')
  if (hands.length === 0) return null
  const decide = async (targetUserId: string, approve: boolean) => {
    setBusyId(targetUserId)
    setError('')
    try {
      if (approve) await api.approveLiveHand(roomId, targetUserId)
      else await api.rejectLiveHand(roomId, targetUserId)
      onResolved(targetUserId, approve)
    } catch { setError(tt('liveModerationFailed')) } finally {
      setBusyId(null)
    }
  }
  const revoke = async (targetUserId: string) => {
    setBusyId(targetUserId)
    setError('')
    try {
      await api.revokeLiveHand(roomId, targetUserId)
      onResolved(targetUserId, false)
    } catch { setError(tt('liveModerationFailed')) } finally {
      setBusyId(null)
    }
  }
  return (
    <Card>
      <CardContent className="flex flex-col gap-2 p-4">
        <span className="text-sm font-semibold text-pfg">{tt('liveHandsTitle')} ({hands.length})</span>
        {error && <p role="alert" className="text-xs text-pdanger">{error}</p>}
        {hands.map((h) => (
          <div key={h.userId} className="flex flex-wrap items-center gap-2 rounded-xl bg-psurface p-2">
            <span className="min-w-0 flex-1 truncate text-sm text-pfg">
              <Hand size={14} className="mr-1 inline text-pmuted" />{h.userName ?? h.userId}
              {h.status === 'approved' ? ` · ${tt('liveApproved')}` : ''}
            </span>
            {h.status === 'pending' ? (
              <>
                <Button variant="secondary" loading={busyId === h.userId} onClick={() => void decide(h.userId, true)}>
                  {tt('liveApprove')}
                </Button>
                <Button variant="ghost" disabled={busyId === h.userId} onClick={() => void decide(h.userId, false)}>
                  {tt('liveReject')}
                </Button>
              </>
            ) : (
              <Button variant="ghost" disabled={busyId === h.userId} onClick={() => void revoke(h.userId)}>
                {tt('liveRevoke')}
              </Button>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
