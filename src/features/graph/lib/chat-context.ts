/**
 * Grafik holatidan AI repetitor uchun kontekst matni (SOF funksiya).
 *
 * Server `questionText` chegarasi — 3000 belgi; bu yerda 2900 da kesiladi.
 * Faqat ko'rinadigan ifodalar va X o'qidan boshqa parametrlar kiritiladi.
 */
import type { Scope } from './math'

export interface GraphChatArgs {
  expressions: { expr: string; visible: boolean }[]
  xVar: string
  vars: Scope
  language: 'uz' | 'ru'
  analysis?: {
    derivative: boolean
    tangent: boolean
    x0: number
    integral: boolean
    a: number
    b: number
    rects: number
  }
}

export interface GraphChatContext {
  questionText: string
  subjectId: string
  topicName: string
}

function fmt(v: number): string {
  if (!Number.isFinite(v)) return '—'
  return String(Number(v.toFixed(4)))
}

export function buildGraphChatContext(args: GraphChatArgs): GraphChatContext {
  const { expressions, xVar, vars, language, analysis } = args
  const ru = language === 'ru'
  const exprs = expressions.filter((e) => e.visible && e.expr.trim().length > 0)
  const parts: string[] = []

  if (exprs.length === 1) {
    parts.push(`${ru ? 'Функция' : 'Funksiya'}: y = ${exprs[0].expr}`)
  } else if (exprs.length > 1) {
    const list = exprs.map((e, i) => `f${i + 1}(${xVar}) = ${e.expr}`).join('; ')
    parts.push(`${ru ? 'Функции' : 'Funksiyalar'}: ${list}`)
  }

  parts.push(`${ru ? 'Ось X' : "X o'qi"}: ${xVar}`)

  const params = Object.entries(vars).filter(([k, v]) => k !== xVar && Number.isFinite(v))
  if (params.length > 0) {
    const list = params.map(([k, v]) => `${k} = ${fmt(v)}`).join(', ')
    parts.push(`${ru ? 'Параметры' : 'Parametrlar'}: ${list}`)
  }

  if (analysis?.derivative) {
    parts.push(ru ? 'Показана производная f′' : "Hosila f′ ko'rsatilgan")
  }
  if (analysis?.tangent) {
    parts.push(ru ? `Касательная в точке x₀ = ${fmt(analysis.x0)}` : `Urinma x₀ = ${fmt(analysis.x0)} nuqtada`)
  }
  if (analysis?.integral) {
    parts.push(
      ru
        ? `Интеграл на отрезке [${fmt(analysis.a)}; ${fmt(analysis.b)}], прямоугольников: ${analysis.rects}`
        : `Integral [${fmt(analysis.a)}; ${fmt(analysis.b)}], to'rtburchaklar: ${analysis.rects}`,
    )
  }

  return {
    questionText: parts.join(' | ').slice(0, 2900),
    subjectId: 'matematika',
    topicName: ru ? 'График функции' : 'Funksiya grafigi',
  }
}
