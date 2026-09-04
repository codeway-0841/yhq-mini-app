/**
 * Boss Battle — Dashboard kartasi (haftalik jamoaviy jang).
 *
 * Faqat O'QISH (GET /boss/state): zarar progress /result orqali server'da
 * qo'llanadi (client yozmaydi).
 */
import { useEffect, useState } from 'react'
import { Swords, Trophy, Flame } from 'lucide-react'
import { api, avatarSrcFor } from '../../shared/api'
import { getBossDef, bossPeriodEndDate } from '../../../shared/boss-battle'
import { useAppStore } from '../../shared/store/useAppStore'
import { useT } from '../../shared/i18n'
import { getBossIcon } from './boss-icons'
import { Skeleton } from '../../shared/components/ui/skeleton'
import { bossCache, fetchBossState } from '../../shared/lib/dashboard-cache'
import { cn } from '../../shared/lib/cn'

type State = Awaited<ReturnType<typeof api.getBossState>>

/** Hafta oxirigacha qolgan KUNLAR (Tashkent dushanbasi + 7) */
function daysLeftOf(periodKey: string): number {
  const end = bossPeriodEndDate(periodKey)
  return Math.max(0, Math.ceil((end.getTime() - Date.now()) / 86_400_000))
}

/** Keshdagi holat HALI SHU HAFTAGA tegishlimi? Boss davri dushanba kuni
 *  almashadi — kechagi nusxa yangi hafta boshida boshqa bossni ko'rsatardi. */
function usableCachedState(): State | null {
  const cached = bossCache.peek()
  if (!cached) return null
  return daysLeftOf(cached.periodKey) > 0 ? cached : null
}

