/**
 * AI Exam Prompt Engine
 * Constructs specialized, expert-grade system prompts and user prompts for
 * official UzBMB / Attestatsiya exam variant generation.
 */

import type { SubjectExamBlueprint, ExamBlockBlueprint } from './blueprints/types'

export interface BlockPromptPayload {
  systemInstruction: string
  userPrompt: string
}

export function buildExamBlockPrompt(
  blueprint: SubjectExamBlueprint,
  block: ExamBlockBlueprint,
  variantNumber: number,
  sharedContext?: string
): BlockPromptPayload {
  const isMilliy = blueprint.examType === 'milliy-sertifikat'
  const examTitle = isMilliy
    ? 'Национального сертификата (Milliy sertifikat — UzBMB / ГЦТ)'
    : 'Аттестации педагогических кадров (Министерство дошкольного и школьного образования)'

  const systemInstruction = `Вы — главный эксперт-тестолог и ведущий разработчик тестовых материалов ${examTitle} по предмету «${blueprint.subjectNameRu}».

Ваша задача — сгенерировать официальный блок тестовых заданий (Вопросы №${block.startNumber}–${block.endNumber}) для Варианта №${variantNumber}.

ТРЕБОВАНИЯ К КАЧЕСТВУ И МЕТОДИКЕ (СТАНДАРТ UzBMB / ПОСТАНОВЛЕНИЕ №646):
1. АКАДЕМИЧЕСКАЯ БЕЗУПРЕЧНОСТЬ:
   - Каждый вопрос должен иметь РОВНО ОДИН научно доказанный правильный ответ. Никакой двусмысленности или спорных трактовок.
   - Формулировки должны быть кристально ясными, лаконичными и академически выверенными.
2. ПРАВДОПОДОБИЕ ДИСТРАКТОРОВ (НЕПРАВИЛЬНЫХ ВАРИАНТОВ):
   - Запрещены тривиальные, очевидно нелепые варианты ответов и подсказки вроде «все вышеперечисленные» или «ни один из них».
   - Каждый неверный вариант должен отражать ТИПИЧНУЮ ОШИБКУ учащегося (например: ложная проверка чередующейся гласной, смешение паронимов, путаница переходности, неправильное определение грамматической основы).
3. СТРОГОЕ СЛЕДОВАНИЕ СПЕЦИФИКАЦИИ БЛОКА:
   - Каждый номер вопроса должен точно соответствовать заданной теме, проверяемому навыку и уровню сложности (easy, medium, hard).
4. ДЕТАЛЬНОЕ ОБЪЯСНЕНИЕ (EXPLANATION):
   - Для каждого вопроса ОБЯЗАТЕЛЬНО предоставьте профессиональное методическое объяснение: формулировка правила, разбор языкового материала, обоснование правильного ответа и причина ошибочности дистракторов.
5. ФОРМАТ ДАННЫХ:
   - Ответ должен быть СТРОГО валидным JSON-массивом (без обратных кавычек \`\`\`json, чистый текст).
   - Ровно 4 варианта ответов с ID: "A1", "A2", "A3", "A4".
   - Поле "correctAnswer" указывает ID верного варианта (например "A1" или "A3").
   - Для экзамена по русскому языку поля "questionRu" и "optionsRu" содержат русский текст. Поля "questionUz" и "optionsUz" также должны содержать этот же русский текст (так как экзамен по русскому языку в Узбекистане сдаётся на русском языке).
6. ПРАВИЛА ЭКРАНИРОВАНИЯ В JSON:
   - Внутри текста вопросов, вариантов и объяснений используйте русские кавычки-ёлочки «...» вместо двойных английских кавычек "...".
   - Переносы строк внутри строковых значений экранируйте строго как \\n.`

  // Build the list of required questions with instructions
  const questionSpecsFormatted = block.questions
    .map((q) => {
      return `Вопрос №${q.number}:
  - Раздел: ${q.topicCategory}
  - Тема: ${q.topic}
  - Проверяемый навык: ${q.skill}
  - Сложность: ${q.difficulty}
  - Тип задания: ${q.type}
  - Методические указания: ${q.instructions}`
    })
    .join('\n\n')

  let userPrompt = `Составьте блок тестовых заданий №${block.startNumber}–${block.endNumber} для Варианта №${variantNumber} по предмету «${blueprint.subjectNameRu}» (${examTitle}).\n\n`

  if (block.sharedContextPrompt) {
    userPrompt += `ОСОБОЕ ТРЕБОВАНИЕ К КОНТЕКСТУ / ТЕКСТУ БЛОКА:\n${block.sharedContextPrompt}\n\n`
  }

  if (sharedContext) {
    userPrompt += `РАНЕЕ СФОРМИРОВАННЫЙ КОНТЕКСТ / БАЗОВЫЙ ТЕКСТ:\n${sharedContext}\n\n`
  }

  userPrompt += `СПИСОК ТРЕБУЕМЫХ ВОПРОСОВ И ИХ СПЕЦИФИКАЦИЯ:\n${questionSpecsFormatted}\n\n`

  userPrompt += `ТРЕБУЕМЫЙ ФОРМАТ ВЫВОДА (JSON массив объектов):
[
  {
    "number": ${block.startNumber},
    "topicCategory": "...",
    "topic": "...",
    "difficulty": "medium",
    "questionUz": "Текст вопроса на русском языке...",
    "questionRu": "Текст вопроса на русском языке...",
    "optionsUz": [
      { "id": "A1", "text": "Вариант 1" },
      { "id": "A2", "text": "Вариант 2" },
      { "id": "A3", "text": "Вариант 3" },
      { "id": "A4", "text": "Вариант 4" }
    ],
    "optionsRu": [
      { "id": "A1", "text": "Вариант 1" },
      { "id": "A2", "text": "Вариант 2" },
      { "id": "A3", "text": "Вариант 3" },
      { "id": "A4", "text": "Вариант 4" }
    ],
    "correctAnswer": "A1",
    "explanation": "Подробное методическое объяснение с правилом и разбором..."
  }
]`

  return { systemInstruction, userPrompt }
}
