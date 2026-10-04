/**
 * Exam Blueprint Registry
 */

import type { SubjectExamBlueprint, ExamType } from './types'
import {
  RUSSIAN_MILLIY_SERTIFIKAT_BLUEPRINT,
  RUSSIAN_ATTESTATSIYA_BLUEPRINT,
} from './russian.blueprint'

export * from './types'
export * from './russian.blueprint'

const BLUEPRINT_REGISTRY: SubjectExamBlueprint[] = [
  RUSSIAN_MILLIY_SERTIFIKAT_BLUEPRINT,
  RUSSIAN_ATTESTATSIYA_BLUEPRINT,
]

export function getExamBlueprint(
  subjectId: string,
  examType: ExamType
): SubjectExamBlueprint | undefined {
  return BLUEPRINT_REGISTRY.find(
    (bp) => bp.subjectId === subjectId && bp.examType === examType
  )
}

export function listAvailableBlueprints(): Array<{
  subjectId: string
  subjectNameUz: string
  subjectNameRu: string
  examType: ExamType
  totalQuestions: number
  durationMinutes: number
  blocksCount: number
}> {
  return BLUEPRINT_REGISTRY.map((bp) => ({
    subjectId: bp.subjectId,
    subjectNameUz: bp.subjectNameUz,
    subjectNameRu: bp.subjectNameRu,
    examType: bp.examType,
    totalQuestions: bp.totalQuestions,
    durationMinutes: bp.durationMinutes,
    blocksCount: bp.blocks.length,
  }))
}
