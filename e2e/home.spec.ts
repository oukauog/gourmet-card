// page.evaluate() callbacks run in the browser and use DOM APIs.
/// <reference lib="dom" />
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, test, type Page } from '@playwright/test'

const fixtures = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures')
const LANDSCAPE = path.join(fixtures, 'landscape-3000x2000.jpg')

const grid = (page: Page) => page.getByTestId('tile-grid')
const tiles = (page: Page) => grid(page).getByRole('button')
const hash = (page: Page) => new URL(page.url()).hash

async function register(page: Page, name: string, files: string[] = []) {
  await page.getByRole('button', { name: 'お店を登録' }).click()
  await expect(page).toHaveURL(/#\/register$/)
  if (files.length > 0) {
    await page.getByTestId('photo-input').setInputFiles(files)
    await expect(page.getByRole('img', { name: `写真${files.length}`, exact: true })).toBeVisible({ timeout: 15_000 })
  }
  await page.getByPlaceholder('店名（必須）').fill(name)
  await page.getByRole('button', { name: '保存' }).click()
  await expect(page.getByRole('button', { name })).toBeVisible()
}

/** The "columns" setting as stored in IndexedDB (undefined if not set). */
const storedColumns = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<unknown>((resolve, reject) => {
        const req = indexedDB.open('gourmet-card')
        req.onerror = () => reject(req.error)
        req.onsuccess = () => {
          const get = req.result.transaction('settings').objectStore('settings').get('columns')
          get.onsuccess = () => {
            req.result.close()
            resolve((get.result as { value?: unknown } | undefined)?.value)
          }
          get.onerror = () => reject(get.error)
        }
      }),
  )

/** Number of grid columns actually rendered. */
const renderedColumns = (page: Page) =>
  grid(page).evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(' ').filter(Boolean).length)

test('register from the tile list; photo and no-photo tiles', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('＋から最初のお店を登録')).toBeVisible()

  await register(page, '店名だけの店')
  await expect(page).toHaveURL(/#\/$/)
  const noPhoto = page.getByRole('button', { name: '店名だけの店' })
  await expect(noPhoto).toHaveClass(/tile-nophoto/)
  await expect(noPhoto.locator('img')).toHaveCount(0)
  await expect(page.getByText('＋から最初のお店を登録')).toHaveCount(0)

  await register(page, '写真の店', [LANDSCAPE])
  await expect(tiles(page)).toHaveCount(2)
  const withPhoto = page.getByRole('button', { name: '写真の店' })
  await expect(withPhoto).toHaveClass(/tile-photo/)
  await expect(withPhoto.locator('img')).toHaveCount(1)
  // newest first
  await expect(tiles(page).first()).toHaveAccessibleName('写真の店')
})

test('tiles use the fixed A2 look: 2px gap, no radius, edge to edge', async ({ page }) => {
  await page.goto('/')
  await register(page, '見た目確認', [LANDSCAPE])
  const style = await grid(page).evaluate((el) => {
    const g = getComputedStyle(el)
    const tile = el.querySelector('.tile')!
    const r = el.getBoundingClientRect()
    return { gap: g.columnGap, rowGap: g.rowGap, radius: getComputedStyle(tile).borderRadius, left: r.left, right: r.right }
  })
  expect(style.gap).toBe('2px')
  expect(style.rowGap).toBe('2px')
  expect(style.radius).toBe('0px')
  expect(style.left).toBe(0)
  expect(style.right).toBe(390)
  // no A1/A2 switch any more; the dev bar only has the sample data buttons
  await expect(page.getByRole('button', { name: 'A1', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'A2', exact: true })).toHaveCount(0)
  await expect(page.getByTestId('dev-sample-bar').getByRole('button')).toHaveText(['見本用に増やす', '見本データを消す'])
})

test('column toggle defaults to 3 and persists 2 after reload', async ({ page }) => {
  await page.goto('/')
  await register(page, 'A店')
  await expect(grid(page)).toHaveAttribute('data-cols', '3')
  expect(await renderedColumns(page)).toBe(3)

  // the button shows the result of tapping
  await expect(page.getByRole('button', { name: '2列表示に切り替え' })).toHaveText('2列にする')
  await page.getByRole('button', { name: '2列表示に切り替え' }).click()
  await expect(page.getByRole('button', { name: '3列表示に切り替え' })).toHaveText('3列にする')
  await expect(grid(page)).toHaveAttribute('data-cols', '2')
  expect(await renderedColumns(page)).toBe(2)
  // the setting is written asynchronously; wait until it is stored before reloading
  await expect.poll(() => storedColumns(page)).toBe(2)

  await page.reload()
  await expect(grid(page)).toHaveAttribute('data-cols', '2')
  expect(await renderedColumns(page)).toBe(2)

  await page.getByRole('button', { name: '3列表示に切り替え' }).click()
  await expect(grid(page)).toHaveAttribute('data-cols', '3')
})

