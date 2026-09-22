/**
 * GOLDEN COURSE PIPELINE (Wondering 1:1 Flagship Course Production Architecture)
 *
 * 7-Step Workflow:
 * 1. course_brief    - Lock target learner, transformation goal, non-goals.
 * 2. source_pack     - Resolve canonical sources, claims, key misconceptions, glossary.
 * 3. curriculum      - Sequence sections and lessons (Mechanism-first vs Builder-first).
 * 4. lesson_specs    - Lock Objective, Likely Confusion, Assessment Target before writing text.
 * 5. lesson_packages - Generate theory pages, concept checklists, inline [[term|definition]], visuals.
 * 6. practice_packages - Aligned assessments (Misconception MCQ, binary_choice, pool_cloze, order).
 * 7. publish_bundle  - Final publish-ready offline course bundle with MindMap, Refractor & Podcast.
 */

import { z } from 'zod'
import type { AiCoursePayload } from './ai-courses'

export const GOLDEN_COURSE_STEP_ORDER = [
  'course_brief',
  'source_pack',
  'curriculum',
  'lesson_specs',
  'lesson_packages',
  'practice_packages',
  'publish_bundle',
] as const

export type GoldenCourseStepId = typeof GOLDEN_COURSE_STEP_ORDER[number]

export const GoldenCourseSourceSchema = z.object({
  id: z.string(),
  kind: z.enum(['topic', 'url', 'text']),
  title: z.string().optional(),
  value: z.string().default(''),
  notes: z.string().optional(),
})
export type GoldenCourseSource = z.infer<typeof GoldenCourseSourceSchema>

export const GoldenCourseRequestSchema = z.object({
  workingTitle: z.string().optional().default(''),
  brief: z.string().optional().default(''),
  sources: z.array(GoldenCourseSourceSchema).default([]),
})
export type GoldenCourseRequest = z.infer<typeof GoldenCourseRequestSchema>

export const GoldenCourseVariantSchema = z.object({
  id: z.string(),
  label: z.string(),
  format: z.enum(['markdown', 'json', 'text']),
  notes: z.string().optional(),
  content: z.string(),
})
export type GoldenCourseVariant = z.infer<typeof GoldenCourseVariantSchema>

export const GoldenCourseStepSchema = z.object({
  id: z.enum(GOLDEN_COURSE_STEP_ORDER),
  title: z.string(),
  goal: z.string(),
  summary: z.string(),
  selectedVariantId: z.string(),
  variants: z.array(GoldenCourseVariantSchema),
})
export type GoldenCourseStep = z.infer<typeof GoldenCourseStepSchema>

export const GoldenCoursePracticeSchema = z.object({
  type: z.enum(['mcq', 'binary_choice', 'cloze', 'order']),
  question: z.string(),
  explanation: z.string(),
  options: z.record(z.string(), z.any()).optional().default({}),
})
export type GoldenCoursePractice = z.infer<typeof GoldenCoursePracticeSchema>

export const GoldenCourseLessonSchema = z.object({
  name: z.string(),
  hook: z.string().default(''),
  meaning: z.string().default(''),
  objective: z.string().optional(),
  likelyConfusion: z.string().optional(),
  concepts: z.array(z.object({ name: z.string(), description: z.string() })).default([]),
  keywords: z.array(z.object({ name: z.string(), description: z.string() })).default([]),
  pages: z.array(z.object({ heading: z.string(), content: z.string() })).default([]),
  practices: z.array(GoldenCoursePracticeSchema).default([]),
})
export type GoldenCourseLesson = z.infer<typeof GoldenCourseLessonSchema>

export const GoldenCourseSectionSchema = z.object({
  name: z.string(),
  lessons: z.array(GoldenCourseLessonSchema),
})
export type GoldenCourseSection = z.infer<typeof GoldenCourseSectionSchema>

export const GoldenCourseFinalCourseSchema = z.object({
  name: z.string(),
  intro: z.string(),
  sections: z.array(GoldenCourseSectionSchema),
})
export type GoldenCourseFinalCourse = z.infer<typeof GoldenCourseFinalCourseSchema>

