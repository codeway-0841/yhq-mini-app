import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  buildSocraticPrompt,
  PhotoSolveResultSchema,
  solveProblemFromPhoto,
  analyzeGraphImage,
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
      expect(prompt).toContain('AKADEMIK HALOLLIK VA UY VAZIFALARI')
      expect(prompt).toContain('TAYYOR JAVOBNI BERMA')
      expect(prompt).toContain('TEST VA KVIZLAR O‘TKAZISH QOIDASI')
      expect(prompt).toContain('MINI-KURS VA REJA TUZISH')
      expect(prompt).toContain('Kivvi AI')
    })

    it('generates prompt in Russian when language is ru', () => {
      const prompt = buildSocraticPrompt({
        subjectId: 'matematika',
        questionText: 'Найдите корень уравнения',
      }, 'ru')

      expect(prompt).toContain('Сократический репетитор')
      expect(prompt).toContain('Предмет/Fan: matematika')
      expect(prompt).toContain('АКАДЕМИЧЕСКАЯ ЧЕСТНОСТЬ И ДОМАШНИЕ ЗАДАНИЯ')
      expect(prompt).toContain('НЕ ВЫДАВАЙ ГОТОВЫЙ ОТВЕТ')
      expect(prompt).toContain('ПРАВИЛА ПРОВЕДЕНИЯ ТЕСТОВ И КВИЗОВ')
      expect(prompt).toContain('Kivvi AI')
    })

    it('returns standalone system prompt without context', () => {
      const promptUz = buildSocraticPrompt({}, 'uz')
      expect(promptUz).toContain('Sen Kivvi platformasining AI o‘quv murabbiyisan')
      expect(promptUz).not.toContain('SAVOL VA VAZIFANING KONTEKSTI')

      const promptRu = buildSocraticPrompt({}, 'ru')
      expect(promptRu).toContain('Ты — AI-наставник и персональный Сократический репетитор платформы Kivvi')
      expect(promptRu).not.toContain('КОНТЕКСТ ТЕКУЩЕГО ВОПРОСА')
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

describe('analyzeGraphImage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('vision javobini matn sifatida qaytaradi va data URL prefiksini olib tashlaydi', async () => {
    vi.spyOn(config.ai, 'geminiApiKey', 'get').mockReturnValue('mock_api_key')
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: 'Grafik — parabolа, ildizlari x = ±2.' }] } }],
      }),
    }))
    globalThis.fetch = fetchMock as unknown as typeof fetch

    const result = await analyzeGraphImage({
      imageBase64: 'data:image/png;base64,AAAA',
      mimeType: 'image/png',
      context: 'f(x) = x^2 - 4',
      language: 'uz',
    })

    expect(result).toContain('parabol')
    const body = JSON.parse(String((fetchMock.mock.calls[0][1] as RequestInit).body))
    const parts = body.contents[0].parts
    expect(parts[1].inlineData.data).toBe('AAAA')
    expect(parts[0].text).toContain('x^2 - 4')
  })

  it('barcha modellar bo‘sh qaytarsa 502', async () => {
    vi.spyOn(config.ai, 'geminiApiKey', 'get').mockReturnValue('mock_api_key')
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({ candidates: [] }),
    })) as unknown as typeof fetch

    await expect(analyzeGraphImage({
      imageBase64: 'data:image/png;base64,AAAA',
      mimeType: 'image/png',
    })).rejects.toMatchObject({ statusCode: 502 })
  })

  it('kalit yo‘q bo‘lsa 503', async () => {
    vi.spyOn(config.ai, 'geminiApiKey', 'get').mockReturnValue('')
    await expect(analyzeGraphImage({
      imageBase64: 'data:image/png;base64,AAAA',
      mimeType: 'image/png',
    })).rejects.toMatchObject({ statusCode: 503 })
  })
})
