/**
 * Kunlik vazifalar kartasi (#40 Faza 2) — Dashboard'ga montajlanadi.
 *
 * Ma'lumot: GET /coins/tasks (server aggregate daily_records'dan — client
 * raqamlariga ishonilmaydi). Har bir vazifa: label (config'dan, UZ/RU),
 * progress-bar (progress/target), mukofot chip'i, holat:
 *   - jarayonda      → progress bar
 *   - bajarilgan     → "Olish" CTA (glow)
 *   - claim qilingan → ✓ Olindi
 * Claim: api.claimCoinTask → store balansi SERVER javobidan.
 */
import { useCallback, useEffect, useState } from 'react'
import { Check, Coins, ClipboardCheck } from 'lucide-react'
import { useAppStore } from '../../shared/store/useAppStore'
import { api, ApiError, type CoinTaskState } from '../../shared/api'
import { DAILY_TASKS } from '../../../shared/daily-tasks'
import { playSound } from '../../shared/lib/sounds'
import { useT } from '../../shared/i18n'
import Confetti from '../../shared/components/Confetti'
import { Skeleton } from '../../shared/components/ui/skeleton'
import { cn } from '../../shared/lib/cn'

export default function DailyTasksCard() {
  const lang     = useAppStore((s) => s.settings.language)
  const tt       = useT(lang)
  const setCoins = useAppStore((s) => s.setCoins)

  const [tasks, setTasks]     = useState<CoinTaskState[] | null>(null)
  const [busy, setBusy]       = useState<string | null>(null)
  const [error, setError]     = useState(false)
  const [celebrate, setCelebrate] = useState(false)

  const load = useCallback(() => {
    api.getCoinTasks()
      .then((r) => { setTasks(r.tasks); setError(false) })
      .catch(() => setError(true))
  }, [])

  useEffect(load, [load])

  const claim = async (taskId: string) => {
    if (busy) return
    setBusy(taskId)
    try {
      const res = await api.claimCoinTask(taskId)
      setCoins(res.balance)
      playSound('win')
      setCelebrate(true)
      window.setTimeout(() => setCelebrate(false), 3200)
      load()
    } catch (err) {
      // TASK_NOT_COMPLETED / TASK_ALREADY_CLAIMED — holatni yangilab ko'rsatamiz
      if (err instanceof ApiError && (err.code === 'TASK_NOT_COMPLETED' || err.code === 'TASK_ALREADY_CLAIMED')) {
        load()
      }
    } finally {
      setBusy(null)
    }
  }

  // Yuklanmoqda/xato — sahifa paypoqni buzmaslik uchun ixcham qaytamiz
  if (tasks === null) {
    return error ? null : (
      <div className="mx-5 mb-6 rounded-container border border-pline bg-pcard p-4">
        <Skeleton className="mb-3 h-2.5 w-28" />
        <div className="space-y-3">
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-4/5" />
        </div>
      </div>
    )
  }

  const visible = tasks.filter((t) => DAILY_TASKS.some((d) => d.id === t.id))
  if (visible.length === 0) return null

  return (
    <div className="mx-5 mb-6 rounded-container border border-pline bg-pcard p-4">
      {celebrate && <Confetti count={32} />}
      <p className="mb-3 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-psubtle">
        <ClipboardCheck size={11} strokeWidth={1.75} /> {tt('dailyTasksTitle')}
      </p>
      <div className="flex flex-col gap-2.5">
        {visible.map((task) => {
          const def = DAILY_TASKS.find((d) => d.id === task.id)!
          const pct = Math.min(100, Math.round((task.progress / task.target) * 100))
          return (
            <div key={task.id} className="flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <p className="truncate text-[12px] font-semibold text-pfg">{def.label[lang]}</p>
                  <span className="flex-none text-[10.5px] font-semibold tabular-nums text-psubtle">{task.progress}/{task.target}</span>
                </div>
                <div className="h-[3px] overflow-hidden rounded-[2px] bg-plineStrong">
                  <div
                    className="h-full rounded-[2px] transition-[width] duration-[400ms] ease-out"
                    style={{
                      width: `${pct}%`,
                      background: task.completed ? 'var(--p-success)' : 'var(--p-primary)',
                    }}
                  />
                </div>
              </div>
              <div className="flex-none w-[74px]">
                {task.claimed ? (
                  <span className="flex items-center justify-center gap-1 py-1.5 text-[11px] font-semibold text-psuccess">
                    <Check size={13} strokeWidth={1.75} /> {tt('taskClaimed')}
                  </span>
                ) : task.completed ? (
                  <button
                    onClick={() => claim(task.id)}
                    disabled={busy !== null}
                    className={cn(
                      'flex h-[34px] w-full items-center justify-center gap-1 rounded-control text-[11px] font-semibold text-pgold',
                      'border border-[rgb(var(--p-gold-rgb)/0.35)] bg-[rgb(var(--p-gold-rgb)/0.12)]',
                      'transition-transform duration-[120ms] ease-out active:scale-[0.98]',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pprimary',
                      'disabled:pointer-events-none disabled:opacity-40',
                    )}>
                    {busy === task.id
                      ? <span aria-hidden="true" className="size-3 rounded-full border-2 border-current border-t-transparent motion-safe:animate-spin" />
                      : <><Coins size={11} strokeWidth={1.75} /> {tt('taskClaim')} +{task.reward}</>}
                  </button>
                ) : (
                  <span className="flex items-center justify-center gap-1 py-1.5 text-[11px] font-medium tabular-nums text-psubtle">
                    <Coins size={11} strokeWidth={1.75} /> +{task.reward}
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
