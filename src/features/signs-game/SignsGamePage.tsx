/**
 * 🎮 Belgilar o'yini — ikki rejim:
 *  1) TEZKOR RAUND: 60 soniyada imkon qadar ko'p belgi tanib olish (4 variantdan).
 *  2) JUFTLASH: 6 belgi ↔ 6 nom kartasini juftlash (xatosiz+tez rekord).
 *
 * CLIENT-ONLY o'yin: server/iqtisod bilan bog'liq emas — rekordlar localStorage'da
 * ('yhq-signs-best-*'), coin ta'sir qilmaydi (anti-farm chegarasidan tashqarida).
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, Timer, Trophy, Zap, LayoutGrid, RotateCcw } from 'lucide-react'
import { GAME_SIGNS, getGameSign, type GameSign } from '../../content/signs-game'
import { buildSpeedRounds, buildMatchPairs, type SpeedRound, type MatchTile } from './game-logic'
import SignIcon from './SignIcon'
import { goBack } from '../../shared/lib/navigation'
import { playSound } from '../../shared/lib/sounds'
import { useAppStore } from '../../shared/store/useAppStore'
import { useT } from '../../shared/i18n'

type Mode = 'hub' | 'speed' | 'match'

const BEST_SPEED_KEY = 'yhq-signs-best-speed'
const BEST_MATCH_KEY = 'yhq-signs-best-match-ms'
const SPEED_SECONDS = 60
const MATCH_PAIRS = 6

function readBest(key: string): number | null {
  try {
    const v = localStorage.getItem(key)
    return v === null ? null : Number(v)
  } catch {
    return null
  }
}
function writeBest(key: string, v: number) {
  try { localStorage.setItem(key, String(v)) } catch { /* private mode — rekordsiz */ }
}

// ── TEZKOR RAUND ─────────────────────────────────────────────────────────────

function SpeedGame({ onExit }: { onExit: () => void }) {
  const lang = useAppStore((s) => s.settings.language)
  const tt = useT(lang)
  const rounds = useMemo<SpeedRound[]>(() => buildSpeedRounds(GAME_SIGNS, 12), [])
  const [idx, setIdx] = useState(0)
  const [score, setScore] = useState(0)
  const [timeLeft, setTimeLeft] = useState(SPEED_SECONDS)
  const [flash, setFlash] = useState<'ok' | 'bad' | null>(null)
  const [done, setDone] = useState(false)
  const stateRef = useRef({ idx: 0, score: 0 })  // timeout'lar ichida yangi qiymat

  stateRef.current = { idx, score }

  useEffect(() => {
    if (done) return
    // Updater SOF bo'lishi shart (L11): StrictMode updater'ni 2× chaqiradi —
    // yakun logikasi (rekord yozish/ovoz) shu yerda bo'lsa 2 marta ijro etilardi
    const iv = window.setInterval(() => {
      setTimeLeft((t) => Math.max(0, t - 1))
    }, 1000)
    return () => window.clearInterval(iv)
  }, [done])

  // Vaqt tugashi — side-effect'lar FAQAT effect'da (updater'dan tashqarida)
  useEffect(() => {
    if (done || timeLeft > 0) return
    setDone(true)
    const s = stateRef.current.score
    const best = readBest(BEST_SPEED_KEY)
    if (best === null || s > best) writeBest(BEST_SPEED_KEY, s)
    playSound('win')
  }, [timeLeft, done])

  const answer = (option: GameSign) => {
    if (flash) return   // animatsiya paytida double-tap blok
    const ok = option.id === rounds[idx].sign.id
    setFlash(ok ? 'ok' : 'bad')
    playSound(ok ? 'success' : 'error')
    if (ok) setScore((s) => s + 1)
    window.setTimeout(() => {
      setFlash(null)
      const next = stateRef.current.idx + 1
      if (next >= rounds.length) {
        // 12 raund tugadi — darhol yakun (vaqt kutish shart emas)
        const s = stateRef.current.score
        const best = readBest(BEST_SPEED_KEY)
        if (best === null || s > best) writeBest(BEST_SPEED_KEY, s)
        setDone(true)
        playSound('win')
      } else {
        setIdx(next)
      }
    }, 350)
  }

  const best = readBest(BEST_SPEED_KEY)
  const round = rounds[idx]

  if (done) {
    return (
      <div className="flex flex-col items-center pt-10 animate-premiumIn">
        <Trophy size={40} className="text-pgold" fill="currentColor" />
        <p className="text-[18px]  font-black mt-3">{tt('signsGameOver')}</p>
        <p className="text-[13px] text-pmuted mt-1">
          {tt('signsGameCorrect')}: <b className="text-pfg">{score}</b> / {rounds.length}
          {best !== null && ` · ${tt('signsGameBest')}: ${Math.max(best, score)}`}
        </p>
        <button onClick={onExit} className="bg-pprimary text-ponprimary font-semibold hover:brightness-[1.06] active:scale-[0.98] disabled:opacity-[0.42] disabled:pointer-events-none transition-[transform,filter] duration-[120ms] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pprimary focus-visible:ring-offset-2 mt-6 px-6 py-2.5 rounded-2xl text-[13.5px] font-black">
          {tt('signsGameBack')}
        </button>
      </div>
    )
  }

  return (
    <div>
      {/* Holat qatori */}
      <div className="flex items-center justify-between mb-4">
        <span className="inline-flex items-center gap-1.5 text-[12.5px] font-black text-pwarning">
          <Timer size={14} /> {timeLeft}s
        </span>
        <span className="text-[12.5px] font-black text-pmuted">{tt('signsGameScore')}: {score}</span>
      </div>
      <div className="h-[3px] rounded-[2px] bg-plineStrong overflow-hidden mb-6" style={{ ['--val' as string]: `${(timeLeft / SPEED_SECONDS) * 100}%` }} />

      {/* Belgi */}
      <div key={round.sign.id} className="flex justify-center py-4 animate-premiumIn">
        <SignIcon sign={round.sign} size={128} />
      </div>

      {/* Variantlar */}
      <div className="grid gap-2.5 mt-2">
        {round.options.map((o) => (
          <button key={o.id} onClick={() => answer(o)} disabled={flash !== null}
            className="border border-pline bg-pcard rounded-container py-3 px-4 text-[13.5px] font-bold text-left active:scale-[0.98] transition-all disabled:opacity-90"
            style={flash !== null && o.id === round.sign.id
              ? { border: '1px solid rgb(var(--p-success-rgb) / 0.6)', background: 'rgb(var(--p-success-rgb) / 0.12)' }
              : undefined}>
            {o.name[lang]}
          </button>
        ))}
      </div>
    </div>
  )
}

