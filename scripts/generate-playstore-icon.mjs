import { chromium } from 'playwright'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import sharp from 'sharp'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')

async function main() {
  console.log('Generating Play Store App Icon & Android Launcher Icons...')
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    viewport: { width: 512, height: 512 },
    devicePixelRatio: 2,
  })
  const page = await context.newPage()

  // Read the splash-mark image as base64 so it can be loaded reliably
  const markPath = path.join(rootDir, 'public', 'images', 'splash-mark.png')
  const markBase64 = fs.readFileSync(markPath).toString('base64')
  const markDataUrl = `data:image/png;base64,${markBase64}`

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body {
      width: 512px;
      height: 512px;
      overflow: hidden;
      background: #0952b8;
    }
    #container {
      position: relative;
      width: 512px;
      height: 512px;
      overflow: hidden;
      background: radial-gradient(circle at 50% 38%, #228aff 0%, #126ee6 55%, #0952b8 100%);
      display: flex;
      align-items: center;
      justify-content: center;
    }
    #wave-canvas {
      position: absolute;
      top: 0;
      left: 0;
      width: 512px;
      height: 512px;
    }
    #mark-img {
      position: relative;
      z-index: 2;
      width: 310px;
      height: 310px;
      object-fit: contain;
      filter: drop-shadow(0 16px 36px rgba(2, 22, 66, 0.45)) drop-shadow(0 4px 10px rgba(2, 22, 66, 0.25));
    }
  </style>
</head>
<body>
  <div id="container">
    <canvas id="wave-canvas" width="1024" height="1024"></canvas>
    <img id="mark-img" src="${markDataUrl}" alt="KIVVI" />
  </div>

  <script>
    window.renderWaveAtTime = function(elapsedSec) {
      const canvas = document.getElementById('wave-canvas');
      const ctx = canvas.getContext('2d');
      const width = 512;
      const height = 512;
      const dpr = 2;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.save();
      ctx.scale(dpr, dpr);

      // Icon uchun to'r qadami: 512px da ~9 ta ustun (54px)
      const step = 54;
      const pad = step * 1.5;

      const cols = Math.ceil((width + pad * 2) / step) + 1;
      const rows = Math.ceil((height + pad * 2) / step) + 1;
      const startX = -pad;
      const startY = -pad;

      const pts = new Array(rows);
      const cx = width * 0.5;
      const cy = height * 0.45;

      for (let j = 0; j < rows; j++) {
        const row = new Array(cols);
        const y0 = startY + j * step;
        for (let i = 0; i < cols; i++) {
          const x0 = startX + i * step;

          const th1 = x0 * 0.014 + y0 * 0.016 - elapsedSec * 1.2;
          const s1 = Math.sin(th1);
          const c1 = Math.cos(th1);

          const th2 = -x0 * 0.016 + y0 * 0.012 + elapsedSec * 0.95;
          const s2 = Math.sin(th2);
          const c2 = Math.cos(th2);

          const dxCenter = x0 - cx;
          const dyCenter = y0 - cy;
          const dist = Math.hypot(dxCenter, dyCenter);
          const th3 = dist * 0.012 - elapsedSec * 1.1;
          const s3 = Math.sin(th3) * 3.8;

          const normFactor = dist > 1 ? 1 / dist : 0;

          const px = x0 + s1 * 7.5 + c2 * 5.0 + dxCenter * normFactor * s3;
          const py = y0 + c1 * 7.5 + s2 * 5.0 + dyCenter * normFactor * s3;

          row[i] = { x: px, y: py };
        }
        pts[j] = row;
      }

      ctx.beginPath();

      // Gorizontal egri chiziqlar
      for (let j = 0; j < rows; j++) {
        const row = pts[j];
        ctx.moveTo(row[0].x, row[0].y);
        for (let i = 0; i < cols - 1; i++) {
          const curr = row[i];
          const next = row[i + 1];
          const mx = (curr.x + next.x) * 0.5;
          const my = (curr.y + next.y) * 0.5;
          ctx.quadraticCurveTo(curr.x, curr.y, mx, my);
        }
        const last = row[cols - 1];
        ctx.lineTo(last.x, last.y);
      }

      // Vertikal egri chiziqlar
      for (let i = 0; i < cols; i++) {
        ctx.moveTo(pts[0][i].x, pts[0][i].y);
        for (let j = 0; j < rows - 1; j++) {
          const curr = pts[j][i];
          const next = pts[j + 1][i];
          const mx = (curr.x + next.x) * 0.5;
          const my = (curr.y + next.y) * 0.5;
          ctx.quadraticCurveTo(curr.x, curr.y, mx, my);
        }
        const last = pts[rows - 1][i];
        ctx.lineTo(last.x, last.y);
      }

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.28)';
      ctx.lineWidth = 1.6;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();

      ctx.restore();
    };
  </script>
