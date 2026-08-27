import { useMemo } from 'react'

interface PasswordStrengthMeterProps {
  password: string
  language: 'uz' | 'ru'
}

interface PasswordStrength {
  score: 0 | 1 | 2 | 3 | 4 | 5
  feedback: string[]
  /** true — feedback ro'yxati "kuchli parol" fallback matni (haqiqiy
   *  kamchilik emas) — UI'da yashil rangda ko'rsatiladi */
  isGood: boolean
  color: string
  label: string
}

function validatePasswordStrength(password: string, language: 'uz' | 'ru'): PasswordStrength {
  // Barcha yo'llar yoki literal qaytaradi yoki avval `score = 2` yozadi — initializer shart emas.
  let score: PasswordStrength['score']
  const feedback: string[] = []

  // Length
  if (password.length < 8) {
    feedback.push(language === 'ru' ? 'Минимум 8 символов' : 'Kamida 8 belgi')
    return { score: 0, feedback, isGood: false, color: 'var(--p-danger)', label: language === 'ru' ? 'Очень слабый' : 'Juda zaif' }
  }

  // Character requirements
  const hasUpper = /[A-Z]/.test(password)
  const hasLower = /[a-z]/.test(password)
  const hasNumber = /[0-9]/.test(password)
  const hasSpecial = /[^A-Za-z0-9]/.test(password)

  if (!hasUpper) feedback.push(language === 'ru' ? 'Добавьте заглавную букву' : 'Katta harf qo\'shing')
  if (!hasLower) feedback.push(language === 'ru' ? 'Добавьте строчную букву' : 'Kichik harf qo\'shing')
  if (!hasNumber) feedback.push(language === 'ru' ? 'Добавьте цифру' : 'Raqam qo\'shing')
  if (!hasSpecial) feedback.push(language === 'ru' ? 'Добавьте спецсимвол' : 'Maxsus belgi qo\'shing')

  if (feedback.length > 0) {
    return { score: 1, feedback, isGood: false, color: 'var(--p-warning)', label: language === 'ru' ? 'Слабый' : 'Zaif' }
  }

  // Calculate strength (clamped to 2-5)
  score = 2 // Basic requirements met

  if (password.length >= 12) score++
  if (password.length >= 16) score++

  const complexityCount = [hasUpper, hasLower, hasNumber, hasSpecial].filter(Boolean).length
  if (complexityCount === 4) score++

  // Penalties
  if (/(.)\1{2,}/.test(password)) {
    score = Math.max(2, score - 1) as PasswordStrength['score']
    feedback.push(language === 'ru' ? 'Избегайте повторов' : 'Takrorlanuvchi belgilar')
  }

  // Clamp score to valid range
  score = Math.min(5, Math.max(0, score)) as PasswordStrength['score']

  // Semantik rampa: danger → warning → gold → success (temadan mustaqil tokenlar)
  const colors = [
    'var(--p-danger)', 'var(--p-warning)', 'var(--p-gold)',
    'color-mix(in srgb, var(--p-gold) 45%, var(--p-success))',
    'var(--p-success)',
    'color-mix(in srgb, var(--p-success) 70%, var(--p-blue))',
  ]
  const labelsUz = ['Juda zaif', 'Zaif', 'Qoniqarli', 'O\'rtacha', 'Kuchli', 'Juda kuchli']
  const labelsRu = ['Очень слабый', 'Слабый', 'Приемлемый', 'Средний', 'Сильный', 'Очень сильный']

  return {
    score,
    feedback: feedback.length > 0 ? feedback : [language === 'ru' ? 'Надёжный пароль' : 'Kuchli parol'],
    isGood: feedback.length === 0,
    color: colors[score] || colors[0],
    label: language === 'ru' ? (labelsRu[score] || labelsRu[0]) : (labelsUz[score] || labelsUz[0]),
  }
}

export default function PasswordStrengthMeter({ password, language }: PasswordStrengthMeterProps) {
  const strength = useMemo(() => validatePasswordStrength(password, language), [password, language])

  if (password.length === 0) return null

  const widthPercent = (strength.score / 5) * 100

  return (
    <div className="space-y-2 animate-fadeIn">
      {/* Progress bar */}
      <div className="h-1.5 bg-psurface rounded-full overflow-hidden">
        <div
          className="h-full transition-all duration-300 ease-out rounded-full"
          style={{
            width: `${widthPercent}%`,
            backgroundColor: strength.color,
          }}
        />
      </div>

      {/* Label + feedback */}
      <div className="flex items-start justify-between gap-2">
        <span
          className="text-[11px] font-semibold uppercase tracking-wide"
          style={{ color: strength.color }}
        >
          {strength.label}
        </span>
        {strength.feedback.length > 0 && (
          <ul className="text-[11px] text-pmuted text-right space-y-0.5 flex-1">
            {strength.feedback.slice(0, 2).map((msg, i) => (
              <li key={i} className={strength.isGood ? 'text-pprimary' : ''}>
                {msg}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
