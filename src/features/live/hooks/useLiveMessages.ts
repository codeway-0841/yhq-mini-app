import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '@/shared/api'
import type { LiveMessagePublic } from '../../../../shared/live'

/**
 * Jonli chat: LiveKit signaliga darhol re-fetch, HTTP 5/30s fallback.
 * `after` cursor ketma-ket o'qilgan xabarlar bilan yuradi.
 */
export function useLiveMessages(roomId: number, joined: boolean, stopped: boolean, signalVersion = 0, realtime = false) {
  const [messages, setMessages] = useState<LiveMessagePublic[]>([])
  const [loading, setLoading] = useState(false)
  const afterRef = useRef(0)
  const epochRef = useRef(0)
  const inFlightEpochRef = useRef<number | null>(null)
  const stoppedRef = useRef(stopped)
  stoppedRef.current = stopped

  const load = useCallback(async () => {
    if (!joined || stoppedRef.current) return
    const epoch = epochRef.current
    if (inFlightEpochRef.current === epoch) return
    inFlightEpochRef.current = epoch
    try {
      const res = await api.listLiveMessages(roomId, afterRef.current, 50)
      if (epoch !== epochRef.current) return
      if (res.messages.length > 0) {
        afterRef.current = res.messages[res.messages.length - 1]!.id
        setMessages((prev) => {
          const byId = new Map(prev.map((message) => [message.id, message]))
          for (const message of res.messages) byId.set(message.id, message)
          return [...byId.values()].sort((a, b) => a.id - b.id)
        })
      }
    } catch {
      // polling best-effort — xato toast qilinmaydi
    } finally {
      if (inFlightEpochRef.current === epoch) inFlightEpochRef.current = null
    }
  }, [roomId, joined])

  useEffect(() => {
    if (!joined) return
    epochRef.current += 1
    afterRef.current = 0
    setMessages([])
    setLoading(true)
    void load().finally(() => setLoading(false))
    return () => { epochRef.current += 1 }
  }, [joined, roomId, load])

  useEffect(() => {
    if (!joined) return
    const t = setInterval(() => void load(), realtime ? 30_000 : 5_000)
    return () => clearInterval(t)
  }, [joined, roomId, load, realtime])

  useEffect(() => {
    if (signalVersion > 0) void load()
  }, [signalVersion, load])

  const send = useCallback(async (body: string) => {
    const res = await api.postLiveMessage(roomId, body)
    // Cursor FAQAT serverdan ketma-ket o'qilgan xabarlar bilan yuradi;
    // o'z xabarimiz cursor'ni oldinga sursa oradagi boshqa xabarlar yo'qoladi.
    setMessages((prev) => prev.some((m) => m.id === res.message.id)
      ? prev
      : [...prev, res.message].sort((a, b) => a.id - b.id))
    return res.message
  }, [roomId])

  return { messages, loading, reload: load, send }
}
