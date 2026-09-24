// page.evaluate() callbacks run in the browser and use DOM APIs.
/// <reference lib="dom" />
// Screenshots of the 4 tile looks (A1/A2 x 3/2 columns) at 390x844 for the consultant.
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, test, type Page } from '@playwright/test'

const outDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'reports', '工事03_見本')

/** Make a food-photo-like JPEG in the page (warm gradient, "plate", "food" blobs). */
async function fakeFoodPhoto(page: Page, seed: number): Promise<Buffer> {
  const dataUrl = await page.evaluate((s) => {
    const w = 1600
    const h = 1200
    const c = document.createElement('canvas')
    c.width = w
    c.height = h
    const g = c.getContext('2d')!
    const hues = [18, 35, 5, 140, 45, 200, 330, 25]
    const hue = hues[s % hues.length]
    const bg = g.createLinearGradient(0, 0, w, h)
    bg.addColorStop(0, `hsl(${(hue + 20) % 360} 35% 32%)`)
    bg.addColorStop(1, `hsl(${(hue + 40) % 360} 30% 18%)`)
    g.fillStyle = bg
    g.fillRect(0, 0, w, h)
    g.fillStyle = '#f4f1ea'
    g.beginPath()
    g.ellipse(w / 2, h / 2, 520, 470, 0, 0, Math.PI * 2)
    g.fill()
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2 + s
      const r = 160 + ((s * 37 + i * 53) % 120)
      g.fillStyle = `hsl(${(hue + i * 12) % 360} ${60 + (i % 3) * 10}% ${40 + (i % 4) * 8}%)`
      g.beginPath()
      g.arc(w / 2 + Math.cos(a) * r, h / 2 + Math.sin(a) * r * 0.85, 90 + ((i * 29 + s) % 60), 0, Math.PI * 2)
      g.fill()
    }
    return c.toDataURL('image/jpeg', 0.85)
  }, seed)
  return Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1), 'base64')
}

const SHOPS: { name: string; photo: boolean }[] = [
  { name: '麺屋 一灯', photo: true },
  { name: '回転寿司 まるや 総曲輪店', photo: true },
  { name: 'ビストロ Le Petit Jardin', photo: true },
  { name: '焼肉 かねこ', photo: false },
  { name: '海鮮丼 ととや', photo: true },
  { name: '喫茶ロンド', photo: false },
]

test('tile look screenshots', async ({ page }) => {
  test.setTimeout(120_000)
  await page.goto('/')
  for (const [i, s] of SHOPS.entries()) {
    await page.getByRole('button', { name: 'お店を登録' }).click()
    if (s.photo) {
      await page
        .getByTestId('photo-input')
        .setInputFiles({ name: `food${i}.jpg`, mimeType: 'image/jpeg', buffer: await fakeFoodPhoto(page, i) })
      await expect(page.getByRole('img', { name: '写真1', exact: true })).toBeVisible({ timeout: 15_000 })
    }
    await page.getByPlaceholder('店名（必須）').fill(s.name)
    await page.getByRole('button', { name: '保存' }).click()
    await expect(page.getByRole('button', { name: s.name })).toBeVisible()
  }
  await page.getByRole('button', { name: '見本用に増やす' }).click()
  await expect.poll(() => page.getByTestId('tile-grid').getByRole('button').count(), { timeout: 30_000 }).toBeGreaterThanOrEqual(24)

  // wait for the "保存しました" toast to disappear
  await expect(page.getByRole('status')).toHaveCount(0, { timeout: 5_000 })

  for (const variant of ['A1', 'A2']) {
    await page.getByRole('button', { name: variant, exact: true }).click()
    for (const cols of [3, 2]) {
      const grid = page.getByTestId('tile-grid')
      if ((await grid.getAttribute('data-cols')) !== String(cols)) {
        await page.getByRole('button', { name: `${cols}列表示に切り替え` }).click()
        await expect(grid).toHaveAttribute('data-cols', String(cols))
      }
      await page.evaluate(() => window.scrollTo(0, 0))
      // wait for lazy images in view to be decoded
      await page.waitForFunction(() =>
        [...document.querySelectorAll<HTMLImageElement>('.tile-img')]
          .filter((im) => im.getBoundingClientRect().top < window.innerHeight)
          .every((im) => im.complete && im.naturalWidth > 0),
      )
      await page.screenshot({ path: path.join(outDir, `${variant.toLowerCase()}-${cols}col.png`), scale: 'css' })
    }
  }
})
