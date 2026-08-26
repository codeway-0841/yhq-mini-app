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
      <div className="mx-5 mb-6 rounded-container border border-pline bg-pcard p-4">
        <Skeleton className="mb-3 h-2.5 w-24" />
        <div className="flex items-center gap-3">
          <Skeleton className="size-12 shrink-0 rounded-[14px]" />
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
  const emoji = def?.emoji ?? '🐉'
  const BossIcon = getBossIcon(state.bossKey)
  const bossColor = def?.color ?? 'var(--p-purple)'
  
  // Zarar foizi va qolgan HP
  const damagePct = state.hpTotal > 0 ? Math.min(100, Math.round((state.totalDamage / state.hpTotal) * 100)) : 0
  const remainingHpPct = Math.max(0, 100 - damagePct)
  const isDefeated = state.status === 'defeated' || remainingHpPct === 0

  const daysLeft = daysLeftOf(state.periodKey)
  const statusBadge = isDefeated
    ? { text: tt('bossStatusDefeated'), color: 'var(--p-success)' }
    : { text: `${daysLeft} ${tt('bossDaysLeft')}`, color: 'var(--p-muted)' }

  return (
    <div className="mx-5 mb-6 overflow-hidden rounded-container border border-pline bg-pcard p-4 transition-all">
      {/* Sarlavha qatori */}
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-[0.14em] text-psubtle">
          <Swords size={13} strokeWidth={2} className="text-pprimary" />
          <span>{tt('bossTitle')}</span>
        </div>
        <span
          className={cn(
            'rounded-full px-2 py-0.5 text-[10.5px] font-bold tracking-tight',
            isDefeated ? 'bg-psuccess/15 text-psuccess' : 'bg-psurface text-pmuted'
          )}
          style={{ color: statusBadge.color }}
        >
          {statusBadge.text}
        </span>
      </div>

      {/* Asosiy Boss ma'lumoti */}
      <div className="flex items-center gap-3.5">
        {/* Boss Avatari (Emoji + Rangli Glowing Badge) */}
        <div
          className="relative flex size-12 shrink-0 items-center justify-center rounded-[14px] border text-[22px] shadow-sm transition-transform active:scale-95"
          style={{
            background: `color-mix(in srgb, ${bossColor} 14%, transparent)`,
            borderColor: `color-mix(in srgb, ${bossColor} 30%, transparent)`,
          }}
        >
          <span>{emoji}</span>
          <span
            className="absolute -bottom-1 -right-1 flex size-5 items-center justify-center rounded-full border border-pcard bg-pcard shadow-xs"
            style={{ color: bossColor }}
          >
            <BossIcon size={11} strokeWidth={2.2} />
          </span>
        </div>

        {/* Boss nomi & Jon (HP) ko'rsatkichi */}
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <p className="truncate text-[14px] font-bold tracking-tight text-pfg">{name}</p>
            <span className="shrink-0 text-[10px] font-semibold text-psubtle">
              {state.totalDamage.toLocaleString()} / {state.hpTotal.toLocaleString()} HP
            </span>
          </div>

          {/* HP Bar (Qolgan jon yoki jamoaviy zarar) */}
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-psurface">
            <div
              className="h-full rounded-full transition-[width] duration-[600ms] ease-out"
              style={{
                width: `${damagePct}%`,
                background: `linear-gradient(90deg, ${bossColor}, #fbbf24)`,
              }}
            />
          </div>

          <div className="mt-1.5 flex items-center justify-between gap-2">
            <span className="text-[10.5px] font-medium tabular-nums text-pmuted">
              {tt('bossHpShort')}: <strong className="font-bold text-pfg">{remainingHpPct}%</strong>
            </span>
            <span className="flex items-center gap-1 text-[10.5px] font-bold tabular-nums text-pprimary">
              <Flame size={12} className="text-pwarning" />
              <span>{tt('bossMyDamage')}: {state.myDamage}</span>
            </span>
          </div>
        </div>
      </div>

      {/* Top-3 zarba beruvchilar — ixcham micro-avatarlar */}
      {state.top.length > 0 && (
        <div className="mt-3 flex items-center justify-between border-t border-pline/70 pt-2.5">
          <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-psubtle">
            <Trophy size={11} className="text-pgold" /> {tt('bossTopHitters')}
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
            <span className="max-w-[110px] truncate text-[10px] font-medium text-pmuted">
              {state.top[0]?.firstName}{state.top.length > 1 ? ` +${state.top.length - 1}` : ''}
            </span>
          </div>
        </div>
      )}

      {/* G'alaba holati eslatmasi */}
      {isDefeated && (
        <div className="mt-3 rounded-control bg-psuccess/10 p-2.5 text-center motion-safe:animate-premiumIn">
          <p className="text-[11.5px] font-bold text-psuccess">
            {tt('bossDefeatedHint')}
          </p>
        </div>
      )}
    </div>
  )
}

export type { State as BossState }
