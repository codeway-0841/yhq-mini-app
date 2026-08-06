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

        // v2 Premium palitasi (eski duo.* nomlar saqlangan — barcha sahifalar avtomatik yangilanadi;
        // duo-green = AKSENT: premium temalar (Payme/Okean/...) bilan birga o'zgaradi)
        duo: {
          green:  { DEFAULT: 'rgb(var(--p-primary-rgb) / <alpha-value>)', dark: 'color-mix(in srgb, var(--p-primary) 72%, #000)' },
          blue:   { DEFAULT: '#3b82f6', dark: '#1d4ed8' },
          red:    { DEFAULT: '#ef4444', dark: '#b91c1c' },
          yellow: { DEFAULT: '#facc15', dark: '#ca8a04' },
          orange: { DEFAULT: '#f59e0b', dark: '#b45309' },
          purple: { DEFAULT: '#8b5cf6', dark: '#6d28d9' },
          gray:   { DEFAULT: '#94a3b8', dark: '#64748b' },
        },

        // Neon aksentlar (glow uchun; green = aksent)
        neon: {
          green:  'rgb(var(--p-primary-rgb) / <alpha-value>)',
          blue:   '#3b82f6',
          purple: '#8b5cf6',
          violet: '#a78bfa',
          red:    '#ef4444',
          yellow: '#facc15',
        },

        // Eski nomlar (backward-compat) — yangi kodda ishlatmang
        bg:      'var(--theme-canvas)',
        border:  'var(--theme-line)',
        accent:  '#1cb0f6',

        // v2 KIWI Premium tokenlari (--p-* CSS o'zgaruvchilariga bog'langan;
        // aksent body[data-accent] orqali almashadi — opacity modifier ISHLAMAYDI)
        pcanvas:    'var(--p-canvas)',
        psurface:   'var(--p-surface)',
        pcard:      'var(--p-card)',
        pline:      'var(--p-line)',
        pfg:        'var(--p-fg)',
        pmuted:     'var(--p-muted)',
        psubtle:    'var(--p-subtle)',
        pprimary:   'var(--p-primary)',
        ponprimary: 'var(--p-on-primary)',
        psuccess:   'var(--p-success)',
        pwarning:   'var(--p-warning)',
        pdanger:    'var(--p-danger)',
        ppurple:    'var(--p-purple)',
        pblue:      'var(--p-blue)',
        pgold:      'var(--p-gold)',
      },
      fontFamily: {
        sans: ['Inter', 'SF Pro Display', '-apple-system', 'BlinkMacSystemFont', 'system-ui', 'sans-serif'],
        display: ['Inter', 'SF Pro Display', '-apple-system', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        '2xl': '1.5rem',
        '3xl': '1.75rem',
      },
    },
  },
  plugins: [],
}
