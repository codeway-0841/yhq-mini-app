import { describe, it, expect } from 'vitest'
import React from 'react'
import { render } from '@testing-library/react'
import MathText, { parseMathSegments, renderMathToHtml, renderKaTeXToString } from '../../../src/shared/components/MathText'

describe('MathText Component & KaTeX Security', () => {
  describe('XSS and HTML Injection Prevention', () => {
    it('HTML script teglarini DOM elementi sifatida chiqarmaydi (React text node sanitizatsiyasi)', () => {
      const malicious = '<script>alert("xss")</script>Oddiy matn'
      const { container } = render(<MathText text={malicious} />)

      // Script tegi DOM daraxtida HTML script elementi sifatida mavjud emasligini tekshirish
      expect(container.querySelector('script')).toBeNull()
      // Matn xavfsiz holda matn ko'rinishida saqlanadi
      expect(container.textContent).toContain('<script>alert("xss")</script>Oddiy matn')
    })

    it('Xavfli img onerror yoki svg onload atributlarini bajarmaydi', () => {
      const malicious = '<img src="x" onerror="window.pwned=1" /> Savol matni'
      const { container } = render(<MathText text={malicious} />)

      expect(container.querySelector('img')).toBeNull()
      expect(container.textContent).toContain('<img src="x" onerror="window.pwned=1" />')
    })

    it('Taqqoslash belgilari (<, >, <=, >=, &) matnda buzilmasdan chiqadi', () => {
      const text = 'Agar a < b va c > d bo\'lsa, m & n qiymatlari "aniq" bo\'ladi.'
      const { container } = render(<MathText text={text} />)

      expect(container.textContent).toBe('Agar a < b va c > d bo\'lsa, m & n qiymatlari "aniq" bo\'ladi.')
    })

    it('renderMathToHtml yordamchi funksiyasi ham HTML-escaped xavfsiz natija beradi', () => {
      const dangerous = '<b onclick="alert(1)">Qalin</b> va $x > 5$'
      const html = renderMathToHtml(dangerous)

      expect(html).not.toContain('<b onclick')
      expect(html).toContain('&lt;b onclick=&quot;alert(1)&quot;&gt;Qalin&lt;/b&gt;')
      expect(html).toContain('katex')
    })
  })

  describe('Formula Parsing and KaTeX Rendering', () => {
    it('Aniq $...$ va $$...$$ chegaralarini to\'g\'ri render qiladi', () => {
      const text = 'Tezlanish $a = \\frac{v - v_0}{t}$ va kinetik energiya: $$\\frac{mv^2}{2}$$'
      const segments = parseMathSegments(text)

      expect(segments.length).toBe(4)
      expect(segments[0]).toEqual({ type: 'text', content: 'Tezlanish ' })
      expect(segments[1].type).toBe('math')
      expect(segments[1].content).toBe('a = \\frac{v - v_0}{t}')
      expect(segments[2]).toEqual({ type: 'text', content: ' va kinetik energiya: ' })
      expect(segments[3].type).toBe('math')
      expect(segments[3].content).toBe('\\frac{mv^2}{2}')
      expect(segments[3].displayMode).toBe(true)
    })

    it('Vektorlar va ularning indekslarini (\\vec{a}_n, \\vec{v}_0) to\'g\'ri aniqlaydi', () => {
      const text = 'Jismning normal tezlanishi \\vec{a}_n va boshlang\'ich tezligi \\vec{v}_0 ga teng.'
      const segments = parseMathSegments(text)

      const mathSegments = segments.filter(s => s.type === 'math')
      expect(mathSegments.some(s => s.content.includes('\\vec{a}_n'))).toBe(true)
      expect(mathSegments.some(s => s.content.includes('\\vec{v}_0'))).toBe(true)
    })

    it('Ildizlar va kasrlar (\\sqrt{\\frac{W}{C}}) toza render bo\'ladi', () => {
      const formula = '\\sqrt{\\frac{W}{C}}'
      const html = renderKaTeXToString(formula)

      expect(html).not.toBeNull()
      expect(html).toContain('katex')
      expect(html).not.toContain('katex-error')
    })

    it('Darajalar va o\'nning darajalari (10^{-3}, m/s^2) to\'g\'ri segmentatsiyalanadi', () => {
      const text = 'Bosim 10^{-3} Pa, tezlanish esa 5 m/s^2 ga teng.'
      const segments = parseMathSegments(text)

      const mathContents = segments.filter(s => s.type === 'math').map(s => s.content)
      expect(mathContents).toContain('10^{-3}')
      expect(mathContents).toContain('m/s^2')
    })

    it('\\begin{cases} tizimli qavslarini displayMode bilan toza render qiladi', () => {
      const text = 'Tengsizliklar sistemasi: \\begin{cases} x - 1 < 4 \\\\ x \\ge 3 \\end{cases} yechimini toping.'
      const segments = parseMathSegments(text)

      expect(segments.length).toBe(3)
      expect(segments[1].type).toBe('math')
      expect(segments[1].displayMode).toBe(true)
      expect(segments[1].content).toContain('\\begin{cases}')

      const { container } = render(<MathText text={text} />)
      expect(container.querySelector('.katex-display')).not.toBeNull()
      expect(container.querySelector('.overflow-x-auto')).not.toBeNull()
    })
  })

  describe('Error Handling & Fallback', () => {
    it('Buzilgan LaTeX sintaksisi sahifani yiqitmasdan oddiy matn fallback sifatida ko\'rsatiladi', () => {
      const brokenMath = 'Formula: $\\frac{1}{' // Yopilmagan kasr
      const { container } = render(<MathText text={brokenMath} />)

      expect(container.textContent).toContain('Formula: $\\frac{1}{')
    })

    it('Juda uzun yoki haddan tashqari kengayuvchi formula xavfsiz bloklanadi', () => {
      const hugeFormula = '\\frac{1}{'.repeat(300) + '1' + '}'.repeat(300)
      const rendered = renderKaTeXToString(hugeFormula)

      // KaTeX xatosi yoki limitdan oshishi sababli null qaytarishi kerak
      expect(rendered).toBeNull()
    })
  })
})
