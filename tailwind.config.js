/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Tema tokenlari — src/index.css dagi CSS o'zgaruvchilarga bog'langan.
        // Light/dark avtomatik almashadi (body[data-theme] orqali).
        canvas:     'var(--theme-canvas)',
        surface:    'var(--theme-surface)',
        elevated:   'var(--theme-elevated)',
        fg:         'var(--theme-fg)',
        muted:      'var(--theme-fg-muted)',
        subtle:     'var(--theme-fg-subtle)',
        line:       'var(--theme-line)',
        lineStrong: 'var(--theme-line-strong)',
        shadow:     'var(--theme-shadow)',

        // Duolingo palitasi (Oson Prava uslubi)
        duo: {
          green:  { DEFAULT: '#58cc02', dark: '#46a302' },
          blue:   { DEFAULT: '#1cb0f6', dark: '#1899d6' },
          red:    { DEFAULT: '#ff4b4b', dark: '#d93f3f' },
          yellow: { DEFAULT: '#ffc800', dark: '#e5b400' },
          orange: { DEFAULT: '#ff9600', dark: '#e59400' },
          purple: { DEFAULT: '#ce82ff', dark: '#a85ed4' },
          gray:   { DEFAULT: '#afaeb3', dark: '#64748b' },
        },

        // Eski nomlar (backward-compat) — yangi kodda ishlatmang
        bg:      'var(--theme-canvas)',
        border:  'var(--theme-line)',
        accent:  '#1cb0f6',
      },
      fontFamily: {
        sans: ['Nunito', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        '2xl': '1.5rem',
        '3xl': '1.75rem',
      },
    },
  },
  plugins: [],
}
