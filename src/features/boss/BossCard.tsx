/**
 * Boss Battle — Dashboard kartasi (haftalik jamoaviy jang).
 *
 * Faqat O'QISH (GET /boss/state): zarar progress /result orqali server'da
 * qo'llanadi (client yozmaydi). HP foizi totalDamage asosida ko'rsatiladi
 * (hpTotal-hpLeft clamp overflow'ni yashirishi mumkin — adolatli vizual).
 */
import { useEffect, useState } from 'react'
import { Swords } from 'lucide-react'
import { api, avatarSrcFor } from '../../shared/api'
import { getBossDef, bossPeriodEndDate } from '../../../shared/boss-battle'
import { useAppStore } from '../../shared/store/useAppStore'
import { useT } from '../../shared/i18n'
import { getBossIcon } from './boss-icons'
import { Skeleton } from '../../shared/components/ui/skeleton'
import { cn } from '../../shared/lib/cn'

type State = Awaited<ReturnType<typeof api.getBossState>>

/** Hafta oxirigacha qolgan KUNLAR (Tashkent dushanbasi + 7) */
function daysLeftOf(periodKey: string): number {
  const end = bossPeriodEndDate(periodKey)
  return Math.max(0, Math.ceil((end.getTime() - Date.now()) / 86_400_000))
}

export default function BossCard() {
  const lang     = useAppStore((s) => s.settings.language)
  const tt       = useT(lang)
  const [state, setState] = useState<State | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let alive = true
    api.getBossState()
      .then((s) => { if (alive) setState(s) })
      .catch(() => { if (alive) setFailed(true) })
    return () => { alive = false }
  }, [])

  if (failed) return null    // offline/xato — Dashboard'ni sindirmaydi
  if (!state) {
    return (
      <div className="mx-5 mb-6 rounded-container border border-pline bg-pcard p-4">
        <Skeleton className="mb-3 h-2.5 w-24" />
        <div className="flex items-center gap-3">
          <Skeleton className="size-12 shrink-0 rounded-[14px]" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3 w-32" />
            <Skeleton className="h-[3px] w-full" />
          </div>
        </div>
      </div>
    )
  }

  const def = getBossDef(state.bossKey)
  const name = def?.name[lang] ?? 'Boss'
  const BossIcon = getBossIcon(state.bossKey)
  const bossColor = def?.color ?? 'var(--p-purple)'
  const pct = state.hpTotal > 0 ? Math.min(100, Math.round((state.totalDamage / state.hpTotal) * 100)) : 0
  const daysLeft = daysLeftOf(state.periodKey)
  const statusBadge = state.status === 'defeated'
    ? { text: tt('bossStatusDefeated'), color: 'var(--p-success)' }
    : { text: `${daysLeft} ${tt('bossDaysLeft')}`, color: 'var(--p-muted)' }

  return (
    <div className="mx-5 mb-6 rounded-container border border-pline bg-pcard p-4">
      <div>
        <div className="mb-3 flex items-center justify-between gap-2">
          <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-psubtle">
            <Swords size={11} strokeWidth={1.75} /> {tt('bossTitle')}
          </p>
          <span className="text-[10.5px] font-semibold" style={{ color: statusBadge.color }}>
            {statusBadge.text}
          </span>
        </div>

        <div className="flex items-center gap-3">
          {/* v3: emoji avatar O'RNIGA boss rangidagi ikonka tile (boss-icons.ts) */}
          <div
            className="flex size-12 flex-shrink-0 items-center justify-center rounded-[14px]"
            style={{
              background: `color-mix(in srgb, ${bossColor} 12%, transparent)`,
              border: `1px solid color-mix(in srgb, ${bossColor} 24%, transparent)`,
            }}
          >
            <BossIcon size={22} strokeWidth={1.75} style={{ color: bossColor }} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[14px] font-semibold text-pfg">{name}</p>
            {/* HP rail — ILGARI BUZUQ EDI: `--val` o'rnatilardi, lekin CSS
                `.progress-premium > .fill` bolasini kutadi, u esa yo'q edi,
                shuning uchun chiziq HAR DOIM bo'sh ko'rinardi. */}
            <div className="mt-2 h-[3px] overflow-hidden rounded-[2px] bg-plineStrong">
              <div
                className="h-full rounded-[2px] bg-pprimary transition-[width] duration-[400ms] ease-out"
                style={{ width: `${pct}%` }}
              />
            </div>
            <div className="mt-1.5 flex items-center justify-between gap-2">
              <span className="text-[10.5px] font-medium tabular-nums text-pmuted">
                {tt('bossHpShort')}: {Math.max(0, 100 - pct)}%
              </span>
              <span className="text-[10.5px] font-semibold tabular-nums text-pprimary">
                {tt('bossMyDamage')}: {state.myDamage}
              </span>
            </div>
          </div>
        </div>

        {/* Top-3 zarba */}
        {state.top.length > 0 && (
          <div className="mt-3 flex items-center gap-2.5 border-t border-pline pt-3">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-psubtle">
              {tt('bossTopHitters')}
            </span>
            <div className="flex items-center -space-x-2">
              {state.top.map((u) => {
                const src = avatarSrcFor({ id: u.userId, photoUrl: u.photoUrl, hasCustomAvatar: u.hasCustomAvatar })
                return (
                  <span key={u.userId}
                    className="flex size-7 items-center justify-center overflow-hidden rounded-full border-2 border-pcard bg-psurface text-[10px] font-semibold text-pmuted"
                    title={`${u.firstName} — ${u.damage}`}>
                    {src
                      ? <img src={src} alt="" className="size-full object-cover" />
                      : (u.firstName?.[0]?.toUpperCase() ?? '?')}
                  </span>
                )
              })}
            </div>
            <span className="truncate text-[10.5px] font-medium text-pmuted">
              {state.top[0]?.firstName}{state.top.length > 1 ? ` +${state.top.length - 1}` : ''}
            </span>
          </div>
        )}

        {state.status === 'defeated' && (
          <p className={cn('mt-3 text-[11px] font-semibold text-psuccess', 'motion-safe:animate-premiumIn')}>
            {tt('bossDefeatedHint')}
          </p>
        )}
      </div>
    </div>
  )
}

export type { State as BossState }
