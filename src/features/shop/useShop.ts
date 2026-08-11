import { useState, useEffect, useCallback, useRef } from 'react'
import { api } from '../../shared/api'
import type { ShopItem, ShopTaskProgress, ShopDailyStatus, ShopTask } from '../../shared/api'
import { useAppStore } from '../../shared/store/useAppStore'

function tashkentDate(): string {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Tashkent' })
}

interface ShopState {
  loading: boolean
  error: string | null
  balance: number
  purchases: Set<string>
  dailyStatus: ShopDailyStatus
  tasks: ShopTask[]
  taskProgress: ShopTaskProgress[]
  avatars: ShopItem[]
  merch: ShopItem[]
  badges: ShopItem[]
}

const DEFAULT_DAILY: ShopDailyStatus = { claimed: false, streak: 0, lastClaimDate: null }

export function useShop() {
  const userId = useAppStore((s) => s.user?.id)
  const userIdRef = useRef(userId)
  userIdRef.current = userId

  const [state, setState] = useState<ShopState>({
    loading: true,
    error: null,
    balance: 0,
    purchases: new Set(),
    dailyStatus: DEFAULT_DAILY,
    tasks: [],
    taskProgress: [],
    avatars: [],
    merch: [],
    badges: [],
  })

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    const uid = userId

    async function load() {
      try {
        const [overview, avatarRes, merchRes, badgeRes] = await Promise.all([
          api.getShopOverview(uid),
          api.getShopItems('avatar'),
          api.getShopItems('merch'),
          api.getShopItems('badge'),
        ])

        if (cancelled) return
        setState({
          loading: false,
          error: null,
          balance: overview.balance,
          purchases: new Set(overview.purchases),
          dailyStatus: overview.dailyStatus,
          tasks: overview.tasks,
          taskProgress: overview.taskProgress,
          avatars: avatarRes.items,
          merch: merchRes.items,
          badges: badgeRes.items,
        })
      } catch (e) {
        if (!cancelled) {
          setState((s) => ({
            ...s,
            loading: false,
            error: e instanceof Error ? e.message : 'Failed to load shop',
          }))
        }
      }
    }

    load()
    return () => { cancelled = true }
  }, [userId])

  const purchase = useCallback(async (itemId: string): Promise<boolean> => {
    const uid = userIdRef.current
    if (!uid) return false
    try {
      const { newBalance } = await api.purchaseShopItem(uid, itemId)
      setState((s) => ({
        ...s,
        balance: newBalance,
        purchases: new Set([...s.purchases, itemId]),
      }))
      return true
    } catch (e) {
      setState((s) => ({ ...s, error: e instanceof Error ? e.message : 'Purchase failed' }))
      return false
    }
  }, [])

  const claimDaily = useCallback(async (): Promise<{ tokens: number; streak: number } | null> => {
    const uid = userIdRef.current
    if (!uid) return null
    try {
      const result = await api.claimDailyReward(uid)
      setState((s) => ({
        ...s,
        balance: result.newBalance,
        dailyStatus: { claimed: true, streak: result.streak, lastClaimDate: tashkentDate() },
      }))
      return { tokens: result.tokens, streak: result.streak }
    } catch (e) {
      setState((s) => ({ ...s, error: e instanceof Error ? e.message : 'Claim failed' }))
      return null
    }
  }, [])

  return { ...state, purchase, claimDaily }
}
