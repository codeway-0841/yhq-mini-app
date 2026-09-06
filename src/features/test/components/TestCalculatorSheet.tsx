import { useState, useEffect, useCallback } from 'react'
import { Delete, AlertCircle } from 'lucide-react'
import { Sheet, SheetBody, SheetClose, SheetHeader, SheetTitle } from '../../../shared/components/ui/sheet'
import { useT, type Lang } from '../../../shared/i18n'
import { haptics } from '../../../platform/haptics'
import {
  evaluateExpression,
  formatCalculatorNumber,
  initialCalculatorState,
  type CalculatorState,
} from './calculator-eval'

interface TestCalculatorSheetProps {
  open: boolean
  onClose: () => void
  language: Lang
  disabledReason?: string | null
}

export default function TestCalculatorSheet({
  open,
  onClose,
  language,
  disabledReason,
}: TestCalculatorSheetProps) {
  const tt = useT(language)
  const [calc, setCalc] = useState<CalculatorState>(initialCalculatorState)

  // Reset on open
  useEffect(() => {
    if (open) {
      setCalc(initialCalculatorState())
    }
  }, [open])

  const handleClear = useCallback(() => {
    haptics.impact('light')
    setCalc(initialCalculatorState())
  }, [])

  const handleBackspace = useCallback(() => {
    haptics.impact('light')
    setCalc((prev) => {
      if (prev.hasResult) return initialCalculatorState()
      if (prev.expression.length <= 1) return initialCalculatorState()
      const nextExpr = prev.expression.slice(0, -1).trimEnd()
      return {
        ...prev,
        expression: nextExpr,
        display: nextExpr.length === 0 ? '0' : nextExpr,
      }
    })
  }, [])

  const handleAppend = useCallback((char: string) => {
    haptics.impact('light')
    setCalc((prev) => {
      if (prev.hasResult) {
        // Agar natijadan keyin amal kiritilsa natijaga ulaymiz, raqam kiritilsa yangi boshlaymiz
        if (['+', '-', '×', '÷', '^', '%'].includes(char)) {
          return {
            expression: `${prev.display} ${char} `,
            display: prev.display,
            hasResult: false,
          }
        }
        return {
          expression: char,
          display: char,
          hasResult: false,
        }
      }

      const isOp = ['+', '-', '×', '÷', '^', '%'].includes(char)
      let nextExpr = prev.expression

      if (isOp) {
        // Agar oxirgisi ham amal bo'lsa almashtiramiz
        if (/\s[+\-×÷^%]\s$/.test(nextExpr)) {
          nextExpr = nextExpr.slice(0, -3) + ` ${char} `
        } else {
          nextExpr = nextExpr ? `${nextExpr} ${char} ` : (char === '-' ? '-' : `0 ${char} `)
        }
      } else {
        nextExpr = nextExpr + char
      }

      return {
        expression: nextExpr,
        display: nextExpr,
        hasResult: false,
      }
    })
  }, [])

  const handleCalculate = useCallback(() => {
    haptics.impact('medium')
    setCalc((prev) => {
      if (!prev.expression) return prev
      try {
        const result = evaluateExpression(prev.expression)
        const formatted = formatCalculatorNumber(result)
        return {
          expression: prev.expression,
          display: formatted,
          hasResult: true,
        }
      } catch {
        return {
          ...prev,
          display: 'Xato',
          hasResult: true,
        }
      }
    })
  }, [])

  const handleToggleSign = useCallback(() => {
    haptics.impact('light')
    setCalc((prev) => {
      if (prev.hasResult) {
        const num = parseFloat(prev.display)
        if (Number.isNaN(num)) return prev
        const nextVal = formatCalculatorNumber(-num)
        return {
          expression: nextVal,
          display: nextVal,
          hasResult: false,
        }
      }
      if (!prev.expression) return { expression: '-', display: '-', hasResult: false }
      if (prev.expression.startsWith('-')) {
        const next = prev.expression.slice(1)
        return { expression: next, display: next || '0', hasResult: false }
      }
      return {
        expression: `-${prev.expression}`,
        display: `-${prev.expression}`,
        hasResult: false,
      }
    })
  }, [])

  const handleSquare = useCallback(() => {
    haptics.impact('light')
    setCalc((prev) => {
      const base = prev.hasResult ? prev.display : prev.expression
      if (!base) return prev
      try {
        const val = evaluateExpression(base)
        const res = formatCalculatorNumber(val * val)
        return {
          expression: `(${base})²`,
          display: res,
          hasResult: true,
        }
      } catch {
        return { ...prev, display: 'Xato', hasResult: true }
      }
    })
  }, [])

  const handleSqrt = useCallback(() => {
    haptics.impact('light')
    setCalc((prev) => {
      const base = prev.hasResult ? prev.display : prev.expression
      if (!base) return prev
      try {
        const val = evaluateExpression(base)
        if (val < 0) return { ...prev, display: 'Xato', hasResult: true }
        const res = formatCalculatorNumber(Math.sqrt(val))
        return {
          expression: `√(${base})`,
          display: res,
          hasResult: true,
        }
      } catch {
        return { ...prev, display: 'Xato', hasResult: true }
      }
    })
  }, [])

  // Keyboard navigation
  useEffect(() => {
    if (!open || disabledReason) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') {
        e.preventDefault()
        handleAppend(e.key)
      } else if (e.key === '.') {
        e.preventDefault()
        handleAppend('.')
      } else if (e.key === '+') {
        e.preventDefault()
        handleAppend('+')
      } else if (e.key === '-') {
        e.preventDefault()
        handleAppend('-')
      } else if (e.key === '*') {
        e.preventDefault()
        handleAppend('×')
      } else if (e.key === '/') {
        e.preventDefault()
        handleAppend('÷')
      } else if (e.key === '(' || e.key === ')') {
        e.preventDefault()
        handleAppend(e.key)
      } else if (e.key === 'Enter' || e.key === '=') {
        e.preventDefault()
        handleCalculate()
      } else if (e.key === 'Backspace') {
        e.preventDefault()
        handleBackspace()
      } else if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, disabledReason, handleAppend, handleCalculate, handleBackspace, onClose])

  return (
    <Sheet open={open} onClose={onClose} zIndex={70} className="max-w-md">
      <SheetHeader>
        <SheetTitle>{tt('calculatorTitle')}</SheetTitle>
      </SheetHeader>
      <SheetClose onClose={onClose} label={tt('calculatorClose')} />

      <SheetBody className="space-y-4 px-4 pb-6">
        {disabledReason ? (
          <div className="flex flex-col items-center justify-center gap-3 py-8 text-center">
            <div className="grid size-14 place-items-center rounded-2xl bg-pdanger/10 text-pdanger">
              <AlertCircle size={32} />
            </div>
            <p className="text-base font-semibold text-pfg">{disabledReason}</p>
            <p className="max-w-xs text-xs text-pmuted leading-relaxed">
              {tt('calculatorDisabledExam')}
            </p>
          </div>
        ) : (
          <>
            {/* Display screen */}
            <div className="flex flex-col justify-end rounded-2xl bg-psurface p-4 min-h-[96px] text-right shadow-inner select-all">
              <span className="text-xs font-mono text-pmuted tracking-wide overflow-x-auto whitespace-nowrap [scrollbar-width:none]">
                {calc.expression || ' '}
              </span>
              <span className="text-3xl font-display font-bold text-pfg tracking-tight overflow-x-auto whitespace-nowrap [scrollbar-width:none]">
                {calc.display}
              </span>
            </div>

            {/* Keypad Grid */}
            <div className="grid grid-cols-4 gap-2 text-base font-semibold select-none">
              {/* Row 1 */}
              <button
                type="button"
                onClick={handleClear}
                className="grid h-12 place-items-center rounded-xl bg-pdanger/10 text-pdanger hover:bg-pdanger/20 active:scale-95 transition-all"
              >
                C
              </button>
              <button
                type="button"
                onClick={() => handleAppend('(')}
                className="grid h-12 place-items-center rounded-xl bg-psurface text-pfg hover:bg-psurfaceHover active:scale-95 transition-all"
              >
                (
              </button>
              <button
                type="button"
                onClick={() => handleAppend(')')}
                className="grid h-12 place-items-center rounded-xl bg-psurface text-pfg hover:bg-psurfaceHover active:scale-95 transition-all"
              >
                )
              </button>
              <button
                type="button"
                onClick={handleBackspace}
                aria-label="Backspace"
                className="grid h-12 place-items-center rounded-xl bg-psurface text-pmuted hover:bg-psurfaceHover active:scale-95 transition-all"
              >
                <Delete size={18} />
              </button>

              {/* Row 2 */}
              <button
                type="button"
                onClick={handleSqrt}
                className="grid h-12 place-items-center rounded-xl bg-psurface text-pprimary hover:bg-psurfaceHover active:scale-95 transition-all"
              >
                √
              </button>
              <button
                type="button"
                onClick={handleSquare}
                className="grid h-12 place-items-center rounded-xl bg-psurface text-pprimary hover:bg-psurfaceHover active:scale-95 transition-all"
              >
                x²
              </button>
              <button
                type="button"
                onClick={() => handleAppend('%')}
                className="grid h-12 place-items-center rounded-xl bg-psurface text-pprimary hover:bg-psurfaceHover active:scale-95 transition-all"
              >
                %
              </button>
              <button
                type="button"
                onClick={() => handleAppend('÷')}
                className="grid h-12 place-items-center rounded-xl bg-pprimary/10 text-pprimary hover:bg-pprimary/20 active:scale-95 transition-all font-bold"
              >
                ÷
              </button>

              {/* Row 3 */}
              <button
                type="button"
                onClick={() => handleAppend('7')}
                className="grid h-12 place-items-center rounded-xl bg-psurface text-pfg hover:bg-psurfaceHover active:scale-95 transition-all"
              >
                7
              </button>
              <button
                type="button"
                onClick={() => handleAppend('8')}
                className="grid h-12 place-items-center rounded-xl bg-psurface text-pfg hover:bg-psurfaceHover active:scale-95 transition-all"
              >
                8
              </button>
              <button
                type="button"
                onClick={() => handleAppend('9')}
                className="grid h-12 place-items-center rounded-xl bg-psurface text-pfg hover:bg-psurfaceHover active:scale-95 transition-all"
              >
                9
              </button>
              <button
                type="button"
                onClick={() => handleAppend('×')}
                className="grid h-12 place-items-center rounded-xl bg-pprimary/10 text-pprimary hover:bg-pprimary/20 active:scale-95 transition-all font-bold"
              >
                ×
              </button>

              {/* Row 4 */}
              <button
                type="button"
                onClick={() => handleAppend('4')}
                className="grid h-12 place-items-center rounded-xl bg-psurface text-pfg hover:bg-psurfaceHover active:scale-95 transition-all"
              >
                4
              </button>
              <button
                type="button"
                onClick={() => handleAppend('5')}
                className="grid h-12 place-items-center rounded-xl bg-psurface text-pfg hover:bg-psurfaceHover active:scale-95 transition-all"
              >
                5
              </button>
              <button
                type="button"
                onClick={() => handleAppend('6')}
                className="grid h-12 place-items-center rounded-xl bg-psurface text-pfg hover:bg-psurfaceHover active:scale-95 transition-all"
              >
                6
              </button>
              <button
                type="button"
                onClick={() => handleAppend('-')}
                className="grid h-12 place-items-center rounded-xl bg-pprimary/10 text-pprimary hover:bg-pprimary/20 active:scale-95 transition-all font-bold"
              >
                -
              </button>

              {/* Row 5 */}
              <button
                type="button"
                onClick={() => handleAppend('1')}
                className="grid h-12 place-items-center rounded-xl bg-psurface text-pfg hover:bg-psurfaceHover active:scale-95 transition-all"
              >
                1
              </button>
              <button
                type="button"
                onClick={() => handleAppend('2')}
                className="grid h-12 place-items-center rounded-xl bg-psurface text-pfg hover:bg-psurfaceHover active:scale-95 transition-all"
              >
                2
              </button>
              <button
                type="button"
                onClick={() => handleAppend('3')}
                className="grid h-12 place-items-center rounded-xl bg-psurface text-pfg hover:bg-psurfaceHover active:scale-95 transition-all"
              >
                3
              </button>
              <button
                type="button"
                onClick={() => handleAppend('+')}
                className="grid h-12 place-items-center rounded-xl bg-pprimary/10 text-pprimary hover:bg-pprimary/20 active:scale-95 transition-all font-bold"
              >
                +
              </button>

              {/* Row 6 */}
              <button
                type="button"
                onClick={handleToggleSign}
                className="grid h-12 place-items-center rounded-xl bg-psurface text-pfg hover:bg-psurfaceHover active:scale-95 transition-all"
              >
                ±
              </button>
              <button
                type="button"
                onClick={() => handleAppend('0')}
                className="grid h-12 place-items-center rounded-xl bg-psurface text-pfg hover:bg-psurfaceHover active:scale-95 transition-all"
              >
                0
              </button>
              <button
                type="button"
                onClick={() => handleAppend('.')}
                className="grid h-12 place-items-center rounded-xl bg-psurface text-pfg hover:bg-psurfaceHover active:scale-95 transition-all"
              >
                .
              </button>
              <button
                type="button"
                onClick={handleCalculate}
                className="grid h-12 place-items-center rounded-xl bg-pprimary text-white shadow-md hover:brightness-110 active:scale-95 transition-all font-bold"
              >
                =
              </button>
            </div>
          </>
        )}
      </SheetBody>
    </Sheet>
  )
}
