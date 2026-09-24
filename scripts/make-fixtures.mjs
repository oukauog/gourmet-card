// Generate e2e fixture images into e2e/fixtures/ (run: npm run fixtures).
// Uses Playwright's Chromium canvas; no extra dependencies.
//   landscape-3000x2000.jpg   : resize check (pattern shows orientation)
//   portrait-800x1200.png     : transparent left half; must not be enlarged, transparency -> white
//   exif-orient6-2000x1500.jpg: stored 2000x1500 with EXIF Orientation=6 (displayed 1500x2000)
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outDir = path.join(root, 'e2e', 'fixtures')

/** Runs in the page: draw a pattern whose orientation is obvious, return a data URL. */
function drawInPage({ width, height, type, quality, transparentLeft }) {
  const c = document.createElement('canvas')
  c.width = width
  c.height = height
  const g = c.getContext('2d')
  const w = width
  const h = height
  // quadrants: TL red, TR green, BL blue, BR yellow
  const quads = [
    ['#e03131', 0, 0],
    ['#2f9e44', w / 2, 0],
    ['#1971c2', 0, h / 2],
    ['#f08c00', w / 2, h / 2],
  ]
  for (const [color, x, y] of quads) {
    g.fillStyle = color
    g.fillRect(x, y, w / 2, h / 2)
  }
  // "TOP" label and an up arrow in the top center
  g.fillStyle = '#ffffff'
  g.font = `bold ${Math.round(h / 6)}px sans-serif`
  g.textAlign = 'center'
  g.textBaseline = 'top'
  g.fillText('TOP', w / 2, h / 20)
  g.beginPath()
  g.moveTo(w / 2, h * 0.3)
  g.lineTo(w / 2 - h / 10, h * 0.45)
  g.lineTo(w / 2 + h / 10, h * 0.45)
  g.closePath()
  g.fill()
  if (transparentLeft) g.clearRect(0, 0, w / 2, h)
  return c.toDataURL(type, quality)
}

function dataUrlToBuffer(dataUrl) {
  return Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1), 'base64')
}

/** Minimal APP1 Exif segment: big-endian TIFF, IFD0 with only Orientation (0x0112). */
function exifOrientationSegment(orientation) {
  const tiff = Buffer.from([
    0x4d, 0x4d, 0x00, 0x2a, 0x00, 0x00, 0x00, 0x08, // "MM", 42, IFD0 offset 8
    0x00, 0x01, // 1 entry
    0x01, 0x12, 0x00, 0x03, 0x00, 0x00, 0x00, 0x01, // tag 0x0112, SHORT, count 1
    0x00, orientation, 0x00, 0x00, // value (left-justified) + padding
    0x00, 0x00, 0x00, 0x00, // next IFD = none
  ])
  const payload = Buffer.concat([Buffer.from('Exif\0\0', 'latin1'), tiff])
  const len = payload.length + 2
  return Buffer.concat([Buffer.from([0xff, 0xe1, len >> 8, len & 0xff]), payload])
}

/** Insert the Exif segment after SOI (and after JFIF APP0 if present). */
function insertExif(jpeg, orientation) {
  if (jpeg[0] !== 0xff || jpeg[1] !== 0xd8) throw new Error('not a JPEG')
  let pos = 2
  if (jpeg[2] === 0xff && jpeg[3] === 0xe0) pos = 4 + jpeg.readUInt16BE(4)
  return Buffer.concat([jpeg.subarray(0, pos), exifOrientationSegment(orientation), jpeg.subarray(pos)])
}

const browser = await chromium.launch()
try {
  const page = await browser.newPage()
  await page.setContent('<!doctype html><html><body></body></html>')
  const make = (opts) => page.evaluate(drawInPage, opts).then(dataUrlToBuffer)

  fs.mkdirSync(outDir, { recursive: true })
  const files = {
    'landscape-3000x2000.jpg': await make({ width: 3000, height: 2000, type: 'image/jpeg', quality: 0.8 }),
    'portrait-800x1200.png': await make({ width: 800, height: 1200, type: 'image/png', transparentLeft: true }),
    'exif-orient6-2000x1500.jpg': insertExif(
      await make({ width: 2000, height: 1500, type: 'image/jpeg', quality: 0.8 }),
      6,
    ),
  }
  for (const [name, buf] of Object.entries(files)) {
    fs.writeFileSync(path.join(outDir, name), buf)
    console.log(`wrote e2e/fixtures/${name} (${Math.round(buf.length / 1024)} KB)`)
  }
} finally {
  await browser.close()
}
