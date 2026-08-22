/**
 * Duel (Oktagon) o'yinlar tarixi — lokal xotirada saqlanadi ('yhq-duel-history').
 */

export interface DuelHistoryRecord {
  id: string
  opponentName: string
  opponentAvatar?: string | null
  yourScore: number
  oppScore: number
  result: 'win' | 'lose' | 'draw'
  timestamp: number
}

const STORAGE_KEY = 'yhq-duel-history'
const MAX_HISTORY = 30

export function getDuelHistory(): DuelHistoryRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function recordDuelMatch(record: Omit<DuelHistoryRecord, 'id' | 'timestamp'>): void {
  try {
    const history = getDuelHistory()
    const item: DuelHistoryRecord = {
      ...record,
      id: `match-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: Date.now(),
    }
    const updated = [item, ...history].slice(0, MAX_HISTORY)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
  } catch {
    // Ignore storage quota
  }
}
