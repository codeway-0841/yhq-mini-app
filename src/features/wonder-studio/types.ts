/**
 * Wondering Studio — Type definitions.
 * Models: Course, Path Nodes, Bite Lessons, 5-Lens Thought Refractor,
 * 2-Host AI Podcast, Spatial Canvas, and FSRS Spaced Repetition.
 */

export type WonderTab = 'path' | 'refractor' | 'podcast' | 'canvas'

export type FsrsRating = 'again' | 'hard' | 'good' | 'easy'

export interface FsrsCardState {
  lessonId: string
  stability: number
  difficulty: number
  reps: number
  lastReviewed: number
  due: number
}

export interface WonderKeyword {
  word: string
  definition: string
}

export interface WonderVisualBlock {
  type: 'svg' | 'comparison' | 'cycle' | 'chart' | 'diagram'
  title: string
  caption?: string
  svgContent?: string
  items?: {
    label: string
    value: number
    color?: string
    desc?: string
  }[]
}

export interface WonderLessonPage {
  id: string
  title: string
  content: string // Supports [[term|glossary explanation]] format
  keywords: WonderKeyword[]
  visual?: WonderVisualBlock
}

export interface WonderLessonQuiz {
  type: 'mcq' | 'cloze' | 'boolean' | 'order' | 'flashcard'
  question: string
  options?: { id: string; text: string }[]
  correctOptionId?: string
  clozeTemplate?: string
  clozeAnswer?: string
  clozeOptions?: string[]
  booleanCorrect?: boolean
  orderSteps?: Array<{ id: string; text: string }>
  correctOrderIds?: string[]
  flashcardPrompt?: string
  flashcardAnswer?: string
  explanation: string
}

export interface WonderLessonNode {
  id: string
  title: string
  durationMinutes: number
  xp: number
  coins: number
  tags: string[]
  status: 'locked' | 'available' | 'completed'
  isMilestone?: boolean
  tldr: string
  hook?: string
  meaning?: string
  objective?: string
  likelyConfusion?: string
  pages: WonderLessonPage[]
  quiz: WonderLessonQuiz
  rawPractices?: readonly any[]
}

export interface WonderSection {
  id: string
  title: string
  description: string
  lessons: WonderLessonNode[]
  isCompleted: boolean
}

export interface RefractorCompetingView {
  topic?: string
  viewA: {
    title: string
    stance: string
    arguments: string[]
    advocate: string
  }
  viewB: {
    title: string
    stance: string
    arguments: string[]
    advocate: string
  }
  synthesis: string
}

export interface RefractorComponentMatrix {
  columns: string[]
  rows: {
    component: string
    role: string
    mechanism: string
    failureImpact: string
  }[]
}

export interface RefractorProgressionFlow {
  stages: {
    step: number
    name: string
    trigger: string
    state: string
    milestone: string
  }[]
}

export interface RefractorRelationshipMap {
  nodes: {
    id: string
    label: string
    group: string
    importance: number
  }[]
  edges: {
    from: string
    to: string
    label: string
    type: 'causes' | 'contains' | 'regulates' | 'conflicts'
  }[]
}

export interface RefractorSystemDynamics {
  inputs: string[]
  feedbackLoops: {
    type: 'positive' | 'negative'
    name: string
    description: string
  }[]
  equilibriumState: string
  outputs: string[]
}

export interface RefractorTopic {
  id: string
  title: string
  concept: string
  lenses: {
    competing: RefractorCompetingView
    component: RefractorComponentMatrix
    progression: RefractorProgressionFlow
    relationship: RefractorRelationshipMap
    system: RefractorSystemDynamics
  }
}

export interface PodcastTurn {
  id: string
  speaker: 'hostA' | 'hostB'
  text: string
  timestamp: number // seconds
}

export interface PodcastEpisode {
  id: string
  title: string
  duration: string
  durationSec: number
  hosts: {
    hostA: { name: string; role: string; avatar: string }
    hostB: { name: string; role: string; avatar: string }
  }
  turns: PodcastTurn[]
}

export interface CanvasCard {
  id: string
  title: string
  content: string
  category: 'core' | 'insight' | 'formula' | 'question'
  x: number
  y: number
  color?: string
}

export interface WonderCourse {
  id: string
  title: string
  description: string
  subjectId: string
  badge: string
  level: 'beginner' | 'intermediate' | 'deep'
  estimatedMinutes: number
  totalXp: number
  author?: string
  category?: string
  coverImage?: string
  localCoverImage?: string
  sections: WonderSection[]
  refractorTopics: RefractorTopic[]
  podcastEpisodes: PodcastEpisode[]
  canvasCards: CanvasCard[]
}
