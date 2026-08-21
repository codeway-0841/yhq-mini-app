/**
 * Boss Battle — Dashboard kartasi (haftalik jamoaviy jang).
 *
 * Faqat O'QISH (GET /boss/state): zarar progress /result orqali server'da
 * qo'llanadi (client yozmaydi). HP foizi totalDamage asosida ko'rsatiladi
 * (hpTotal-hpLeft clamp overflow'ni yashirishi mumkin — adolatli vizual).
 */
import { useEffect, useState } from 'react'
import { Swords, Loader2 } from 'lucide-react'
import { api, avatarSrcFor } from '../../shared/api'
import { getBossDef, bossPeriodEndDate } from '../../../shared/boss-battle'
import { useAppStore } from '../../shared/store/useAppStore'
import { useT } from '../../shared/i18n'

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
      <div className="mx-5 mb-5 card-premium p-4 flex items-center justify-center min-h-[76px]">
        <Loader2 size={18} className="animate-spin text-psubtle" />
      </div>
    )
  }

  const def = getBossDef(state.bossKey)
  const name = def?.name[lang] ?? 'Boss'
  const emoji = def?.emoji ?? '🐲'
  const pct = state.hpTotal > 0 ? Math.min(100, Math.round((state.totalDamage / state.hpTotal) * 100)) : 0
  const daysLeft = daysLeftOf(state.periodKey)
  const statusBadge = state.status === 'defeated'
    ? { text: tt('bossStatusDefeated'), color: 'var(--p-success)' }
    : { text: `${daysLeft} ${tt('bossDaysLeft')}`, color: 'var(--p-muted)' }

  return (
    <div className="mx-5 mb-5 card-premium p-4 relative overflow-hidden">
      {/* Atmosfera */}
      <div className="absolute inset-0 pointer-events-none" style={{
        background: `linear-gradient(135deg, color-mix(in srgb, ${def?.color ?? '#8b5cf6'} 14%, transparent), transparent 55%)`,
      }} />

      <div className="relative">
        <div className="flex items-center justify-between mb-2.5">
          <p className="text-[10px] font-semibold text-psubtle uppercase tracking-[0.14em] flex items-center gap-1.5">
            <Swords size={11} /> {tt('bossTitle')}
          </p>
          <span className="text-[10.5px] font-bold" style={{ color: statusBadge.color }}>
            {statusBadge.text}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-[40px] leading-none" style={{ filter: 'drop-shadow(0 4px 10px rgba(0,0,0,0.35))' }}>
            {emoji}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[14px] font-black truncate">{name}</p>
            <div className="progress-premium mt-1.5" style={{ ['--val' as string]: `${pct}%` }} />
            <div className="flex items-center justify-between mt-1">
              <span className="text-[10.5px] font-bold text-pmuted">
                {tt('bossHpShort')}: {Math.max(0, 100 - pct)}%
              </span>
              <span className="text-[10.5px] font-black text-pprimary">
                {tt('bossMyDamage')}: {state.myDamage}
              </span>
            </div>
          </div>
        </div>

        {/* Top-3 zarba */}
        {state.top.length > 0 && (
          <div className="mt-3 pt-3 border-t border-pline flex items-center gap-2.5">
            <span className="text-[10px] font-semibold text-psubtle uppercase tracking-wide">
              {tt('bossTopHitters')}
            </span>
            <div className="flex items-center -space-x-2">
              {state.top.map((u) => {
                const src = avatarSrcFor({ id: u.userId, photoUrl: u.photoUrl, hasCustomAvatar: u.hasCustomAvatar })
                return (
                  <span key={u.userId}
                    className="w-7 h-7 rounded-full border-2 border-pcard bg-psurface overflow-hidden flex items-center justify-center text-[10px] font-black text-pmuted"
                    title={`${u.firstName} — ${u.damage}`}>
                    {src
                      ? <img src={src} alt={u.firstName} className="w-full h-full object-cover" />
                      : (u.firstName?.[0]?.toUpperCase() ?? '?')}
                  </span>
                )
              })}
            </div>
            <span className="text-[10.5px] font-bold text-pmuted truncate">
              {state.top[0]?.firstName}{state.top.length > 1 ? ` +${state.top.length - 1}` : ''}
            </span>
          </div>
        )}

        {state.status === 'defeated' && (
          <p className="mt-2.5 text-[11px] font-bold text-psuccess animate-premiumIn">
            🎉 {tt('bossDefeatedHint')}
          </p>
        )}
      </div>
    </div>
  )
}

export type { State as BossState }
