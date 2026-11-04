import fs from 'fs'
import path from 'path'

const HEX = /^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/
const NEEDS = { normal: [4.5, 7.0], large: [3.0, 4.5], ui: [3.0, 3.0] }

function parseHex(hex) {
  let h = hex.trim().replace(/^#/, '')
  if (h.length === 3) h = h.split('').map((c) => c + c).join('')
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
}

function luminance([r, g, b]) {
  const chan = (c) => {
    const val = c / 255
    return val <= 0.04045 ? val / 12.92 : Math.pow((val + 0.055) / 1.055, 2.4)
  }
  return 0.2126 * chan(r) + 0.7152 * chan(g) + 0.0722 * chan(b)
}

function ratio(fg, bg) {
  const la = luminance(parseHex(fg))
  const lb = luminance(parseHex(bg))
  const hi = Math.max(la, lb)
  const lo = Math.min(la, lb)
  return (hi + 0.05) / (lo + 0.05)
}

const tokensPath = process.argv[2] || 'replica/design/tokens.json'
const raw = fs.readFileSync(path.resolve(tokensPath), 'utf-8')
const data = JSON.parse(raw)

const colors = data.color
const pairs = data.pairs

console.log(`Checking WCAG 2.2 Contrast for: ${tokensPath}`)
let failures = 0

for (const [fgKey, bgKey, size = 'normal'] of pairs) {
  const fg = colors[fgKey]
  const bg = colors[bgKey]
  if (!fg || !bg) {
    console.warn(`[WARN] Missing color key: ${fgKey} or ${bgKey}`)
    continue
  }
  const r = ratio(fg, bg)
  const [minAA, minAAA] = NEEDS[size] || NEEDS.normal
  const passAA = r >= minAA
  const passAAA = r >= minAAA

  const status = passAA ? (passAAA ? 'AAA' : 'AA ') : 'FAIL'
  if (!passAA) failures++

  console.log(
    `[${status}] ${fgKey.padEnd(14)} (${fg}) on ${bgKey.padEnd(10)} (${bg}) -> ${r.toFixed(2)}:1 (need ${minAA}:1)`,
  )
}

if (failures > 0) {
  console.error(`\n❌ Total WCAG Failures: ${failures}`)
  process.exit(1)
} else {
  console.log(`\n✅ All color pairs passed WCAG 2.2 AA floor with 0 failures!`)
}
