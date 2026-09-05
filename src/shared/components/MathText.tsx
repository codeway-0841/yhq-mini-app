import { useMemo } from 'react'
import katex from 'katex'

interface MathTextProps {
  text: string
  className?: string
  as?: 'span' | 'p' | 'div'
}

function findClosingBrace(str: string, startIdx: number): number {
  let depth = 0
  for (let i = startIdx; i < str.length; i++) {
    if (str[i] === '{') depth++
    else if (str[i] === '}') {
      depth--
      if (depth === 0) return i
    }
  }
  return -1
}

/**
 * Parses and renders LaTeX formulas (vectors, fractions, radicals, powers, subscripts)
 * inline with regular text using KaTeX with zero rendering errors.
 */
export function renderMathToHtml(text: string): string {
  if (!text) return ''
  const trimmed = text.trim()

  // 1. Explicit $...$ delimiters
  if (trimmed.includes('$')) {
    const parts = trimmed.split(/(\$[^$]+\$)/g)
    return parts.map((part) => {
      if (part.startsWith('$') && part.endsWith('$')) {
        const math = part.slice(1, -1)
        try {
          return katex.renderToString(math, { throwOnError: false })
        } catch {
          return part
        }
      }
      return part
    }).join('')
  }

  // 2. Pure formula check (very common in test option choices)
  const words = trimmed.split(/\s+/).filter(w => /^[a-zA-Z'ʻ`’]{4,}$/.test(w) && !/^(const|frac|sqrt|text|left|right|cdot|times|approx|infty|Delta)$/i.test(w))
  const isLikelyProse = words.length >= 2

  if (!isLikelyProse && (trimmed.includes('\\') || trimmed.includes('^') || /_[0-9a-zA-Z]/.test(trimmed))) {
    const hasDot = trimmed.endsWith('.')
    const cleanMath = hasDot ? trimmed.slice(0, -1) : trimmed
    try {
      const rendered = katex.renderToString(cleanMath, { throwOnError: false })
      if (!rendered.includes('class="katex-error"')) {
        return rendered + (hasDot ? '.' : '')
      }
    } catch {
      // fallback to mixed tokenizer
    }
  }

  // 3. Mixed prose tokenizer
  let result = ''
  let i = 0
  while (i < trimmed.length) {
    // LaTeX commands starting with \
    if (trimmed[i] === '\\') {
      if (trimmed.startsWith('\\frac{', i)) {
        const numClose = findClosingBrace(trimmed, i + 5)
        if (numClose !== -1 && trimmed[numClose + 1] === '{') {
          const denClose = findClosingBrace(trimmed, numClose + 1)
          if (denClose !== -1) {
            const frac = trimmed.slice(i, denClose + 1)
            result += katex.renderToString(frac, { throwOnError: false })
            i = denClose + 1
            continue
          }
        }
      } else if (trimmed.startsWith('\\sqrt{', i)) {
        const close = findClosingBrace(trimmed, i + 5)
        if (close !== -1) {
          const sqrt = trimmed.slice(i, close + 1)
          result += katex.renderToString(sqrt, { throwOnError: false })
          i = close + 1
          continue
        }
      } else if (trimmed.startsWith('\\vec{', i)) {
        const close = findClosingBrace(trimmed, i + 4)
        if (close !== -1) {
          const vec = trimmed.slice(i, close + 1)
          result += katex.renderToString(vec, { throwOnError: false })
          i = close + 1
          continue
        }
      } else if (trimmed.startsWith('\\text{', i)) {
        const close = findClosingBrace(trimmed, i + 5)
        if (close !== -1) {
          const txt = trimmed.slice(i, close + 1)
          result += katex.renderToString(txt, { throwOnError: false })
          i = close + 1
          continue
        }
      } else {
        const cmdMatch = trimmed.slice(i).match(/^(\\[a-zA-Z]+(?:\s*[a-zA-Z0-9_]*)?)/)
        if (cmdMatch) {
          try {
            result += katex.renderToString(cmdMatch[1], { throwOnError: false })
            i += cmdMatch[1].length
            continue
          } catch {
            result += cmdMatch[1]
            i += cmdMatch[1].length
            continue
          }
        }
      }
    }

    // Vector modulus |\vec{...}|
    if (trimmed[i] === '|' && trimmed.startsWith('|\\vec{', i)) {
      const barClose = trimmed.indexOf('|', i + 1)
      if (barClose !== -1) {
        const mod = trimmed.slice(i, barClose + 1)
        result += katex.renderToString(mod, { throwOnError: false })
        i = barClose + 1
        continue
      }
    }

    // Exponents: e.g. 10^{-3}, 10^5, m/s^2, cm^2, m^2, v^2, t^2
    const expMatch = trimmed.slice(i).match(/^([0-9a-zA-Z/)]+)\^(\{[^{}]+\}|[0-9a-zA-Z\-]+)/)
    if (expMatch) {
      const fullExp = expMatch[0]
      result += katex.renderToString(fullExp, { throwOnError: false })
      i += fullExp.length
      continue
    }

    // Subscripts: e.g. v_0, a_n, a_\tau, m_1, etc.
    const subMatch = trimmed.slice(i).match(/^([a-zA-Z])_([0-9a-zA-Z\\]+)/)
    if (subMatch) {
      const fullSub = subMatch[0]
      result += katex.renderToString(fullSub, { throwOnError: false })
      i += fullSub.length
      continue
    }

    result += trimmed[i]
    i++
  }

  return result
}

export default function MathText({ text, className, as: Component = 'span' }: MathTextProps) {
  const html = useMemo(() => renderMathToHtml(text), [text])

  return (
    <Component
      className={className}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
