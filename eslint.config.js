// ESLint flat config (FIXPLAN #34) — tsc'ni ALMASHTIRMAYDI, to'ldiruvchi.
// Birinchi joriy: mavjud kodbazani blocklamasdan qoidalar `warn` darajasida;
// vaqt o'tib xatolar `error`ga ko'tariladi.
import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'

export default tseslint.config(
  {
    ignores: [
      'node_modules/**', 'dist/**', 'api/**', 'server/dist/**', 'android/**',
      'migrations/**', '*.config.*', 'graphify-out/**', 'coverage/**',
      '.vercel/**', '.claude/**', '.agents/**', '.drizzle/**', 'public/**', 'scratch/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.{ts,tsx}', 'tests/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    rules: {
      // v7 recommended'dagi yangi compiler-era qoidalar (purity/set-state-in-effect)
      // hozircha yoqilmaydi — faqat klassik ikkalasi: hooks tartibi + deps.
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
  {
    // Node build skriptlari (.mjs — TS qamrovda emas, `no-undef` faol):
    // browser globals'lari yo'q, Node global'lari kerak (CI lint error: 'process').
    files: ['scripts/**/*.mjs'],
    languageOptions: {
      globals: { process: 'readonly', console: 'readonly' },
    },
  },
  {
    rules: {
      // Mavjud kod bilan yashash — asta-sekin error'ga ko'taramiz
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'off',           // jsonb/raw SQL ajdod massivlari keng ishlatiladi
      '@typescript-eslint/no-require-imports': 'off',
      'no-empty': ['warn', { allowEmptyCatch: true }],
      'no-debugger': 'error',
      'no-var': 'error',
      'prefer-const': 'warn',
      '@typescript-eslint/no-non-null-assertion': 'off',
      'no-useless-escape': 'warn',
      'no-async-promise-executor': 'warn',
      'no-fallthrough': ['error', { allowEmptyCase: true }],
      'no-useless-assignment': 'warn',     // mavjud 4 ta holat warn; yangilari ko'rinadi
      'preserve-caught-error': ['warn', { requireCatchParameter: false }],
    },
  },
)