export const GoldenCourseRunSchema = z.object({
  schemaVersion: z.literal('golden-course-v0'),
  createdAt: z.string(),
  request: GoldenCourseRequestSchema,
  normalizedBrief: z.string(),
  notes: z.string().optional(),
  steps: z.array(GoldenCourseStepSchema),
  finalCourse: GoldenCourseFinalCourseSchema,
})
export type GoldenCourseRun = z.infer<typeof GoldenCourseRunSchema>

export function isGoldenCourseRun(val: unknown): val is GoldenCourseRun {
  return GoldenCourseRunSchema.safeParse(val).success
}

export function getSelectedVariant(step?: GoldenCourseStep | null): GoldenCourseVariant | undefined {
  if (!step) return undefined
  return step.variants.find((v) => v.id === step.selectedVariantId) || step.variants[0]
}

function formatSource(source: GoldenCourseSource, index: number): string {
  const title = source.title?.trim() ? `Title: ${source.title.trim()}\n` : ''
  const notes = source.notes?.trim() ? `Notes: ${source.notes.trim()}\n` : ''
  const kind = source.kind === 'topic' ? 'Topic' : source.kind === 'url' ? 'URL' : 'Text Source'
  return `### Source ${index + 1}
Kind: ${kind}
${title}${notes}Content:
${source.value.trim() || '(empty)'}`
}

export function buildSourceSection(request: GoldenCourseRequest): string {
  if (!request.sources || request.sources.length === 0) {
    return 'No sources were provided.'
  }
  return request.sources.map((s, i) => formatSource(s, i)).join('\n\n')
}

export function buildStepRequirements(): string {
  return `Required steps and their jobs:

1. course_brief
- If the brief is empty, infer it from the strongest sources.
- Produce at least 2 variants when the problem framing is ambiguous.

2. source_pack
- Resolve the input sources into a concrete teaching dossier.
- If a source is a topic, autonomously search for high-quality sources.
- If a source is a URL, fetch and use it.
- If a source is raw text, treat it as canonical input material.
- Surface the best sources, key claims, misconceptions, and glossary.

3. curriculum
- Produce the course structure.
- Include at least 2 variants if the sequencing could reasonably differ (e.g. Mechanism-first vs Builder-first).
- Freeze on one selected variant.

4. lesson_specs
- Define what each lesson must accomplish before writing pages: Objective, Likely Confusion, Assessment Target.

5. lesson_packages
- Produce the actual lesson pages, concepts, hooks, meanings, and keywords.

6. practice_packages
- Produce the practices for each lesson.
- Make sure the practices test the lesson objective and likely confusion rather than just paraphrasing the page text.

7. publish_bundle
- Produce the final, publish-ready offline course bundle.
- The finalCourse object must match this selected variant.`
}

export function buildOutputContract(): string {
  return `Return ONLY JSON with this exact top-level shape:

{
  "schemaVersion": "golden-course-v0",
  "createdAt": "ISO-8601 timestamp",
  "request": {
    "workingTitle": "optional string",
    "brief": "optional string",
    "sources": [
      {
        "id": "string",
        "kind": "topic | url | text",
        "title": "optional string",
        "value": "string",
        "notes": "optional string"
      }
    ]
  },
  "normalizedBrief": "The brief you inferred or refined from the request and sources",
  "notes": "optional short operator note",
  "steps": [
    {
      "id": "course_brief | source_pack | curriculum | lesson_specs | lesson_packages | practice_packages | publish_bundle",
      "title": "Human-readable title",
      "goal": "What the step is supposed to accomplish",
      "summary": "1-3 sentence summary",
      "selectedVariantId": "string",
      "variants": [
        {
          "id": "string",
          "label": "string",
          "format": "markdown | json | text",
          "notes": "optional short note",
          "content": "string"
        }
      ]
    }
  ],
  "finalCourse": {
    "name": "Course title",
    "intro": "One short intro paragraph",
    "sections": [
      {
        "name": "Section title",
        "lessons": [
          {
            "name": "Lesson name",
            "hook": "string",
            "meaning": "string",
            "concepts": [{ "name": "string", "description": "string" }],
            "keywords": [{ "name": "string", "description": "string" }],
            "pages": [{ "heading": "string", "content": "markdown string" }],
            "practices": [
              {
                "type": "mcq | binary_choice | cloze | order",
                "question": "string",
                "explanation": "string",
                "options": {
                  "choices": [{ "id": "a", "text": "...", "isCorrect": true }]
                }
              }
            ]
          }
        ]
      }
    ]
  }
}`
}

