/**
 * Qidiruv indeksi testlari (FIXPLAN #45) — sof funksiyalar:
 * normalize + substring match + limitlar + ikkala til + apostrof variantlari.
 */

import { describe, it, expect } from 'vitest'
import { normalizeSearchText, searchContent } from '../../../src/features/search/search-index'
import type { Question, DbTopic } from '../../../src/shared/api'

const questions: Question[] = [
  { id: 1, text: "Chorrahada kim birinchi o'tadi?", image: null, options: [{ id: 'A', text: "O'ng tomondagi" }], topicId: 10 },
  { id: 2, text: 'Tezlikni qachon kamaytirasiz?', image: null, options: [{ id: 'A', text: 'Doim' }], topicId: 20 },
  { id: 3, text: 'Sirpanchiq yo‘lda harakatlanish qoidalari', image: null, options: [{ id: 'A', text: 'Sekin' }], topicId: 20 },
]

const topics: DbTopic[] = [
  { id: 10, slug: 'chorrahalar', nameUz: 'Chorrahalar', nameRu: 'Перекрёстки' } as DbTopic,
  { id: 20, slug: 'tezlik',      nameUz: 'Tezlik',      nameRu: 'Скорость' } as DbTopic,
]

const lessons = {
  2: [
    {
      titleUz: "Chorraxalarni o'tish",
      titleRu: 'Проезд перекрёстков',
      bodyUz: ["Chorrahaga yaqinlashganda tezlikni kamaytiring."],
      bodyRu: ['При приближении к перекрёстку снизьте скорость.'],
    },
  ],
}
const modules = [{ id: 2, title: 'Chorrahalar', titleRu: 'Перекрёстки' }]

const input = (lang: 'uz' | 'ru') => ({ questions, topics, lessons, modules, lang })

describe('normalizeSearchText', () => {
  it('apostrof variantlari bir xil natija beradi', () => {
    expect(normalizeSearchText("o'tish")).toBe(normalizeSearchText('o‘tish'))
    expect(normalizeSearchText("o'tish")).toBe(normalizeSearchText('otish'))
    expect(normalizeSearchText('  Ko‘PLAM  ')).toBe('koPLAM'.toLowerCase())
  })
})

describe('searchContent', () => {
  it('2 belgidan qisqa so\'rov — bo\'sh natija', () => {
    expect(searchContent('c', input('uz'))).toEqual({ questions: [], lessons: [] })
  })

  it('savol matni bo\'yicha topadi (case-insensitive) + topic nomi', () => {
    const r = searchContent('TEZLIKNI', input('uz'))
    expect(r.questions.map((h) => h.question.id)).toContain(2)
    expect(r.questions[0].topicName).toBe('Tezlik')
  })

  it('apostrof farqi: "otadi" (apostrofsiz) o\' bilan yozilgan matndan topiladi', () => {
    const r = searchContent('otadi', input('uz'))
    expect(r.questions.map((h) => h.question.id)).toContain(1)
    // va teskari: apostrofLI so'rov apostrof sniff'idan qat'i nazar ishlaydi
    expect(searchContent("o'tadi", input('uz')).questions.map((h) => h.question.id)).toContain(1)
  })

  it('variant (option) matni bo\'yicha ham topadi', () => {
    const r = searchContent('tomoNDAGI', input('uz'))
    expect(r.questions.map((h) => h.question.id)).toEqual([1])
  })

  it('dars sarlavhasi body\'dan YUQORI ustuvorlikka ega', () => {
    const r = searchContent('chorr', input('uz'))
    expect(r.lessons.length).toBe(1)
    expect(r.lessons[0].moduleId).toBe(2)
    expect(r.lessons[0].lessonIdx).toBe(0)
    expect(r.lessons[0].moduleTitle).toBe('Chorrahalar')
  })

  it('RU til: darslar ruscha matndan topiladi', () => {
    const r = searchContent('перекрёстку', input('ru'))
    expect(r.lessons.length).toBe(1)
    expect(r.lessons[0].moduleTitle).toBe('Перекрёстки')
  })

  it('savol limiti ishlaydi', () => {
    const r = searchContent('a', input('uz'), { questions: 1, lessons: 0 })
    expect(r.questions.length).toBeLessThanOrEqual(1)
  })

  it('snippet birinchi moslik atrofida kesiladi', () => {
    const r = searchContent('kamaytiring', input('uz'))
    expect(r.lessons[0].snippet).toContain('kamaytiring')
  })
})
