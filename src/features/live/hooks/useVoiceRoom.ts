import { useCallback, useEffect, useRef, useState } from 'react'
import type {
  LocalVideoTrack,
  RemoteParticipant,
  RemoteTrack,
  RemoteTrackPublication,
  Room,
} from 'livekit-client'

export type MediaState = 'idle' | 'connecting' | 'connected' | 'failed'

export interface RemoteVideo {
  identity: string
  sid: string
  source: 'camera' | 'screen'
  track: RemoteTrack
}

interface MediaRoomArgs {
  mediaUrl: string | null
  livekitToken: string | null
  /** Gapirish ruxsati (teacher true; student approve'dan keyin true) */
  canSpeak: boolean
  /** Kamera/screen-share ham shu ruxsatga bog'langan */
  canPublishVideo: boolean
  enabled: boolean
}

/**
 * Media xona (LiveKit — ovoz + kamera + screen-share, Faza 1c).
 *
 * - `livekit-client` LAZY import (route chunk'da — entry bundle o'smaydi).
 * - Uzoq audio avtomatik attach (yashirin <audio>); video track'lar state'da —
 *   UI `VideoView` orqali attach qiladi.
 * - Mic/kamera/screen faqat ruxsat (canSpeak) bo'lsa yoqiladi; rad etilsa
 *   *Blocked flag (fallback: chat). Throw HECH QACHON tashlanmaydi.
 */
