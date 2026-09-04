import { modules } from '../../content/modules'

/** The free preview is one lesson in the entire course, not one per module. */
export function canReadLesson(isPremium: boolean, moduleId: number, lessonIdx: number) {
  return isPremium || (moduleId === modules[0].id && lessonIdx === 0)
}
