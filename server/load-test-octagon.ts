/**
 * Octagon WS yuk-testi (FIXPLAN #50) — haqiqiy WS protokol orqali (join_queue →
 * matched → question/answer → match_end) N ta parallel duel simulyatsiya qiladi
 * va matchmaking/DB (resolveAvatars, addOctagonWin) hamda round-trip latency'ni
 * o'lchaydi.
 *
 * Ishlatish (avval `npm run server:dev` boshqa terminalda ishga tushirilgan bo'lsin):
 *   npm run loadtest:octagon                          # 100 duel (200 o'yinchi), localhost
 *   npm run loadtest:octagon -- --pairs=250            # 250 duel
 *   npm run loadtest:octagon -- --subject=matematika
 *   OCTAGON_WS_URL=ws://localhost:3001/ws/octagon npm run loadtest:octagon
 *
 * Xavfsizlik: faqat localhost/127.0.0.1 target'ga ruxsat — production WS'ga
 * qasddan soxta yuk yuborib qo'ymaslik uchun (`--force` bilan bekor qilinadi,
 * lekin buni ATAYIN va ehtiyot bilan qiling).
 *
 * `isAuthEnforced()` faqat `config.isProd`da true (server/middleware/auth.ts) —
 * shuning uchun lokal/dev serverda join_queue initData'siz, xom userId bilan
 * ishlaydi (WS_USER_ID_RE'ga mos raqamli id yetarli).
 */
import { WebSocket } from 'ws'

interface Args {
  pairs:     number
  url:       string
  subjectId: string
}

function parseArgs(): Args {
  const argv = process.argv.slice(2)
  const get = (name: string, def: string): string => {
    const hit = argv.find((a) => a.startsWith(`--${name}=`))
    return hit ? hit.slice(name.length + 3) : def
  }
  const url = process.env.OCTAGON_WS_URL ?? get('url', 'ws://localhost:3001/ws/octagon')

  let host: string
  try { host = new URL(url).hostname } catch { throw new Error(`Yaroqsiz --url: ${url}`) }
  const isLocal = host === 'localhost' || host === '127.0.0.1' || host === '::1'
  if (!isLocal && !argv.includes('--force')) {
    console.error(`Xavfsizlik: faqat localhost target ruxsat (host='${host}'). Amaliy sabab bo'lsa --force qo'shing.`)
    process.exit(1)
  }

  return {
    pairs:     Math.max(1, Number(get('pairs', '100')) || 100),
    url,
    subjectId: get('subject', 'yhq'),
  }
}

interface PlayerMetrics {
  userId:      string
  connectedAt: number
  matchedAt:   number | null
  matchEndAt:  number | null
  ackLatencies: number[]   // o'z javobi yuborilgandan answer_ack kelgunicha
  errors:      string[]
  matched:     boolean
  completed:   boolean
}

const ANSWER_DELAY_MIN_MS = 200
const ANSWER_DELAY_MAX_MS = 2500
const HARD_TIMEOUT_MS     = 5 * 60_000   // ~10 raund × (15s + 1s gap) ≈ 160s + katta zaxira (server sekinlashsa ham test osilmasin)
const OPTIONS = ['A', 'B', 'C', 'D']