export default function BossCard() {
  const lang     = useAppStore((s) => s.settings.language)
  const tt       = useT(lang)
  const [state, setState] = useState<State | null>(usableCachedState)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let alive = true
    fetchBossState()
      .then((s) => { if (alive) setState(s) })
      .catch(() => { if (alive) setFailed(true) })
    return () => { alive = false }
  }, [])

  // Offline/xato — Dashboard'ni sindirmaydi. Lekin keshdagi holat BOR bo'lsa
  // uni ko'rsatamiz: kartani yashirish o'rniga eski ma'lumot foydaliroq.
  if (failed && !state) return null
  if (!state) {
    return (
      <div className="mx-5 mb-6 rounded-2xl bg-pcard p-4 shadow-xs">
        <Skeleton className="mb-3 h-2.5 w-24" />
        <div className="flex items-center gap-3">
          <Skeleton className="size-12 shrink-0 rounded-2xl" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3 w-32" />
            <Skeleton className="h-[4px] w-full" />
          </div>
        </div>
      </div>
    )
  }

  const def = getBossDef(state.bossKey)
  const name = def?.name[lang] ?? 'Boss'
  const BossIcon = getBossIcon(state.bossKey)
  
  // Zarar foizi va qolgan HP
  const remainingHp = Math.max(0, state.hpTotal - state.totalDamage)
  const remainingHpPct = state.hpTotal > 0 ? (remainingHp / state.hpTotal) * 100 : 0
  const isDefeated = state.status === 'defeated' || (state.hpTotal > 0 && remainingHp === 0)

  const daysLeft = daysLeftOf(state.periodKey)
  const statusBadge = isDefeated
    ? { text: tt('bossStatusDefeated'), color: 'var(--p-success)' }
    : { text: `${daysLeft} ${tt('bossDaysLeft')}`, color: 'var(--p-muted)' }

  return (
    <div className="mx-4 mb-5 overflow-hidden rounded-2xl bg-pcard p-4 transition-all shadow-xs">
      {/* Sarlavha qatori */}
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-[0.14em] text-psubtle">
          <Swords size={14} strokeWidth={1.75} className="text-pmuted" />
          <span>{tt('bossTitle')}</span>
        </div>
        <span
          className={cn(
            'rounded-full px-2 py-0.5 text-[12px] font-bold tracking-tight',
            isDefeated ? 'bg-psuccess/15 text-psuccess' : 'bg-psurface text-pmuted'
          )}
          style={{ color: statusBadge.color }}
        >
          {statusBadge.text}
        </span>
      </div>

      {/* Asosiy Boss ma'lumoti */}
      <div className="flex items-center gap-3.5">
        {/* Boss Ikonkasi */}
        <div className="flex size-11 shrink-0 items-center justify-center">
          <BossIcon size={38} className="text-pmuted" />
        </div>

        {/* Boss nomi & Jon (HP) ko'rsatkichi */}
        <div className="min-w-0 flex-1">
          <p className="text-[16px] font-bold tracking-tight text-pfg">{name}</p>
          <p className="mt-1 text-[12px] font-medium tabular-nums text-pmuted">
            {tt('bossTeamDamage')}: <strong className="text-pfg">{state.totalDamage.toLocaleString()}</strong>
          </p>

          {/* Qolgan HP: raqam va progress bar bir xil miqdorni ko‘rsatadi. */}
          <div role="progressbar" aria-label={tt('bossRemainingHp')} aria-valuemin={0} aria-valuemax={state.hpTotal} aria-valuenow={remainingHp}
            className="mt-2 h-2 w-full overflow-hidden rounded-full bg-psurface">
            <div
              className="h-full rounded-full bg-pprimary transition-[width] duration-700 ease-out"
              style={{
                width: `${remainingHpPct}%`,
              }}
            />
          </div>

          <div className="mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
            <span className="text-[12px] font-medium tabular-nums text-pmuted">
              {tt('bossRemainingHp')}: <strong className="font-bold text-pfg">{remainingHp.toLocaleString()} / {state.hpTotal.toLocaleString()}</strong>
            </span>
            <span className="flex items-center gap-1 text-[12px] font-bold tabular-nums text-pfg">
              <Flame size={12} strokeWidth={1.75} className="text-pmuted" />
              <span>{tt('bossMyDamage')}: {state.myDamage}</span>
            </span>
          </div>
        </div>
      </div>

      {/* Top-3 zarba beruvchilar — ixcham micro-avatarlar */}
      {state.top.length > 0 && (
        <div className="mt-3 flex items-center justify-between border-t border-pline pt-2.5">
          <span className="flex items-center gap-1 text-[12px] font-bold uppercase tracking-wide text-psubtle">
            <Trophy size={11} strokeWidth={1.75} className="text-pmuted" /> {tt('bossTopHitters')}
          </span>
          <div className="flex items-center gap-2">
            <div className="flex items-center -space-x-1.5">
              {state.top.map((u, idx) => {
                const src = avatarSrcFor({ id: u.userId, photoUrl: u.photoUrl, hasCustomAvatar: u.hasCustomAvatar })
                const medalBorder = idx === 0 ? 'border-yellow-400' : idx === 1 ? 'border-slate-300' : 'border-amber-600'
                return (
                  <span
                    key={u.userId}
                    className={cn(
                      'relative flex size-6 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 bg-psurface text-[9px] font-bold text-pmuted shadow-xs',
                      medalBorder
                    )}
                    style={{ width: 24, height: 24, minWidth: 24, minHeight: 24 }}
                    title={`${u.firstName} — ${u.damage}`}
                  >
                    {src ? (
                      <img src={src} alt="" className="size-full object-cover block" style={{ width: '100%', height: '100%' }} />
                    ) : (
                      u.firstName?.[0]?.toUpperCase() ?? '?'
                    )}
                  </span>
                )
              })}
            </div>
            <span className="max-w-[110px] truncate text-[12px] font-medium text-pmuted">
              {state.top[0]?.firstName}{state.top.length > 1 ? ` +${state.top.length - 1}` : ''}
            </span>
          </div>
        </div>
      )}

      {/* G'alaba holati eslatmasi */}
      {isDefeated && (
        <div className="mt-3 rounded-2xl bg-psuccess/10 p-3 text-center shadow-xs motion-safe:animate-premiumIn">
          <p className="text-[13px] font-bold text-psuccess">
            {tt('bossDefeatedHint')}
          </p>
        </div>
      )}
    </div>
  )
}

export type { State as BossState }
