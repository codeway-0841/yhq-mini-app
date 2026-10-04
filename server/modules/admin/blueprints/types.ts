/**
 * Universal Exam Blueprint Specification Types
 * Used by Kivvi AI Exam Variant Generator for Milliy Sertifikat, Attestatsiya, and Mock exams.
 */

export type ExamType = 'milliy-sertifikat' | 'attestatsiya'

export type QuestionType = 'single_choice' | 'matching' | 'reading_comprehension' | 'analytical'

export type QuestionDifficulty = 'easy' | 'medium' | 'hard'

export interface QuestionBlueprintItem {
  number: number
  topic: string
  topicCategory: string
  skill: string
  difficulty: QuestionDifficulty
  type: QuestionType
  instructions: string
  pointValue?: number
}

export interface ExamBlockBlueprint {
  blockId: string
  title: string
  startNumber: number
  endNumber: number
  description: string
  /** Shared context prompt (e.g. instruction to write a reading passage first) */
  sharedContextPrompt?: string
  questions: QuestionBlueprintItem[]
}

export interface SubjectExamBlueprint {
  subjectId: string
  subjectNameUz: string
  subjectNameRu: string
  examType: ExamType
  totalQuestions: number
  durationMinutes: number
  passingScore?: number
  maxScore?: number
  specificationSource: string
  blocks: ExamBlockBlueprint[]
}
