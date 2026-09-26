// List tabs, filter and sort (construction 6). Phone size 390x844.
// Shops are prepared with the public data API (/src/db/...) from the dev server inside the page.
// page.evaluate() callbacks run in the browser and use DOM APIs.
/// <reference lib="dom" />
import { expect, test, type Page } from '@playwright/test'

interface Seed {
  name: string
  status?: 'visited' | 'wishlist'
  rating?: number
  prefecture?: string
  genres?: string[]
  uses?: string[]
  areas?: string[]
}

/** Create the shops in this order (so "新しい順" is the reverse), then reload the list. */
async function seed(page: Page, shops: Seed[], extraGenres: string[] = []) {
  await page.goto('/')
  await expect(page.getByTestId('tile-grid')).toBeVisible()
  await page.evaluate(
    async ({ shops, extraGenres }) => {
      const load = (p: string) => import(/* @vite-ignore */ p)
      const db = await load('/src/db/shops.ts')
      const tags = await load('/src/db/tags.ts')
      const ids = async (kind: string, names: string[] = []) => {
        const out: string[] = []
        for (const n of names) out.push((await tags.findOrCreateTag(kind, n)).id)
        return out
      }
      for (const n of extraGenres) await tags.findOrCreateTag('genre', n)
      for (const s of shops) {
        await db.createShop({
          name: s.name,
          status: s.status ?? 'visited',
          rating: s.rating,
          prefecture: s.prefecture,
          genreTagIds: await ids('genre', s.genres),
          useTagIds: await ids('use', s.uses),
          areaTagIds: await ids('area', s.areas),
        })
        // distinct createdAt (ms) so that "新しい順" is well defined
        await new Promise((r) => setTimeout(r, 2))
      }
    },
    { shops, extraGenres },
  )
  await page.reload()
  await expect(page.getByTestId('tile-grid')).toHaveAttribute('aria-busy', 'false')
}

const tileNames = (page: Page) => page.getByTestId('tile-grid').getByRole('button').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')))
const tab = (page: Page, name: '手札' | '行きたい') => page.getByRole('tab', { name: new RegExp(`^${name}`) })
const chip = (page: Page, kind: string) => page.getByTestId('filter-chips').locator(`[data-kind="${kind}"]`)
const sheet = (page: Page) => page.getByRole('dialog')
const option = (page: Page, name: string) => sheet(page).getByRole('button', { name: new RegExp(`^${name} ?\\d+$`) })
const count = (page: Page) => page.getByTestId('list-count')

async function openPanel(page: Page, kind: string) {
  await chip(page, kind).click()
  await expect(sheet(page)).toBeVisible()
}
async function closePanel(page: Page) {
  await sheet(page).getByRole('button', { name: /件を表示$/ }).click()
  await expect(sheet(page)).toHaveCount(0)
}

test('tabs: 手札 first, shops split by status with counts; "行った！" moves a shop to 手札', async ({ page }) => {
  await seed(page, [{ name: '手札A' }, { name: '行きたいX', status: 'wishlist' }, { name: '手札B' }, { name: '行きたいY', status: 'wishlist' }, { name: '手札C' }])
  await expect(tab(page, '手札')).toHaveAttribute('aria-selected', 'true')
  await expect(page.locator('.list-tab-count')).toHaveText(['3', '2'])
  expect(await tileNames(page)).toEqual(['手札C', '手札B', '手札A'])
  await expect(count(page)).toHaveText('3件')

  await tab(page, '行きたい').click()
  await expect(tab(page, '行きたい')).toHaveAttribute('aria-selected', 'true')
  expect(await tileNames(page)).toEqual(['行きたいY', '行きたいX'])
  await expect(count(page)).toHaveText('2件')

  // 行った！ -> edit -> cancel -> back to the list: now in 手札 (the tab stays 行きたい)
  await page.getByRole('button', { name: '行きたいX' }).click()
  await page.getByRole('button', { name: '行った！' }).click()
  await expect(page).toHaveURL(/\/edit$/)
  await page.getByRole('button', { name: 'キャンセル' }).click()
  await page.getByRole('button', { name: '戻る', exact: true }).click()
  await expect(tab(page, '行きたい')).toHaveAttribute('aria-selected', 'true')
  await expect(page.locator('.list-tab-count')).toHaveText(['4', '1'])
  expect(await tileNames(page)).toEqual(['行きたいY'])
  await tab(page, '手札').click()
  await expect.poll(() => tileNames(page)).toContain('行きたいX')
})

