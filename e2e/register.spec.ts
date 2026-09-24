// page.evaluate() callbacks run in the browser and use DOM APIs.
/// <reference lib="dom" />
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, test, type Page } from '@playwright/test'

const fixtures = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures')
const LANDSCAPE = path.join(fixtures, 'landscape-3000x2000.jpg')
const PORTRAIT_PNG = path.join(fixtures, 'portrait-800x1200.png')
const EXIF6 = path.join(fixtures, 'exif-orient6-2000x1500.jpg')

interface ImageInfo {
  w: number
  h: number
  type: string
  size: number
  /** RGB at (5% x, 25% y) = inside the top-left quadrant */
  leftPixel: number[]
}
interface SavedShop {
  name: string
  photos: { width: number; height: number; large: ImageInfo; small: ImageInfo }[]
}

/** Read shops + photos straight from IndexedDB inside the page (photos in photoIds order). */
async function readDb(page: Page): Promise<SavedShop[]> {
  return page.evaluate(async () => {
    const idb = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open('gourmet-card')
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
    const getAll = <T,>(store: string) =>
      new Promise<T[]>((resolve, reject) => {
        const req = idb.transaction(store).objectStore(store).getAll()
        req.onsuccess = () => resolve(req.result as T[])
        req.onerror = () => reject(req.error)
      })
    type P = { id: string; width: number; height: number; small: Blob; large: Blob }
    const shops = await getAll<{ name: string; photoIds: string[] }>('shops')
    const photos = await getAll<P>('photos')
    idb.close()
    const info = async (blob: Blob) => {
      const bm = await createImageBitmap(blob)
      const c = document.createElement('canvas')
      c.width = bm.width
      c.height = bm.height
      const g = c.getContext('2d')!
      g.drawImage(bm, 0, 0)
      const px = g.getImageData(Math.floor(bm.width * 0.05), Math.floor(bm.height / 4), 1, 1).data
      const r = { w: bm.width, h: bm.height, type: blob.type, size: blob.size, leftPixel: [px[0], px[1], px[2]] }
      bm.close()
      return r
    }
    return Promise.all(
      shops.map(async (s) => ({
        name: s.name,
        photos: await Promise.all(
          s.photoIds.map(async (id) => {
            const p = photos.find((x) => x.id === id)!
            return { width: p.width, height: p.height, large: await info(p.large), small: await info(p.small) }
          }),
        ),
      })),
    )
  })
}

async function waitPhotosReady(page: Page, count: number) {
  for (let i = 1; i <= count; i++) {
    await expect(page.getByRole('img', { name: `写真${i}`, exact: true })).toBeVisible({ timeout: 15_000 })
  }
  await expect(page.getByText('処理中…')).toHaveCount(0)
}

test('register a shop with 2 photos, keep it after reload, then delete', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'グルメカード' })).toBeVisible()
  await expect(page.getByText('＋から最初のお店を登録')).toBeVisible()

  await page.getByRole('button', { name: 'お店を登録' }).click()
  const save = page.getByRole('button', { name: '保存' })
  await expect(save).toBeDisabled()
  await page.getByPlaceholder('店名（必須）').fill('   ')
  await expect(save).toBeDisabled()

  await page.getByTestId('photo-input').setInputFiles([LANDSCAPE, PORTRAIT_PNG])
  await waitPhotosReady(page, 2)
  await expect(page.getByText('表紙')).toHaveCount(1)

  await page.getByPlaceholder('店名（必須）').fill('すし富山')
  await expect(save).toBeEnabled()
  await save.click()

  // back on home, newest on top, with the photo count
  await expect(page.getByRole('status')).toHaveText('保存しました')
  const row = page.getByRole('listitem').filter({ hasText: 'すし富山' })
  await expect(row).toBeVisible()
  await expect(row).toContainText('写真 2枚')

  await page.reload()
  await expect(page.getByRole('listitem').filter({ hasText: 'すし富山' })).toContainText('写真 2枚')

  const [shop] = await readDb(page)
  expect(shop.name).toBe('すし富山')
  expect(shop.photos).toHaveLength(2)
  const [land, png] = shop.photos
  expect([land.large.w, land.large.h]).toEqual([1800, 1200])
  expect([land.small.w, land.small.h]).toEqual([400, 267])
  expect([land.width, land.height]).toEqual([1800, 1200])
  expect([png.large.w, png.large.h]).toEqual([800, 1200]) // not enlarged
  expect([png.small.w, png.small.h]).toEqual([267, 400])
  for (const p of shop.photos) {
    expect(p.large.type).toBe('image/jpeg')
    expect(p.small.type).toBe('image/jpeg')
  }
  // transparent left half of the PNG became white (not black)
  for (const v of png.large.leftPixel) expect(v).toBeGreaterThan(240)
  // landscape keeps its orientation: top-left quadrant is red
  const [r, g, b] = land.large.leftPixel
  expect(r > 150 && g < 100 && b < 100).toBe(true)

  page.on('dialog', (d) => void d.accept())
  await page.getByRole('listitem').filter({ hasText: 'すし富山' }).getByRole('button', { name: '削除' }).click()
  await expect(page.getByText('＋から最初のお店を登録')).toBeVisible()
  expect(await readDb(page)).toEqual([])
})

test('refuses the 4th photo and keeps the EXIF orientation', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'お店を登録' }).click()
  const input = page.getByTestId('photo-input')

  await input.setInputFiles([LANDSCAPE, PORTRAIT_PNG, EXIF6])
  await waitPhotosReady(page, 3)
  await expect(page.getByRole('alert')).toHaveCount(0)

  // 4th photo via the input: refused
  await input.setInputFiles([LANDSCAPE])
  await expect(page.getByRole('alert')).toHaveText('写真は3枚までです')
  await expect(page.getByRole('img', { name: /^写真\d$/ })).toHaveCount(3)

  // removing one clears the notice; tapping the button when full shows it again
  await page.getByRole('button', { name: '写真2を取り消す' }).click()
  await expect(page.getByRole('alert')).toHaveCount(0)
  await input.setInputFiles([PORTRAIT_PNG])
  await waitPhotosReady(page, 3)
  await page.getByRole('button', { name: '写真を追加' }).click()
  await expect(page.getByRole('alert')).toHaveText('写真は3枚までです')

  await page.getByPlaceholder('店名（必須）').fill('向きテスト')
  await page.getByRole('button', { name: '保存' }).click()
  await expect(page.getByRole('listitem').filter({ hasText: '向きテスト' })).toContainText('写真 3枚')

  const [shop] = await readDb(page)
  // order after removal: landscape, exif, png
  const exif = shop.photos[1]
  // stored 2000x1500 with Orientation=6 -> displayed portrait 1500x2000 -> 1350x1800
  expect([exif.large.w, exif.large.h]).toEqual([1350, 1800])
  expect([exif.small.w, exif.small.h]).toEqual([300, 400])
  // rotated 90deg clockwise: the blue bottom-left quadrant is now top-left (rotated once, not twice)
  const [r, g, b] = exif.large.leftPixel
  expect(b > 150 && r < 100 && g < 150).toBe(true)
})

test('cancel returns home without saving', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'お店を登録' }).click()
  await page.getByTestId('photo-input').setInputFiles([LANDSCAPE])
  await waitPhotosReady(page, 1)
  await page.getByPlaceholder('店名（必須）').fill('保存しない店')
  await page.getByRole('button', { name: 'キャンセル' }).click()
  await expect(page.getByText('＋から最初のお店を登録')).toBeVisible()
  expect(await readDb(page)).toEqual([])
})