export function useMediaRoom({ mediaUrl, livekitToken, canSpeak, canPublishVideo, enabled }: MediaRoomArgs) {
  const [state, setState] = useState<MediaState>('idle')
  const [micOn, setMicOn] = useState(false)
  const [micBlocked, setMicBlocked] = useState(false)
  const [cameraOn, setCameraOn] = useState(false)
  const [cameraBlocked, setCameraBlocked] = useState(false)
  const [screenOn, setScreenOn] = useState(false)
  const [speakers, setSpeakers] = useState<string[]>([])
  const [videos, setVideos] = useState<RemoteVideo[]>([])
  const [localVideo, setLocalVideo] = useState<LocalVideoTrack | null>(null)
  const roomRef = useRef<Room | null>(null)
  const livekitRef = useRef<typeof import('livekit-client') | null>(null)
  const canSpeakRef = useRef(canSpeak)
  canSpeakRef.current = canSpeak
  const canVideoRef = useRef(canPublishVideo)
  canVideoRef.current = canPublishVideo

  const attachRemote = useCallback((room: Room) => {
    const Lk = livekitRef.current
    if (!Lk) return
    const audios = new Map<string, HTMLAudioElement>()
    const onSubscribed = (track: RemoteTrack, pub: RemoteTrackPublication, p: RemoteParticipant) => {
      if (track.kind === Lk.Track.Kind.Audio) {
        const el = document.createElement('audio')
        el.autoplay = true
        track.attach(el)
        audios.set(track.sid ?? '', el)
        return
      }
      if (track.kind === Lk.Track.Kind.Video) {
        const source = pub.source === Lk.Track.Source.ScreenShare ? 'screen' : 'camera'
        setVideos((prev) => {
          if (prev.some((v) => v.sid === (track.sid ?? ''))) return prev
          return [...prev, { identity: p.identity, sid: track.sid ?? '', source, track }]
        })
      }
    }
    const onUnsubscribed = (track: RemoteTrack) => {
      const sid = track.sid ?? ''
      const el = audios.get(sid)
      if (el) {
        track.detach(el)
        el.remove()
        audios.delete(sid)
      }
      setVideos((prev) => prev.filter((v) => v.sid !== sid))
    }
    room.on(Lk.RoomEvent.TrackSubscribed, onSubscribed)
    room.on(Lk.RoomEvent.TrackUnsubscribed, onUnsubscribed)
    room.on(Lk.RoomEvent.Disconnected, () => {
      for (const el of audios.values()) el.remove()
      audios.clear()
      setVideos([])
      setLocalVideo(null)
    })
    // Ulanish paytida allaqachon publish qilganlar (kech join)
    for (const p of room.remoteParticipants.values()) {
      for (const pub of p.trackPublications.values()) {
        const t = pub.track as RemoteTrack | undefined
        if (t && pub.isSubscribed) onSubscribed(t, pub as RemoteTrackPublication, p as RemoteParticipant)
      }
    }
  }, [])

  useEffect(() => {
    if (!enabled || !mediaUrl || !livekitToken) return
    let cancelled = false
    setState('connecting')
    setMicBlocked(false)
    setCameraBlocked(false)
    ;(async () => {
      try {
        const Lk = await import('livekit-client')
        if (cancelled) return
        livekitRef.current = Lk
        const room = new Lk.Room({
          adaptiveStream: true,
          dynacast: true,
          audioCaptureDefaults: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        })
        room.on(Lk.RoomEvent.ActiveSpeakersChanged, (list) => {
          setSpeakers(list.map((p) => p.identity))
        })
        room.on(Lk.RoomEvent.Disconnected, () => {
          if (!cancelled) {
            setState('idle')
            setMicOn(false)
            setCameraOn(false)
            setScreenOn(false)
          }
        })
        attachRemote(room)
        await room.connect(mediaUrl, livekitToken)
        if (cancelled) {
          await room.disconnect()
          return
        }
        roomRef.current = room
        setState('connected')
        if (canSpeakRef.current) {
          try {
            await room.localParticipant.setMicrophoneEnabled(true)
            if (!cancelled) setMicOn(true)
          } catch {
            if (!cancelled) setMicBlocked(true)
          }
        }
      } catch {
        if (!cancelled) setState('failed')
      }
    })()
    return () => {
      cancelled = true
      const r = roomRef.current
      roomRef.current = null
      setSpeakers([])
      setVideos([])
      setLocalVideo(null)
      setMicOn(false)
      setCameraOn(false)
      setScreenOn(false)
      if (r) void r.disconnect().catch(() => {})
    }
  }, [enabled, mediaUrl, livekitToken, attachRemote])

  // Approve jonli: canSpeak false->true bo'lsa mic yoqish
  useEffect(() => {
    const room = roomRef.current
    if (!room || state !== 'connected') return
    if (canSpeak && !micOn && !micBlocked) {
      room.localParticipant.setMicrophoneEnabled(true).then(() => setMicOn(true)).catch(() => setMicBlocked(true))
    } else if (!canSpeak && micOn) {
      room.localParticipant.setMicrophoneEnabled(false).then(() => setMicOn(false)).catch(() => {})
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canSpeak, state])

  const toggleMic = useCallback(async () => {
    const room = roomRef.current
    if (!room || state !== 'connected' || !canSpeakRef.current) return
    try {
      const next = !micOn
      await room.localParticipant.setMicrophoneEnabled(next)
      setMicOn(next)
      if (next) setMicBlocked(false)
    } catch {
      setMicBlocked(true)
    }
  }, [micOn, state])

  const toggleCamera = useCallback(async () => {
    const room = roomRef.current
    const Lk = livekitRef.current
    if (!room || !Lk || state !== 'connected' || !canVideoRef.current) return
    try {
      const next = !cameraOn
      await room.localParticipant.setCameraEnabled(next)
      setCameraOn(next)
      if (next) {
        setCameraBlocked(false)
        const pub = room.localParticipant.getTrackPublication(Lk.Track.Source.Camera)
        const vt = pub?.videoTrack as LocalVideoTrack | undefined
        setLocalVideo(vt ?? null)
      } else {
        setLocalVideo(null)
      }
    } catch {
      setCameraBlocked(true)
    }
  }, [cameraOn, state])

  const toggleScreen = useCallback(async () => {
    const room = roomRef.current
    if (!room || state !== 'connected' || !canVideoRef.current) return
    try {
      const next = !screenOn
      await room.localParticipant.setScreenShareEnabled(next)
      setScreenOn(next)
    } catch {
      // screen-share bekor qilinsa (user dialog'ni yopsa) — jim qolamiz
    }
  }, [screenOn, state])

  return { state, micOn, micBlocked, cameraOn, cameraBlocked, screenOn, speakers, videos, localVideo, toggleMic, toggleCamera, toggleScreen }
}

/** Eski nom — backward compat (yangi kod useMediaRoom ishlatsin). */
export const useVoiceRoom = useMediaRoom
export type VoiceState = MediaState
