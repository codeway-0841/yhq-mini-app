import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const root = fileURLToPath(new URL('../', import.meta.url))
for (const name of ['kivvi-qa', 'kivvi-memory', 'kivvi-workflow']) {
  const text = readFileSync(resolve(root, `.agents/skills/${name}/SKILL.md`), 'utf8')
  const header = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/)
  assert.ok(header, `${name}: missing frontmatter`)
  // These skills deliberately use only two plain single-line YAML string fields.
  // Reject syntax needing a YAML parser rather than pretend to validate arbitrary YAML.
  const lines = header[1].split(/\r?\n/)
  assert.equal(lines.length, 2)
  assert.equal(lines[0], `name: ${name}`)
  assert.match(lines[1], /^description: [A-Za-z][^\n]*$/)
  assert.ok(!lines[1].slice(13).includes(': '), 'Quote complex YAML strings instead')
  assert.ok(!/TODO|\[INSERT|\[REPLACE/.test(text), `${name}: scaffold remains`)
}
for (const path of ['docs/agent-context/architecture.md', 'docs/agent-context/backend.md',
  'docs/agent-context/design.md', 'docs/agent-context/memory.md', '.codex/agents/kivvi-qa.toml']) {
  assert.ok(existsSync(resolve(root, path)), `Missing ${path}`)
}
for (const args of [['unit'], ['unknown'], ['unit', '../outside.test.ts'],
  ['unit', 'tests/unit/nonexistent.test.ts'], ['client', '--extra']]) {
  const result = spawnSync(process.execPath, ['scripts/agent-check.mjs', ...args], { cwd: root, encoding: 'utf8' })
  assert.equal(result.status, 2, `Expected input rejection: ${args.join(' ')}`)
}
const help = spawnSync(process.execPath, ['scripts/agent-check.mjs', '--help'], { cwd: root, encoding: 'utf8' })
assert.equal(help.status, 0)
assert.match(help.stdout, /Usage:/)
console.log('PASS: three flat-frontmatter skills, reference paths, runner help and five invalid-input cases. TOML validated separately; not a general YAML validator.')
