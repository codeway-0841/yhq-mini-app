/**
 * `npm run build` wrapper — frontend bundle'ni HAR DOIM production NODE_ENV'da
 * quradi (cross-platform: Windows bash + Vercel Linux).
 *
 * 2026-08-27 incident: `.env` ga `NODE_ENV=development` yozilib qolgan — Vite
 * .env'dagi NODE_ENV'ni build default'idan USTUN qo'yadi (faqat shell'da
 * NODE_ENV berilgan bo'lsagina e'tiborsiz qoldiradi — `isNodeEnvSet`).
 * Natijada prod'ga DEV-bundle chiqqan (`import.meta.env.DEV=true`) va wsUrl
 * localhost'ga tushib, duel barcha userlarda sinib ketgan.
 */
process.env.NODE_ENV = 'production'

const { build } = await import('vite')
await build()
