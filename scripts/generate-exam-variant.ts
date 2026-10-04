/**
 * CLI Tool: Generate Official Exam Variant using AI
 *
 * Usage:
 *   npx tsx scripts/generate-exam-variant.ts --subject=rustili --type=milliy-sertifikat --variant=1 --save
 *   npx tsx scripts/generate-exam-variant.ts --subject=rustili --type=attestatsiya --variant=1 --save
 */

import 'dotenv/config'
import fs from 'node:fs'
import path from 'node:path'
import {
  generateExamVariant,
  type GeneratedExamVariant,
} from '../server/modules/admin/exam-variant-generator.service'
import { listAvailableBlueprints } from '../server/modules/admin/blueprints'

function parseArgs() {
  const args = process.argv.slice(2)
  const params: Record<string, string | boolean> = {}

  for (const arg of args) {
    if (arg.startsWith('--')) {
      const [key, val] = arg.slice(2).split('=')
      params[key] = val !== undefined ? val : true
    }
  }

  return {
    subjectId: (params['subject'] as string) || 'rustili',
    examType: (params['type'] as any) || 'milliy-sertifikat',
    variantNumber: Number(params['variant']) || 1,
    save: Boolean(params['save'] ?? true),
    list: Boolean(params['list']),
  }
}

async function main() {
  const options = parseArgs()

  console.log('='.repeat(65))
  console.log('🤖 KIVVI AI EXAM VARIANT GENERATOR')
  console.log('='.repeat(65))

  if (options.list) {
    console.log('\nMavjud Exam Blueprintlar ro‘yxati:')
    const bps = listAvailableBlueprints()
    for (const b of bps) {
      console.log(` - [${b.subjectId}] ${b.subjectNameRu} (${b.examType}): ${b.totalQuestions} savol, ${b.durationMinutes} daqiqa, ${b.blocksCount} blok`)
    }
    return
  }

  console.log(`📚 Fan:           ${options.subjectId}`)
  console.log(`📋 Imtihon turi:  ${options.examType}`)
  console.log(`🔢 Variant №:     ${options.variantNumber}`)
  console.log(`💾 Faylga saqlash: ${options.save ? 'HA' : 'YO‘Q'}`)
  console.log('-'.repeat(65))

  const startTime = Date.now()

  try {
    const variant: GeneratedExamVariant = await generateExamVariant(
      {
        subjectId: options.subjectId,
        examType: options.examType,
        variantNumber: options.variantNumber,
        saveToFile: options.save,
      },
      (status, pct) => {
        console.log(`[${pct}%] ${status}`)
      }
    )

    const elapsedSec = ((Date.now() - startTime) / 1000).toFixed(1)

    console.log('='.repeat(65))
    console.log(`✅ Variant muvaffaqiyatli tuzildi (${elapsedSec}s)!`)
    console.log(`   ID:              ${variant.variantId}`)
    console.log(`   Sarlavha:        ${variant.title}`)
    console.log(`   Jami savollar:   ${variant.questions.length}`)
    console.log(`   Standart manba:  ${variant.specificationSource}`)

    if (options.save) {
      const savedPath = path.resolve(
        process.cwd(),
        `content-banks/${variant.subjectId}/variants/${variant.variantId}.json`
      )
      console.log(`   📁 Saqlangan joy: ${savedPath}`)
    }

    console.log('\nNamuna savollar (dastlabki 3 ta):')
    for (const q of variant.questions.slice(0, 3)) {
      console.log(`\n--- Savol №${q.number} [${q.topicCategory}] ---`)
      console.log(`Savol: ${q.questionRu}`)
      for (const opt of q.optionsRu) {
        const mark = opt.id === q.correctAnswer ? ' (✓ TO‘G‘RI)' : ''
        console.log(`  [${opt.id}] ${opt.text}${mark}`)
      }
      console.log(`💡 Tushuntirish: ${q.explanation.slice(0, 120)}...`)
    }

    console.log('\n' + '='.repeat(65))
  } catch (err: any) {
    console.error('\n❌ Xatolik yuz berdi:', err?.message || err)
    process.exit(1)
  }
}

main()
