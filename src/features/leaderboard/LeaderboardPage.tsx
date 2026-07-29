import { useEffect, useState } from 'react'
import { Trophy } from 'lucide-react'
import { useAppStore } from '../../shared/store/useAppStore'
import { useT } from '../../shared/i18n'

interface Entry {
  rank: number; userId: string; name: string
  score: number; streak: number; isYou: boolean
}

async function fetchLeaderboard(signal: AbortSignal): Promise<Entry[]> {
  const res = await fetch('/api/leaderboard?limit=50', { signal })
  if (!res.ok) throw new Error('leaderboard fetch failed')
  return res.json() as Promise<Entry[]>
}

function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-[#30363d] animate-pulse">
      <div className="w-6 h-4 bg-[#21262d] rounded" />
      <div className="w-8 h-8 rounded-full bg-[#21262d]" />
      <div className="flex-1 h-4 bg-[#21262d] rounded" />
      <div className="w-10 h-4 bg-[#21262d] rounded" />
    </div>
  )
}

function Medal({ rank }: { rank: number }) {
  if (rank === 1) return <span className="text-lg">🥇</span>
  if (rank === 2) return <span className="text-lg">🥈</span>
  if (rank === 3) return <span className="text-lg">🥉</span>
  return <span className="text-xs text-[#8b949e] w-6 text-center">{rank}</span>
}

function InitialAvatar({ name }: { name: string }) {
  return (
    <div className="w-8 h-8 rounded-full bg-[#1f6feb] flex items-center justify-center text-white text-xs font-black flex-shrink-0">
      {name[0]?.toUpperCase() ?? '?'}
    </div>
  )
}

export default function LeaderboardPage() {
  const { settings, user } = useAppStore()
  const tt = useT(settings.language)

  const [entries, setEntries] = useState<Entry[] | null>(null)
  const [error, setError]     = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 8_000)

    fetchLeaderboard(controller.signal)
      .then(setEntries)
      .catch((err: unknown) => {
        if ((err as Error)?.name !== 'AbortError') setError(true)
      })
      .finally(() => clearTimeout(timer))

    return () => controller.abort()
  }, [])

  const notInTop50 = entries !== null && user !== null && !entries.find((e) => e.isYou)

  return (
    <div className="pb-24">
      <div className="flex items-center gap-2 px-4 pt-4 pb-3 border-b border-[#30363d]">
        <Trophy size={20} className="text-yellow-400" />
        <h1 className="text-lg font-black">{tt('leaderboard')}</h1>
      </div>

      {error && (
        <p className="text-center text-[#8b949e] text-sm py-16">{tt('leaderboardError')}</p>
      )}

      {!entries && !error && Array.from({ length: 10 }, (_, i) => <SkeletonRow key={i} />)}

      {entries && (
        <div>
          {entries.map((entry) => (
            <div key={entry.userId}
              className={`flex items-center gap-3 px-4 py-3 border-b border-[#30363d] ${entry.isYou ? 'bg-[#1f6feb]/10' : ''}`}>
              <div className="w-8 flex items-center justify-center flex-shrink-0">
                <Medal rank={entry.rank} />
              </div>
              <InitialAvatar name={entry.name} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">
                  {entry.name}
                  {entry.isYou && (
                    <span className="ml-1.5 text-[10px] text-[#1f6feb] font-bold">{tt('youLabel')}</span>
                  )}
                </p>
                {entry.streak > 0 && (
                  <p className="text-[11px] text-orange-400">🔥 {entry.streak} {tt('streakCol')}</p>
                )}
              </div>
              <span className="text-sm font-bold text-green-400">{entry.score}</span>
            </div>
          ))}
        </div>
      )}

      {notInTop50 && user && (
        <div className="mx-4 mt-4 bg-[#161b22] border border-[#30363d] rounded-2xl px-4 py-3">
          <p className="text-xs text-[#8b949e] mb-2">{tt('yourRank')}</p>
          <div className="flex items-center gap-3">
            <InitialAvatar name={user.firstName} />
            <span className="flex-1 text-sm font-semibold">{user.firstName}</span>
            <span className="text-xs text-[#8b949e]">{tt('notInTop50')}</span>
          </div>
        </div>
      )}
    </div>
  )
}
