#!/usr/bin/env tsx
/**
 * Generates an interactive, standalone HTML review gallery for visual inspection
 * of physics questions, images, formulas, and answer keys.
 *
 * Usage: npx tsx scripts/generate-physics-review.ts [--topic <id>] [--with-images-only]
 */
import fs from 'node:fs'
import path from 'node:path'
import { renderMathToHtml } from '../src/shared/components/MathText'

interface BankItem {
  externalId: string
  topicExternalId: string
  questionUz: string
  questionRu: string
  optionsUz: Record<string, string>
  optionsRu: Record<string, string>
  correctAnswer: string
  source: string
  image: string | null
}

interface BankData {
  version: number
  subjectId: string
  bankId: string
  bankName: string
  topics: Array<{ externalId: string; nameUz: string; nameRu: string }>
  items: BankItem[]
}

const ROOT = process.cwd()
const JSON_PATH = path.resolve(ROOT, 'content-banks/fizika/physics-print.json')
const OUTPUT_HTML = path.resolve(ROOT, 'content-banks/fizika/physics-review.html')

console.log(`Loading ${JSON_PATH}...`)
const raw = fs.readFileSync(JSON_PATH, 'utf8')
const bank = JSON.parse(raw) as BankData

const topicsMap = new Map(bank.topics.map(t => [t.externalId, t]))
const imagesCount = bank.items.filter(i => i.image).length

console.log(`Generating review HTML for ${bank.items.length} questions (${imagesCount} with images)...`)

let htmlContent = `<!DOCTYPE html>
<html lang="uz">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Fizika Test Banki — Vizual Ko'rik Galereyasi</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.css">
  <style>
    :root {
      --bg: #0e1210;
      --card: #1c222b;
      --text: #f5f5f4;
      --muted: #a8a29e;
      --accent: #1a81fc;
      --success: #10b981;
      --border: rgba(255, 255, 255, 0.08);
    }
    body {
      background: var(--bg);
      color: var(--text);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      margin: 0;
      padding: 20px;
    }
    .header {
      max-width: 1100px;
      margin: 0 auto 24px auto;
      padding-bottom: 16px;
      border-bottom: 1px solid var(--border);
    }
    .stats {
      display: flex;
      gap: 16px;
      margin-top: 8px;
      font-size: 14px;
      color: var(--muted);
    }
    .container {
      max-width: 1100px;
      margin: 0 auto;
      display: grid;
      grid-template-columns: 1fr;
      gap: 20px;
    }
    .card {
      background: var(--card);
      border-radius: 16px;
      padding: 20px;
      border: 1px solid var(--border);
    }
    .card-header {
      display: flex;
      justify-content: space-between;
      margin-bottom: 12px;
      font-size: 13px;
      color: var(--muted);
    }
    .topic-tag {
      background: rgba(26, 129, 252, 0.15);
      color: var(--accent);
      padding: 2px 8px;
      border-radius: 6px;
      font-weight: 500;
    }
    .question-text {
      font-size: 16px;
      line-height: 1.6;
      margin-bottom: 16px;
    }
    .image-preview {
      margin: 12px 0;
      max-width: 380px;
      border-radius: 8px;
      background: #ffffff;
      padding: 6px;
    }
    .image-preview img {
      max-width: 100%;
      height: auto;
      display: block;
    }
    .options-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
      margin-top: 12px;
    }
    @media (max-width: 640px) {
      .options-grid { grid-template-columns: 1fr; }
    }
    .opt {
      padding: 10px 14px;
      border-radius: 10px;
      background: rgba(255, 255, 255, 0.04);
      font-size: 14px;
      display: flex;
      gap: 8px;
      align-items: center;
    }
    .opt.correct {
      background: rgba(16, 185, 129, 0.15);
      border: 1px solid rgba(16, 185, 129, 0.4);
      color: #34d399;
      font-weight: 600;
    }
    .opt-key {
      font-size: 12px;
      opacity: 0.7;
    }
    .katex {
      font-size: 1.05em;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>Fizika Test Banki — Vizual Ko'rik</h1>
    <div class="stats">
      <span>Mavzular: ${bank.topics.length}</span>
      <span>Savollar: ${bank.items.length}</span>
      <span>Rasmli savollar: ${imagesCount}</span>
    </div>
  </div>
  <div class="container">
`

// Sample representative items or all items
const itemsToRender = bank.items.slice(0, 150) // First 150 questions for instant preview

for (const it of itemsToRender) {
  const topic = topicsMap.get(it.topicExternalId)
  const qHtml = renderMathToHtml(it.questionUz)

  let imgHtml = ''
  if (it.image) {
    imgHtml = `<div class="image-preview"><img src="../../public/${it.image.replace(/^\/+/, '')}" alt="${it.externalId}" loading="lazy"/></div>`
  }

  const optKeys = ['A1', 'A2', 'A3', 'A4']
  const optionsHtml = optKeys.map(k => {
    const isCorrect = it.correctAnswer === k
    const optText = it.optionsUz[k] || ''
    const optHtml = renderMathToHtml(optText)
    return `<div class="opt ${isCorrect ? 'correct' : ''}"><span class="opt-key">${k}:</span> <span>${optHtml}</span></div>`
  }).join('')

  htmlContent += `
    <div class="card" id="${it.externalId}">
      <div class="card-header">
        <span class="topic-tag">${it.topicExternalId}: ${topic?.nameUz || ''}</span>
        <span>ID: <strong>${it.externalId}</strong></span>
      </div>
      <div class="question-text">${qHtml}</div>
      ${imgHtml}
      <div class="options-grid">
        ${optionsHtml}
      </div>
    </div>
  `
}

htmlContent += `
  </div>
</body>
</html>
`

fs.writeFileSync(OUTPUT_HTML, htmlContent, 'utf8')
console.log(`✅ Review gallery HTML generated at: ${OUTPUT_HTML}`)
