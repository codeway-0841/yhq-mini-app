import fs from 'node:fs'
import path from 'node:path'
import {
  parseContentBank,
  toAdminBulkImportPayload,
  toExplanationSeedRows,
  toTopicIdTemplate,
  toTopicSeedRows,
  type ContentBank,
} from '../shared/content-bank.ts'

type CliOptions = {
  out?: string
  topicIds?: string
}

function usage(): never {
  console.log(`Content bank tools

Usage:
  npx tsx scripts/content-bank.ts validate <bank.json>
  npx tsx scripts/content-bank.ts export <bank.json> --out <dir> [--topic-ids <topic-id-map.json>]

Examples:
  npx tsx scripts/content-bank.ts validate content-banks/_template/content-bank.sample.json
  npx tsx scripts/content-bank.ts export content-banks/_template/content-bank.sample.json --out content-banks/out`)
  process.exit(1)
}

function parseArgs(argv: string[]): { command: string; file: string; options: CliOptions } {
  const [command, file, ...rest] = argv
  if (!command || !file) usage()

  const options: CliOptions = {}
  for (let i = 0; i < rest.length; i += 1) {
    const arg = rest[i]
    const value = rest[i + 1]
    if (arg === '--out' && value) {
      options.out = value
      i += 1
    } else if (arg === '--topic-ids' && value) {
      options.topicIds = value
      i += 1
    } else {
      console.error(`Noma’lum argument: ${arg}`)
      usage()
    }
  }

  return { command, file, options }
}

function readJson(file: string): unknown {
  const fullPath = path.resolve(process.cwd(), file)
  return JSON.parse(fs.readFileSync(fullPath, 'utf8')) as unknown
}

function readTopicIds(file?: string): Record<string, number | null> {
  if (!file) return {}
  const raw = readJson(file)
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('--topic-ids fayli object bo‘lishi kerak')
  }

  const result: Record<string, number | null> = {}
  for (const [key, value] of Object.entries(raw)) {
    if (value === null) {
      result[key] = null
    } else if (Number.isInteger(value) && Number(value) > 0) {
      result[key] = Number(value)
    } else {
      throw new Error(`--topic-ids.${key}: musbat integer yoki null bo‘lishi kerak`)
    }
  }
  return result
}

function loadBank(file: string): ContentBank {
  const validation = parseContentBank(readJson(file))
  if (!validation.ok || !validation.data) {
    console.error('❌ Content bank validatsiyadan o‘tmadi:')
    for (const error of validation.errors) console.error(`  - ${error}`)
    process.exit(1)
  }

  console.log(`✅ Format toza: ${validation.data.subjectId} / ${validation.data.bankId}`)
  console.log(`   Topics: ${validation.data.topics.length}`)
  console.log(`   Questions: ${validation.data.items.length}`)
  if (validation.warnings.length) {
    console.log('⚠️  Tavsiyalar:')
    for (const warning of validation.warnings) console.log(`  - ${warning}`)
  }

  return validation.data
}

function writeJson(file: string, data: unknown): void {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`)
}

function validate(file: string): void {
  loadBank(file)
}

function exportBank(file: string, options: CliOptions): void {
  if (!options.out) {
    console.error('export uchun --out <dir> kerak')
    usage()
  }

  const bank = loadBank(file)
  const outDir = path.resolve(process.cwd(), options.out)
  const topicIds = readTopicIds(options.topicIds)
  const base = `${bank.subjectId}.${bank.bankId}`

  const topicsPath = path.join(outDir, `${base}.topics.json`)
  const topicIdTemplatePath = path.join(outDir, `${base}.topic-ids.template.json`)
  const bulkImportPath = path.join(outDir, `${base}.bulk-import.json`)
  const explanationsPath = path.join(outDir, `${base}.explanations.json`)

  writeJson(topicsPath, toTopicSeedRows(bank))
  writeJson(topicIdTemplatePath, toTopicIdTemplate(bank))
  writeJson(bulkImportPath, toAdminBulkImportPayload(bank, topicIds))
  writeJson(explanationsPath, toExplanationSeedRows(bank))

  console.log('📦 Export tayyor:')
  console.log(`  - ${path.relative(process.cwd(), topicsPath)}`)
  console.log(`  - ${path.relative(process.cwd(), topicIdTemplatePath)}`)
  console.log(`  - ${path.relative(process.cwd(), bulkImportPath)}`)
  console.log(`  - ${path.relative(process.cwd(), explanationsPath)}`)

  if (!options.topicIds) {
    console.log('ℹ️  topicId map berilmagan: bulk-import ichida topicId=null chiqadi.')
    console.log('   Mavzular DBga kirgach topic-ids.template.json ni to‘ldirib, exportni --topic-ids bilan qayta chiqaring.')
  }
}

const { command, file, options } = parseArgs(process.argv.slice(2))

if (command === 'validate') {
  validate(file)
} else if (command === 'export') {
  exportBank(file, options)
} else {
  console.error(`Noma’lum command: ${command}`)
  usage()
}
