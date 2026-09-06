import React, { useMemo } from 'react'
import katex from 'katex'

export interface MathSegment {
  type: 'text' | 'math'
  content: string
  displayMode?: boolean
}

export interface MathTextProps {
  text: string
  className?: string
  as?: 'span' | 'p' | 'div'
}

const MAX_INPUT_LENGTH = 15000
const MAX_FORMULA_LENGTH = 2000

const KATEX_OPTIONS = {
  throwOnError: false,
  trust: false, // Security: strictly block \url, \href, \includegraphics, \htmlId, etc.
  strict: 'ignore',
  maxSize: 30,
  maxExpand: 1000,
} as const

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
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
 * Safely renders LaTeX string with KaTeX under strict trust: false.
 * Returns null if the formula is invalid or produces a KaTeX error.
 */
export function renderKaTeXToString(math: string, displayMode = false): string | null {
  const trimmed = math.trim()
  if (!trimmed || trimmed.length > MAX_FORMULA_LENGTH) return null

  try {
    const rendered = katex.renderToString(trimmed, {
      ...KATEX_OPTIONS,
      displayMode,
    })
    if (rendered.includes('class="katex-error"')) {
      return null
    }
    return rendered
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('KaTeX render error for formula:', trimmed, err)
    }
    return null
  }
}

/**
 * Parses mixed text and LaTeX into structured segments.
 * Distinguishes explicit delimiters ($$, $, \[, \(), pure formulas, and mixed prose.
 */
export function parseMathSegments(text: string): MathSegment[] {
  if (!text) return []
  if (text.length > MAX_INPUT_LENGTH) {
    text = text.slice(0, MAX_INPUT_LENGTH)
  }

  // 1. Explicit LaTeX block or inline delimiters: $$, $, \[, \(
  if (text.includes('$') || text.includes('\\(') || text.includes('\\[')) {
    const segments: MathSegment[] = []
    const regex = /(\$\$[\s\S]+?\$\$|\$[^$\n]+\$|\\\[[\s\S]+?\\\]|\\\([\s\S]+?\\\))/g
    let lastIndex = 0
    let match: RegExpExecArray | null

    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        segments.push({ type: 'text', content: text.slice(lastIndex, match.index) })
      }

      const raw = match[0]
      let mathContent = ''
      let displayMode = false

      if (raw.startsWith('$$') && raw.endsWith('$$')) {
        mathContent = raw.slice(2, -2).trim()
        displayMode = true
      } else if (raw.startsWith('\\[') && raw.endsWith('\\]')) {
        mathContent = raw.slice(2, -2).trim()
        displayMode = true
      } else if (raw.startsWith('\\(') && raw.endsWith('\\)')) {
        mathContent = raw.slice(2, -2).trim()
      } else if (raw.startsWith('$') && raw.endsWith('$')) {
        mathContent = raw.slice(1, -1).trim()
      }

      const rendered = renderKaTeXToString(mathContent, displayMode)
      if (rendered) {
        segments.push({ type: 'math', content: mathContent, displayMode })
      } else {
        segments.push({ type: 'text', content: raw })
      }

      lastIndex = regex.lastIndex
    }

    if (lastIndex < text.length) {
      segments.push({ type: 'text', content: text.slice(lastIndex) })
    }

    return segments
  }

  // 2. Pure formula check (e.g. single mathematical options)
  const trimmed = text.trim()
  const words = trimmed.split(/\s+/).filter(w => /^[a-zA-Z'ʻ`’]{4,}$/.test(w) && !/^(const|frac|sqrt|text|left|right|cdot|times|approx|infty|Delta)$/i.test(w))
  const isLikelyProse = words.length >= 2

  if (!isLikelyProse && (trimmed.includes('\\') || trimmed.includes('^') || /_[0-9a-zA-Z]/.test(trimmed))) {
    const hasDot = trimmed.endsWith('.')
    const cleanMath = hasDot ? trimmed.slice(0, -1) : trimmed
    const rendered = renderKaTeXToString(cleanMath, false)
    if (rendered) {
      const segments: MathSegment[] = [{ type: 'math', content: cleanMath, displayMode: false }]
      if (hasDot) {
        segments.push({ type: 'text', content: '.' })
      }
      return segments
    }
  }

  // 3. Mixed prose tokenizer
  const segments: MathSegment[] = []
  let currentText = ''
  let i = 0

  const flushText = () => {
    if (currentText) {
      segments.push({ type: 'text', content: currentText })
      currentText = ''
    }
  }

  while (i < text.length) {
    // LaTeX commands starting with \
    if (text[i] === '\\') {
      if (text.startsWith('\\frac{', i)) {
        const numClose = findClosingBrace(text, i + 5)
        if (numClose !== -1 && text[numClose + 1] === '{') {
          const denClose = findClosingBrace(text, numClose + 1)
          if (denClose !== -1) {
            const frac = text.slice(i, denClose + 1)
            const rendered = renderKaTeXToString(frac)
            if (rendered) {
              flushText()
              segments.push({ type: 'math', content: frac })
              i = denClose + 1
              continue
            }
          }
        }
      } else if (text.startsWith('\\sqrt{', i)) {
        const close = findClosingBrace(text, i + 5)
        if (close !== -1) {
          const sqrt = text.slice(i, close + 1)
          const rendered = renderKaTeXToString(sqrt)
          if (rendered) {
            flushText()
            segments.push({ type: 'math', content: sqrt })
            i = close + 1
            continue
          }
        }
      } else if (text.startsWith('\\vec{', i)) {
        const close = findClosingBrace(text, i + 4)
        if (close !== -1) {
          let endIdx = close + 1
          const subMatch = text.slice(endIdx).match(/^(_(?:\{[^{}]+\}|[0-9a-zA-Z\\]+))/)
          if (subMatch) {
            endIdx += subMatch[0].length
          }
          const vec = text.slice(i, endIdx)
          const rendered = renderKaTeXToString(vec)
          if (rendered) {
            flushText()
            segments.push({ type: 'math', content: vec })
            i = endIdx
            continue
          }
        }
      } else if (text.startsWith('\\text{', i)) {
        const close = findClosingBrace(text, i + 5)
        if (close !== -1) {
          const txt = text.slice(i, close + 1)
          const rendered = renderKaTeXToString(txt)
          if (rendered) {
            flushText()
            segments.push({ type: 'math', content: txt })
            i = close + 1
            continue
          }
        }
      } else {
        const cmdMatch = text.slice(i).match(/^(\\[a-zA-Z]+(?:\s*[a-zA-Z0-9_]*)?)/)
        if (cmdMatch) {
          const cmd = cmdMatch[1]
          const rendered = renderKaTeXToString(cmd)
          if (rendered) {
            flushText()
            segments.push({ type: 'math', content: cmd })
            i += cmd.length
            continue
          }
        }
      }
    }

    // Vector modulus |\vec{...}|
    if (text[i] === '|' && text.startsWith('|\\vec{', i)) {
      const barClose = text.indexOf('|', i + 1)
      if (barClose !== -1) {
        const mod = text.slice(i, barClose + 1)
        const rendered = renderKaTeXToString(mod)
        if (rendered) {
          flushText()
          segments.push({ type: 'math', content: mod })
          i = barClose + 1
          continue
        }
      }
    }

    // Exponents: e.g. 10^{-3}, 10^5, m/s^2, cm^2, m^2, v^2, t^2
    const expMatch = text.slice(i).match(/^([0-9a-zA-Z/)]+)\^(\{[^{}]+\}|[0-9a-zA-Z-]+)/)
    if (expMatch) {
      const fullExp = expMatch[0]
      const rendered = renderKaTeXToString(fullExp)
      if (rendered) {
        flushText()
        segments.push({ type: 'math', content: fullExp })
        i += fullExp.length
        continue
      }
    }

    // Subscripts: e.g. v_0, a_n, a_\tau, m_1, etc.
    const subMatch = text.slice(i).match(/^([a-zA-Z])_([0-9a-zA-Z\\]+)/)
    if (subMatch) {
      const fullSub = subMatch[0]
      const rendered = renderKaTeXToString(fullSub)
      if (rendered) {
        flushText()
        segments.push({ type: 'math', content: fullSub })
        i += fullSub.length
        continue
      }
    }

    currentText += text[i]
    i++
  }

  flushText()
  return segments
}

