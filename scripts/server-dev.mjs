/**
 * `npm run server:dev` wrapper — serverni HAR DOIM development NODE_ENV'da
 * ishga tushiradi (cross-platform: Windows + Linux).
 *
 * Bu local dev'da dev-mock Telegram initData qabul qilinishini va
 * Sokratik AI Tutor / Wonder Studio kabi funksiyalar 401 siz ishlashini ta'minlaydi.
 */
process.env.NODE_ENV = 'development'

const { spawn } = await import('node:child_process')
const isWin = process.platform === 'win32'
const cmd = isWin ? 'npx.cmd' : 'npx'

const child = spawn(cmd, ['tsx', 'watch', 'server/index.ts'], {
  stdio: 'inherit',
  env: { ...process.env, NODE_ENV: 'development' },
  shell: isWin,
})

child.on('exit', (code) => {
  process.exit(code ?? 0)
})