test('sample data: grow to 24+, stars are drawn, then remove back to the originals', async ({ page }) => {
  await page.goto('/')
  await register(page, '元の店1')
  await register(page, '元の店2', [LANDSCAPE])
  await expect(page.getByRole('img', { name: /^評価 / })).toHaveCount(0) // no rating UI yet

  await page.getByRole('button', { name: '見本用に増やす' }).click()
  await expect.poll(() => tiles(page).count(), { timeout: 20_000 }).toBeGreaterThanOrEqual(24)
  const stars = page.getByRole('img', { name: /^評価 \d\.\d$/ })
  expect(await stars.count()).toBeGreaterThan(0)
  // each Stars has 5 star icons
  await expect(stars.first().locator('svg.star')).toHaveCount(5)

  await page.getByRole('button', { name: '見本データを消す' }).click()
  await expect(tiles(page)).toHaveCount(2)
  await expect(page.getByRole('button', { name: '元の店1' })).toBeVisible()
  await expect(page.getByRole('button', { name: '元の店2' })).toBeVisible()
})

test('tile -> shop page (survives reload) -> back', async ({ page }) => {
  await page.goto('/')
  await register(page, '鮨 みなと', [LANDSCAPE])
  await page.getByRole('button', { name: '鮨 みなと' }).click()
  await expect(page).toHaveURL(/#\/shop\/[0-9a-f-]{36}$/)
  const shopHash = hash(page)
  await expect(page.getByRole('heading', { name: '鮨 みなと' })).toBeVisible()
  await expect(page.getByText('未評価')).toBeVisible()
  await expect(page.getByRole('img', { name: '鮨 みなと' })).toBeVisible() // large cover

  await page.reload()
  await expect(page).toHaveURL((u) => u.hash === shopHash)
  await expect(page.getByRole('heading', { name: '鮨 みなと' })).toBeVisible()

  await page.getByRole('button', { name: '戻る', exact: true }).click()
  await expect(page).toHaveURL(/#\/$/)
  await expect(page.getByRole('button', { name: '鮨 みなと' })).toBeVisible()

  // browser back returns to the shop page, forward/back history works
  await page.goBack()
  await expect(page).toHaveURL((u) => u.hash === shopHash)
  await expect(page.getByRole('heading', { name: '鮨 みなと' })).toBeVisible()
})

test('unknown shop id shows a message and goes back to the list', async ({ page }) => {
  await page.goto('/#/shop/does-not-exist')
  await expect(page.getByText('この店は見つかりません')).toBeVisible()
  await page.getByRole('button', { name: '一覧へ戻る' }).click()
  await expect(page).toHaveURL(/#\/$/)
  await expect(page.getByText('＋から最初のお店を登録')).toBeVisible()
})

test('#/register survives reload; cancel goes home', async ({ page }) => {
  await page.goto('/#/register')
  await expect(page.getByRole('heading', { name: 'お店を登録' })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('heading', { name: 'お店を登録' })).toBeVisible()
  await page.getByRole('button', { name: 'キャンセル' }).click()
  await expect(page).toHaveURL(/#\/$/)
  await expect(page.getByText('＋から最初のお店を登録')).toBeVisible()
})

test('after save, back does not reopen the register form', async ({ page }) => {
  await page.goto('/#/')
  await register(page, '戻る確認')
  await page.goBack()
  // the register entry was replaced by home, so back leaves #/register behind
  await expect(page.getByRole('heading', { name: 'お店を登録' })).toHaveCount(0)
})

test('delete from the shop page returns home with one fewer tile', async ({ page }) => {
  await page.goto('/')
  await register(page, '消す店')
  await register(page, '残す店')
  await expect(tiles(page)).toHaveCount(2)

  await page.getByRole('button', { name: '消す店' }).click()
  page.on('dialog', (d) => void d.accept())
  await page.getByRole('button', { name: 'この店を削除' }).click()
  await expect(page).toHaveURL(/#\/$/)
  await expect(page.getByRole('status')).toHaveText('削除しました')
  await expect(tiles(page)).toHaveCount(1)
  await expect(page.getByRole('button', { name: '残す店' })).toBeVisible()
})