export function buildGoldenCourseCodexPrompt(request: GoldenCourseRequest): string {
  const briefText = request.brief && request.brief.trim().length > 0
    ? request.brief.trim()
    : '(No brief provided. Infer it from the sources.)'

  return `You are Codex acting as an autonomous offline flagship-course production agent for Wondering.

Your job is to run the golden-course workflow end to end from the input below to a publish-ready offline course bundle.

Important operating rules:
- Do not ask for human approval.
- Make reasonable assumptions when something is underspecified.
- Complete the entire workflow end to end.
- If a source is a topic, search and select high-quality learning sources yourself.
- If a source is a URL, fetch and use it.
- If a source is text, treat it as source material.
- If the course brief is empty or weak, infer and refine it from the sources.
- Optimize for course quality, not speed.
- Keep the final course coherent and realistically teachable.
- Return ONLY valid JSON.

Input request:

Working title:
${request.workingTitle && request.workingTitle.trim().length > 0 ? request.workingTitle.trim() : '(No working title provided.)'}

Course brief:
${briefText}

Sources:
${buildSourceSection(request)}

${buildStepRequirements()}

Quality bar:
- Curriculum should reflect real prerequisites.
- Lessons should feel intentionally authored.
- Examples should be concrete and well chosen.
- Practices should test actual understanding.
- The final course should be fully inspectable offline.

${buildOutputContract()}`
}

export function buildUpstreamContext(run: GoldenCourseRun, targetStepId: GoldenCourseStepId): string {
  const idx = run.steps.findIndex((s) => s.id === targetStepId)
  if (idx <= 0) return 'No upstream steps are locked yet.'
  return run.steps.slice(0, idx).map((s) => {
    const v = getSelectedVariant(s)
    return `## ${s.title}
Summary: ${s.summary}
Selected Variant: ${v?.label || '(none)'}
Content:
${v?.content || '(empty)'}`
  }).join('\n\n')
}

export function buildRunOverview(run: GoldenCourseRun): string {
  return run.steps.map((s) => {
    const v = getSelectedVariant(s)
    return `- ${s.id}: ${v?.label || '(none selected)'} — ${s.summary}`
  }).join('\n')
}

export function buildGoldenCourseStepUpdatePrompt(params: {
  request?: GoldenCourseRequest
  run: GoldenCourseRun
  stepId: GoldenCourseStepId
  instruction: string
}): string {
  const step = params.run.steps.find((s) => s.id === params.stepId) || params.run.steps[0]
  const variant = getSelectedVariant(step)
  const instruction = params.instruction.trim() || 'Improve this step while preserving upstream constraints.'
  const request = params.request || params.run.request

  return `You are Codex updating one stage inside an existing offline golden-course pipeline run for Wondering.

Update target:
- Step ID: ${step.id}
- Step Title: ${step.title}

Instruction:
${instruction}

Rules:
- Preserve upstream decisions unless the instruction explicitly requires changing them.
- Regenerate the target step in a stronger form.
- Update any downstream steps that are materially affected.
- Keep the top-level JSON schema exactly the same.
- Return ONLY valid JSON.

Current run overview:
${buildRunOverview(params.run)}

Locked upstream context:
${buildUpstreamContext(params.run, step.id)}

Current selected variant for the target step:
Label: ${variant?.label || '(none)'}
Format: ${variant?.format || 'text'}
Content:
${variant?.content || '(empty)'}

Original request:
${JSON.stringify(request, null, 2)}

${buildOutputContract()}`
}

/**
 * Converts a GoldenCourseRun into Kivvi's canonical AiCoursePayload for immediate playability.
 */
