/**
 * Faza 0 spike runner: qo'lyozma recognition baholash.
 *
 * Foydalanish:
 *   # 1) Dataset validatsiyasi (kalit shart emas):
 *   npx tsx spike/math-board/run.ts
 *   # 2) To'liq spike (100 rasm: <id>.png, masalan log-01.png):
 *   GEMINI_API_KEY=... npx tsx spike/math-board/run.ts --images ./spike-images [--limit 20] [--out spike-result.json]
 *
 * Metrika (v2 talabi): raw LaTeX string EMAS — normalized AST equivalence
 * (exactEqual). Hisobot: exact accuracy, top-3 accuracy, kategoriya kesimi,
 * p50/p95 latency, chaqiruvlar soni. GO: exact ≥85%.
 */

import 'dotenv/config'
import fs from 'node:fs'
import path from 'node:path'
import { parseStep, exactEqual } from '../../src/shared/math-engine/index'
import { latexToAscii } from '../../src/features/math-board/lib/latex-to-ascii'
import { recognizeHandwriting } from '../../server/modules/math-board/math-board.service'

interface Item {
  id: string
  category: string
  ascii: string
  latex: string
}

function args(): Record<string, string> {
  const out: Record<string, string> = {}
  const raw = process.argv.slice(2)
  for (let i = 0; i < raw.length; i++) {
    if (raw[i].startsWith('--')) out[raw[i].slice(2)] = raw[i + 1] ?? ''
  }
  return out
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))]
}

/** Tanilgan latex expected ascii'ga AST-exact mosmi? */
function isExact(recognizedLatex: string, expectedAscii: string): boolean {
  try {
    const cand = parseStep(latexToAscii(recognizedLatex))
    const exp = parseStep(expectedAscii)
    if (cand.kind !== exp.kind) return false
    if (cand.kind === 'expr' && exp.kind === 'expr') return exactEqual(cand.node, exp.node)
    if (cand.kind === 'equation' && exp.kind === 'equation') {
      return (exactEqual(cand.left, exp.left) && exactEqual(cand.right, exp.right))
        || (exactEqual(cand.left, exp.right) && exactEqual(cand.right, exp.left))
    }
    return false
  } catch {
    return false
  }
}

async function main(): Promise<void> {
  const opts = args()
  const dataset = JSON.parse(
    fs.readFileSync(path.join(import.meta.dirname, 'dataset.json'), 'utf8'),
  ) as { items: Item[] }

  // Rejim 1: validatsiya (rasmsiz)
  if (!opts.images) {
    let bad = 0
    const byCat: Record<string, number> = {}
    for (const it of dataset.items) {
      byCat[it.category] = (byCat[it.category] ?? 0) + 1
      try {
        parseStep(it.ascii)
      } catch {
        bad++
        console.log(`PARSE-FAIL ${it.id}: ${it.ascii}`)
      }
    }
    console.log(`items=${dataset.items.length} balance=${JSON.stringify(byCat)} parseFails=${bad}`)
    console.log('Rasm yig‘ish: har item uchun <id>.png (masalan log-01.png) --images papkasiga.')
    return
  }

  const limit = opts.limit ? Number(opts.limit) : dataset.items.length
  const items = dataset.items.slice(0, limit)
  const latencies: number[] = []
  const catStats: Record<string, { n: number; exact: number; top3: number }> = {}
  let exact = 0
  let top3 = 0
  let tested = 0
  let errors = 0

  for (const it of items) {
    const file = ['png', 'jpg', 'jpeg', 'webp']
      .map((ext) => path.join(opts.images, `${it.id}.${ext}`))
      .find((f) => fs.existsSync(f))
    if (!file) continue
    const buf = fs.readFileSync(file)
    const ext = path.extname(file).slice(1).toLowerCase()
    const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : ext === 'webp' ? 'image/webp' : 'image/png'
    const dataUrl = `data:${mime};base64,${buf.toString('base64')}`
    tested++
    const t0 = performance.now()
    try {
      const res = await recognizeHandwriting({
        imageBase64: dataUrl,
        mimeType: mime as 'image/png',
        category: it.category,
      })
      latencies.push(performance.now() - t0)
      const hitExact = isExact(res.latex, it.ascii)
      const hitTop3 = hitExact || res.alternatives.some((a) => isExact(a, it.ascii))
      if (hitExact) exact++
      if (hitTop3) top3++
      const cs = (catStats[it.category] ??= { n: 0, exact: 0, top3: 0 })
      cs.n++
      if (hitExact) cs.exact++
      if (hitTop3) cs.top3++
      console.log(`${hitExact ? 'EXACT' : hitTop3 ? 'TOP3 ' : 'MISS '} ${it.id} (${Math.round(latencies[latencies.length - 1])}ms): ${res.latex.slice(0, 80)}`)
    } catch (e) {
      errors++
      console.log(`ERROR ${it.id}: ${e instanceof Error ? e.message.slice(0, 100) : e}`)
    }
  }

  latencies.sort((a, b) => a - b)
  const summary = {
    tested,
    errors,
    exactAccuracy: tested ? exact / tested : 0,
    top3Accuracy: tested ? top3 / tested : 0,
    p50ms: Math.round(percentile(latencies, 50)),
    p95ms: Math.round(percentile(latencies, 95)),
    byCategory: catStats,
    go: tested >= 20 && tested && exact / tested >= 0.85 ? 'GO (exact ≥85%)' : 'NO-GO / yetarli namuna yo‘q',
  }
  console.log(JSON.stringify(summary, null, 2))
  if (opts.out) fs.writeFileSync(opts.out, JSON.stringify(summary, null, 2))
}

await main()
