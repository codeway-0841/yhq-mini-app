import { useState } from 'react'
import { Eye, EyeOff, Check, Circle } from 'lucide-react'

interface PasswordInputProps {
  value: string
  onChange: (value: string) => void
  label?: string
  placeholder?: string
  showStrengthMeter?: boolean
  disabled?: boolean
  autoComplete?: string
  id?: string
  required?: boolean
}

function getPasswordStrength(password: string): { level: 0 | 1 | 2 | 3 | 4; label: string; barColor: string; textColor: string } {
  if (password.length === 0) return { level: 0, label: '', barColor: '', textColor: '' }
  if (password.length < 8) return { level: 1, label: 'Zaif', barColor: 'bg-pdanger', textColor: 'text-pdanger' }

  const hasNumber = /\d/.test(password)
  const hasSymbol = /[!@#$%^&*(),.?":{}|<>]/.test(password)

  if (password.length >= 8 && !hasNumber) return { level: 2, label: "O'rtacha", barColor: 'bg-pwarning', textColor: 'text-pwarning' }
  if (password.length >= 8 && hasNumber && !hasSymbol) return { level: 3, label: 'Kuchli', barColor: 'bg-psuccess', textColor: 'text-psuccess' }
  return { level: 4, label: 'Juda kuchli', barColor: 'bg-pblue', textColor: 'text-pblue' }
}

export default function PasswordInput({
  value,
  onChange,
  label = 'Parol',
  placeholder,
  showStrengthMeter = false,
  disabled = false,
  autoComplete = 'current-password',
  id = 'password',
  required = false,
}: PasswordInputProps) {
  const [visible, setVisible] = useState(false)
  const strength = showStrengthMeter ? getPasswordStrength(value) : null

  const hasMinLength = value.length >= 8
  const hasNumber = /\d/.test(value)

  const inputCls =
    'w-full bg-psurface rounded-2xl pl-3.5 pr-12 py-3 text-[15px] text-pfg ' +
    'placeholder:text-pmuted outline-none focus:ring-2 focus:ring-pprimary shadow-xs transition-all'

  return (
    <div className="flex flex-col gap-2">
      {label && (
        <label htmlFor={id} className="text-[11px] font-semibold text-pmuted uppercase tracking-wide">
          {label}
        </label>
      )}

      <div className="relative">
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          autoComplete={autoComplete}
          required={required}
          maxLength={72}
          className={inputCls}
        />
        <button
          type="button"
          onClick={() => setVisible(!visible)}
          disabled={disabled}
          className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 hover:bg-plineStrong/50 rounded-lg transition-colors"
          aria-label={visible ? 'Parolni yashirish' : "Parolni ko'rsatish"}
        >
          {visible ? (
            <EyeOff className="w-5 h-5 text-pmuted" />
          ) : (
            <Eye className="w-5 h-5 text-pmuted" />
          )}
        </button>
      </div>

      {showStrengthMeter && value.length > 0 && (
        <>
          {/* Strength Meter */}
          <div className="flex gap-1 h-1">
            {[1, 2, 3, 4].map((level) => (
              <div
                key={level}
                className={`flex-1 rounded-full transition-colors ${
                  strength && level <= strength.level ? strength.barColor : 'bg-plineStrong'
                }`}
              />
            ))}
          </div>
          {strength && strength.label && (
            <p className={`text-[11px] font-semibold ${strength.textColor}`}>
              {strength.label}
            </p>
          )}

          {/* Requirements Checklist */}
          <div className="flex flex-col gap-1 text-[11px]">
            <div className={`flex items-center gap-1.5 ${hasMinLength ? 'text-psuccess' : 'text-pmuted'}`}>
              {hasMinLength ? <Check size={12} strokeWidth={2} /> : <Circle size={12} strokeWidth={1.75} />}
              <span>Kamida 8 belgi</span>
            </div>
            <div className={`flex items-center gap-1.5 ${hasNumber ? 'text-psuccess' : 'text-pmuted'}`}>
              {hasNumber ? <Check size={12} strokeWidth={2} /> : <Circle size={12} strokeWidth={1.75} />}
              <span>Kamida 1 raqam</span>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
