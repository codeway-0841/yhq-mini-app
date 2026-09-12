import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  buildSocraticPrompt,
  PhotoSolveResultSchema,
  solveProblemFromPhoto,
  streamSocraticChatResponse,
} from '../../../server/modules/tutor/tutor.service'
import { config } from '../../../server/config'

describe('tutor.service unit tests', () => {
  describe('buildSocraticPrompt', () => {
    it('generates prompt with question context in Uzbek', () => {
      const prompt = buildSocraticPrompt({
        subjectId: 'fizika',
        topicName: 'Kinematika',
        questionText: 'Jismning boshlang\'ich tezligi 10 m/s...',
        options: { A: '10 m/s', B: '20 m/s' },
        userSelectedOption: 'A',
        correctAnswer: 'B',
      }, 'uz')

      expect(prompt).toContain('Sokratik repetitorisiz')
      expect(prompt).toContain('Fan: fizika')
      expect(prompt).toContain('Mavzu: Kinematika')
      expect(prompt).toContain('10 m/s')
      expect(prompt).toContain('LaTeX')
    })

    it('generates prompt in Russian when language is ru', () => {
      const prompt = buildSocraticPrompt({
        subjectId: 'matematika',
        questionText: 'Найдите корень уравнения',
      }, 'ru')

      expect(prompt).toContain('Сократический репетитор')
      expect(prompt).toContain('Предмет/Fan: matematika')
    })
  })

  describe('PhotoSolveResultSchema', () => {
    it('validates a correct photo solve response', () => {
      const validData = {
        ocrText: '2x + 4 = 10 tenglamani yeching',
        detectedSubject: 'matematika',
        subjectName: 'Matematika',
        finalAnswer: 'x = 3',
        steps: [
          {
            stepNumber: 1,
            title: '4 ni o\'ng tomonga o\'tkazamiz',
            explanation: '2x = 10 - 4 ya\'ni 2x = 6',
            formula: '$2x = 6$',
          },
          {
            stepNumber: 2,
            title: 'Ikkala tomonni 2 ga bo\'lamiz',
            explanation: 'x = 3',
            formula: '$x = 3$',
          },
        ],
        keyConcept: 'Chiziqli tenglamalar',
      }

      const result = PhotoSolveResultSchema.safeParse(validData)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.finalAnswer).toBe('x = 3')
        expect(result.data.steps).toHaveLength(2)
      }
    })

    it('rejects incomplete data missing required fields', () => {
      const invalidData = {
        ocrText: 'Test',
      }

      const result = PhotoSolveResultSchema.safeParse(invalidData)
      expect(result.success).toBe(false)
    })
  })

  describe('solveProblemFromPhoto', () => {
    beforeEach(() => {
      vi.clearAllMocks()
    })

    it('parses valid Gemini JSON output', async () => {
      vi.spyOn(config.ai, 'geminiApiKey', 'get').mockReturnValue('mock_api_key')

      const mockResponse = {
        ocrText: 'Kuch qanday formula bilan topiladi?',
        detectedSubject: 'fizika',
        subjectName: 'Fizika',
        finalAnswer: 'F = m * a',
        steps: [
          {
            stepNumber: 1,
            title: 'Nyutonning ikkinchi qonuni',
            explanation: 'Kuch jism massasi va tezlanishining ko\'paytmasiga teng',
            formula: '$F = ma$',
          },
        ],
        keyConcept: 'Nyutonning ikkinchi qonuni',
      }

      globalThis.fetch = vi.fn(async () => ({
        ok: true,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [{ text: JSON.stringify(mockResponse) }],
              },
            },
          ],
        }),
      })) as unknown as typeof fetch

      const result = await solveProblemFromPhoto({
        imageBase64: 'data:image/jpeg;base64,abc123mock',
        mimeType: 'image/jpeg',
        subjectHint: 'fizika',
      })

      expect(result.finalAnswer).toBe('F = m * a')
      expect(result.steps).toHaveLength(1)
      expect(result.detectedSubject).toBe('fizika')
    })
  })

  describe('streamSocraticChatResponse', () => {
    it('streams chunks from Gemini SSE response', async () => {
      vi.spyOn(config.ai, 'geminiApiKey', 'get').mockReturnValue('mock_api_key')

      const ssePayload = [
        'data: {"candidates":[{"content":{"parts":[{"text":"Salom! "}]}}]}\n\n',
        'data: {"candidates":[{"content":{"parts":[{"text":"Qaysi formulani "}]}}]}\n\n',
        'data: {"candidates":[{"content":{"parts":[{"text":"qo\'lladingiz?"}]}}]}\n\n',
        'data: [DONE]\n\n',
      ].join('')

      const encoder = new TextEncoder()
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode(ssePayload))
          controller.close()
        },
      })

      globalThis.fetch = vi.fn(async () => ({
        ok: true,
        body: stream,
      })) as unknown as typeof fetch

      const receivedChunks: string[] = []
      const controller = new AbortController()

      await streamSocraticChatResponse({
        messages: [{ role: 'user', content: 'Tushunmadim' }],
        context: { questionText: 'Savol matni' },
        language: 'uz',
        signal: controller.signal,
        onChunk: (chunk) => receivedChunks.push(chunk),
      })

      expect(receivedChunks.join('')).toBe("Salom! Qaysi formulani qo'lladingiz?")
    })
  })
})