export function convertGoldenCourseToAiCoursePayload(run: GoldenCourseRun): AiCoursePayload {
  const outcomes = [
    `${run.finalCourse.name} asosiy mental modellarini tushunasiz`,
    'Nazariy mexanizmlarni amaliy holatlardan ajrata olasiz',
    'Keng tarqalgan xato tasavvurlar va stereotiplardan qutulasiz',
    'Bilimlarni mustaqil amaliyotda to‘g‘ri qo‘llay olasiz',
  ]

  const sections = run.finalCourse.sections.map((sec, si) => {
    const sectionId = `sec-${si + 1}`
    const lessons = sec.lessons.map((l, li) => {
      const lessonId = `s${si + 1}-l${li + 1}`

      // Convert pages
      const pages = l.pages.map((p, pi) => {
        if (pi === 1) {
          return {
            kind: 'visual' as const,
            style: 'cycle' as const,
            heading: p.heading || 'Mexanizm tahlili',
            items: [
              { label: 'Kirish signali', value: 85 },
              { label: 'Qayta aloqa', value: 70 },
              { label: 'Natija', value: 95 },
            ],
          }
        }
        return {
          kind: 'text' as const,
          heading: p.heading || l.name,
          body: p.content,
        }
      })

      // Convert practices into AiCoursePractice
      const practices = l.practices.map((pr, pi) => {
        const pId = `${lessonId}-mcq-${pi}`
        if (pr.type === 'binary_choice') {
          return {
            kind: 'mcq' as const,
            id: pId,
            prompt: pr.question,
            options: [
              { id: 'opt_true', text: 'To‘g‘ri (True)' },
              { id: 'opt_false', text: 'Noto‘g‘ri (False)' },
            ],
            correctOptionId: 'opt_false',
          }
        }
        const choices = pr.options?.choices || [
          { id: 'a', text: 'To‘g‘ri mental model', isCorrect: true },
          { id: 'b', text: 'Keng tarqalgan stereotip', isCorrect: false },
        ]
        const correctChoice = choices.find((c: any) => c.isCorrect) || choices[0]
        return {
          kind: 'mcq' as const,
          id: pId,
          prompt: pr.question,
          options: choices.map((c: any) => ({ id: String(c.id), text: String(c.text) })),
          correctOptionId: String(correctChoice.id),
        }
      })

      // Knowledge cards
      const knowledgeCards = (l.concepts && l.concepts.length > 0 ? l.concepts : [
        { name: 'Asosiy xulosa', description: l.meaning || l.name },
      ]).slice(0, 2).map((c, ci) => ({
        id: `${lessonId}-k${ci + 1}`,
        title: c.name,
        body: c.description,
      }))

      return {
        id: lessonId,
        ord: li,
        title: l.name,
        tldr: l.meaning ? `${l.name}: ${l.meaning}` : `${l.name} darsi bo‘yicha asosiy tushunchalar va amaliyot.`,
        hook: l.hook || undefined,
        meaning: l.meaning || undefined,
        objective: l.objective || undefined,
        likelyConfusion: l.likelyConfusion || undefined,
        pages: pages.length > 0 ? pages : [
          { kind: 'text' as const, heading: l.name, body: l.meaning || l.name },
        ],
        practices: practices.length >= 2 ? practices : [
          ...practices,
          {
            kind: 'mcq' as const,
            id: `${lessonId}-mcq-fallback`,
            prompt: `${l.name} bo‘yicha eng to‘g‘ri yondashuv qaysi?`,
            options: [
              { id: 'o1', text: 'Tub mexanizmlarni tushunib amalda sinash' },
              { id: 'o2', text: 'Shunchaki ko‘r-ko‘rona yodlash' },
            ],
            correctOptionId: 'o1',
          },
        ],
        knowledgeCards: knowledgeCards.length > 0 ? knowledgeCards : [
          { id: `${lessonId}-k1`, title: 'Oltin Qoida', body: 'Faktlarni yodlashdan ko‘ra tub mexanizmlarni tushunish 10x ko‘proq foyda beradi.' },
        ],
      }
    })

    return {
      id: sectionId,
      ord: si,
      title: `${si + 1}. ${sec.name}`,
      lessons,
    }
  })

  return {
    version: 1,
    outcomes,
    sections,
  }
}

/**
 * The Authentic Sample Golden Course Run directly extracted from wondering-bundle.js
 */
