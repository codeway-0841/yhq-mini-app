import { useEffect, useRef, useState } from 'react'

interface OTPInputProps {
  length?: number
  value: string
  onChange: (value: string) => void
  onComplete?: (value: string) => void
  disabled?: boolean
  error?: boolean
}

export default function OTPInput({
  length = 6,
  value,
  onChange,
  onComplete,
  disabled = false,
  error = false,
}: OTPInputProps) {
  const [focused, setFocused] = useState<number>(0)
  const inputsRef = useRef<(HTMLInputElement | null)[]>([])

  const digits = value.padEnd(length, ' ').split('').slice(0, length)

  useEffect(() => {
    // Auto-focus first box on mount
    if (inputsRef.current[0] && !disabled) {
      inputsRef.current[0].focus()
    }
  }, [disabled])

  useEffect(() => {
    // Auto-submit when all digits entered
    if (value.length === length && onComplete) {
      onComplete(value)
    }
  }, [value, length, onComplete])

  const handleChange = (index: number, inputValue: string) => {
    if (disabled) return

    // Only allow digits
    const digit = inputValue.replace(/\D/g, '').slice(-1)

    const newDigits = [...digits]
    newDigits[index] = digit || ' '
    const newValue = newDigits.join('').trim()

    onChange(newValue)

    // Auto-advance to next box if digit entered
    if (digit && index < length - 1) {
      inputsRef.current[index + 1]?.focus()
      setFocused(index + 1)
    }
  }

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (disabled) return

    // Backspace: clear current + move to previous
    if (e.key === 'Backspace') {
      if (!digits[index] || digits[index] === ' ') {
        // Current empty, move to previous
        if (index > 0) {
          const newDigits = [...digits]
          newDigits[index - 1] = ' '
          onChange(newDigits.join('').trim())
          inputsRef.current[index - 1]?.focus()
          setFocused(index - 1)
        }
      } else {
        // Clear current
        const newDigits = [...digits]
        newDigits[index] = ' '
        onChange(newDigits.join('').trim())
      }
      e.preventDefault()
    }

    // Arrow keys navigation
    if (e.key === 'ArrowLeft' && index > 0) {
      inputsRef.current[index - 1]?.focus()
      setFocused(index - 1)
    }
    if (e.key === 'ArrowRight' && index < length - 1) {
      inputsRef.current[index + 1]?.focus()
      setFocused(index + 1)
    }
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    if (disabled) return
    e.preventDefault()

    const pasteData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length)
    if (pasteData) {
      onChange(pasteData)
      // Focus last filled box
      const focusIndex = Math.min(pasteData.length, length - 1)
      inputsRef.current[focusIndex]?.focus()
      setFocused(focusIndex)
    }
  }

  return (
    <div
      role="group"
      aria-label="Tasdiqlash kodi"
      className="flex gap-2 justify-center"
    >
      {digits.map((digit, index) => (
        <input
          key={index}
          ref={(el) => (inputsRef.current[index] = el)}
          type="text"
          inputMode="numeric"
          pattern="[0-9]"
          maxLength={1}
          value={digit === ' ' ? '' : digit}
          onChange={(e) => handleChange(index, e.target.value)}
          onKeyDown={(e) => handleKeyDown(index, e)}
          onPaste={handlePaste}
          onFocus={() => setFocused(index)}
          disabled={disabled}
          aria-label={`Raqam ${index + 1} of ${length}`}
          className={`
            w-12 h-14 sm:w-14 sm:h-16
            text-center text-2xl font-bold
            bg-elevated border-2 rounded-xl
            outline-none transition-all
            ${error ? 'border-red-500 animate-shake' :
              focused === index ? 'border-duo-green bg-duo-green/5' : 'border-line'}
            ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
            ${digit !== ' ' ? 'text-fg' : 'text-transparent'}
          `}
        />
      ))}
    </div>
  )
}
