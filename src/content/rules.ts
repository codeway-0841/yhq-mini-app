import rulesData from './rules.yhq.json'

export interface RuleArticle {
  id: string
  text: string
}

export interface RuleChapter {
  chapter: number
  title: string
  articles: RuleArticle[]
}

export const rulesChapters: RuleChapter[] = rulesData as RuleChapter[]
