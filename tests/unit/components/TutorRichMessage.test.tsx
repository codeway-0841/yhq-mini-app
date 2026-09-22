import { describe, it, expect, vi } from 'vitest'
import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import TutorRichMessage, { parseQuizOptions } from '../../../src/shared/components/TutorRichMessage'

describe('TutorRichMessage Component & Quiz Option Detection', () => {
  describe('parseQuizOptions helper', () => {
    it('Savoldagi A), B), C), D) variantlarini aniq ajratib oladi', () => {
      const text = `Quyidagi savolga javob bering:
Nyutonning ikkinchi qonuni qaysi formula bilan ifodalanadi?

A) $F = ma$
B) $E = mc^2$
C) $v = s / t$
D) $P = UI$`

      const result = parseQuizOptions(text)
      expect(result.options.length).toBe(4)
      expect(result.options[0]).toEqual({
        key: 'A',
        text: '$F = ma$',
        raw: 'A) $F = ma$',
      })
      expect(result.options[1].key).toBe('B')
      expect(result.options[2].key).toBe('C')
      expect(result.options[3].key).toBe('D')
      expect(result.before).toContain('Nyutonning ikkinchi qonuni')
    })

    it('A., B., C., D. nuqtali variantlarni ham taniy oladi', () => {
      const text = `Test:
A. Birinchi variant
B. Ikkinchi variant
C. Uchinchi variant
D. To'rtinchi variant`

      const result = parseQuizOptions(text)
      expect(result.options.length).toBe(4)
      expect(result.options[0].key).toBe('A')
      expect(result.options[0].text).toBe('Birinchi variant')
    })

    it('Agar matnda variantlar bo\'lmasa, options bo\'sh massiv bo\'ladi', () => {
      const text = 'Bu shunchaki oddiy tushuntirish xabari bo\'lib, unda hech qanday variantli test yo\'q.'
      const result = parseQuizOptions(text)
      expect(result.options.length).toBe(0)
      expect(result.before).toBe(text)
    })
  })

  describe('Interactive Options Rendering & Click Handler', () => {
    it('Variantlar bo\'lsa, bosiladigan tugmalar (kartalar) paydo bo\'ladi va bosilganda onSelectOption chaqiriladi', () => {
      const onSelectOption = vi.fn()
      const text = `Kuch formulasini tanlang:
A) F = ma
B) E = mc^2
C) v = s/t
D) I = U/R`

      render(
        <TutorRichMessage
          content={text}
          isUser={false}
          onSelectOption={onSelectOption}
        />
      )

      // 4 ta variant tugmasi chiqishi kerak
      const optionButtons = screen.getAllByRole('button')
      expect(optionButtons.length).toBe(4)

      // A variantini bosish
      fireEvent.click(optionButtons[0])
      expect(onSelectOption).toHaveBeenCalledTimes(1)
      expect(onSelectOption).toHaveBeenCalledWith('A) F = ma')

      // C variantini bosish
      fireEvent.click(optionButtons[2])
      expect(onSelectOption).toHaveBeenCalledTimes(2)
      expect(onSelectOption).toHaveBeenCalledWith('C) v = s/t')
    })

    it('User xabarlarida variantlar interaktiv kartalarga ajratilmaydi (oddiy matn bo\'lib qoladi)', () => {
      const text = 'A) Variant tanlandi'
      const { container } = render(
        <TutorRichMessage
          content={text}
          isUser={true}
        />
      )

      expect(container.querySelectorAll('button').length).toBe(0)
      expect(container.textContent).toContain('A) Variant tanlandi')
    })
  })

  describe('KaTeX Math and Markdown Rendering', () => {
    it('LaTeX formulalarni KaTeX orqali toza render qiladi', () => {
      const text = 'Kinetik energiya formulasi: $E_k = \\frac{mv^2}{2}$ ko\'rinishida bo\'ladi.'
      const { container } = render(
        <TutorRichMessage
          content={text}
          isUser={false}
        />
      )

      expect(container.querySelector('.katex')).not.toBeNull()
      expect(container.textContent).toContain('Kinetik energiya formulasi:')
    })

    it('Qalin (bold) va kod bloklarini to\'g\'ri render qiladi', () => {
      const text = 'Bu **juda muhim** qoida va `console.log()` funksiyasi.'
      const { container } = render(
        <TutorRichMessage
          content={text}
          isUser={false}
        />
      )

      const boldEl = container.querySelector('strong')
      expect(boldEl).not.toBeNull()
      expect(boldEl?.textContent).toBe('juda muhim')

      const codeEl = container.querySelector('code')
      expect(codeEl).not.toBeNull()
      expect(codeEl?.textContent).toBe('console.log()')
    })

    it('Variant kartalarida **qalin** sarlavhalar va $...$ formulalar to\'g\'ri render bo\'ladi (xom yulduzchalar ko\'rinmaydi)', () => {
      const text = `Qaysi birini birinchi ko'rib chiqamiz?
A) **Klassik qiyin aniqmas integral**: $x^4 + 1$ bo'lgan holat
B) **Ildizli integral**: $\\sqrt{\\tan x}$ bo'lgan holat`

      const { container } = render(
        <TutorRichMessage
          content={text}
          isUser={false}
        />
      )

      const buttons = container.querySelectorAll('button')
      expect(buttons.length).toBe(2)

      // 1-tugmada <strong> bo'lishi va ichida "Klassik qiyin aniqmas integral" bo'lishi kerak
      const strongA = buttons[0].querySelector('strong')
      expect(strongA).not.toBeNull()
      expect(strongA?.textContent).toBe('Klassik qiyin aniqmas integral')
      // Xom yulduzcha qolmasligi kerak
      expect(buttons[0].textContent).not.toContain('**')

      // 1-tugmada KaTeX formula (.katex) render bo'lishi kerak
      expect(buttons[0].querySelector('.katex')).not.toBeNull()

      // 2-tugmada ham strong va katex bo'lishi kerak
      const strongB = buttons[1].querySelector('strong')
      expect(strongB).not.toBeNull()
      expect(strongB?.textContent).toBe('Ildizli integral')
      expect(buttons[1].textContent).not.toContain('**')
      expect(buttons[1].querySelector('.katex')).not.toBeNull()
    })
  })
})

