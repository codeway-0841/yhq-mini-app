import animate from 'tailwindcss-animate'

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: ['selector', "body[data-theme='dark']"],
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

        // ── DEPRECATED: `duo.*` namespace (v3'da nomi ham, Duolingo mazmuni ham
        // tizimdan chiqadi). Qiymatlar allaqachon Jade & Stone palitrasiga
        // ko'chirilgan — yangi kodda `accent` / `success` / `warning` / `danger`
        // ishlating. Phase 6 call-site'larni ko'chiradi, Phase 10 bu blokni
        // butunlay o'chiradi.
        duo: {
          green:  { DEFAULT: 'rgb(var(--p-primary-rgb) / <alpha-value>)', dark: 'color-mix(in srgb, var(--p-primary) 82%, #000)' },
          blue:   { DEFAULT: 'var(--p-blue)',    dark: 'color-mix(in srgb, var(--p-blue) 82%, #000)' },
          red:    { DEFAULT: 'var(--p-danger)',  dark: 'color-mix(in srgb, var(--p-danger) 82%, #000)' },
          yellow: { DEFAULT: 'var(--p-warning)', dark: 'color-mix(in srgb, var(--p-warning) 82%, #000)' },
          orange: { DEFAULT: 'var(--p-warning)', dark: 'color-mix(in srgb, var(--p-warning) 82%, #000)' },
          purple: { DEFAULT: 'var(--p-purple)',  dark: 'color-mix(in srgb, var(--p-purple) 82%, #000)' },
          gray:   { DEFAULT: 'var(--p-subtle)',  dark: 'var(--p-disabled)' },
        },

        // DEPRECATED: `neon.*` — v3'da glow yo'q, ranglar semantik tokenlarga bog'landi
        neon: {
          green:  'rgb(var(--p-primary-rgb) / <alpha-value>)',
          blue:   'var(--p-blue)',
          purple: 'var(--p-purple)',
          violet: 'var(--p-purple)',
          red:    'var(--p-danger)',
          yellow: 'var(--p-warning)',
        },

        // Eski nomlar (backward-compat) — yangi kodda ishlatmang
        bg:      'var(--theme-canvas)',
        accent:  'var(--p-primary)',

        // ── v3 KIWI tokenlari (--p-*). Aksent body[data-accent] orqali almashadi;
        // `pprimary` da opacity modifier ISHLAMAYDI — buning uchun `duo-green`
        // yoki `rgb(var(--p-primary-rgb) / X)` ishlating.
        pcanvas:     'var(--p-canvas)',
        psurface:    'var(--p-surface)',
        pcard:       'var(--p-card)',
        pline:       'var(--p-line)',
        plineStrong: 'var(--p-line-strong)',
        pfg:         'var(--p-fg)',
        pmuted:      'var(--p-muted)',
        psubtle:     'var(--p-subtle)',
        pdisabled:   'var(--p-disabled)',
        pprimary:    'var(--p-primary)',
        ponprimary:  'var(--p-on-primary)',
        pwash:       'var(--p-wash)',
        psuccess:    'var(--p-success)',
        pwarning:    'var(--p-warning)',
        pdanger:     'var(--p-danger)',
        ppurple:     'var(--p-purple)',
        pblue:       'var(--p-blue)',
        pgold:       'var(--p-gold)',
        pgolddeep:   'var(--p-gold-deep)',
        pongold:     'var(--p-on-gold)',

        // ── shadcn/ui ko'prigi — `bg-background`, `text-foreground`,
        // `border-border`, `ring-ring`. Manba har doim --p-* (index.css, body).
        background:  'var(--background)',
        foreground:  'var(--foreground)',
        border:      'var(--border)',
        input:       'var(--input)',
        ring:        'var(--ring)',
        primary: {
          DEFAULT:     'var(--primary)',
          foreground:  'var(--primary-foreground)',
        },
        secondary: {
          DEFAULT:     'var(--secondary)',
          foreground:  'var(--foreground)',
        },
        destructive: {
          DEFAULT:     'var(--destructive)',
          foreground:  '#ffffff',
        },
        card: {
          DEFAULT:     'var(--card-bg)',
          foreground:  'var(--foreground)',
        },
        popover: {
          DEFAULT:     'var(--popover)',
          foreground:  'var(--foreground)',
        },
      },
      screens: {
        // Tor Telegram WebView (360px) va undan kattaroq telefonlar orasidagi chegara.
        // TopBar'da `xs:inline` ishlatiladi — bu breakpoint e'lon qilinmagani uchun
        // element HAR DOIM yashirin qolardi.
        xs: '400px',
      },
      fontFamily: {
        // Matn — Inter Tight. Sarlavha/raqam — Bricolage Grotesque.
        sans:    ['Inter Tight', '-apple-system', 'BlinkMacSystemFont', 'system-ui', 'sans-serif'],
        display: ['Bricolage Grotesque', 'Inter Tight', '-apple-system', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        // v3 ikki bosqichli shkala: boshqaruv 10px · konteyner 18px · sheet 24px
        control:   'var(--radius-control)',
        container: 'var(--radius-container)',
        sheet:     'var(--radius-sheet)',
        // shadcn/ui kutadigan nomlar
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
        // Eski utilitilar — v3 shkalasiga tekislandi (28 fayl bir zumda sinmasin)
        '2xl': 'var(--radius-container)',
        '3xl': 'var(--radius-sheet)',
      },
      transitionTimingFunction: {
        out: 'var(--ease-out)',
      },
    },
  },
  plugins: [animate],
}
