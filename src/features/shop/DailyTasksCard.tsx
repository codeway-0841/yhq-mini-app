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
import { Check, Coins, ClipboardCheck, Loader2 } from 'lucide-react'
import { useAppStore } from '../../shared/store/useAppStore'
import { api, ApiError, type CoinTaskState } from '../../shared/api'
import { DAILY_TASKS } from '../../../shared/daily-tasks'
import { playSound } from '../../shared/lib/sounds'
import { useT } from '../../shared/i18n'
import Confetti from '../../shared/components/Confetti'

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
  if (tasks === null) return error ? null : <div className="mx-5 mb-4 h-[88px] card-premium animate-pulse" />

  const visible = tasks.filter((t) => DAILY_TASKS.some((d) => d.id === t.id))
  if (visible.length === 0) return null

  return (
    <div className="mx-5 mb-4 card-premium p-4">
      {celebrate && <Confetti count={32} />}
      <p className="text-[10px] font-semibold text-psubtle uppercase tracking-[0.14em] flex items-center gap-1.5 mb-3">
        <ClipboardCheck size={11} /> {tt('dailyTasksTitle')}
      </p>
      <div className="flex flex-col gap-2.5">
        {visible.map((task) => {
          const def = DAILY_TASKS.find((d) => d.id === task.id)!
          const pct = Math.min(100, Math.round((task.progress / task.target) * 100))
          return (
            <div key={task.id} className="flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <p className="text-[12px] font-bold text-pfg truncate">{def.label[lang]}</p>
                  <span className="text-[10.5px] font-semibold text-psubtle flex-none">{task.progress}/{task.target}</span>
                </div>
                <div className="h-1.5 rounded-full bg-psurface overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${pct}%`,
                      background: task.completed ? 'var(--p-success)' : 'var(--p-primary)',
                    }}
                  />
                </div>
              </div>
              <div className="flex-none w-[74px]">
                {task.claimed ? (
                  <span className="flex items-center justify-center gap-1 text-[11px] font-black text-psuccess py-1.5">
                    <Check size={13} /> {tt('taskClaimed')}
                  </span>
                ) : task.completed ? (
                  <button
                    onClick={() => claim(task.id)}
                    disabled={busy !== null}
                    className="w-full flex items-center justify-center gap-1 text-[11px] font-black text-pgold py-1.5 rounded-xl active:scale-[0.96] transition-transform disabled:opacity-60"
                    style={{
                      background: 'rgb(var(--p-gold-rgb) / 0.16)',
                      border: '1px solid rgb(var(--p-gold-rgb) / 0.5)',
                      boxShadow: '0 0 14px rgb(var(--p-gold-rgb) / 0.25)',
                    }}>
                    {busy === task.id
                      ? <Loader2 size={12} className="animate-spin" />
                      : <><Coins size={11} fill="currentColor" /> {tt('taskClaim')} +{task.reward}</>}
                  </button>
                ) : (
                  <span className="flex items-center justify-center gap-1 text-[11px] font-bold text-psubtle py-1.5">
                    <Coins size={11} /> +{task.reward}
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
