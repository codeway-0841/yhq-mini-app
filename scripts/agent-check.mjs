import { spawn } from 'node:child_process'
import { createWriteStream, existsSync, mkdirSync, statSync } from 'node:fs'
import { resolve, relative, isAbsolute } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))
const [mode, ...args] = process.argv.slice(2)
const modes = {
  unit: ['node_modules/vitest/vitest.mjs', 'run'],
  'unit-all': ['node_modules/vitest/vitest.mjs', 'run', 'tests/unit'],
  client: ['node_modules/typescript/bin/tsc', '-p', 'tsconfig.json', '--noEmit'],
  server: ['node_modules/typescript/bin/tsc', '-p', 'tsconfig.server.json', '--noEmit'],
  build: ['scripts/build.mjs'],
}
if (mode === '--help' || !mode) {
  console.log('Usage: node scripts/agent-check.mjs unit <exact tests/unit/*.test.ts[x] paths> | unit-all | client | server | build\nFull logs and metrics: .agent-local/checks/. No AI calls. Failures retain nonzero exit status.')
  process.exit(0)
}
function reject(message) { console.error(message); process.exit(2) }
if (!modes[mode]) reject('Unknown check. Use --help.')
if (mode !== 'unit' && args.length) reject('This mode takes no extra arguments.')
if (mode === 'unit') {
  if (!args.length) reject('unit requires explicit test files; use unit-all intentionally.')
  for (const arg of args) {
    const path = resolve(root, arg)
    const local = relative(resolve(root, 'tests/unit'), path)
    if (local.startsWith('..') || isAbsolute(local) || !/\.test\.tsx?$/.test(local) ||
        !existsSync(path) || !statSync(path).isFile()) reject(`Invalid unit test path: ${arg}`)
  }
}
const dir = resolve(root, '.agent-local/checks')
mkdirSync(dir, { recursive: true })
const id = `${new Date().toISOString().replace(/[:.]/g, '-')}-${process.pid}-${mode}`
const logPath = resolve(dir, `${id}.log`)
const log = createWriteStream(logPath, { flags: 'wx' })
const start = Date.now()
let bytes = 0
let tail = ''
let firstError = ''
const child = spawn(process.execPath, [...modes[mode], ...args], {
  cwd: root, shell: false, env: { ...process.env, NO_COLOR: '1' }, stdio: ['ignore', 'pipe', 'pipe'],
})
log.on('error', error => { console.error(`Log write failed: ${error.message}`); child.kill(); process.exitCode = 1 })
for (const stream of [child.stdout, child.stderr]) {
  stream.on('data', chunk => {
    bytes += chunk.length
    log.write(chunk)
    const text = chunk.toString()
    tail = (tail + text).slice(-5000)
    if (!firstError && /FAIL|Error:|error TS\d|failed/i.test(text)) firstError = text.slice(0, 1800)
  })
}
child.on('error', error => { firstError = error.message })
child.on('close', (code, signal) => {
  log.end()
  const exit = process.exitCode || (signal ? 1 : code ?? 1)
  const summary = {
    mode, files: args, exit, signal, seconds: Number(((Date.now() - start) / 1000).toFixed(2)),
    capturedBytes: bytes, log: relative(root, logPath),
  }
  console.log(JSON.stringify(summary))
  if (exit !== 0) console.error(`${firstError}\n${tail}`.slice(-6500))
  process.exitCode = exit
})
