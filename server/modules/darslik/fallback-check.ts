import { DarslikCheckSchema, type DarslikCheck } from '../../../shared/darslik-mastery'

type CheckQuestion = DarslikCheck['questions'][number]
type TopicSource = { title: string; source: string }

const GENERIC_TERMS = new Set([
  'например', 'важно', 'главное', 'это', 'все', 'они', 'она', 'он', 'так',
  'здесь', 'запомнить', 'правило', 'тема', 'вывод', 'итого', 'итак',
  'вопрос', 'ответ', 'слово', 'слова', 'текст', 'часть', 'раздел',
])

const DEFINITION_STARTERS = new Set([
  'это', 'раздел', 'часть', 'наука', 'знак', 'слова', 'слово', 'согласные',
  'гласные', 'выделение', 'нормы', 'правила', 'совокупность', 'форма',
  'морфема', 'признак', 'действие', 'предмет', 'отношения', 'устаревшие',
  'новые', 'устойчивые', 'перенос', 'оборот', 'термин', 'единица', 'тип',
  'вид', 'способ', 'приём', 'изменение', 'процесс', 'явление', 'категория',
  'разряд', 'группа', 'система', 'звук', 'буква', 'самостоятельная',
  'служебная', 'графический', 'устаревшее', 'новое', 'устойчивое',
  'противоположные', 'близкие', 'одинаковые', 'разные', 'лексическое',
  'грамматическое', 'минимальная', 'значимая', 'главная', 'второстепенный',
  'обособленный', 'однородные', 'сложное', 'простое', 'наречие', 'предлог',
  'союз', 'частица', 'междометие', 'причастие', 'деепричастие',
  'числительное', 'местоимение', 'глагол', 'прилагательное', 'имя',
])

const TOPIC_PROMPTS = [
  'К какому разделу относится утверждение: «',
  'Определи тему утверждения: «',
  'Выбери раздел, к которому относится утверждение: «',
  'Какая тема соответствует утверждению: «',
]

const TITLE_PROMPTS = [
  'Как называется раздел, который ты изучаешь?',
  'Выбери название изученного раздела.',
  'Укажи раздел, который ты открыл.',
]

interface Definition {
  term: string
  definition: string
}

const definitionCache = new Map<string, Definition[]>()
const termCache = new Map<string, string[]>()
const sentenceCache = new Map<string, string[]>()
const rawSentenceCache = new Map<string, { raw: string; text: string; terms: string[] }[]>()
let globalDefinitionCache: Definition[] | null = null
let globalTermCache: string[] | null = null

function hash(value: string): number {
  let result = 2166136261
  for (let index = 0; index < value.length; index++) {
    result ^= value.charCodeAt(index)
    result = Math.imul(result, 16777619)
  }
  return result >>> 0
}

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))]
}

function plain(value: string): string {
  return value
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()
}