test('empty tabs: 手札 and 行きたい messages', async ({ page }) => {
  await seed(page, [])
  await expect(page.getByText('＋から最初のお店を登録')).toBeVisible()
  await tab(page, '行きたい').click()
  await expect(page.getByText('行きたいお店はまだありません')).toBeVisible()
  await expect(page.getByText('＋から最初のお店を登録')).toHaveCount(0)
})

test('any of the genres, all of the uses, and across kinds; chip text and fill', async ({ page }) => {
  await seed(page, [
    { name: 'R1', genres: ['ラーメン'], prefecture: '富山県', uses: ['個室あり', '駐車場あり'] },
    { name: 'R2', genres: ['寿司'], prefecture: '石川県', uses: ['個室あり'] },
    { name: 'R3', genres: ['カフェ'], prefecture: '富山県' },
  ])
  await expect(chip(page, 'genre')).toHaveAttribute('data-active', 'false')
  await expect(chip(page, 'genre')).toHaveText('ジャンル▾')

  const urlBefore = page.url()
  const historyBefore = await page.evaluate(() => history.length)
  await openPanel(page, 'genre')
  // not a history entry
  expect(page.url()).toBe(urlBefore)
  expect(await page.evaluate(() => history.length)).toBe(historyBefore)
  await option(page, 'ラーメン').click()
  await expect(option(page, 'ラーメン')).toHaveAttribute('aria-pressed', 'true')
  await expect(chip(page, 'genre')).toHaveText('ラーメン▾')
  await expect(sheet(page).getByRole('button', { name: '1件を表示' })).toBeVisible()
  await option(page, '寿司').click()
  await expect(chip(page, 'genre')).toHaveText('ラーメン ほか1▾')
  await expect(sheet(page).getByRole('button', { name: '2件を表示' })).toBeVisible()
  await closePanel(page)
  await expect(chip(page, 'genre')).toHaveAttribute('data-active', 'true')
  expect((await tileNames(page)).sort()).toEqual(['R1', 'R2']) // any
  await expect(count(page)).toHaveText('2件（3件中）')

  // + prefecture: and
  await openPanel(page, 'place')
  await sheet(page).getByRole('region', { name: '県' }).getByRole('button', { name: /^富山県/ }).click()
  await closePanel(page)
  await expect(chip(page, 'place')).toHaveText('富山県▾')
  expect(await tileNames(page)).toEqual(['R1'])

  // clear in the count row
  await page.locator('.list-meta').getByRole('button', { name: '条件を解除' }).click()
  await expect(count(page)).toHaveText('3件')
  await expect(chip(page, 'genre')).toHaveAttribute('data-active', 'false')

  // uses: all
  await openPanel(page, 'use')
  await option(page, '個室あり').click()
  await expect(sheet(page).getByRole('button', { name: '2件を表示' })).toBeVisible()
  await option(page, '駐車場あり').click()
  await expect(sheet(page).getByRole('button', { name: '1件を表示' })).toBeVisible()
  await closePanel(page)
  expect(await tileNames(page)).toEqual(['R1'])
  await expect(chip(page, 'use')).toHaveText('個室あり ほか1▾')

  // the panel's クリア clears only its kind
  await openPanel(page, 'use')
  await sheet(page).getByRole('button', { name: 'クリア' }).click()
  await closePanel(page)
  await expect(count(page)).toHaveText('3件')
})

