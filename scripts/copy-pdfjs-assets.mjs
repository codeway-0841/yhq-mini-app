/**
 * PDF.js yordamchi asset'larini `public/pdfjs/`ga ko'chiradi:
 *   - cmaps/          — Adobe CMap'lar (CID/Cyrillic matn to'g'ri o'qilishi uchun)
 *   - standard_fonts/ — standart shriftlar (metrics mos kelishi uchun)
 *
 * Nima uchun: pdf.js bu fayllarni RUNTIME'da URL orqali yuklaydi, Vite esa
 * `node_modules` ichidagi papkani avtomatik chiqarmaydi. Skript `npm run dev`
 * (predev) va `npm run build` (scripts/build.mjs) oldidan ishga tushadi.
 *
 * Natija gitignore'da (node_modules'dan generatsiya qilinadi).
 */
import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SRC = path.join(ROOT, 'node_modules', 'pdfjs-dist')
const DEST = path.join(ROOT, 'public', 'pdfjs')

const ASSETS = ['cmaps', 'standard_fonts', 'wasm']

if (!existsSync(SRC)) {
  console.error(`pdfjs-dist topilmadi: ${SRC} — avval npm install`)
  process.exit(1)
}

mkdirSync(DEST, { recursive: true })

let copied = 0
for (const asset of ASSETS) {
  const from = path.join(SRC, asset)
  const to = path.join(DEST, asset)
  if (!existsSync(from)) {
    console.error(`PDF.js asset topilmadi: ${from}`)
    process.exit(1)
  }
  rmSync(to, { recursive: true, force: true })
  cpSync(from, to, { recursive: true })
  copied++
}

console.log(`pdfjs asset'lar tayyor: ${ASSETS.join(', ')} → public/pdfjs/ (${copied} papka)`)