// ── JUFTLASH ─────────────────────────────────────────────────────────────────

function MatchGame({ onExit }: { onExit: () => void }) {
  const lang = useAppStore((s) => s.settings.language)
  const tt = useT(lang)

  const startNew = () => {
    setTiles(buildMatchPairs(GAME_SIGNS, MATCH_PAIRS))
    setMatched(new Set())
    setSelected(null)
    setWrong(null)
    setAttempts(0)
    setStartedAt(null)
    setDoneMs(null)
  }

  const [tiles, setTiles] = useState<MatchTile[]>(() => buildMatchPairs(GAME_SIGNS, MATCH_PAIRS))
  const [matched, setMatched] = useState<Set<string>>(new Set())
  const [selected, setSelected] = useState<MatchTile | null>(null)
  const [wrong, setWrong] = useState<string[] | null>(null)
  const [attempts, setAttempts] = useState(0)
  const [startedAt, setStartedAt] = useState<number | null>(null)
  const [doneMs, setDoneMs] = useState<number | null>(null)
  const lockRef = useRef(false)

  const tap = (tile: MatchTile) => {
    if (lockRef.current || doneMs !== null) return
    if (matched.has(tile.signId)) return
    if (selected?.uid === tile.uid) return
    playSound('click')
    if (startedAt === null) setStartedAt(Date.now())
    if (!selected) { setSelected(tile); return }
    // Ikkinchi karta: HAR DOIM qarama-qarshi kind bo'lishi kerak
    if (selected.kind === tile.kind) { setSelected(tile); return }
    setAttempts((a) => a + 1)
    if (selected.signId === tile.signId) {
      const next = new Set(matched); next.add(tile.signId)
      setMatched(next)
      setSelected(null)
      playSound('success')
      if (next.size === MATCH_PAIRS) {
        const ms = Date.now() - (startedAt ?? Date.now())
        setDoneMs(ms)
        const best = readBest(BEST_MATCH_KEY)
        if (best === null || ms < best) writeBest(BEST_MATCH_KEY, ms)
        playSound('win')
      }
    } else {
      setWrong([selected.uid, tile.uid])
      setSelected(null)
      playSound('error')
      lockRef.current = true
      window.setTimeout(() => { setWrong(null); lockRef.current = false }, 650)
    }
  }

  const fmtMs = (ms: number) => `${(ms / 1000).toFixed(1)}s`
  const best = readBest(BEST_MATCH_KEY)

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <span className="text-[12.5px] font-black text-pmuted">
          {tt('signsGamePairs')}: {matched.size}/{MATCH_PAIRS}
        </span>
        <span className="text-[12.5px] font-black text-pmuted">
          {tt('signsGameAttempts')}: {attempts}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2.5">
        {tiles.map((tile) => {
          const sign = getGameSign(tile.signId)
          if (!sign) return null
          const isMatched = matched.has(tile.signId)
          const isSelected = selected?.uid === tile.uid
          const isWrong = wrong?.includes(tile.uid) ?? false
          return (
            <button key={tile.uid} onClick={() => tap(tile)}
              className={`border border-pline bg-pcard rounded-container aspect-square flex items-center justify-center p-2 text-center transition-all active:scale-[0.96] ${isMatched ? 'opacity-40' : ''} ${isWrong ? 'animate-shake' : ''}`}
              style={isSelected ? {
                border: '1.5px solid rgb(var(--p-primary-rgb) / 0.7)',
                boxShadow: '0 0 0 3px rgb(var(--p-primary-rgb) / 0.15)',
              } : isWrong ? {
                border: '1.5px solid color-mix(in srgb, var(--p-danger) 70%, transparent)',
              } : undefined}>
              {tile.kind === 'icon'
                ? <SignIcon sign={sign} size={56} />
                : <span className="text-[10.5px] font-bold leading-tight">{sign.name[lang]}</span>}
            </button>
          )
        })}
      </div>

      {doneMs !== null && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onExit}>
          <div className="bg-pcard border border-pline rounded-3xl p-6 mx-6 text-center animate-premiumIn"
            onClick={(e) => e.stopPropagation()}>
            <Trophy size={40} className="text-pgold mx-auto" fill="currentColor" />
            <p className="text-[16px] font-black mt-3">{tt('signsGameWin')}</p>
            <p className="text-[12.5px] text-pmuted mt-1.5">
              {fmtMs(doneMs)} · {attempts} {tt('signsGameAttempts').toLowerCase()}
              {best !== null && ` · ${tt('signsGameBest')}: ${fmtMs(Math.min(best, doneMs))}`}
            </p>
            <div className="flex gap-2.5 mt-5">
              <button onClick={startNew}
                className="bg-pprimary text-ponprimary font-semibold hover:brightness-[1.06] active:scale-[0.98] disabled:opacity-[0.42] disabled:pointer-events-none transition-[transform,filter] duration-[120ms] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pprimary focus-visible:ring-offset-2 flex-1 py-2.5 rounded-2xl text-[13px] font-black flex items-center justify-center gap-1.5">
                <RotateCcw size={14} /> {tt('signsGamePlayAgain')}
              </button>
              <button onClick={onExit}
                className="flex-1 py-2.5 rounded-2xl text-[13px] font-black bg-psurface border border-pline text-pmuted">
                {tt('signsGameBack')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── MARKAZ (rejim tanlash) ───────────────────────────────────────────────────

export default function SignsGamePage() {
  const navigate = useNavigate()
  const lang = useAppStore((s) => s.settings.language)
  const tt = useT(lang)
  const [mode, setMode] = useState<Mode>('hub')
  const bestSpeed = readBest(BEST_SPEED_KEY)
  const bestMatch = readBest(BEST_MATCH_KEY)

  return (
    <div className="font-display bg-pcanvas text-pfg px-5 pt-3">
      <div className="flex items-center gap-2 mb-5">
        <button onClick={() => (mode === 'hub' ? goBack(navigate) : setMode('hub'))} aria-label="Orqaga"
          className="text-psubtle hover:text-pfg px-1 transition-colors">
          <ChevronLeft size={24} />
        </button>
        <h1 className="text-lg font-bold tracking-tight">{tt('signsGameTitle')}</h1>
      </div>

      {mode === 'hub' && (
        <div className="grid gap-3.5 animate-premiumIn">
          {([
            { id: 'speed' as const, icon: Zap,        title: tt('signsGameSpeed'), desc: tt('signsGameSpeedDesc'),
              best: bestSpeed !== null ? `${tt('signsGameBest')}: ${bestSpeed}` : null,
              iconColor: 'var(--p-warning)' },
            { id: 'match' as const, icon: LayoutGrid, title: tt('signsGameMatch'), desc: tt('signsGameMatchDesc'),
              best: bestMatch !== null ? `${tt('signsGameBest')}: ${(bestMatch / 1000).toFixed(1)}s` : null,
              iconColor: 'var(--p-blue)' },
          ]).map((m) => (
            <button key={m.id} onClick={() => { playSound('click'); setMode(m.id) }}
              className="border border-pline bg-pcard rounded-container p-4 flex items-center gap-3.5 text-left active:scale-[0.98] transition-transform">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-none"
                style={m.id === 'speed'
                  ? { background: 'rgb(var(--p-warning-rgb) / 0.14)', border: '1px solid rgb(var(--p-warning-rgb) / 0.4)' }
                  : { background: 'color-mix(in srgb, var(--p-blue) 12%, transparent)', border: '1px solid color-mix(in srgb, var(--p-blue) 35%, transparent)' }}>
                <m.icon size={22} style={{ color: m.iconColor }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[14.5px] font-black">{m.title}</p>
                <p className="text-[11.5px] text-pmuted mt-0.5 leading-snug">{m.desc}</p>
                {m.best && <p className="text-[10.5px] font-bold text-pgold mt-1">{m.best}</p>}
              </div>
              <ChevronLeft size={18} className="rotate-180 text-psubtle flex-none" />
            </button>
          ))}
        </div>
      )}

      {mode === 'speed' && <SpeedGame onExit={() => setMode('hub')} />}
      {mode === 'match' && <MatchGame onExit={() => setMode('hub')} />}
    </div>
  )
}
