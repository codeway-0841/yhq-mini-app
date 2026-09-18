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
 * Strict KaTeX validity gate for SEGMENTATION (not display).
 * Lenient rendering hides unknown commands (red text without error class),
 * so `\\alphax` would pass as "math". This gate rejects:
 * - unknown control sequences (throwOnError),
 * - prose apostrophes / Cyrillic inside math (never valid TeX).
 * Display stays crash-proof: MathSegmentNode falls back to plain text.
 */
export function isValidKaTeX(math: string, _displayMode = false): boolean {
  const trimmed = math.trim()
  if (!trimmed || trimmed.length > MAX_FORMULA_LENGTH) return false
  if (/[‘’ʻ`а-яА-ЯЁё]/.test(trimmed)) return false
  try {
    katex.renderToString(trimmed, {
      ...KATEX_OPTIONS,
      throwOnError: true,
      displayMode: false,
    })
    return true
  } catch {
    return false
  }
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

  // 1. Explicit LaTeX block or inline delimiters: $$, $, \[, \(, \begin{cases}, \begin{matrix}
  if (text.includes('$') || text.includes('\\(') || text.includes('\\[') || text.includes('\\begin{cases}') || text.includes('\\begin{matrix}')) {
    const segments: MathSegment[] = []
    const regex = /(\$\$[\s\S]+?\$\$|\$[^$\n]+\$|\\\[[\s\S]+?\\\]|\\\([\s\S]+?\\\)|\\begin\{cases\}[\s\S]+?\\end\{cases\}|\\begin\{matrix\}[\s\S]+?\\end\{matrix\})/g
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
      } else if (raw.startsWith('\\begin{cases}') && raw.endsWith('\\end{cases}')) {
        mathContent = raw.trim()
        displayMode = true
      } else if (raw.startsWith('\\begin{matrix}') && raw.endsWith('\\end{matrix}')) {
        mathContent = raw.trim()
        displayMode = true
      } else if (raw.startsWith('\\(') && raw.endsWith('\\)')) {
        mathContent = raw.slice(2, -2).trim()
      } else if (raw.startsWith('$') && raw.endsWith('$')) {
        mathContent = raw.slice(1, -1).trim()
      }

      const rendered = isValidKaTeX(mathContent, displayMode)
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
  // Prose guard strips surrounding punctuation first: 'bo‘lsa,' and 'qancha?'
  // must count as Uzbek words, otherwise prose gets swallowed into math-italic.
  // NOTE: both Uzbek apostrophes U+2018 (‘) and U+2019 (’) are in the class.
  const trimmed = text.trim()
  const stripPunct = (w: string) => w.replace(/^[^a-zA-Z'ʻ`’‘]+|[^a-zA-Z'ʻ`’‘]+$/g, '')
  const words = trimmed.split(/\s+/).map(stripPunct).filter(w => /^[a-zA-Z'ʻ`’‘]{4,}$/.test(w) && !/^(const|frac|sqrt|text|left|right|cdot|times|approx|infty|delta|alpha|beta|gamma|pi|circ|le|ge|ne|in|cup|cap|log|ln|sin|cos|tg|ctg|lim|vec|operatorname|frac)$/i.test(w))
  const hasUzbekApostrophe = /[‘’'`′]/.test(trimmed) && /[a-zA-Z]/.test(trimmed)
  // '%' never belongs to pure math (KaTeX comment char); with a prose word
  // it proves the field is a sentence, not a formula.
  const hasPercent = trimmed.includes('%')
  // A 4+ letter word together with an Uzbek apostrophe is always prose:
  // pure math never has both (variables are short, functions excluded).
  const isLikelyProse = words.length >= 2 || (words.length >= 1 && (hasUzbekApostrophe || hasPercent))

  if (!isLikelyProse && (trimmed.includes('\\') || trimmed.includes('^') || /_[0-9a-zA-Z]/.test(trimmed))) {
    const hasDot = trimmed.endsWith('.')
    const cleanMath = hasDot ? trimmed.slice(0, -1) : trimmed
    const rendered = isValidKaTeX(cleanMath, false)
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
            const rendered = isValidKaTeX(frac)
            if (rendered) {
              flushText()
              segments.push({ type: 'math', content: frac })
              i = denClose + 1
              continue
            }
          }
        }
      } else if (text.startsWith('\\sqrt[', i)) {
        // Indexed root: \sqrt[3]{...} with balanced braces
        const optClose = text.indexOf(']', i + 6)
        if (optClose !== -1 && text[optClose + 1] === '{') {
          const radClose = findClosingBrace(text, optClose + 1)
          if (radClose !== -1) {
            const sqrt = text.slice(i, radClose + 1)
            const rendered = isValidKaTeX(sqrt)
            if (rendered) {
              flushText()
              segments.push({ type: 'math', content: sqrt })
              i = radClose + 1
              continue
            }
          }
        }
      } else if (text.startsWith('\\sqrt{', i)) {
        const close = findClosingBrace(text, i + 5)
        if (close !== -1) {
          const sqrt = text.slice(i, close + 1)
          const rendered = isValidKaTeX(sqrt)
          if (rendered) {
            flushText()
            segments.push({ type: 'math', content: sqrt })
            i = close + 1
            continue
          }
        }
      } else if (text.startsWith('\\operatorname{', i)) {
        const close = findClosingBrace(text, i + 13)
        if (close !== -1) {
          const op = text.slice(i, close + 1)
          const rendered = isValidKaTeX(op)
          if (rendered) {
            flushText()
            segments.push({ type: 'math', content: op })
            i = close + 1
            continue
          }
        }
      } else if (text.startsWith('\\left', i)) {
        // Paired \left...\right... span first (balanced delimiters render).
        // Rejected when the span holds Uzbek prose (apostrophe never occurs
        // in math): parenthetical remarks stay text with plain delimiters.
        const pairMatch = text.slice(i, i + 500).match(/^\\left\s*[\(\)\[\]\{\}\|\.\/]\s*[\s\S]+?\\right\s*[\(\)\[\]\{\}\|\.\/]/)
        if (pairMatch && !/[‘’'`′]/.test(pairMatch[0])) {
          const span = pairMatch[0]
          const rendered = isValidKaTeX(span)
          if (rendered) {
            flushText()
            segments.push({ type: 'math', content: span })
            i += span.length
            continue
          }
        }
        // Singleton \leftX (unbalanced source): render just the delimiter.
        const singleMatch = text.slice(i).match(/^\\left\s*([\(\)\[\]\{\}\|\.\/])/)
        if (singleMatch) {
          const delim = singleMatch[1]
          const rendered = renderKaTeXToString(delim)
          if (rendered) {
            flushText()
            segments.push({ type: 'math', content: delim })
            i += singleMatch[0].length
            continue
          }
        }
      } else if (text.startsWith('\\right', i)) {
        const singleMatch = text.slice(i).match(/^\\right\s*([\(\)\[\]\{\}\|\.\/])/)
        if (singleMatch) {
          const delim = singleMatch[1]
          const rendered = renderKaTeXToString(delim)
          if (rendered) {
            flushText()
            segments.push({ type: 'math', content: delim })
            i += singleMatch[0].length
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
          const rendered = isValidKaTeX(vec)
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
          const rendered = isValidKaTeX(txt)
          if (rendered) {
            flushText()
            segments.push({ type: 'math', content: txt })
            i = close + 1
            continue
          }
        }
      } else {
        // Bare command name only ('\alpha', not '\alphax'): greedy alnum
        // swallowing creates undefined sequences ('\alphax', '\sinx').
        // Afterwards, attach script arguments ('\log_{2}', '\pi^{2}').
        // Unknown long commands fall back to the longest renderable prefix
        // ('\alphax' -> '\alpha' + 'x').
        const cmdMatch = text.slice(i).match(/^(\\[a-zA-Z]+)/)
        if (cmdMatch) {
          const full = cmdMatch[1]
          const scriptMatch = text.slice(i + full.length).match(/^((?:_\{[^}]*\}|\^\{[^}]*\}|_[0-9a-zA-Z]|\^[0-9a-zA-Z])+)/)
          const withScript = scriptMatch ? full + scriptMatch[0] : full
          if (isValidKaTeX(withScript)) {
            flushText()
            segments.push({ type: 'math', content: withScript })
            i += withScript.length
            continue
          }
          let emit: string | null = null
          for (let len = full.length - 1; len >= 3; len--) {
            const cand = full.slice(0, len)
            if (isValidKaTeX(cand)) {
              emit = cand
              break
            }
          }
          if (emit) {
            flushText()
            segments.push({ type: 'math', content: emit })
            i += emit.length
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
        const rendered = isValidKaTeX(mod)
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
      const rendered = isValidKaTeX(fullExp)
      if (rendered) {
        flushText()
        segments.push({ type: 'math', content: fullExp })
        i += fullExp.length
        continue
      }
    }

    // Subscripts: e.g. v_0, a_n, x_{0}, a_\tau, m_1, log_{2}, sin^{2}x etc.
    // Plain function words with geometric subscripts ('log_{0,5}').
    const funcSubMatch = text.slice(i).match(/^(log|ln|lg|sin|cos|tg|ctg|arcsin|arccos|arctg|arcctg)_(\{[^{}]+\}|[0-9a-zA-Z\\]+)/)
    if (funcSubMatch) {
      const fullSub = funcSubMatch[0]
      const rendered = isValidKaTeX('\\' + fullSub)
      if (rendered) {
        flushText()
        segments.push({ type: 'math', content: '\\' + fullSub })
        i += fullSub.length
        continue
      }
    }
    const subMatch = text.slice(i).match(/^([a-zA-Z])_(\{[^{}]+\}|[0-9a-zA-Z\\]+)/)
    if (subMatch) {
      const fullSub = subMatch[0]
      const rendered = isValidKaTeX(fullSub)
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
      className={displayMode ? 'block my-1.5 text-center overflow-x-auto max-w-full py-0.5' : 'inline-block max-w-full overflow-x-auto align-middle'}
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

