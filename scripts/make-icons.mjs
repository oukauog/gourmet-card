// App icons from data-src/icons/icon-<a|b|c>.svg (construction 9, spec 4.6).
//   npm run icons          -> design A (default)
//   npm run icons -- B     -> design B (or C)
// Renders the SVG with Playwright's Chromium (already a devDependency; nothing new is added) and
// writes public/apple-touch-icon.png (180), pwa-192.png, pwa-512.png, pwa-maskable-512.png and
// public/favicon.svg. The SVGs are full bleed (no corner radius, no transparency; iPhone rounds
// the corners) and keep the important part inside the centre 80% circle (Android maskable).
// Console output is ASCII only (Japanese Windows).
import { chromium } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const design = (process.argv[2] ?? 'A').toUpperCase()
if (!['A', 'B', 'C'].includes(design)) {
  console.error('ERROR: design must be A, B or C')
  process.exit(1)
}
const svgPath = path.join(root, 'data-src', 'icons', `icon-${design.toLowerCase()}.svg`)
const svg = fs.readFileSync(svgPath, 'utf8')
const out = path.join(root, 'public')

const OUTPUTS = [
  ['apple-touch-icon.png', 180],
  ['pwa-192.png', 192],
  ['pwa-512.png', 512],
  // the same full-bleed picture: its important part is already inside the safe circle
  ['pwa-maskable-512.png', 512],
]

const browser = await chromium.launch()
try {
  const page = await browser.newPage({ deviceScaleFactor: 1 })
  for (const [name, size] of OUTPUTS) {
    await page.setViewportSize({ width: size, height: size })
    const dataUrl = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`
    await page.setContent(`<!doctype html><html><body style="margin:0;background:#fff"><img src="${dataUrl}" width="${size}" height="${size}" style="display:block"></body></html>`)
    await page.locator('img').evaluate((img) => img.decode())
    await page.screenshot({ path: path.join(out, name), clip: { x: 0, y: 0, width: size, height: size }, omitBackground: false })
    console.log(`wrote public/${name} (${size}x${size})`)
  }
} finally {
  await browser.close()
}
fs.writeFileSync(path.join(out, 'favicon.svg'), svg, { encoding: 'utf8' })
console.log(`wrote public/favicon.svg (design ${design})`)
