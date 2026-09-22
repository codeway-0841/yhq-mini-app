import { describe, it, expect } from 'vitest'
import {
  sampleGoldenCourseRun,
  isGoldenCourseRun,
  buildGoldenCourseCodexPrompt,
  buildGoldenCourseStepUpdatePrompt,
  convertGoldenCourseToAiCoursePayload,
  GoldenCourseRunSchema,
  GoldenCourseRequest,
  getSelectedVariant,
} from '../../../shared/golden-course'
import {
  buildDeterministicGoldenRun,
  updateGoldenCourseStep,
} from '../../../server/modules/ai-courses/golden-pipeline'

describe('Golden Course Pipeline & Codex Architecture', () => {
  describe('sampleGoldenCourseRun & Schemas', () => {
    it('authenticates sampleGoldenCourseRun against GoldenCourseRunSchema', () => {
      const parseResult = GoldenCourseRunSchema.safeParse(sampleGoldenCourseRun)
      expect(parseResult.success).toBe(true)
      expect(isGoldenCourseRun(sampleGoldenCourseRun)).toBe(true)
    })

    it('contains all 7 required steps in canonical order', () => {
      const stepIds = sampleGoldenCourseRun.steps.map((s) => s.id)
      expect(stepIds).toEqual([
        'course_brief',
        'source_pack',
        'curriculum',
        'lesson_specs',
        'lesson_packages',
        'practice_packages',
        'publish_bundle',
      ])
    })

    it('resolves selectedVariant properly', () => {
      const briefStep = sampleGoldenCourseRun.steps[0]
      const variant = getSelectedVariant(briefStep)
      expect(variant).toBeDefined()
      expect(variant?.id).toBe(briefStep.selectedVariantId)
    })
  })

  describe('Prompt Builders', () => {
    const request: GoldenCourseRequest = {
      workingTitle: 'Kvant Kompyuterlari Asoslari',
      brief: 'Qubitlar, superpozitsiya va Grover algoritmini amaliy o‘rganish',
      sources: [
        {
          id: 'src-1',
          kind: 'topic',
          title: 'Quantum Gates',
          value: 'Hadamard, CNOT va Pauli darvozalari',
          notes: 'Amaliy misollar bilan',
        },
        {
          id: 'src-2',
          kind: 'url',
          title: 'Qiskit Docs',
          value: 'https://qiskit.org/documentation',
          notes: 'Dasturlash amaliyoti',
        },
      ],
    }

    it('builds comprehensive Codex orchestrator prompt with all 7 step instructions', () => {
      const prompt = buildGoldenCourseCodexPrompt(request)

      expect(prompt).toContain('You are Codex acting as an autonomous')
      expect(prompt).toContain('Kvant Kompyuterlari Asoslari')
      expect(prompt).toContain('Qubitlar, superpozitsiya va Grover algoritmini amaliy o‘rganish')
      expect(prompt).toContain('course_brief')
      expect(prompt).toContain('source_pack')
      expect(prompt).toContain('curriculum')
      expect(prompt).toContain('lesson_specs')
      expect(prompt).toContain('lesson_packages')
      expect(prompt).toContain('practice_packages')
      expect(prompt).toContain('publish_bundle')
      expect(prompt).toContain('### Source 1')
      expect(prompt).toContain('### Source 2')
    })

    it('builds step update prompt with upstream context locking', () => {
      const updatePrompt = buildGoldenCourseStepUpdatePrompt({
        run: sampleGoldenCourseRun,
        stepId: 'curriculum',
        instruction: 'Mavzularni kvant algoritmlaridan boshlang va apparat qismini oxiriga suring',
      })

      expect(updatePrompt).toContain('You are Codex updating one stage')
      expect(updatePrompt).toContain('Step ID: curriculum')
      expect(updatePrompt).toContain('Mavzularni kvant algoritmlaridan boshlang')
      expect(updatePrompt).toContain('Locked upstream context:')
      expect(updatePrompt).toContain('Course Brief')
      expect(updatePrompt).toContain('Source Pack')
    })
  })

  describe('Converter: GoldenCourseRun -> AiCoursePayload', () => {
    it('losslessly converts GoldenCourseRun into playable Kivvi course payload', () => {
      const payload = convertGoldenCourseToAiCoursePayload(sampleGoldenCourseRun)

      expect(payload.version).toBe(1)
      expect(payload.outcomes.length).toBeGreaterThan(0)
      expect(payload.sections.length).toBeGreaterThan(0)

      const firstSection = payload.sections[0]
      expect(firstSection.title).toBeTruthy()
      expect(firstSection.lessons.length).toBeGreaterThan(0)

      const firstLesson = firstSection.lessons[0]
      expect(firstLesson.title).toBeTruthy()
      expect(firstLesson.hook).toBeTruthy()
      expect(firstLesson.meaning).toBeTruthy()
      expect(firstLesson.objective).toBeTruthy()
      expect(firstLesson.likelyConfusion).toBeTruthy()
      expect(firstLesson.pages.length).toBeGreaterThan(0)
      expect(firstLesson.practices.length).toBeGreaterThan(0)
    })
  })

  describe('golden-pipeline backend engine', () => {
    it('buildDeterministicGoldenRun produces a complete, compliant 7-step run', () => {
      const run = buildDeterministicGoldenRun({
        workingTitle: 'Dvigatel mexanikasi',
        brief: 'Ichki yonuv dvigatellari va ularning foydali ish koeffitsiyenti',
        sources: [],
      })

      expect(isGoldenCourseRun(run)).toBe(true)
      expect(run.steps.length).toBe(7)
      expect(run.finalCourse.sections.length).toBeGreaterThan(0)
      expect(run.finalCourse.sections[0].lessons[0].hook).toContain('Dvigatel mexanikasi')
    })

    it('updateGoldenCourseStep appends a new variant and switches selectedVariantId', async () => {
      const initialRun = buildDeterministicGoldenRun({
        workingTitle: 'Test Course',
        brief: 'Test brief',
        sources: [],
      })

      const updatedRun = await updateGoldenCourseStep({
        run: initialRun,
        stepId: 'course_brief',
        instruction: 'Faqat magistrantlar uchun chuqurlashtirilgan formatga o‘ting',
        fetchFn: (async () => {
          throw new Error('skip AI network in unit test')
        }) as unknown as typeof fetch,
      })

      const briefStep = updatedRun.steps.find((s) => s.id === 'course_brief')
      expect(briefStep).toBeDefined()
      expect(briefStep?.variants.length).toBeGreaterThan(1)
      expect(briefStep?.selectedVariantId).toMatch(/^var_update_/)
      const currentVariant = getSelectedVariant(briefStep)
      expect(currentVariant?.content).toContain('magistrantlar')
    })
  })
})
