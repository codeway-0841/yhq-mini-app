/**
 * Math Board — MathLive LaTeX → engine ASCII konvertor (Faza 3).
 *
 * MathLive `\frac{}{}`, `\sqrt{}`, `\log_{}`, `\left\right` yozadi;
 * engine ASCII grammatikani tushunadi (`(1)/(2)`, `sqrt(9)`, `log(2,32)`).
 * Noma'lum buyruqlar qoldiriladi → engine `syntax_error` beradi (halol xato).
 */

function findClose(s: string, openIdx: number): number {
  let depth = 0
  for (let i = openIdx; i < s.length; i++) {
    if (s[i] === '{') depth++
    else if (s[i] === '}') {
      depth--
      if (depth === 0) return i
    }
  }
  return -1
}

/** `(X)` ko'rinishidagi ortiqcha tashqi qavsni echadi (muvozanatli bo'lsa) */
function unwrapParens(text: string): string {
  if (text.length >= 2 && text.startsWith('(') && text.endsWith(')')) {
    let depth = 0
    for (let i = 0; i < text.length; i++) {
      if (text[i] === '(') depth++
      else if (text[i] === ')') {
        depth--
        if (depth === 0 && i !== text.length - 1) return text
      }
    }
    if (depth === 0) return text.slice(1, -1)
  }
  return text
}
function readAtom(s: string, i: number): { text: string; next: number } {
  while (i < s.length && s[i] === ' ') i++
  if (s[i] === '{') {
    const close = findClose(s, i)
    if (close === -1) return { text: s.slice(i + 1), next: s.length }
    return { text: s.slice(i + 1, close), next: close + 1 }
  }
  if (s[i] === '(') {
    let depth = 0
    for (let j = i; j < s.length; j++) {
      if (s[j] === '(') depth++
      else if (s[j] === ')') {
        depth--
        if (depth === 0) return { text: s.slice(i, j + 1), next: j + 1 }
      }
    }
    return { text: s.slice(i), next: s.length }
  }
  if (s[i] === '\\') {
    const m = /^\\[a-zA-Z]+/.exec(s.slice(i))
    if (m) return { text: m[0], next: i + m[0].length }
    return { text: s[i + 1] ?? '', next: i + 2 }
  }
  return { text: s[i] ?? '', next: i + 1 }
}

/**
 * To'liq argument o'qish (P2): qavssiz argument operator/tenglikkacha
 * (`\log_{2}32` → `32`, `\log_2x+1` → `x`). Guruh/qavs — balansli;
 * `\fn` + guruh — bir atom (`\sin(x)`).
 */
const ARG_STOP = new Set(['+', '-', '*', '/', '^', '%', '=', ',', '<', '>', '!', '&', '|', ' ', '\t'])

function readArg(s: string, i: number): { text: string; next: number } {
  while (i < s.length && (s[i] === ' ' || s[i] === '\t')) i++
  if (s[i] === '{' || s[i] === '(') return readAtom(s, i)
  if (s[i] === '\\') {
    const m = /^\\[a-zA-Z]+/.exec(s.slice(i))
    if (!m) return { text: '', next: i + 1 }
    let j = i + m[0].length
    while (j < s.length && (s[j] === ' ' || s[j] === '\t')) j++
    if (s[j] === '{' || s[j] === '(') {
      const atom = readAtom(s, j)
      return { text: m[0] + atom.text, next: atom.next }
    }
    return { text: m[0], next: j }
  }
  let j = i
  while (j < s.length && !ARG_STOP.has(s[j]) && s[j] !== '\\' && s[j] !== '{' && s[j] !== '(' && s[j] !== ')' && s[j] !== '}') j++
  return { text: s.slice(i, j), next: j }
}

