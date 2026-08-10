/**
 * Password validation utilities — strength checking, policy enforcement.
 * Enterprise-grade password requirements matching OWASP recommendations.
 */

export interface PasswordStrength {
  score: 0 | 1 | 2 | 3 | 4 | 5  // 0=very weak, 5=very strong
  feedback: string[]
  isValid: boolean
}

export interface PasswordPolicy {
  minLength: number
  maxLength: number
  requireUppercase: boolean
  requireLowercase: boolean
  requireNumber: boolean
  requireSpecial: boolean
  minScore?: 3 | 4 | 5  // Minimum acceptable strength score
}

/** Default KIWI password policy */
export const DEFAULT_PASSWORD_POLICY: PasswordPolicy = {
  minLength: 8,
  maxLength: 72,  // bcrypt/scrypt limit
  requireUppercase: true,
  requireLowercase: true,
  requireNumber: true,
  requireSpecial: true,
  minScore: 3,  // Medium strength minimum
}

/** Common weak passwords (sample - extend with full dictionary in production) */
const COMMON_WEAK_PASSWORDS = new Set([
  'password', 'password123', '12345678', 'qwerty', 'abc123',
  'password1', '123456789', 'letmein', 'welcome', 'admin',
  'monkey', '1234567890', 'qwertyuiop', 'password!',
])

/**
 * Validate password against policy.
 * Returns detailed feedback for UI display.
 */
export function validatePassword(password: string, policy: PasswordPolicy = DEFAULT_PASSWORD_POLICY): PasswordStrength {
  const feedback: string[] = []
  let score: PasswordStrength['score'] = 0

  // Length check
  if (password.length < policy.minLength) {
    feedback.push(`Kamida ${policy.minLength} belgi bo'lishi kerak`)
    return { score: 0, feedback, isValid: false }
  }
  if (password.length > policy.maxLength) {
    feedback.push(`Maksimum ${policy.maxLength} belgidan oshmasin`)
    return { score: 0, feedback, isValid: false }
  }

  // Character class requirements
  const hasUppercase = /[A-Z]/.test(password)
  const hasLowercase = /[a-z]/.test(password)
  const hasNumber = /[0-9]/.test(password)
  const hasSpecial = /[^A-Za-z0-9]/.test(password)

  if (policy.requireUppercase && !hasUppercase) {
    feedback.push('Kamida 1 ta katta harf kerak (A-Z)')
  }
  if (policy.requireLowercase && !hasLowercase) {
    feedback.push('Kamida 1 ta kichik harf kerak (a-z)')
  }
  if (policy.requireNumber && !hasNumber) {
    feedback.push('Kamida 1 ta raqam kerak (0-9)')
  }
  if (policy.requireSpecial && !hasSpecial) {
    feedback.push('Kamida 1 ta maxsus belgi kerak (!@#$%^&* va hokazo)')
  }

  // If basic requirements not met, return early
  if (feedback.length > 0) {
    return { score: 1, feedback, isValid: false }
  }

  // Calculate strength score (2-5 range for valid passwords)
  score = 2  // Meets basic requirements

  // Length bonus
  if (password.length >= 12) score++
  if (password.length >= 16) score++

  // Complexity bonus
  const complexityCount = [hasUppercase, hasLowercase, hasNumber, hasSpecial].filter(Boolean).length
  if (complexityCount === 4) score++

  // Penalize common weak passwords
  const lowerPassword = password.toLowerCase()
  if (COMMON_WEAK_PASSWORDS.has(lowerPassword)) {
    score = Math.max(1, score - 2) as PasswordStrength['score']
    feedback.push('Bu parol juda keng tarqalgan — xavfsizroq variant tanlang')
  }

  // Penalize sequential patterns
  if (/(.)\1{2,}/.test(password)) {  // aaa, 111, etc
    score = Math.max(2, score - 1) as PasswordStrength['score']
    feedback.push('Takrorlanuvchi belgilar kamroq bo\'lsin')
  }
  if (/(?:abc|bcd|cde|def|efg|fgh|ghi|hij|ijk|jkl|klm|lmn|mno|nop|opq|pqr|qrs|rst|stu|tuv|uvw|vwx|wxy|xyz)/i.test(password)) {
    score = Math.max(2, score - 1) as PasswordStrength['score']
    feedback.push('Ketma-ket belgilar kamroq bo\'lsin')
  }
  if (/(?:012|123|234|345|456|567|678|789|890)/.test(password)) {
    score = Math.max(2, score - 1) as PasswordStrength['score']
    feedback.push('Ketma-ket raqamlar kamroq bo\'lsin')
  }

  // Reverse sequence detection (same penalties as forward sequences)
  if (/(?:zyx|yxw|xwv|wvu|vut|uts|tsr|srq|rqp|qpo|pon|onm|nml|mlk|lkj|kji|jih|ihg|hgf|gfe|fed|edc|dcb|cba)/i.test(password)) {
    score = Math.max(2, score - 1) as PasswordStrength['score']
    feedback.push('Teskari ketma-ket belgilar kamroq bo\'lsin')
  }
  if (/(?:987|876|765|654|543|432|321|210)/.test(password)) {
    score = Math.max(2, score - 1) as PasswordStrength['score']
    feedback.push('Teskari ketma-ket raqamlar kamroq bo\'lsin')
  }

  // Check minimum score requirement
  const meetsMinScore = !policy.minScore || score >= policy.minScore
  if (!meetsMinScore) {
    feedback.push(`Parol kamida ${policy.minScore === 3 ? 'o\'rtacha' : policy.minScore === 4 ? 'kuchli' : 'juda kuchli'} bo'lishi kerak`)
  }

  // Positive feedback for strong passwords (informational, not validation)
  if (meetsMinScore) {
    if (score === 5) {
      feedback.push('✓ Juda kuchli parol')
    } else if (score === 4) {
      feedback.push('✓ Kuchli parol')
    }
  }

  return {
    score,
    feedback,
    isValid: meetsMinScore,  // Valid = meets minimum score, regardless of penalty feedback
  }
}

/**
 * Get password strength label for UI display.
 */
export function getPasswordStrengthLabel(score: PasswordStrength['score'], language: 'uz' | 'ru' = 'uz'): string {
  if (language === 'ru') {
    return ['Очень слабый', 'Слабый', 'Приемлемый', 'Средний', 'Сильный', 'Очень сильный'][score]
  }
  return ['Juda zaif', 'Zaif', 'Qoniqarli', 'O\'rtacha', 'Kuchli', 'Juda kuchli'][score]
}

/**
 * Get password strength color for UI display.
 */
export function getPasswordStrengthColor(score: PasswordStrength['score']): string {
  return ['#ef4444', '#f97316', '#eab308', '#84cc16', '#22c55e', '#10b981'][score]
}
