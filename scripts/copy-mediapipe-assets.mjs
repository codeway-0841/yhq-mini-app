/**
 * MediaPipe Tasks Vision WASM asset'larini `public/mediapipe/wasm/`ga ko'chiradi
 * (CamAi — features/camai yuz aniqlash uchun).
 *
 * Nima uchun: FilesetResolver.forVisionTasks(basePath) wasm/*.wasm|js fayllarni
 * RUNTIME'da URL orqali yuklaydi, Vite esa node_modules ichidagi papkani
 * avtomatik chiqarmaydi. Skript `npm run dev` (predev) va `npm run build`
 * (scripts/build.mjs) oldidan ishga tushadi.
 *
 * Model fayli (blaze_face_short_range.tflite, ~230KB) shu yerdan EMAS —
 * u public/models/ da TRACKED (git'da saqlanadi, build'da network shart emas).
 *
 * Natija gitignore'da (node_modules'dan generatsiya qilinadi).
 */
import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SRC = path.join(ROOT, 'node_modules', '@mediapipe', 'tasks-vision', 'wasm')
const DEST = path.join(ROOT, 'public', 'mediapipe', 'wasm')

if (!existsSync(SRC)) {
  console.error(`@mediapipe/tasks-vision topilmadi: ${SRC} — avval npm install`)
  process.exit(1)
}

mkdirSync(DEST, { recursive: true })
rmSync(DEST, { recursive: true, force: true })
mkdirSync(DEST, { recursive: true })
cpSync(SRC, DEST, { recursive: true })

console.log(`mediapipe wasm tayyor: ${SRC} → public/mediapipe/wasm/`)