function isUsableTerm(term: string): boolean {
  const text = plain(term).trim()
  if (text.length < 3 || text.length > 50) return false
  if (GENERIC_TERMS.has(text.toLowerCase())) return false
  if (!/\p{L}/u.test(text)) return false
  if (!/^[\p{L}\p{N}«»\s.,'’/-]+$/u.test(text)) return false
  if (/[.!?]/.test(text)) return false
  if (text.split(/\s+/).length > 6) return false
  return true
}

function isConceptTerm(term: string): boolean {
  if (/^[А-ЯЁA-Z«]/.test(term)) return true
  return /(ость|ение|ание|ция|изм|ика|олог|ство|тель|ник|мость|чивость)$/i.test(term)
}

function isDefinitionSentinel(definition: string): boolean {
  const first = definition.toLowerCase().split(/\s+/)[0]?.replace(/[^а-яёa-z-]/g, '') ?? ''
  return DEFINITION_STARTERS.has(first)
}

function canBeDefinition(term: string, definition: string): boolean {
  if (!isUsableTerm(term) || !isConceptTerm(term)) return false
  if (term.length < 3 || term.split(/\s+/).length > 5) return false
  if (!/^[А-ЯЁA-Z«]/.test(term) && !/^(это|означает)\b/i.test(definition)) return false
  if (!isDefinitionSentinel(definition)) return false
  if (definition.length < 15 || definition.length > 200) return false
  if (definition.split(/\s+/).length < 4) return false
  if (/^\d/.test(definition)) return false
  if (definition.endsWith(':') || definition.includes(':') || definition.includes(';')) return false
  if (definition.includes('→') || definition.includes('[')) return false
  if (/^например\b/i.test(definition)) return false
  return true
}

function sourceDefinitions(source: string): Definition[] {
  const cached = definitionCache.get(source)
  if (cached) return cached
  const result: Definition[] = []
  for (const match of source.matchAll(/\*\*([^*\n]{3,40})\*\*\s*[—–-]\s*([^\n]{12,200})/g)) {
    const term = plain(match[1]).trim()
    const definition = plain(match[2]).trim().replace(/[.;,]+$/, '').trim()
    if (canBeDefinition(term, definition)) result.push({ term, definition })
  }
  definitionCache.set(source, result)
  return result
}

function sourceBoldTerms(source: string): string[] {
  const cached = termCache.get(source)
  if (cached) return cached
  const result: string[] = []
  for (const match of source.matchAll(/\*\*([^*\n]{3,50})\*\*/g)) {
    const term = plain(match[1]).trim().replace(/[;:,]+$/, '').trim()
    if (isUsableTerm(term) && isConceptTerm(term)) result.push(term)
  }
  const uniqueTerms = unique(result)
  termCache.set(source, uniqueTerms)
  return uniqueTerms
}

function cleanSource(source: string): string {
  return source
    .replace(/^#{1,6}\s+.*$/gm, '')
    .replace(/^\|.*$/gm, '')
    .replace(/^\s*[-*•]\s+/gm, '')
    .replace(/^\s*\d+[.)]\s+/gm, '')
    .replace(/^\s*>\s?/gm, '')
}

function sourceSentences(source: string): string[] {
  const cached = sentenceCache.get(source)
  if (cached) return cached
  const result: string[] = []
  for (const paragraph of cleanSource(source).split(/\n{2,}/)) {
    const text = paragraph.trim()
    if (!text) continue
    for (const sentence of text.split(/(?<=[.!?])\s+(?=[А-ЯЁA-Z«"])/)) {
      const value = plain(sentence).replace(/^[^\p{L}\p{N}]+/u, '').trim()
      if (value.length < 12 || value.length > 200) continue
      if (/[?]$/.test(value) || value.includes('→')) continue
      result.push(value)
    }
  }
  const uniqueSentences = unique(result)
  sentenceCache.set(source, uniqueSentences)
  return uniqueSentences
}

function sourceRawSentences(source: string): { raw: string; text: string; terms: string[] }[] {
  const cached = rawSentenceCache.get(source)
  if (cached) return cached
  const result: { raw: string; text: string; terms: string[] }[] = []
  for (const paragraph of cleanSource(source).split(/\n{2,}/)) {
    const text = paragraph.trim()
    if (!text) continue
    for (const raw of text.split(/(?<=[.!?])\s+(?=[А-ЯЁA-Z«"])/)) {
      const value = raw.trim()
      const plainValue = plain(value).trim()
      if (plainValue.length < 25 || plainValue.length > 190) continue
      const terms: string[] = []
      for (const match of value.matchAll(/\*\*([^*]+)\*\*/g)) {
        const term = plain(match[1]).trim().replace(/[;:,]+$/, '').trim()
        if (isUsableTerm(term) && isConceptTerm(term)) terms.push(term)
      }
      result.push({ raw: value, text: plainValue, terms: unique(terms) })
    }
  }
  rawSentenceCache.set(source, result)
  return result
}

function globalDefinitions(allTopics: Record<string, TopicSource>): Definition[] {
  if (globalDefinitionCache) return globalDefinitionCache
  const result: Definition[] = []
  for (const topic of Object.values(allTopics)) result.push(...sourceDefinitions(topic.source))
  globalDefinitionCache = result
  return result
}

function globalTerms(allTopics: Record<string, TopicSource>): string[] {
  if (globalTermCache) return globalTermCache
  const result: string[] = []
  for (const topic of Object.values(allTopics)) result.push(...sourceBoldTerms(topic.source))
  globalTermCache = unique(result)
  return globalTermCache
}

function pick(values: string[], count: number, seed: string): string[] {
  return unique(values)
    .sort((a, b) => hash(seed + '\u0000' + a) - hash(seed + '\u0000' + b))
    .slice(0, count)
}

function rotate(options: string[], correctIndex: number, seed: string): { options: string[]; correctIndex: number } {
  const offset = hash(seed) % options.length
  return {
    options: options.slice(offset).concat(options.slice(0, offset)),
    correctIndex: (correctIndex - offset + options.length) % options.length,
  }
}

function makeMcq(
  id: string,
  prompt: string,
  options: string[],
  correctIndex: number,
  explanation: string,
  seed: string,
): CheckQuestion | null {
  const normalized = unique(options.map((option) => plain(option)))
  const correct = plain(options[correctIndex] ?? '')
  const position = normalized.indexOf(correct)
  if (normalized.length !== 4 || position < 0) return null
  if (normalized.some((option) => option.length < 1 || option.length > 300)) return null
  if (!prompt.trim() || prompt.length < 5 || prompt.length > 600) return null
  if (!explanation.trim() || explanation.length < 5 || explanation.length > 800) return null
  const rotated = rotate(normalized, position, seed)
  return { id, kind: 'mcq', prompt: prompt.trim(), options: rotated.options, correctIndex: rotated.correctIndex, explanation: explanation.trim() }
}

function makeInput(
  id: string,
  prompt: string,
  answers: string[],
  explanation: string,
): CheckQuestion | null {
  const normalized = unique(answers)
  if (normalized.length < 1 || normalized.length > 8) return null
  if (normalized.some((answer) => answer.length < 1 || answer.length > 100)) return null
  if (!prompt.trim() || prompt.length < 5 || prompt.length > 600) return null
  if (!explanation.trim() || explanation.length < 5 || explanation.length > 800) return null
  return { id, kind: 'input', prompt: prompt.trim(), answers: normalized, explanation: explanation.trim() }
}

function definitionMcq(topic: TopicSource, allTopics: Record<string, TopicSource>): CheckQuestion | null {
  const definitions = sourceDefinitions(topic.source)
  if (definitions.length === 0) return null
  const pool = globalDefinitions(allTopics)
  for (const definition of definitions) {
    const distractors = pick(
      pool
        .filter((entry) => entry.definition !== definition.definition)
        .map((entry) => entry.definition),
      3,
      'definition:' + topic.title + ':' + definition.term,
    )
    if (distractors.length < 3) continue
    const options = [definition.definition, ...distractors]
    return makeMcq(
      'm1',
      'Что такое «' + definition.term + '»?',
      options,
      0,
      definition.term + ' — ' + definition.definition + '.',
      'definition:' + topic.title,
    )
  }
  return null
}

function clozeMcq(topic: TopicSource, allTopics: Record<string, TopicSource>): CheckQuestion | null {
  const pool = globalTerms(allTopics)
  for (const sentence of sourceRawSentences(topic.source)) {
    if (sentence.terms.length !== 1) continue
    if (!/[.!]$/.test(sentence.text)) continue
    if (/^например\b/i.test(sentence.text)) continue
    if ((sentence.text.match(/;/g) ?? []).length >= 2) continue
    const term = sentence.terms[0]
    const first = sentence.text.indexOf(term)
    if (first < 0 || sentence.text.indexOf(term, first + term.length) >= 0) continue
    const distractors = pick(
      pool.filter((candidate) => candidate !== term && !candidate.includes(term) && !term.includes(candidate) && !sentence.text.includes(candidate)),
      3,
      'cloze:' + topic.title + ':' + term,
    )
    if (distractors.length < 3) continue
    const blanked = sentence.text.slice(0, first) + '_____' + sentence.text.slice(first + term.length)
    return makeMcq(
      'm2',
      'Впиши пропущенное слово: «' + blanked + '»',
      [term, ...distractors],
      0,
      sentence.text,
      'cloze:' + topic.title,
    )
  }
  return null
}

function numberFacts(source: string): { text: string; number: number }[] {
  return sourceSentences(source)
    .map((text) => {
      const match = text.match(/(?<!\d)(\d{1,4})(?!\d)/)
      if (!match) return null
      return { text, number: Number(match[1]) }
    })
    .filter((value): value is { text: string; number: number } => Boolean(value))
    .filter((value) => value.number >= 0 && value.text.split(/\s+/).length >= 6 && !/^\d/.test(value.text))
}

function numberMcq(topic: TopicSource): CheckQuestion | null {
  for (const fact of numberFacts(topic.source)) {
    const variants: string[] = []
    for (const delta of [1, -1, 2, -2, 3, -3]) {
      const next = fact.number + delta
      if (next < 0) continue
      const variant = fact.text.replace(new RegExp('(?<!\\d)' + fact.number + '(?!\\d)'), String(next))
      if (variant !== fact.text && !variants.includes(variant)) variants.push(variant)
      if (variants.length === 3) break
    }
    if (variants.length < 3) continue
    return makeMcq(
      'm2',
      'Выбери утверждение, которое соответствует теме «' + topic.title + '».',
      [fact.text, ...variants],
      0,
      fact.text,
      'number:' + topic.title,
    )
  }
  return null
}

function topicMatchMcq(
  topic: TopicSource,
  allTopics: Record<string, TopicSource>,
  variant: number,
  used: Set<string>,
): CheckQuestion | null {
  const sentences = sourceSentences(topic.source).filter((sentence) => !used.has(sentence))
  const titles = pick(
    Object.values(allTopics).map((entry) => entry.title).filter((title) => title !== topic.title),
    3,
    'titles:' + topic.title + ':' + variant,
  )
  if (sentences.length === 0 || titles.length < 3) return null
  const sentence = sentences[variant % sentences.length]
  used.add(sentence)
  return makeMcq(
    'm' + (variant + 1),
    TOPIC_PROMPTS[variant % TOPIC_PROMPTS.length] + sentence + '»?',
    [topic.title, ...titles],
    0,
    'Это утверждение из раздела «' + topic.title + '».',
    'topic:' + topic.title + ':' + variant,
  )
}

function titleMcq(
  topic: TopicSource,
  allTopics: Record<string, TopicSource>,
  variant: number,
): CheckQuestion | null {
  const titles = pick(
    Object.values(allTopics).map((entry) => entry.title).filter((title) => title !== topic.title),
    3,
    'title:' + topic.title + ':' + variant,
  )
  if (titles.length < 3) return null
  return makeMcq(
    'm' + (variant + 1),
    TITLE_PROMPTS[variant % TITLE_PROMPTS.length],
    [topic.title, ...titles],
    0,
    'Правильный раздел: «' + topic.title + '».',
    'title:' + topic.title + ':' + variant,
  )
}

function numberInput(topic: TopicSource): CheckQuestion | null {
  for (const fact of numberFacts(topic.source)) {
    const blanked = fact.text.replace(new RegExp('(?<!\\d)' + fact.number + '(?!\\d)'), '_____')
    if (blanked === fact.text) continue
    return makeInput(
      'i1',
      'Впиши пропущенное число: «' + blanked + '»',
      [String(fact.number)],
      fact.text,
    )
  }
  return null
}

function definitionInput(topic: TopicSource): CheckQuestion | null {
  for (const definition of sourceDefinitions(topic.source)) {
    if (definition.definition.toLowerCase().includes(definition.term.toLowerCase())) continue
    return makeInput(
      'i1',
      'Впиши термин: «' + definition.definition + '»',
      answerVariants(definition.term),
      definition.term + ' — ' + definition.definition + '.',
    )
  }
  return null
}

function wordInput(topic: TopicSource): CheckQuestion | null {
  for (const sentence of sourceSentences(topic.source)) {
    if (sentence.length < 40) continue
    const words = sentence.match(/[А-ЯЁа-яё]{5,}/g) ?? []
    const titleWords = new Set(topic.title.toLowerCase().split(/\s+/))
    const candidates = words.filter((word) => !titleWords.has(word.toLowerCase()) && sentence.indexOf(word) === sentence.lastIndexOf(word))
    if (candidates.length === 0) continue
    const word = candidates.sort((a, b) => b.length - a.length)[0]
    const index = sentence.indexOf(word)
    const blanked = sentence.slice(0, index) + '_____' + sentence.slice(index + word.length)
    return makeInput('i1', 'Впиши пропущенное слово: «' + blanked + '»', [word], sentence)
  }
  return null
}

function answerVariants(value: string): string[] {
  const stripped = value
    .replace(/[«»"'.,;:!?—–]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  const spaced = value.replace(/[,\s]+/g, ' ').trim()
  return unique([value, stripped, spaced]).filter(Boolean)
}

function titleInput(topic: TopicSource): CheckQuestion | null {
  return makeInput(
    'i1',
    'Впиши название раздела, который ты изучаешь.',
    answerVariants(topic.title),
    'Правильный раздел: «' + topic.title + '».',
  )
}

export function buildFallbackCheck(
  topic: TopicSource,
  allTopics: Record<string, TopicSource>,
): DarslikCheck | null {
  if (!topic?.title || !topic.source || !topic.source.trim()) return null

  const used = new Set<string>()
  const mcqs: CheckQuestion[] = []
  const add = (question: CheckQuestion | null) => {
    if (question && !mcqs.some((existing) => existing.id === question.id)) mcqs.push(question)
  }

  add(definitionMcq(topic, allTopics))
  add(clozeMcq(topic, allTopics))
  add(numberMcq(topic))

  for (let variant = 0; mcqs.length < 2 && variant < 4; variant++) {
    add(topicMatchMcq(topic, allTopics, variant, used))
  }
  for (let variant = 0; mcqs.length < 2 && variant < 3; variant++) {
    add(titleMcq(topic, allTopics, variant))
  }

  if (mcqs.length < 2) return null

  const input = numberInput(topic) ?? definitionInput(topic) ?? wordInput(topic) ?? titleInput(topic)
  if (!input) return null

  const parsed = DarslikCheckSchema.safeParse({ questions: [mcqs[0], mcqs[1], input] })
  return parsed.success ? parsed.data : null
}