export function latexToAscii(input: string): string {
  let s = input
  s = s.replace(/\\left|\\right/g, '')
  s = s.replace(/\\[,;!:\s]/g, '')
  s = s.replace(/~/g, '')

  // \frac{A}{B} → (A)/(B) (ichma-ich — eng ichkaridan)
  for (let guard = 0; guard < 20; guard++) {
    const idx = s.lastIndexOf('\\frac')
    if (idx === -1) break
    let i = idx + 5
    while (s[i] === ' ') i++
    if (s[i] !== '{') break
    const aClose = findClose(s, i)
    if (aClose === -1) break
    let j = aClose + 1
    while (s[j] === ' ') j++
    if (s[j] !== '{') break
    const bClose = findClose(s, j)
    if (bClose === -1) break
    const a = s.slice(i + 1, aClose)
    const b = s.slice(j + 1, bClose)
    s = `${s.slice(0, idx)}(${a})/(${b})${s.slice(bClose + 1)}`
  }

  // \sqrt[n]{A} → (A)^(1/(n)), \sqrt{A} → sqrt(A)
  for (let guard = 0; guard < 20; guard++) {
    const idx = s.lastIndexOf('\\sqrt')
    if (idx === -1) break
    let i = idx + 5
    while (s[i] === ' ') i++
    if (s[i] === '[') {
      const end = s.indexOf(']', i)
      if (end === -1) break
      const n = s.slice(i + 1, end)
      let j = end + 1
      while (s[j] === ' ') j++
      if (s[j] !== '{') break
      const close = findClose(s, j)
      if (close === -1) break
      const a = s.slice(j + 1, close)
      s = `${s.slice(0, idx)}(${a})^(1/(${n}))${s.slice(close + 1)}`
    } else if (s[i] === '{') {
      const close = findClose(s, i)
      if (close === -1) break
      const a = s.slice(i + 1, close)
      s = `${s.slice(0, idx)}sqrt(${a})${s.slice(close + 1)}`
    } else break
  }

  // \log_{B}X / \log_BX → log(B,X) — argument to'liq o'qiladi (P2)
  for (let guard = 0; guard < 20; guard++) {
    const idx = s.lastIndexOf('\\log_')
    if (idx === -1) break
    const rest = s.slice(idx + 5)
    const base = readAtom(rest, 0)
    const arg = readArg(rest, base.next)
    if (!arg.text) break
    s = `${s.slice(0, idx)}log(${unwrapParens(base.text)},${unwrapParens(arg.text)})${rest.slice(arg.next)}`
  }

  // Qolgan \fn buyruqlar → fn (P2): \sin(x), \ln e, \cos 2x ... Engine
  // qavssiz bitta-argument chaqiruvni tushunadi. Uzun nomlar birinchi.
  // (\frac\sqrt\log_ yuqorida qayta ishlandi; \ln\lg\log qavs/guruhlari
  // pastdagi {...}→(...) qoidasi bilan parentezlanadi.)
  s = s.replace(/\\(log10|log2|atan2|sinh|cosh|tanh|asin|acos|atan|sin|cos|tan|cot|sec|csc|cbrt|abs|exp|floor|ceil|round|sign|min|max|mod|pow|hypot|ln|lg|log)\b/g, '$1')

  // P2-F: qavssiz funksiya argumentini bog'lash (`\sin 2x` → `sin(2x)`).
  // Sabab: parserda `sin 2x` BP_UNARY (25) > MUL (20) tufayli `sin(2)*x`
  // bo'lib qoladi — matematik ma'no `sin(2x)`. Faqat 1-arg funksiyalar,
  // atom qavs bilan boshlanmasa (`sin(x)` tegilmaydi).
  s = s.replace(
    /\b(asin|acos|atan|sinh|cosh|tanh|sin|cos|tan|cot|sec|csc|cbrt|abs|exp|floor|ceil|round|sign|ln|lg|log10|log2|log)\s+([A-Za-z0-9_.]+)/g,
    '$1($2)',
  )

  s = s.replace(/\\(cdot|times)/g, '*')
  s = s.replace(/\\div/g, '/')
  s = s.replace(/\\pi/g, 'pi')
  // ^{X} → ^(X); qolgan _{..} subscript'lar engine'da yo'q — tashlanadi
  s = s.replace(/\^\{([^{}]*)\}/g, '^($1)')
  s = s.replace(/_\{([^{}]*)\}/g, '')
  s = s.replace(/_([a-zA-Z0-9])/g, '')
  // Qolgan {...} guruhlar → (...)
  for (let guard = 0; guard < 20; guard++) {
    const idx = s.indexOf('{')
    if (idx === -1) break
    const close = findClose(s, idx)
    if (close === -1) break
    s = `${s.slice(0, idx)}(${s.slice(idx + 1, close)})${s.slice(close + 1)}`
  }
  // Bo'shliq: operator atrofidagisi o'chadi, `sin x` dagi saqlanadi
  // (`sinx` alohida o'zgaruvchi bo'lib qolmasligi uchun, P2).
  // Engine tokenizer bo'shliqni baribir o'tkazib yuboradi.
  return s.trim().replace(/\s+/g, ' ').replace(/\s*([+\-*/^%=,()])\s*/g, '$1')
}