test('rating 4.0+ drops 3.9 and unrated; 未評価のみ and rating turn each other off', async ({ page }) => {
  await seed(page, [
    { name: '三点九', rating: 39 },
    { name: '四点〇', rating: 40 },
    { name: '未評価の店' },
    { name: '四点五', rating: 45 },
  ])
  await openPanel(page, 'rating')
  await sheet(page).getByRole('radio', { name: '4.0以上' }).click()
  await expect(sheet(page).getByRole('radio', { name: '4.0以上' })).toHaveAttribute('aria-checked', 'true')
  await closePanel(page)
  await expect(chip(page, 'rating')).toHaveText('4.0以上▾')
  expect(await tileNames(page)).toEqual(['四点五', '四点〇'])

  await chip(page, 'unrated').click()
  await expect(chip(page, 'unrated')).toHaveAttribute('aria-pressed', 'true')
  await expect(chip(page, 'rating')).toHaveText('評価▾')
  await expect(chip(page, 'rating')).toHaveAttribute('data-active', 'false')
  expect(await tileNames(page)).toEqual(['未評価の店'])

  await openPanel(page, 'rating')
  await sheet(page).getByRole('radio', { name: '3.0以上' }).click()
  await closePanel(page)
  await expect(chip(page, 'unrated')).toHaveAttribute('aria-pressed', 'false')
  expect(await tileNames(page)).toEqual(['四点五', '四点〇', '三点九'])

  await openPanel(page, 'rating')
  await sheet(page).getByRole('radio', { name: '指定なし' }).click()
  await closePanel(page)
  await expect(count(page)).toHaveText('4件')
})

test('candidates: only tags of the current tab with counts; a chosen tag stays (0) after switching tabs', async ({ page }) => {
  await seed(
    page,
    [
      { name: '手札ラーメン1', genres: ['ラーメン'] },
      { name: '手札ラーメン2', genres: ['ラーメン', '海鮮'] },
      { name: '行きたい寿司', status: 'wishlist', genres: ['寿司'] },
    ],
    ['カフェ'], // a genre tag no shop uses
  )
  await openPanel(page, 'genre')
  await expect(sheet(page).locator('.option-chip')).toHaveText(['ラーメン2', '海鮮1'])
  await option(page, 'ラーメン').click()
  await closePanel(page)

  await tab(page, '行きたい').click()
  await expect(page.getByText('条件に合うお店がありません')).toBeVisible()
  await openPanel(page, 'genre')
  // the chosen ラーメン stays with 0 so it can be taken off; カフェ (unused) never shows
  await expect(sheet(page).locator('.option-chip')).toHaveText(['寿司1', 'ラーメン0'])
  await option(page, 'ラーメン').click()
  await closePanel(page)
  expect(await tileNames(page)).toEqual(['行きたい寿司'])

  // no use tag on any shop (the initial use tags exist but are unused) -> "まだありません"
  await openPanel(page, 'use')
  await expect(sheet(page).getByText('まだありません')).toBeVisible()
})

test('count row, 0 results and clearing', async ({ page }) => {
  await seed(page, [
    { name: 'A', genres: ['ラーメン'] },
    { name: 'B', genres: ['ラーメン'] },
    { name: 'C', genres: ['寿司'] },
    { name: 'D' },
    { name: 'E', genres: ['カフェ'], rating: 20 },
  ])
  await expect(count(page)).toHaveText('5件')
  await expect(page.locator('.list-meta').getByRole('button', { name: '条件を解除' })).toHaveCount(0)
  await openPanel(page, 'genre')
  await option(page, 'ラーメン').click()
  await closePanel(page)
  await expect(count(page)).toHaveText('2件（5件中）')

  await openPanel(page, 'rating')
  await sheet(page).getByRole('radio', { name: '4.5以上' }).click()
  await expect(sheet(page).getByRole('button', { name: '0件を表示' })).toBeVisible()
  await closePanel(page)
  await expect(count(page)).toHaveText('0件（5件中）')
  await expect(page.getByText('条件に合うお店がありません')).toBeVisible()
  await page.locator('.list-nomatch').getByRole('button', { name: '条件を解除' }).click()
  await expect(count(page)).toHaveText('5件')
  await expect(page.getByText('条件に合うお店がありません')).toHaveCount(0)
})

