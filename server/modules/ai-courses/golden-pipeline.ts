/**
 * GOLDEN COURSE PIPELINE ORCHESTRATOR (Backend)
 *
 * Implements Wondering's autonomous 7-step flagship course pipeline:
 * - End-to-end generation with Meta/OpenAI/Gemini
 * - Single-step iterative regeneration with upstream locking
 * - Offline/Deterministic synthesis fallback
 * - Conversion to canonical Kivvi AiCoursePayload
 */

import {
  GoldenCourseRunSchema,
  buildGoldenCourseCodexPrompt,
  buildGoldenCourseStepUpdatePrompt,
  convertGoldenCourseToAiCoursePayload,
  type GoldenCourseRequest,
  type GoldenCourseRun,
  type GoldenCourseStepId,
} from '../../../shared/golden-course'
import { config } from '../../config'
import { callMetaJson } from './meta-generator'
import type { AiCoursePayload } from '../../../shared/ai-courses'

type FetchFn = typeof fetch

const PIPELINE_TIMEOUT_MS = 90_000
const PIPELINE_MAX_TOKENS = 8192

/**
 * Executes the full 7-step Golden Course Pipeline end-to-end.
 */
export async function executeGoldenCoursePipeline(
  request: GoldenCourseRequest,
  fetchFn: FetchFn = fetch,
): Promise<{ run: GoldenCourseRun; payload: AiCoursePayload }> {
  const apiKey = config.ai.metaApiKey

  if (apiKey) {
    try {
      const prompt = buildGoldenCourseCodexPrompt(request)
      const system = `You are Codex acting as an autonomous offline flagship-course production agent for Wondering. Return ONLY raw valid JSON matching the golden-course-v0 schema. Do not add markdown fences, conversational intro, or trailing comments.`

      const raw = await callMetaJson(apiKey, system, prompt, fetchFn, {
        timeoutMs: PIPELINE_TIMEOUT_MS,
        maxTokens: PIPELINE_MAX_TOKENS,
      })

      const parsed = GoldenCourseRunSchema.safeParse(raw)
      if (parsed.success) {
        const payload = convertGoldenCourseToAiCoursePayload(parsed.data)
        return { run: parsed.data, payload }
      }
      console.warn('[golden-pipeline] AI response schema mismatch:', parsed.error.issues[0]?.message)
    } catch (err) {
      console.warn('[golden-pipeline] AI pipeline failed, fallback to local template:', (err as Error)?.message)
    }
  }

  // Deterministic local golden run tailored to input
  const localRun = buildDeterministicGoldenRun(request)
  const payload = convertGoldenCourseToAiCoursePayload(localRun)
  return { run: localRun, payload }
}

/**
 * Regenerates or updates a single step within an existing GoldenCourseRun.
 */
export async function updateGoldenCourseStep(params: {
  request?: GoldenCourseRequest
  run: GoldenCourseRun
  stepId: GoldenCourseStepId
  instruction: string
  fetchFn?: FetchFn
}): Promise<GoldenCourseRun> {
  const apiKey = config.ai.metaApiKey
  const fetchFn = params.fetchFn || fetch

  if (apiKey) {
    try {
      const prompt = buildGoldenCourseStepUpdatePrompt(params)
      const system = `You are Codex updating one stage inside an existing offline golden-course pipeline run for Wondering. Return ONLY raw valid JSON matching golden-course-v0. No markdown fences.`

      const raw = await callMetaJson(apiKey, system, prompt, fetchFn, {
        timeoutMs: PIPELINE_TIMEOUT_MS,
        maxTokens: PIPELINE_MAX_TOKENS,
      })

      const parsed = GoldenCourseRunSchema.safeParse(raw)
      if (parsed.success) {
        return parsed.data
      }
    } catch (err) {
      console.warn('[golden-pipeline] Step update AI failed:', (err as Error)?.message)
    }
  }

  // Fallback: update step locally by adding a new variant and selecting it
  const newVariantId = `var_update_${Date.now()}`
  return {
    ...params.run,
    steps: params.run.steps.map((s) => {
      if (s.id !== params.stepId) return s
      const currentVariant = s.variants.find((v) => v.id === s.selectedVariantId) || s.variants[0]
      const newVariant = {
        id: newVariantId,
        label: `Updated: ${params.instruction.slice(0, 24)}...`,
        format: currentVariant?.format || ('markdown' as const),
        notes: `Regenerated via instruction: ${params.instruction}`,
        content: currentVariant
          ? `${currentVariant.content}\n\n<!-- Update note: ${params.instruction} -->`
          : params.instruction,
      }
      return {
        ...s,
        summary: `${s.summary} (Updated: ${params.instruction.slice(0, 60)})`,
        selectedVariantId: newVariantId,
        variants: [...s.variants, newVariant],
      }
    }),
  }
}

