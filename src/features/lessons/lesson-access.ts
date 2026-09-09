import { FREE_LESSON } from '../../../shared/test-access'

/** The free preview is one lesson in the entire course, not one per module. */
export function canReadLesson(isPremium: boolean, moduleId: number, lessonIdx: number) {
  return isPremium || (moduleId === FREE_LESSON.moduleId && lessonIdx === FREE_LESSON.lessonIndex)
}