test('sort: 3 orders; after reload the order stays but tab and filter are back to 手札 / none', async ({ page }) => {
  await seed(page, [
    { name: 'いちご', rating: 30, genres: ['カフェ'] },
    { name: 'かき', rating: 50 },
    { name: 'あさり' },
    { name: '行きたい店', status: 'wishlist' },
  ])
  await expect(page.locator('.list-sort')).toHaveText('新しい順 ▾')
  expect(await tileNames(page)).toEqual(['あさり', 'かき', 'いちご'])

  await page.locator('.list-sort').click()
  await sheet(page).getByRole('radio', { name: '評価の高い順' }).click()
  await expect(sheet(page)).toHaveCount(0) // closes on choosing
  await expect(page.locator('.list-sort')).toHaveText('評価の高い順 ▾')
  await expect.poll(() => tileNames(page)).toEqual(['かき', 'いちご', 'あさり']) // unrated last

  await page.locator('.list-sort').click()
  await sheet(page).getByRole('radio', { name: '名前順' }).click()
  await expect.poll(() => tileNames(page)).toEqual(['あさり', 'いちご', 'かき'])

  // filter + other tab, then reload
  await openPanel(page, 'genre')
  await option(page, 'カフェ').click()
  await closePanel(page)
  await tab(page, '行きたい').click()
  await expect
    .poll(() =>
      page.evaluate(async () => {
        const s = await import(/* @vite-ignore */ '/src/db/settings.ts' as string)
        return s.getSetting('sortOrder')
      }),
    )
    .toBe('name')
  await page.reload()
  await expect(page.locator('.list-sort')).toHaveText('名前順 ▾')
  await expect(tab(page, '手札')).toHaveAttribute('aria-selected', 'true')
  await expect(chip(page, 'genre')).toHaveAttribute('data-active', 'false')
  await expect(count(page)).toHaveText('3件')
  expect(await tileNames(page)).toEqual(['あさり', 'いちご', 'かき'])
})

test('filter + scroll survive opening a shop and coming back', async ({ page }) => {
  const shops: Seed[] = Array.from({ length: 60 }, (_, i) => ({ name: `店${String(i).padStart(2, '0')}`, genres: [i % 3 === 0 ? '寿司' : 'ラーメン'] }))
  await seed(page, shops)
  await openPanel(page, 'genre')
  await option(page, 'ラーメン').click()
  await closePanel(page)
  await expect(count(page)).toHaveText('40件（60件中）')
  await page.evaluate(() => window.scrollTo(0, 500))
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(500)

  const target = page.getByTestId('tile-grid').getByRole('button').nth(20)
  const name = (await target.getAttribute('aria-label'))!
  await target.click()
  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible()
  await page.getByRole('button', { name: '戻る', exact: true }).click()
  await expect(page).toHaveURL(/#\/$/)
  await expect(count(page)).toHaveText('40件（60件中）')
  await expect(chip(page, 'genre')).toHaveText('ラーメン▾')
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(500)

  // also with the browser back
  await target.click()
  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible()
  await page.goBack()
  await expect(count(page)).toHaveText('40件（60件中）')
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(500)

  // switching tabs goes to the top
  await tab(page, '行きたい').click()
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0)
})

test('panel: backdrop tap and Esc close it; the page behind does not move; "N件を表示" follows the choice', async ({ page }) => {
  const shops: Seed[] = Array.from({ length: 40 }, (_, i) => ({ name: `店${i}`, genres: [i % 2 ? '寿司' : 'ラーメン'] }))
  await seed(page, shops)
  // a small offset: the chips must stay on screen (a click would scroll them into view)
  await page.evaluate(() => window.scrollTo(0, 60))
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(60)

  await openPanel(page, 'genre')
  await expect(sheet(page)).toHaveAttribute('aria-modal', 'true')
  await expect(sheet(page).getByRole('heading', { name: 'ジャンル' })).toBeVisible()
  await expect(sheet(page).getByRole('button', { name: '40件を表示' })).toBeVisible()
  await option(page, '寿司').click()
  await expect(sheet(page).getByRole('button', { name: '20件を表示' })).toBeVisible()
  // the page is held in place while open (body fixed at -60px)
  const body = await page.evaluate(() => ({ pos: document.body.style.position, top: document.body.style.top }))
  expect(body).toEqual({ pos: 'fixed', top: '-60px' })
  await page.mouse.wheel(0, 400)
  await expect(page.getByTestId('tile-grid')).toBeVisible()

  // backdrop tap closes, and the scroll position is back
  await page.getByTestId('sheet-backdrop').click({ position: { x: 195, y: 40 } })
  await expect(sheet(page)).toHaveCount(0)
  expect(await page.evaluate(() => document.body.style.position)).toBe('')
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(60)
  await expect(count(page)).toHaveText('20件（40件中）')

  // Esc closes
  await openPanel(page, 'place')
  await expect(sheet(page).getByText('まだありません')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(sheet(page)).toHaveCount(0)
})