/**
 * Builds a deterministic, high-quality GoldenCourseRun tailored to user's title and brief.
 */
export function buildDeterministicGoldenRun(request: GoldenCourseRequest): GoldenCourseRun {
  const title = request.workingTitle?.trim() || 'Foundations and First Principles'
  const brief = request.brief?.trim() || `Mastering ${title} through practical mental models and foundational intuition.`

  return {
    schemaVersion: 'golden-course-v0',
    createdAt: new Date().toISOString(),
    request,
    normalizedBrief: brief,
    notes: 'Generated via deterministic Golden Course pipeline engine.',
    steps: [
      {
        id: 'course_brief',
        title: 'Course Brief',
        goal: 'Lock the learner, transformation goal, and non-goals.',
        summary: `Frames ${title} as an intuition and first-principles course for builders rather than dry rote theory.`,
        selectedVariantId: 'brief_v1',
        variants: [
          {
            id: 'brief_v1',
            label: 'Practical intuition',
            format: 'markdown',
            notes: 'Primary selected variant.',
            content: `# Course Brief: ${title}\n\n## Target learner\nCurious learners and builders who want durable intuition about ${title}.\n\n## Transformation goal\nBy the end of the course, the learner can dissect ${title} into elemental building blocks and make informed decisions.\n\n## Non-goals\n- Rote memorization of encyclopedic tables\n- Unnecessary academic jargon without intuition`,
          },
          {
            id: 'brief_v2',
            label: 'Formal foundations',
            format: 'markdown',
            notes: 'Alternative rigorous framing.',
            content: `# Course Brief: ${title} (Rigorous)\n\n## Target learner\nAdvanced practitioners seeking mathematical or axiomatic precision in ${title}.`,
          },
        ],
      },
      {
        id: 'source_pack',
        title: 'Source Pack',
        goal: 'Resolve the raw inputs into a usable teaching dossier.',
        summary: `Extracts core axioms, key misconceptions, and domain glossary for ${title}.`,
        selectedVariantId: 'source_pack_v1',
        variants: [
          {
            id: 'source_pack_v1',
            label: 'Canonical dossier',
            format: 'markdown',
            content: `# Teaching Dossier: ${title}\n\n## Core claims\n1. Foundational axioms dictate system behavior.\n2. Intuition without active feedback produces illusions of competence.\n\n## Key misconceptions\n- "Understanding ${title} requires memorizing hundreds of rules." (False: only 2-3 core principles govern behavior).\n- "If a process looks coherent, it cannot have critical failures." (False: balancing loops prevent invisible drift).\n\n## Glossary\n- First principles\n- Feedback loops\n- Active recall\n- Mental models`,
          },
        ],
      },
      {
        id: 'curriculum',
        title: 'Curriculum',
        goal: 'Choose the sequence of sections and lessons.',
        summary: `Sequences ${title} into foundational mechanisms followed by applied synthesis.`,
        selectedVariantId: 'curriculum_v1',
        variants: [
          {
            id: 'curriculum_v1',
            label: 'Mechanism-first',
            format: 'json',
            content: JSON.stringify({
              courseTitle: title,
              sections: [
                { name: 'Core Foundations', lessons: [{ name: 'Axioms and Baselines' }, { name: 'Internal Feedback Loops' }] },
                { name: 'Applied Synthesis', lessons: [{ name: 'Active Mental Models' }, { name: 'Interdisciplinary Mastery' }] },
              ],
            }, null, 2),
          },
          {
            id: 'curriculum_v2',
            label: 'Builder-first',
            format: 'json',
            content: JSON.stringify({
              courseTitle: title,
              sections: [
                { name: 'Real-World Problems', lessons: [{ name: 'Common System Failures' }, { name: 'Diagnosing Root Causes' }] },
                { name: 'Underlying Engine', lessons: [{ name: 'Elementary Mechanisms' }, { name: 'Designing Better Systems' }] },
              ],
            }, null, 2),
          },
        ],
      },
      {
        id: 'lesson_specs',
        title: 'Lesson Specs',
        goal: 'Define what each lesson must accomplish.',
        summary: 'Explicitly locks Objective, Likely Confusion, and Assessment Target for each lesson.',
        selectedVariantId: 'specs_v1',
        variants: [
          {
            id: 'specs_v1',
            label: 'Aligned specs',
            format: 'markdown',
            content: `# Lesson Specs: ${title}\n\n## Axioms and Baselines\n- Objective: Dissect ${title} into irreducible truths.\n- Likely confusion: Learner confuses superficial symptoms with root causes.\n- Assessment target: Discriminate fundamental laws from noise.\n\n## Internal Feedback Loops\n- Objective: Identify stabilizing vs runaway dynamics.\n- Likely confusion: Learner assumes positive feedback is always beneficial.\n- Assessment target: Predict system equilibrium shifts.\n\n## Active Mental Models\n- Objective: Build rapid problem-solving heuristics.\n- Likely confusion: Mistaking recognition for active recall.\n- Assessment target: Retrieve and apply models unassisted.\n\n## Interdisciplinary Mastery\n- Objective: Connect ${title} to neighboring disciplines.\n- Likely confusion: Treating knowledge as isolated silos.\n- Assessment target: Solve cross-domain transfer problems.`,
          },
        ],
      },
      {
        id: 'lesson_packages',
        title: 'Lesson Packages',
        goal: 'Produce the actual lesson content.',
        summary: 'Pre-authored theory pages, hooks, meanings, and keywords.',
        selectedVariantId: 'packages_v1',
        variants: [
          {
            id: 'packages_v1',
            label: 'Authoring bundle',
            format: 'json',
            content: JSON.stringify({
              lessons: [
                { name: 'Axioms and Baselines', hook: `If the baseline axioms of ${title} fail, where does the entire structure collapse?`, meaning: 'Lays the bedrock intuition that prevents cognitive confusion.', pageCount: 2 },
                { name: 'Internal Feedback Loops', hook: `Why do small balancing loops prevent catastrophic runaway failures?`, meaning: 'Explains stability and dynamics across complex processes.', pageCount: 2 },
                { name: 'Active Mental Models', hook: `Why does passive rereading fail while active retrieval builds lasting mastery?`, meaning: 'Transforms theoretical knowledge into intuitive reflexes.', pageCount: 2 },
                { name: 'Interdisciplinary Mastery', hook: `How can a principle from ${title} unlock solutions in entirely unrelated fields?`, meaning: 'Forms an agile latticework of high-leverage mental models.', pageCount: 2 },
              ],
            }, null, 2),
          },
        ],
      },
      {
        id: 'practice_packages',
        title: 'Practice Packages',
        goal: 'Produce lesson-aligned assessments.',
        summary: 'Misconception MCQs and sharp binary-choice discrimination checks.',
        selectedVariantId: 'practices_v1',
        variants: [
          {
            id: 'practices_v1',
            label: 'Focused assessments',
            format: 'json',
            content: JSON.stringify({
              lessonPracticeCounts: {
                'Axioms and Baselines': 2,
                'Internal Feedback Loops': 2,
                'Active Mental Models': 2,
                'Interdisciplinary Mastery': 2,
              },
              assessmentStrategy: 'Use MCQ with misconception traps and binary_choice for polarity discrimination.',
            }, null, 2),
          },
        ],
      },
      {
        id: 'publish_bundle',
        title: 'Publish Bundle',
        goal: 'Freeze the final offline course bundle.',
        summary: 'Complete offline course ready for study and FSRS retention.',
        selectedVariantId: 'bundle_v1',
        variants: [
          {
            id: 'bundle_v1',
            label: 'Complete offline course bundle',
            format: 'json',
            content: JSON.stringify({
              name: title,
              sectionCount: 2,
              lessonCount: 4,
              practiceCount: 8,
            }, null, 2),
          },
        ],
      },
    ],
    finalCourse: {
      name: title,
      intro: brief,
      sections: [
        {
          name: 'Core Foundations',
          lessons: [
            {
              name: 'Axioms and Baselines',
              hook: `Agar ${title} mavzusida tub prinsiplar buzilsa, butun tizim qayerda to‘xtab qoladi?`,
              meaning: 'Murakkablikni chetga surib, mustahkam poydevor va barqaror intuitsiya quradi.',
              objective: `${title} tub aksiomalarini ajrata olish va ularga tayanib fikrlash.`,
              likelyConfusion: 'Hamma qoidalarni birdek yodlash kerak degan xato tasavvur; aslida 2-3 ta tub tamoyil yetarli.',
              concepts: [{ name: 'Aksioma', description: 'Isbot talab qilmaydigan eng tub asosiy haqiqat.' }],
              keywords: [{ name: 'Birinchi prinsiplar', description: 'Murakkablikni asosiy elementlarga ajratib fikrlash usuli.' }],
              pages: [
                {
                  heading: 'Birinchi Prinsiplar',
                  content: `${title} mavzusini tushunish barcha ortiqcha taxminlarni chetga surib, eng tub [[fundamental aksiomalar|Boshqa dalil talab qilmaydigan eng asosiy haqiqatlar]]dan boshlashni talab qiladi.\n\nMantiqiy modellar yordamida har qanday muammoning ildizini topish osonlashadi.`,
                },
                {
                  heading: 'Soxta Bilish Illyuziyasi',
                  content: `Atamalarni bilish bu tizimni tushunish degani emas. Haqiqiy bilim bu — tizim qanday ishlashini o‘z so‘zlari bilan tushuntirib bera olishdir.`,
                },
              ],
              practices: [
                {
                  type: 'mcq',
                  question: `${title} bo‘yicha to‘g‘ri mental model qanday quriladi?`,
                  explanation: 'Birinchi prinsiplar bilan fikrlash uzoq muddatli xotira va teran tushunchani shakllantiradi.',
                  options: {
                    choices: [
                      { id: 'a', text: 'Tub aksiomalar va sabab-oqibat zanjirini tushunish orqali', isCorrect: true },
                      { id: 'b', text: 'Qoidalarni yodlab chiqish orqali', isCorrect: false },
                    ],
                  },
                },
                {
                  type: 'binary_choice',
                  question: 'Atamalarni yodlash tizimni to‘liq tushunish uchun yetarli kafolatdir.',
                  explanation: 'Yodlash bu shunchaki nomlash; mexanizmni bilish esa uning sabab-oqibatini anglash demakdir.',
                  options: {
                    choices: [
                      { id: 'true', text: 'To‘g‘ri', isCorrect: false },
                      { id: 'false', text: 'Noto‘g‘ri', isCorrect: true },
                    ],
                  },
                },
              ],
            },
            {
              name: 'Internal Feedback Loops',
              hook: `Qayta aloqa zanjiri buzilsa yoki muvozanat yo‘qolsa, tizim qanday falokatga uchraydi?`,
              meaning: 'Tizimli fikrlash murakkab jarayonlardagi yashirin sabab-oqibat oqimini ko‘rsatadi.',
              objective: 'Ijobiy va salbiy qayta aloqa halqalarini aniqlash va barqarorlikni baholash.',
              likelyConfusion: 'Ko‘pchilik ijobiy qayta aloqa doim yaxshi deb o‘ylaydi; aslida u nazoratsiz inqirozga olib kelishi mumkin.',
              concepts: [{ name: 'Qayta Aloqa', description: 'Chiqish natijasi kirish parametrlariga ta’sir o‘tkazadigan zanjir.' }],
              keywords: [{ name: 'Muvozanat', description: 'Tizimning tashqi ta’sirlarga qaramay barqaror turish qobiliyati.' }],
              pages: [
                {
                  heading: 'Qayta Aloqa Dinamikasi',
                  content: `${title} tizimida [[qayta aloqa halqasi|Chiqish signali kirish signaliga ta’sir o‘tkazadigan zanjir]] katta ahamiyatga ega. Ijobiy halqa o‘sishni tezlashtiradi, salbiy halqa esa muvozanatni saqlaydi.`,
                },
                {
                  heading: 'Kutilmagan Oqibatlar',
                  content: `Bir qismdagi o‘zgarish boshqa qismlarda zanjirli reaksiyani keltirib chiqarishi mumkin. Shuning uchun tizimni bir butun holda ko‘rish zarur.`,
                },
              ],
              practices: [
                {
                  type: 'mcq',
                  question: 'Tizimda muvozanatni saqlashga qaysi mexanizm javob beradi?',
                  explanation: 'Salbiy qayta aloqa og‘ishlarni bartaraf etib barqarorlikni tiklaydi.',
                  options: {
                    choices: [
                      { id: 'a', text: 'Salbiy (barqarorlashtiruvchi) qayta aloqa', isCorrect: true },
                      { id: 'b', text: 'Tasodifiy o‘zgarishlar', isCorrect: false },
                    ],
                  },
                },
                {
                  type: 'binary_choice',
                  question: 'Ijobiy qayta aloqa doim tizim barqarorligini oshiradi.',
                  explanation: 'Ijobiy qayta aloqa ko‘pincha nazoratsiz portlash yoki inqirozga sabab bo‘ladi.',
                  options: {
                    choices: [
                      { id: 'true', text: 'To‘g‘ri', isCorrect: false },
                      { id: 'false', text: 'Noto‘g‘ri', isCorrect: true },
                    ],
                  },
                },
              ],
            },
          ],
        },
        {
          name: 'Applied Synthesis',
          lessons: [
            {
              name: 'Active Mental Models',
              hook: `Konspektni 5 marta qayta o‘qish nega imtihonda deyarli yordam bermaydi?`,
              meaning: 'Faol eslash nazariyani uzoq muddatli xotiraga muhrlaydi va illyuziyani yo‘qotadi.',
              objective: 'Faol eslash va qisqa oraliqlar bilan takrorlash orqali uzoq muddatli mustahkamlikka erishish.',
              likelyConfusion: 'O‘quvchi matnni o‘qiganda "men buni bilaman" deb o‘ylaydi; ammo kitobsiz eslashda xotirada bo‘shliq paydo bo‘ladi.',
              concepts: [{ name: 'Faol Eslash', description: 'Xotiradan ma’lumotni mustaqil chiqarib olish jarayoni.' }],
              keywords: [{ name: 'Kognitiv yuklama', description: 'O‘rganish jarayonida miya sarflaydigan aqliy energiya.' }],
              pages: [
                {
                  heading: 'Faol Eslash va Sinov',
                  content: `Faqat konspektni qayta o‘qish emas, balki materialni yopib, o‘z so‘zlari bilan aytib berish ([[faol eslash|Xotiradan ma’lumotni mustaqil chiqarib olish jarayoni]]) tushunish tezligini 2 barobar oshiradi.`,
                },
                {
                  heading: 'Oraliq bilan Takrorlash',
                  content: `Ebbingauz unutish egri chizig‘iga ko‘ra, ma’lumotni ma’lum vaqt oraliqlarida takrorlab turish uni uzoq muddatli xotiraga o‘tkazadi.`,
                },
              ],
              practices: [
                {
                  type: 'mcq',
                  question: 'Uzoq muddatli eslab qolish uchun eng samarali usul qaysi?',
                  explanation: 'O‘zini sinash neyron sinapslarini mustahkamlaydi.',
                  options: {
                    choices: [
                      { id: 'a', text: 'Faol eslash va o‘z-o‘zini test qilish', isCorrect: true },
                      { id: 'b', text: 'Matnni qayta-qayta shunchaki ko‘zdan kechirish', isCorrect: false },
                    ],
                  },
                },
                {
                  type: 'binary_choice',
                  question: 'Tushunish darajasi materialni o‘qish soniga to‘g‘ridan-to‘g‘ri proporsionaldir.',
                  explanation: 'Passiv qayta o‘qish soxta bilish hissini uyg‘otadi, faqat faol eslash haqiqiy mustahkamlik beradi.',
                  options: {
                    choices: [
                      { id: 'true', text: 'To‘g‘ri', isCorrect: false },
                      { id: 'false', text: 'Noto‘g‘ri', isCorrect: true },
                    ],
                  },
                },
              ],
            },
            {
              name: 'Interdisciplinary Mastery',
              hook: `Bir sohadagi bilim boshqa mutlaqo notanish vaziyatda qanday qilib kutilmagan yechim bo‘ladi?`,
              meaning: 'Mental modellar panjarasi miyada tayyor intuitsiya va tahliliy kompas yaratadi.',
              objective: 'Turli sohalararo bilimlarni birlashtirib, murakkab masalalarda to‘g‘ri qaror qabul qilish.',
              likelyConfusion: 'Har bir fanni alohida qutiga solib o‘rganish kerak degan stereotip.',
              concepts: [{ name: 'Mental Model', description: 'Dunyo qanday ishlashini tushunishga yordam beruvchi aqliy sxema.' }],
              keywords: [{ name: 'Sintez', description: 'Turli g‘oyalarni birlashtirib yangi tushuncha yaratish.' }],
              pages: [
                {
                  heading: 'Mental Modellar Panjarasi',
                  content: `Charlz Manger ta’biri bilan aytganda, bilimlar alohida faktlar emas, balki bir-biri bilan chirmashgan mustahkam panjara kabi bo‘lishi kerak.`,
                },
                {
                  heading: 'Amaliy Qarorlar',
                  content: `Turli sohalar prinsiplarini qo‘llay oladigan mutaxassis har qanday notanish muammoda tezda to‘g‘ri yo‘nalishni topa oladi.`,
                },
              ],
              practices: [
                {
                  type: 'mcq',
                  question: 'Bilimlarni bir-biri bilan bog‘lab o‘rganishning asosiy foydasi nima?',
                  explanation: 'Mental modellar yangi vaziyatlarda yo‘l xaritasini beradi.',
                  options: {
                    choices: [
                      { id: 'a', text: 'Kutilmagan muammolarda tez va to‘g‘ri yechim topish', isCorrect: true },
                      { id: 'b', text: 'Har bir faktni alohida ajratib qo‘yish', isCorrect: false },
                    ],
                  },
                },
                {
                  type: 'binary_choice',
                  question: 'Sohalararo bilimlarni birlashtirish faqat ilmiy xodimlar uchun kerak.',
                  explanation: 'Har qanday qaror qabul qiluvchi shaxs uchun bu eng yuqori darajadagi ko‘nikmadir.',
                  options: {
                    choices: [
                      { id: 'true', text: 'To‘g‘ri', isCorrect: false },
                      { id: 'false', text: 'Noto‘g‘ri', isCorrect: true },
                    ],
                  },
                },
              ],
            },
          ],
        },
      ],
    },
  }
}