/**
 * Backward-compatible helper that renders math to safe HTML string with escaped prose.
 */
export function renderMathToHtml(text: string): string {
  if (!text) return ''
  const segments = parseMathSegments(text)

  return segments
    .map(seg => {
      if (seg.type === 'text') {
        return escapeHtml(seg.content)
      }
      const mathHtml = renderKaTeXToString(seg.content, seg.displayMode)
      if (mathHtml) {
        return mathHtml
      }
      return escapeHtml(seg.content)
    })
    .join('')
}

/**
 * Individual KaTeX formula node with fallback to plain React text on failure.
 */
function MathSegmentNode({ math, displayMode }: { math: string; displayMode?: boolean }) {
  const html = useMemo(() => renderKaTeXToString(math, displayMode), [math, displayMode])

  if (!html) {
    return <span>{math}</span>
  }

  return (
    <span
      className={displayMode ? 'block my-1 text-center' : 'inline-block'}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}

/**
 * Pure React MathText component.
 * Plain text is rendered directly as React text nodes (preventing any HTML/XSS injection),
 * while mathematical formulas are processed safely via KaTeX (trust: false).
 */
export default function MathText({ text, className, as: Component = 'span' }: MathTextProps) {
  const segments = useMemo(() => parseMathSegments(text), [text])

  return (
    <Component className={className}>
      {segments.map((seg, idx) => {
        if (seg.type === 'text') {
          return <React.Fragment key={idx}>{seg.content}</React.Fragment>
        }
        return (
          <MathSegmentNode
            key={idx}
            math={seg.content}
            displayMode={seg.displayMode}
          />
        )
      })}
    </Component>
  )
}

