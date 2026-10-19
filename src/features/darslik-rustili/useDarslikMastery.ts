import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from '../../shared/api'
import { darslikTopicId } from '../../../shared/darslik-mastery'
import { useAppStore } from '../../shared/store/useAppStore'
import { useLessonsStore } from '../../shared/store/useLessonsStore'
import { DARSLIK_BLOCKS, DARSLIK_PROGRESS_MODULE_OFFSET, getBlockOutline } from '../../content/darslik-rustili'

export interface DarslikMastery {
  /** Server tasdiqlagan o'tilgan mavzular ('block:section'). */
  passed: ReadonlySet<string>
  loading: boolean
  /** Progress API mavjud emas — lokal cache bilan ishlayapmiz. */
  error: boolean
  /** Server progressini qayta yuklash. */
  refresh: () => void
  /** Server test natijasidan keyin lokal cache'ni darhol yangilash. */
  markPassed: (topicId: string) => void
}

/**
 * Rus tili darsligi mastery holati.
 *
 * Manba — server (/darslik/progress): testdan o'tilgan mavzular faqat serverda
 * saqlanadi. API vaqtincha ishlamasa, lokal cache (eski progress) bilan
 * ko'rsatiladi — o'qish davom etadi, lekin yangi test server talab qiladi.
 */
export function useDarslikMastery(): DarslikMastery {
  const userId = useAppStore((state) => state.user?.id) ?? '0'
  const byUser = useLessonsStore((state) => state.byUser)
  const markDone = useLessonsStore((state) => state.markDone)
  const [serverPassed, setServerPassed] = useState<Set<string> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [reloadToken, setReloadToken] = useState(0)

  const localPassed = useMemo(() => {
    const passed = new Set<string>()
    if (!userId || userId === '0') return passed
    const map = byUser[userId]
    if (!map) return passed
    for (const block of DARSLIK_BLOCKS) {
      const done = map[DARSLIK_PROGRESS_MODULE_OFFSET + block.id] ?? []
      const total = getBlockOutline(block.id).length
      for (const idx of done) {
        if (Number.isInteger(idx) && idx >= 0 && idx < total) {
          passed.add(darslikTopicId(block.id, idx))
        }
      }
    }
    return passed
  }, [byUser, userId])

  useEffect(() => {
    if (!userId || userId === '0') {
      setServerPassed(null)
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    setError(false)
    api.getDarslikProgress()
      .then((result) => {
        if (cancelled) return
        setServerPassed(new Set(result.passed))
        setError(false)
      })
      .catch(() => {
        if (!cancelled) setError(true)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [userId, reloadToken])

  const passed = serverPassed ?? localPassed

  const markPassed = useCallback((topicId: string) => {
    setServerPassed((previous) => {
      const next = new Set(previous ?? passed)
      next.add(topicId)
      return next
    })
    const [blockId, sectionIdx] = topicId.split(':').map(Number)
    if (userId && userId !== '0' && Number.isInteger(blockId) && Number.isInteger(sectionIdx)) {
      markDone(userId, DARSLIK_PROGRESS_MODULE_OFFSET + blockId, sectionIdx)
    }
  }, [markDone, passed, userId])

  const refresh = useCallback(() => setReloadToken((token) => token + 1), [])

  return { passed, loading, error, refresh, markPassed }
}