export const sampleGoldenCourseRun: GoldenCourseRun = {
  schemaVersion: 'golden-course-v0',
  createdAt: '2026-04-24T12:00:00.000Z',
  request: {
    workingTitle: 'Reasoning About LLMs',
    brief: 'Help product-minded builders understand how modern language models work, where they fail, and how to evaluate them without needing an ML research background.',
    sources: [
      { id: 'topic_llms', kind: 'topic', value: 'How modern large language models work and how to evaluate them' },
      { id: 'url_attention', kind: 'url', title: 'Attention Is All You Need', value: 'https://arxiv.org/abs/1706.03762' },
      { id: 'text_notes', kind: 'text', title: 'Internal notes', value: 'The course should feel practical, not like a survey class. Learners need usable intuition about tokens, prediction, hallucinations, evaluation, and prompting limits.' },
    ],
  },
  normalizedBrief: 'Teach product-minded builders how LLMs predict text, where their apparent intelligence breaks down, and how to evaluate real-world usefulness with practical intuition rather than ML math.',
  notes: 'Sample run for the Golden Course Codex workspace.',
  steps: [
    {
      id: 'course_brief',
      title: 'Course Brief',
      goal: 'Lock the learner, transformation goal, and non-goals.',
      summary: 'The selected brief frames this as a practical intuition course for product-minded builders rather than an academic ML survey.',
      selectedVariantId: 'brief_v2',
      variants: [
        {
          id: 'brief_v1',
          label: 'Product intuition',
          format: 'markdown',
          notes: 'More explicitly product-facing.',
          content: `# Course Brief\n\n## Target learner\nProduct-minded builders who use or ship AI features but do not want to become ML researchers.\n\n## Transformation goal\nBy the end of the course, the learner should be able to explain what an LLM is doing, predict common failure modes, and choose better evaluation habits.\n\n## Non-goals\n- Full mathematical treatment of transformers\n- Training infrastructure details\n- Research frontier coverage`,
        },
        {
          id: 'brief_v2',
          label: 'Practical reasoning',
          format: 'markdown',
          notes: 'Selected because it balances mechanism and application.',
          content: `# Course Brief\n\n## Target learner\nBuilders, PMs, designers, and technical generalists who need reliable intuition about LLM behavior.\n\n## Transformation goal\nAfter this course, the learner should be able to:\n1. explain next-token prediction in plain language\n2. understand why strong outputs can still be unreliable\n3. evaluate LLM usefulness through grounded tasks instead of vibes\n\n## Non-goals\n- turning the learner into an ML engineer\n- reproducing the full transformer literature\n- exhaustive prompt engineering tricks`,
        },
      ],
    },
    {
      id: 'source_pack',
      title: 'Source Pack',
      goal: 'Resolve the raw inputs into a usable teaching dossier.',
      summary: 'The selected source pack uses the transformer paper for canonical mechanism, high-quality explainers for intuition, and operator notes to keep the course practical.',
      selectedVariantId: 'source_pack_v1',
      variants: [
        {
          id: 'source_pack_v1',
          label: 'Balanced dossier',
          format: 'markdown',
          content: `# Teaching Dossier\n\n## Canonical sources\n1. Attention Is All You Need\n2. High-quality transformer explainers\n3. Practical notes on evaluation and hallucination behavior\n\n## Core claims\n- LLMs predict next tokens, not truths\n- Apparent reasoning often emerges from pattern completion\n- Reliability depends on task structure and evaluation discipline\n\n## Key misconceptions\n- "The model understands like a human"\n- "A fluent answer is probably a correct answer"\n- "Prompting skill can fully overcome model limitations"\n\n## Glossary\n- token\n- context window\n- attention\n- hallucination\n- evaluation set`,
        },
      ],
    },
    {
      id: 'curriculum',
      title: 'Curriculum',
      goal: 'Choose the sequence of sections and lessons.',
      summary: 'The selected curriculum starts with the prediction mechanism, then moves into failure modes and evaluation so learners get usable intuition quickly.',
      selectedVariantId: 'curriculum_v2',
      variants: [
        {
          id: 'curriculum_v1',
          label: 'Mechanism-first',
          format: 'json',
          content: JSON.stringify({
            courseTitle: 'Reasoning About LLMs',
            sections: [
              { name: 'Prediction Engine', lessons: [{ name: 'Next-Token Prediction' }, { name: 'Tokens and Context' }] },
              { name: 'Reliability', lessons: [{ name: 'Hallucination Patterns' }, { name: 'Practical Evaluation' }] },
            ],
          }, null, 2),
        },
        {
          id: 'curriculum_v2',
          label: 'Builder-first',
          format: 'json',
          notes: 'Selected because it keeps the why before the details.',
          content: JSON.stringify({
            courseTitle: 'Reasoning About LLMs',
            sections: [
              { name: 'What The Model Is Doing', lessons: [{ name: 'Next-Token Prediction' }, { name: 'Tokens and Context Windows' }] },
              { name: 'Where It Breaks', lessons: [{ name: 'Why Fluency Misleads' }, { name: 'Evaluation That Actually Helps' }] },
            ],
          }, null, 2),
        },
      ],
    },
    {
      id: 'lesson_specs',
      title: 'Lesson Specs',
      goal: 'Define what each lesson must accomplish.',
      summary: 'Each lesson has an explicit objective, likely confusion, and assessment target before full pages are written.',
      selectedVariantId: 'lesson_specs_v1',
      variants: [
        {
          id: 'lesson_specs_v1',
          label: 'Compact lesson specs',
          format: 'markdown',
          content: `# Lesson Specs\n\n## Next-Token Prediction\n- Objective: Explain LLM output as prediction over next tokens\n- Likely confusion: Learner thinks the model retrieves full answers from memory\n- Assessment target: Distinguish prediction from understanding\n\n## Tokens and Context Windows\n- Objective: Explain why tokenization and context length shape output quality\n- Likely confusion: Learner assumes the model sees whole words and infinite context\n- Assessment target: Diagnose context truncation and token boundary issues\n\n## Why Fluency Misleads\n- Objective: Explain why confident prose does not imply correctness\n- Likely confusion: Learner equates coherence with truth\n- Assessment target: Identify hallucination risk from task structure\n\n## Evaluation That Actually Helps\n- Objective: Choose concrete eval habits instead of impressionistic testing\n- Likely confusion: Learner thinks ad hoc prompting is enough\n- Assessment target: Design a small but meaningful evaluation loop`,
        },
      ],
    },
    {
      id: 'lesson_packages',
      title: 'Lesson Packages',
      goal: 'Produce the actual lesson content.',
      summary: 'The selected package keeps pages short and practical, with one mechanism lesson and one applied takeaway per lesson.',
      selectedVariantId: 'lesson_packages_v1',
      variants: [
        {
          id: 'lesson_packages_v1',
          label: 'Compact authored package',
          format: 'json',
          content: JSON.stringify({
            lessons: [
              { name: 'Next-Token Prediction', hook: 'Why can a system that predicts text sound so smart?', meaning: 'This lesson gives the core intuition that explains both impressive outputs and obvious failures.', pageCount: 2 },
              { name: 'Tokens and Context Windows', hook: 'Why does a model lose the thread when your prompt gets long?', meaning: 'This lesson explains why context length shapes output quality.', pageCount: 2 },
              { name: 'Why Fluency Misleads', hook: 'Why does an answer that sounds polished still collapse under verification?', meaning: 'This lesson helps learners stop mistaking confidence and flow for correctness.', pageCount: 2 },
              { name: 'Evaluation That Actually Helps', hook: 'How do you stop testing models by vibes and start learning something useful?', meaning: 'This lesson shows how small evaluation loops beat ad hoc prompting.', pageCount: 2 },
            ],
          }, null, 2),
        },
      ],
    },
    {
      id: 'practice_packages',
      title: 'Practice Packages',
      goal: 'Produce lesson-aligned assessments.',
      summary: 'The selected practice bundle uses a small number of focused items that test reasoning, not just recall.',
      selectedVariantId: 'practice_packages_v1',
      variants: [
        {
          id: 'practice_packages_v1',
          label: 'Focused practice bundle',
          format: 'json',
          content: JSON.stringify({
            lessonPracticeCounts: {
              'Next-Token Prediction': 2,
              'Tokens and Context Windows': 2,
              'Why Fluency Misleads': 2,
              'Evaluation That Actually Helps': 2,
            },
            assessmentStrategy: 'Use MCQ for misconception checks and binary_choice for sharp discriminations.',
          }, null, 2),
        },
      ],
    },
    {
      id: 'publish_bundle',
      title: 'Publish Bundle',
      goal: 'Freeze the final offline course bundle.',
      summary: 'The selected publish bundle is a compact four-lesson course with pre-authored pages and practices.',
      selectedVariantId: 'publish_bundle_v1',
      variants: [
        {
          id: 'publish_bundle_v1',
          label: 'Compact bundle',
          format: 'json',
          content: JSON.stringify({
            name: 'Reasoning About LLMs',
            sectionCount: 2,
            lessonCount: 4,
            practiceCount: 8,
          }, null, 2),
        },
      ],
    },
  ],
  finalCourse: {
    name: 'Reasoning About LLMs',
    intro: 'Build practical intuition about what modern language models are doing, where they fail, and how to evaluate them without getting lost in ML jargon.',
    sections: [
      {
        name: 'What The Model Is Doing',
        lessons: [
          {
            name: 'Next-Token Prediction',
            hook: 'Why can a system that predicts text sound so smart?',
            meaning: 'Understanding next-token prediction is the fastest way to stop treating LLM behavior as magic.',
            objective: 'Explain LLM output as prediction over next tokens',
            likelyConfusion: 'Learner thinks the model retrieves full answers from memory',
            concepts: [
              { name: 'Prediction Over Truth', description: 'LLMs choose likely next tokens rather than directly checking whether a statement is true.' },
            ],
            keywords: [
              { name: 'Next-token prediction', description: 'Generating text by estimating which token is most likely to come next.' },
            ],
            pages: [
              {
                heading: 'A Prediction Machine',
                content: `A language model does not begin with a fact and then decide how to say it. It begins with context and predicts what token should come next.\n\nThat mechanism is powerful because language contains a lot of structure. It is limited because prediction is not the same thing as grounded verification.`,
              },
              {
                heading: 'Why This Looks Like Thinking',
                content: `When prediction works well across many steps, the output can look like reasoning. That appearance is useful, but it can also be misleading.\n\nThe learner should leave this lesson able to explain why fluency can emerge from token prediction alone.`,
              },
            ],
            practices: [
              {
                type: 'mcq',
                question: 'Which description best matches what an LLM is doing during generation?',
                explanation: 'The core mechanism is choosing likely next tokens from context, not directly verifying truth.',
                options: {
                  choices: [
                    { id: 'a', text: 'Predicting likely next tokens from context', isCorrect: true },
                    { id: 'b', text: 'Looking up a single stored answer', isCorrect: false },
                    { id: 'c', text: 'Running a built-in fact checker first', isCorrect: false },
                  ],
                },
              },
              {
                type: 'binary_choice',
                question: 'If a response sounds thoughtful, that alone is strong evidence it was factually verified.',
                explanation: 'Fluency can emerge from prediction alone, so polished prose is not evidence of verification.',
                options: {
                  choices: [
                    { id: 'true', text: 'True', isCorrect: false },
                    { id: 'false', text: 'False', isCorrect: true },
                  ],
                },
              },
            ],
          },
          {
            name: 'Tokens and Context Windows',
            hook: 'Why does a model lose the thread when your prompt gets long or oddly formatted?',
            meaning: 'This lesson explains why token boundaries and limited context change output quality in predictable ways.',
            objective: 'Explain why tokenization and context length shape output quality',
            likelyConfusion: 'Learner assumes the model sees whole words and infinite context',
            concepts: [
              { name: 'Context Limits', description: 'A model can only condition on the tokens inside its active context window.' },
            ],
            keywords: [
              { name: 'Context window', description: 'The amount of tokenized input a model can attend to while generating output.' },
            ],
            pages: [
              {
                heading: 'Tokens Are The Unit',
                content: `Models do not read the world as whole words and neat paragraphs. They process tokens.\n\nThat matters because awkward formatting, repeated boilerplate, and long prompts can crowd out the information you actually need the model to use.`,
              },
              {
                heading: 'When Context Gets Tight',
                content: `As useful context falls out of the window, the model still keeps generating. It just does so with worse grounding.\n\nThat is why prompt length and structure are operational concerns, not cosmetic ones.`,
              },
            ],
            practices: [
              {
                type: 'mcq',
                question: 'What is the main practical risk when key information falls outside the context window?',
                explanation: 'The model will continue generating, but it will do so without access to the missing grounding information.',
                options: {
                  choices: [
                    { id: 'a', text: 'The model stops immediately', isCorrect: false },
                    { id: 'b', text: 'The model continues with weaker grounding', isCorrect: true },
                    { id: 'c', text: 'The model automatically retrieves the missing context', isCorrect: false },
                  ],
                },
              },
              {
                type: 'binary_choice',
                question: 'Prompt formatting is purely cosmetic if the words stay the same.',
                explanation: 'Formatting changes token structure and salience, so it can change model behavior.',
                options: {
                  choices: [
                    { id: 'true', text: 'True', isCorrect: false },
                    { id: 'false', text: 'False', isCorrect: true },
                  ],
                },
              },
            ],
          },
        ],
      },
      {
        name: 'Where It Breaks',
        lessons: [
          {
            name: 'Why Fluency Misleads',
            hook: 'Why does an answer that sounds polished still collapse under verification?',
            meaning: 'This lesson helps learners separate surface quality from actual reliability.',
            objective: 'Explain why confident prose does not imply correctness',
            likelyConfusion: 'Learner equates coherence with truth',
            concepts: [
              { name: 'Fluency Is Not Evidence', description: 'A coherent answer can still be wrong because language fluency and factual correctness are different properties.' },
            ],
            keywords: [
              { name: 'Hallucination', description: 'A plausible-looking output that is unsupported, incorrect, or fabricated.' },
            ],
            pages: [
              {
                heading: 'The Confidence Trap',
                content: `An LLM can produce smooth explanations even when it lacks grounding. That is not a rare edge case. It is a direct consequence of text prediction.\n\nThe danger is not only false facts. It is the false feeling of reliability.`,
              },
              {
                heading: 'Better Questions To Ask',
                content: `Instead of asking whether an answer sounds good, ask what evidence supports it, what constraints the task imposed, and how easily the answer can be checked.\n\nThat shift turns vague trust into operational judgment.`,
              },
            ],
            practices: [
              {
                type: 'mcq',
                question: 'Why is polished prose a weak proxy for correctness in LLM output?',
                explanation: 'Because fluency can emerge from token prediction even when the model lacks grounding.',
                options: {
                  choices: [
                    { id: 'a', text: 'Because polished prose always means the output is random', isCorrect: false },
                    { id: 'b', text: 'Because fluency and correctness are different properties', isCorrect: true },
                    { id: 'c', text: 'Because long answers are always wrong', isCorrect: false },
                  ],
                },
              },
              {
                type: 'binary_choice',
                question: 'A hallucination is only a problem when the answer sounds strange.',
                explanation: 'The most dangerous hallucinations are often the plausible ones.',
                options: {
                  choices: [
                    { id: 'true', text: 'True', isCorrect: false },
                    { id: 'false', text: 'False', isCorrect: true },
                  ],
                },
              },
            ],
          },
          {
            name: 'Evaluation That Actually Helps',
            hook: 'How do you stop testing models by vibes and start learning something useful?',
            meaning: 'This lesson shows how small, intentional evaluation loops beat ad hoc prompting.',
            objective: 'Choose concrete eval habits instead of impressionistic testing',
            likelyConfusion: 'Learner thinks ad hoc prompting is enough',
            concepts: [
              { name: 'Task-First Evaluation', description: 'Useful evaluation starts from a real task and a clear success criterion rather than generic curiosity.' },
            ],
            keywords: [
              { name: 'Evaluation set', description: 'A small, intentional collection of examples used to test whether a model is actually useful for a task.' },
            ],
            pages: [
              {
                heading: 'Start With The Task',
                content: `A useful evaluation asks whether the model helps with a real task under recognizable constraints.\n\nThat usually means defining examples, expected behavior, and obvious failure cases before you start prompting.`,
              },
              {
                heading: 'Small Loops Beat Vibes',
                content: `A compact evaluation set with known expectations teaches you more than ten impressive one-off demos.\n\nYou do not need a giant benchmark to become more disciplined. You need a repeatable loop.`,
              },
            ],
            practices: [
              {
                type: 'mcq',
                question: 'What is the strongest starting point for evaluating whether an LLM is useful?',
                explanation: 'Start from a real task and explicit success criteria, not from curiosity-driven prompting alone.',
                options: {
                  choices: [
                    { id: 'a', text: 'Try many random prompts and trust your intuition', isCorrect: false },
                    { id: 'b', text: 'Define a real task with clear expectations', isCorrect: true },
                    { id: 'c', text: 'Ask only for the most impressive demo possible', isCorrect: false },
                  ],
                },
              },
              {
                type: 'binary_choice',
                question: 'A small repeatable evaluation loop is usually more informative than isolated impressive demos.',
                explanation: 'Repeatable evaluation produces comparable evidence; isolated demos mostly produce impressions.',
                options: {
                  choices: [
                    { id: 'true', text: 'True', isCorrect: true },
                    { id: 'false', text: 'False', isCorrect: false },
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