function runPlayer(idx: number, url: string, subjectId: string): Promise<PlayerMetrics> {
  return new Promise((resolve) => {
    const userId = String(900_000_000_000 + idx)   // WS_USER_ID_RE: \d{1,20} — dev'da initData shart emas
    const metrics: PlayerMetrics = {
      userId, connectedAt: Date.now(), matchedAt: null, matchEndAt: null,
      ackLatencies: [], errors: [], matched: false, completed: false,
    }
    const ws = new WebSocket(url)
    let matchId: string | null = null
    let answerSentAt = 0
    let settled = false

    const finish = (): void => {
      if (settled) return
      settled = true
      clearTimeout(hardTimeout)
      try { ws.close() } catch { /* allaqachon yopiq */ }
      resolve(metrics)
    }

    const hardTimeout = setTimeout(() => {
      metrics.errors.push('client_hard_timeout')
      finish()
    }, HARD_TIMEOUT_MS)

    ws.on('open', () => {
      try {
        ws.send(JSON.stringify({ type: 'join_queue', userId, name: `Load${idx}`, subjectId }))
      } catch (err) {
        metrics.errors.push(`send_error:${(err as Error).message}`)
        finish()
      }
    })

    ws.on('message', (raw) => {
      let msg: Record<string, unknown>
      try { msg = JSON.parse(raw.toString()) } catch { return }

      switch (msg.type) {
        case 'matched':
          metrics.matched = true
          metrics.matchedAt = Date.now()
          matchId = String(msg.matchId)
          break

        case 'question': {
          const index = Number(msg.index)
          const delay = ANSWER_DELAY_MIN_MS + Math.random() * (ANSWER_DELAY_MAX_MS - ANSWER_DELAY_MIN_MS)
          setTimeout(() => {
            if (ws.readyState === WebSocket.OPEN && matchId) {
              answerSentAt = Date.now()
              try {
                ws.send(JSON.stringify({
                  type: 'answer', matchId, index,
                  optionId: OPTIONS[Math.floor(Math.random() * OPTIONS.length)],
                }))
              } catch (err) {
                answerSentAt = 0
                metrics.errors.push(`send_error:${(err as Error).message}`)
              }
            }
          }, delay)
          break
        }

        case 'answer_ack':
          if (answerSentAt) {
            metrics.ackLatencies.push(Date.now() - answerSentAt)
            answerSentAt = 0   // stray/qayta ack kelsa qayta hisoblanmasin
          }
          break

        case 'match_end':
          metrics.completed = true
          metrics.matchEndAt = Date.now()
          finish()
          break

        case 'error':
          metrics.errors.push(String(msg.message))
          break
      }
    })

    ws.on('error', (err) => metrics.errors.push(`ws_error:${(err as Error).message}`))
    ws.on('close', finish)
  })
}

function stats(values: number[]): { min: number; avg: number; p50: number; p95: number; max: number } {
  if (!values.length) return { min: 0, avg: 0, p50: 0, p95: 0, max: 0 }
  const sorted = [...values].sort((a, b) => a - b)
  const pct = (p: number): number => sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))]
  return {
    min: sorted[0],
    avg: Math.round(sorted.reduce((a, b) => a + b, 0) / sorted.length),
    p50: pct(50),
    p95: pct(95),
    max: sorted[sorted.length - 1],
  }
}

function fmt(s: { min: number; avg: number; p50: number; p95: number; max: number }): string {
  return `min=${s.min} avg=${s.avg} p50=${s.p50} p95=${s.p95} max=${s.max}`
}

async function main(): Promise<void> {
  const { pairs, url, subjectId } = parseArgs()
  const total = pairs * 2
  console.log(`Octagon yuk-testi: ${pairs} duel maqsadi (${total} o'yinchi) → ${url} (fan: ${subjectId})\n`)

  const startedAt = Date.now()
  const results = await Promise.all(
    Array.from({ length: total }, (_, i) => runPlayer(i, url, subjectId)),
  )
  const wallMs = Date.now() - startedAt

  const matched        = results.filter((r) => r.matched)
  const completed       = results.filter((r) => r.completed)
  const matchmakingLat = matched.map((r) => r.matchedAt! - r.connectedAt)
  const matchDuration  = completed.filter((r) => r.matchedAt).map((r) => r.matchEndAt! - r.matchedAt!)
  const ackLatencies   = results.flatMap((r) => r.ackLatencies)

  const errorCounts = new Map<string, number>()
  for (const r of results) for (const e of r.errors) errorCounts.set(e, (errorCounts.get(e) ?? 0) + 1)

  console.log(`=== Natija (${wallMs}ms davomida) ===`)
  console.log(`O'yinchilar: ${total} so'ralgan, ${matched.length} juftlashdi (~${Math.round(matched.length / 2)} duel), ${completed.length} to'liq yakunladi`)
  console.log(`Matchmaking latency (ms, connect→matched, DB avatar resolve ichida):  ${fmt(stats(matchmakingLat))}`)
  console.log(`Answer ack latency (ms, javob→answer_ack, WS/event-loop):            ${fmt(stats(ackLatencies))}`)
  console.log(`Match davomiyligi (ms, matched→match_end, 10 raund o'yin qismi):      ${fmt(stats(matchDuration))}`)

  if (errorCounts.size) {
    console.log(`\nXatolar:`)
    for (const [msg, n] of errorCounts) console.log(`  ${msg}: ${n}`)
  } else {
    console.log(`\nXatolar: yo'q`)
  }

  const unmatched = total - matched.length
  if (unmatched > 0) console.log(`\nDIQQAT: ${unmatched} o'yinchi juftlashmadi (queue_timeout yoki server_full bo'lishi mumkin).`)

  process.exit(errorCounts.size || unmatched > 0 ? 1 : 0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
