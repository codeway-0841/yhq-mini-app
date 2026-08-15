import { describe, it, expect } from 'vitest'
import { t } from '../../../src/shared/i18n'
import type { TestSessionSnapshot } from '../../../src/shared/lib/test-session'

describe('Anti-Cheat Exam Protection System', () => {
  it('has complete UZ and RU i18n keys for Anti-Cheat', () => {
    expect(t('uz', 'antiCheatWarningTitle')).toContain('qoidabuzarligi')
    expect(t('ru', 'antiCheatWarningTitle')).toContain('Нарушение')

    expect(t('uz', 'antiCheatStrikeCount')).toBe('Ogohlantirish')
    expect(t('ru', 'antiCheatStrikeCount')).toBe('Предупреждение')

    expect(t('uz', 'antiCheatStrikeHint1')).toBeTruthy()
    expect(t('ru', 'antiCheatStrikeHint1')).toBeTruthy()

    expect(t('uz', 'antiCheatStrikeHint2')).toBeTruthy()
    expect(t('ru', 'antiCheatStrikeHint2')).toBeTruthy()

    expect(t('uz', 'antiCheatDisqualifiedTitle')).toContain('Anti-Cheat')
    expect(t('ru', 'antiCheatDisqualifiedTitle')).toContain('Anti-Cheat')
  })

  it('preserves cheatViolations in TestSessionSnapshot schema', () => {
    const snapshot: TestSessionSnapshot = {
      key: 'mode:exam',
      subjectId: 'yhq',
      mode: 'exam',
      title: 'Rasmiy Imtihon',
      questionIds: [1, 2, 3],
      current: 0,
      answers: [null, null, null],
      selected: [null, null, null],
      cheatViolations: 2,
      startedAt: Date.now(),
      finished: false,
    }

    expect(snapshot.cheatViolations).toBe(2)
  })
})
