/**
 * Darslik testi keshini CLI orqali regeneratsiya qilish.
 *
 * Misol:
 *   npm run darslik:regenerate -- --block=1 --dry-run
 *   npm run darslik:regenerate -- --topic=1:0 --topic=1:1 --yes
 *
 * Xavfsizlik: yozuv amali faqat `--yes` bilan bajariladi. Curated mavzular
 * darhol qayta yoziladi; qolganlar keshdan o'chiriladi va keyingi /check'da
 * AI/fallback orqali qayta yaratiladi.
 */
import 'dotenv/config'
import {
  DarslikRegenerationInputError,
  DarslikTopicNotFoundError,
  regenerateDarslikChecks,
  resolveDarslikRegenerationTopics,
  type DarslikRegenerationInput,
} from '../server/modules/darslik/regenerate'

const USAGE = `Usage:
  npm run darslik:regenerate -- --block=1 [--dry-run] [--yes]
  npm run darslik:regenerate -- --topic=1:0 [--topic=1:1 ...] [--dry-run] [--yes]

Options:
  --block=<1..15>   butun blok mavzulari
  --topic=<b:s>     bitta mavzu (takrorlash mumkin)
  --dry-run         faqat tanlovni ko'rsatadi, DB'ga yozmaydi
  --yes             yozuv amalini tasdiqlaydi (majburiy)`

function parseArgs(argv: string[]) {
  const topicIds: string[] = []
  let blockId: number | undefined
  let dryRun = false
  let yes = false

  for (const arg of argv) {
    if (arg === '--dry-run') { dryRun = true; continue }
    if (arg === '--yes') { yes = true; continue }
    if (arg.startsWith('--topic=')) {
      const value = arg.slice('--topic='.length).trim()
      if (value) topicIds.push(value)
      continue
    }
    if (arg.startsWith('--block=')) {
      const raw = arg.slice('--block='.length).trim()
      if (!/^\d{1,2}$/.test(raw)) throw new DarslikRegenerationInputError('block must be 1..15')
      blockId = Number(raw)
      if (blockId < 1 || blockId > 15) throw new DarslikRegenerationInputError('block must be 1..15')
      continue
    }
    if (arg === '--help' || arg === '-h') {
      console.log(USAGE)
      process.exit(0)
    }
    throw new DarslikRegenerationInputError('Unknown argument: ' + arg)
  }

  const input: DarslikRegenerationInput = topicIds.length > 0 ? { topicIds } : { blockId }
  if (topicIds.length === 0 && blockId === undefined) {
    throw new DarslikRegenerationInputError('Provide --block or --topic')
  }
  return { input, dryRun, yes }
}

function targetHost(): string {
  try {
    return new URL(process.env['DATABASE_URL'] ?? '').hostname
  } catch {
    return '(DATABASE_URL not set)'
  }
}

async function main(): Promise<void> {
  const { input, dryRun, yes } = parseArgs(process.argv.slice(2))
  const topicIds = resolveDarslikRegenerationTopics(input)

  console.log('[darslik] target DB:', targetHost())
  console.log('[darslik] topics:', topicIds.length, topicIds.slice(0, 12).join(', '))

  if (dryRun) {
    console.log('[darslik] dry-run — DB unchanged')
    return
  }
  if (!yes) {
    throw new DarslikRegenerationInputError('Refusing to write without --yes')
  }

  const result = await regenerateDarslikChecks(input)
  console.log('[darslik] regenerated:', JSON.stringify(result))
}

main().catch((error: unknown) => {
  if (error instanceof DarslikTopicNotFoundError) {
    console.error('[darslik] unknown topics:', error.topicIds.join(', '))
    process.exit(1)
  }
  if (error instanceof DarslikRegenerationInputError) {
    console.error('[darslik]', error.message)
    console.error(USAGE)
    process.exit(1)
  }
  console.error('[darslik] regeneration failed:', error instanceof Error ? error.message : String(error))
  process.exit(1)
})