</body>
</html>
`

  await page.setContent(htmlContent)
  await page.waitForTimeout(300)

  // Use the balanced t=1.3 frame
  await page.evaluate(() => window.renderWaveAtTime(1.3))
  await page.waitForTimeout(100)

  const outDir = path.join(rootDir, 'public')
  const playstoreDir = path.join(outDir, 'playstore')
  if (!fs.existsSync(playstoreDir)) fs.mkdirSync(playstoreDir, { recursive: true })

  // 1. Google Play Console Official Submission Icon: 512x512 full bleed square PNG
  const rawSquareBuffer = await page.locator('#container').screenshot()
  const playstoreSquarePath = path.join(playstoreDir, 'playstore-icon-512.png')

  await sharp(rawSquareBuffer)
    .resize(512, 512)
    .png({ compressionLevel: 9, quality: 100 })
    .toFile(playstoreSquarePath)

  // Also put a copy in public/ for direct web access: /playstore-icon-512.png
  await sharp(playstoreSquarePath).toFile(path.join(outDir, 'playstore-icon-512.png'))
  console.log('Saved Play Store 512x512 square icon to:', playstoreSquarePath)

  // 2. Play Store Squircle Preview (continuous squircle mask ~20% radius)
  const squircleSvgMask = Buffer.from(`
    <svg width="512" height="512" viewBox="0 0 512 512">
      <rect x="0" y="0" width="512" height="512" rx="104" ry="104" fill="#ffffff" />
    </svg>
  `)

  const squirclePreviewPath = path.join(playstoreDir, 'playstore-icon-preview.png')
  await sharp(playstoreSquarePath)
    .composite([{ input: squircleSvgMask, blend: 'dest-in' }])
    .png()
    .toFile(squirclePreviewPath)

  await sharp(squirclePreviewPath).toFile(path.join(outDir, 'playstore-icon-preview.png'))
  console.log('Saved Play Store Squircle Preview to:', squirclePreviewPath)

  // 3. Update PWA and web icons
  await sharp(squirclePreviewPath).toFile(path.join(outDir, 'icon-512.png'))
  await sharp(squirclePreviewPath).resize(192, 192).toFile(path.join(outDir, 'icon-192.png'))
  await sharp(squirclePreviewPath).resize(180, 180).toFile(path.join(outDir, 'apple-touch-icon.png'))
  console.log('Updated PWA and web icons!')

  // 4. Update Android native launcher mipmap icons in android/app/src/main/res/
  const resDir = path.join(rootDir, 'android', 'app', 'src', 'main', 'res')
  const mipmapDensities = [
    { name: 'mipmap-mdpi', size: 48 },
    { name: 'mipmap-hdpi', size: 72 },
    { name: 'mipmap-xhdpi', size: 96 },
    { name: 'mipmap-xxhdpi', size: 144 },
    { name: 'mipmap-xxxhdpi', size: 192 },
  ]

  for (const { name, size } of mipmapDensities) {
    const targetFolder = path.join(resDir, name)
    if (fs.existsSync(targetFolder)) {
      // Legacy square / squircle icon
      await sharp(playstoreSquarePath)
        .resize(size, size)
        .toFile(path.join(targetFolder, 'ic_launcher.png'))

      // Round launcher icon
      const circleMask = Buffer.from(`
        <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
          <circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="#ffffff" />
        </svg>
      `)
      await sharp(playstoreSquarePath)
        .resize(size, size)
        .composite([{ input: circleMask, blend: 'dest-in' }])
        .png()
        .toFile(path.join(targetFolder, 'ic_launcher_round.png'))
    }
  }

  console.log('Updated Android native mipmap launcher icons in android/app/src/main/res/!')

  await browser.close()
}

main().catch((err) => {
  console.error('Error generating icon:', err)
  process.exit(1)
})
