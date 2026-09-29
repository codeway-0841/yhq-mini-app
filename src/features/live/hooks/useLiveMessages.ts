import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '@/shared/api'
import type { LiveMessagePublic } from '../../../../shared/live'

/**
 * Jonli chat polling — 5s interval, `after` cursor bilan.
 * Unmount'da interval tozalanadi; xona ended bo'lsa polling to'xtaydi.
 */
export function useLiveMessages(roomId: number, joined: boolean, stopped: boolean) {
  const [messages, setMessages] = useState<LiveMessagePublic[]>([])
  const [loading, setLoading] = useState(false)
  const afterRef = useRef(0)
  const stoppedRef = useRef(stopped)
  stoppedRef.current = stopped

  const load = useCallback(async () => {
    if (!joined || stoppedRef.current) return
    try {
      const res = await api.listLiveMessages(roomId, afterRef.current, 50)
      if (res.messages.length > 0) {
        afterRef.current = res.messages[res.messages.length - 1]!.id
        setMessages((prev) => [...prev, ...res.messages])
      }
    } catch {
      // polling best-effort — xato toast qilinmaydi
    }
  }, [roomId, joined])

  useEffect(() => {
    if (!joined) return
    afterRef.current = 0
    setMessages([])
    setLoading(true)
    void load().finally(() => setLoading(false))
    const t = setInterval(() => void load(), 5000)
    return () => clearInterval(t)
  }, [joined, roomId, load])

  const send = useCallback(async (body: string) => {
    const res = await api.postLiveMessage(roomId, body)
    afterRef.current = Math.max(afterRef.current, res.message.id)
    setMessages((prev) => [...prev, res.message])
    return res.message
  }, [roomId])

  return { messages, loading, reload: load, send }
}
