import LessonRunner from './LessonRunner'

interface TopicCheckProps {
  topicId: string
  title: string
  onClose: () => void
  /** Server testdan o'tilganda (bir marta) */
  onPassed: () => void
  onNext?: () => void
  hasNext: boolean
  /** Server 403 qaytardi — progress eskirgan bo'lishi mumkin */
  onLocked?: () => void
}

/**
 * Mavzu testi — yagona LessonRunner engine'i ustidagi yupqa qobiq.
 *
 * v2 (5–7 mashqli dars) qadam-baqadam oqimda, v1 (2 MCQ + 1 input) eski
 * bir-sahifa oqimida ochiladi. Ikkala holatda ham javoblar serverda
 * tekshiriladi va keyingi mavzu faqat passdan keyin ochiladi.
 */
export default function TopicCheck(props: TopicCheckProps) {
  return <LessonRunner {...props} />
}
