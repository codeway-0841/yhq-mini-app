import type { WonderCourse } from '../types'

/**
 * Escapes tab characters and newlines for clean Anki TSV import
 */
function sanitizeTsvCell(text: string): string {
  if (!text) return ''
  return text
    .replace(/\t/g, ' ')
    .replace(/\r?\n/g, '<br>')
    .trim()
}

/**
 * Generates an Anki-compatible TSV (Tab-Separated Values) string containing
 * all keywords, glossary terms, and flashcard practice items from the course.
 *
 * Format:
 * Front [TAB] Back [TAB] Tag
 */
export function generateAnkiTsv(course: WonderCourse): string {
  const lines: string[] = []
  const courseTag = course.title.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '')

  // 1. Export all keywords / conceptual terms
  for (const section of course.sections) {
    for (const lesson of section.lessons) {
      for (const page of lesson.pages) {
        if (!page.keywords) continue
        for (const kw of page.keywords) {
          if (!kw.word || !kw.definition) continue
          const front = sanitizeTsvCell(kw.word)
          const back = sanitizeTsvCell(
            `<b>Ta'rif:</b> ${kw.definition}<br><br><small><i>Dars: ${lesson.title}</i></small>`,
          )
          const tag = `Wondering::${courseTag}::Keywords`
          lines.push(`${front}\t${back}\t${tag}`)
        }
      }

      // 2. Export flashcards and quiz questions
      if (lesson.quiz) {
        if (lesson.quiz.type === 'flashcard' && lesson.quiz.flashcardPrompt && lesson.quiz.flashcardAnswer) {
          const front = sanitizeTsvCell(lesson.quiz.flashcardPrompt)
          const back = sanitizeTsvCell(lesson.quiz.flashcardAnswer)
          const tag = `Wondering::${courseTag}::Flashcards`
          lines.push(`${front}\t${back}\t${tag}`)
        } else if (lesson.quiz.type === 'mcq' && lesson.quiz.options && lesson.quiz.correctOptionId) {
          const correctOpt = lesson.quiz.options.find((o) => o.id === lesson.quiz.correctOptionId)
          if (correctOpt) {
            const front = sanitizeTsvCell(`Savol: ${lesson.quiz.question}`)
            let back = `<b>To'g'ri javob:</b> ${correctOpt.text}`
            if (lesson.likelyConfusion) {
              back += `<br><br><small><b>Eslatma:</b> ${lesson.likelyConfusion}</small>`
            }
            const tag = `Wondering::${courseTag}::Quizzes`
            lines.push(`${front}\t${sanitizeTsvCell(back)}\t${tag}`)
          }
        }
      }
    }
  }

  return lines.join('\n')
}

/**
 * Generates a structured Markdown conspectus of the entire course,
 * including modules, lessons, TLDRs, key definitions, and student notes.
 */
export function generateCourseMarkdownConspectus(
  course: WonderCourse,
  lessonNotes: Record<string, string[]> = {},
): string {
  const parts: string[] = []

  parts.push(`# ${course.title}`)
  parts.push(`> ${course.description}\n`)
  const durationText = course.estimatedMinutes
    ? `${course.estimatedMinutes} daqiqa`
    : 'Moslashuvchan'
  parts.push(`**Davomiyligi:** ${durationText} | **Daraja:** ${course.level} | **Yo'nalish:** ${course.category || 'Fan'}\n`)
  parts.push(`---\n`)

  for (let sIdx = 0; sIdx < course.sections.length; sIdx++) {
    const section = course.sections[sIdx]
    parts.push(`## ${sIdx + 1}-Bo'lim: ${section.title}\n`)

    for (let lIdx = 0; lIdx < section.lessons.length; lIdx++) {
      const lesson = section.lessons[lIdx]
      parts.push(`### ${sIdx + 1}.${lIdx + 1}. ${lesson.title}`)

      if (lesson.tldr) {
        parts.push(`**Qisqacha xulosa (TLDR):**\n${lesson.tldr}\n`)
      }

      // Pedagogy highlights
      if (lesson.hook) {
        parts.push(`*Savol (Hook):* "${lesson.hook}"\n`)
      }
      if (lesson.likelyConfusion) {
        parts.push(`*Keng tarqalgan xato:* ${lesson.likelyConfusion}\n`)
      }

      // Keywords
      const allLessonKeywords = lesson.pages.flatMap((p) => p.keywords || [])
      if (allLessonKeywords.length > 0) {
        parts.push(`#### 📌 Asosiy Tushunchalar:`)
        for (const kw of allLessonKeywords) {
          parts.push(`- **${kw.word}**: ${kw.definition}`)
        }
        parts.push('')
      }

      // Student personal notes
      const notes = lessonNotes[lesson.id]
      if (notes && notes.length > 0) {
        parts.push(`#### 📝 Shaxsiy Qaydlar:`)
        for (const n of notes) {
          parts.push(`- ${n}`)
        }
        parts.push('')
      }

      parts.push('---\n')
    }
  }

  parts.push(`_KIVVI Universal Ta'lim Platformasi · Wondering Studio konspekti_`)
  return parts.join('\n')
}

/**
 * Robust clipboard copy helper supporting modern Clipboard API with fallback
 */
export async function copyTextToClipboard(text: string): Promise<boolean> {
  if (!text) return false
  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // Fallback to execCommand if clipboard permissions are restricted in WebView
  }

  try {
    const textArea = document.createElement('textarea')
    textArea.value = text
    textArea.style.position = 'fixed'
    textArea.style.left = '-9999px'
    textArea.style.top = '-9999px'
    document.body.appendChild(textArea)
    textArea.focus()
    textArea.select()
    const successful = document.execCommand('copy')
    document.body.removeChild(textArea)
    return successful
  } catch {
    return false
  }
}
