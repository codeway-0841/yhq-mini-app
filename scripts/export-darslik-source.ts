import { readFileSync, writeFileSync } from 'node:fs'
import { splitDarslikSections, darslikTopicId } from '../shared/darslik-mastery'
import outline from '../src/content/darslik-rustili/outline.json'

// Bundled server source: no filesystem dependency on a deployed/serverless host.
const topics: Record<string, { title: string; source: string }> = {}
for (const [block, titles] of Object.entries(outline)) {
  const source = readFileSync(new URL(`../src/content/darslik-rustili/block-${block.padStart(2, '0')}.md`, import.meta.url), 'utf8')
  const sections = splitDarslikSections(source)
  if (sections.length !== titles.length) throw new Error(`Outline mismatch: ${block}`)
  titles.forEach((title, index) => { topics[darslikTopicId(Number(block), index)] = { title, source: sections[index] } })
}
writeFileSync(new URL('../server/modules/darslik/source.json', import.meta.url), JSON.stringify(topics, null, 2) + '\n')
console.log(`Exported ${Object.keys(topics).length} textbook topics`)
