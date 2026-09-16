import type { DeliveredTestQuestion } from '../../../shared/test-session'
import type { Question } from '../../shared/api'
import type {
  ServerPracticeMode,
  ServerTestSnapshot,
} from '../../shared/store/useServerTestSessionStore'
import type { QuestionResult } from './ResultsModal'
import type { ExamReviewItem } from './components/ExamReviewModal'

/**
 * V2 natija/review adapterlari (sof funksiyalar — legacy TestPage pariteti).
 *
 * ServerPracticePage savolning MASTER id'sini bilmaydi (himoya: client faqat
 * position + deliveryToken ko'radi). Review modal legacy `Question` shape kutadi:
 *  - `id` FAQAT React key + dars-link lookup'da ishlatiladi. Musbat id
 *    lessonMap'dagi haqiqiy master ID bilan to'qnashib NOTO'G'RI dars linkini
 *    chiqarardi — shuning uchun MANFIY (`-(position+1)`): lookup xavfsiz
 *    miss qiladi (dars tugmasi chiqmaydi), key'lar unikal qoladi.
 *  - matn/variant/rasm/mavzu — yetkazilgan payload'dan 1:1.
 */
export function toReviewQuestion(q: DeliveredTestQuestion): Question {
  return {
    id: -(q.position + 1),
    text: q.text,
    image: q.media,
    options: q.options.map((o) => ({ id: o.id, text: o.text })),
    topicId: q.topic?.id ?? null,
  }
}

export function buildV2Results(snapshot: ServerTestSnapshot): QuestionResult[] {
  return snapshot.answers.map((a, position) => ({
    questionId: position + 1,
    status: a === 'correct' ? 'correct' : a === 'wrong' ? 'incorrect' : 'unanswered',
  }))
}

export function buildV2ReviewItems(
  snapshot: ServerTestSnapshot,
  topicNameOf?: (topicId: number | null) => string | undefined,
): ExamReviewItem[] {
  return [...snapshot.questions]
    .sort((x, y) => x.position - y.position)
    .map((q) => {
      const answer = snapshot.answers[q.position]
      return {
        question: toReviewQuestion(q),
        index: q.position,
        status: answer === 'correct' ? 'correct' : answer === 'wrong' ? 'incorrect' : 'unanswered',
        selectedOptionId: snapshot.selected[q.position] ?? null,
        correctOptionId: snapshot.correctOptions[q.position] ?? null,
        topicName: topicNameOf?.(q.topic?.id ?? null),
      }
    })
}

/** Legacy TestPage threshold'lari bilan bir xil (natija ekrani pariteti). */
export function v2Threshold(mode: ServerPracticeMode): number {
  return mode === 'exam' ? 90 : mode === 'mock' ? 95 : 80
}
