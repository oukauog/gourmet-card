// Shop page (construction 4). Photos are registered through the UI (fixtures); rating, tags,
// place, map URL and memo have no input screen yet (construction 5), so they are set by
// importing the public data API (/src/db/...) from the dev server inside the page.
// page.evaluate() callbacks run in the browser and use DOM APIs.
/// <reference lib="dom" />
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, test, type Page } from '@playwright/test'

const fixtures = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures')
const LANDSCAPE = path.join(fixtures, 'landscape-3000x2000.jpg')
const PORTRAIT_PNG = path.join(fixtures, 'portrait-800x1200.png')
const EXIF6 = path.join(fixtures, 'exif-orient6-2000x1500.jpg')

const MAP_URL = 'https://www.google.com/maps/search/?api=1&query=%E5%AF%8C%E5%B1%B1%E5%B8%82'
const MEMO = 'カウンター8席。\n日曜定休\nhttps://example.com/ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'

interface Extra {
  rating?: number
  prefecture?: string
  city?: string
  mapUrl?: string
  memo?: string
  genres?: string[]
  uses?: string[]
  areas?: string[]
}

async function register(page: Page, name: string, files: string[] = []) {
  await page.goto('/')
  await page.getByRole('button', { name: 'お店を登録' }).click()
  if (files.length > 0) {
    await page.getByTestId('photo-input').setInputFiles(files)
    await expect(page.getByRole('img', { name: `写真${files.length}`, exact: true })).toBeVisible({ timeout: 15_000 })
  }
  await page.getByPlaceholder('店名（必須）').fill(name)
  await page.getByRole('button', { name: '保存' }).click()
  // construction 5: saving opens the shop page; go back to the list with its back button
  await expect(page.getByRole('heading', { level: 1, name: name, exact: true })).toBeVisible()
  await page.getByRole('button', { name: '戻る', exact: true }).click()
  await expect(page.getByRole('button', { name, exact: true })).toBeVisible()
}

/** Set the fields that have no input screen yet, through the public API. Returns the shop id. */
async function setExtra(page: Page, name: string, extra: Extra): Promise<string> {
  return page.evaluate(
    async ({ name, extra }) => {
      // a variable path: loaded by the dev server at run time, not resolved by tsc
      const load = (p: string) => import(/* @vite-ignore */ p)
      const shops = await load('/src/db/shops.ts')
      const tags = await load('/src/db/tags.ts')
      const shop = (await shops.listShops()).find((s: { name: string }) => s.name === name)
      const ids = async (kind: string, names: string[] = []) => {
        const out: string[] = []
        for (const n of names) out.push((await tags.findOrCreateTag(kind, n)).id)
        return out
      }
      await shops.updateShop(shop.id, {
        rating: extra.rating,
        prefecture: extra.prefecture,
        city: extra.city,
        mapUrl: extra.mapUrl,
        memo: extra.memo,
        genreTagIds: await ids('genre', extra.genres),
        useTagIds: await ids('use', extra.uses),
        areaTagIds: await ids('area', extra.areas),
      })
      return shop.id as string
    },
    { name, extra },
  )
}

async function openShop(page: Page, id: string) {
  await page.goto(`/#/shop/${encodeURIComponent(id)}`)
  await expect(page.locator('.shop-name')).toBeVisible()
}

const dots = (page: Page) => page.getByTestId('carousel-dots').locator('.carousel-dot')
const slides = (page: Page) => page.locator('.carousel-slide')

test('3 photos with every field: carousel, dots, large image, stars, tags, place, map, memo', async ({ page }) => {
  await register(page, '三枚の店', [LANDSCAPE, PORTRAIT_PNG, EXIF6])
  const id = await setExtra(page, '三枚の店', {
    rating: 37,
    prefecture: '富山県',
    city: '富山市',
    genres: ['ラーメン', '寿司'],
    uses: ['個室あり'],
    areas: ['総曲輪', '八尾'],
    mapUrl: MAP_URL,
    memo: MEMO,
  })
  await openShop(page, id)

  // carousel: 3 slides, 3 dots, the first one selected
  await expect(slides(page)).toHaveCount(3)
  await expect(dots(page)).toHaveCount(3)
  await expect(dots(page).nth(0)).toHaveAttribute('data-active', 'true')
  await expect(dots(page).nth(1)).toHaveAttribute('data-active', 'false')

  // the visible image is the LARGE one (fixture 1: 3000x2000 -> 1800x1200)
  const first = page.getByRole('img', { name: '三枚の店 写真1/3' })
  await expect.poll(() => first.evaluate((im: HTMLImageElement) => im.complete && im.naturalWidth)).toBe(1800)

  // scroll to the 2nd photo -> the 2nd dot is selected
  await page.locator('.carousel-track').evaluate((el) => el.scrollTo({ left: el.clientWidth, behavior: 'instant' }))
  await expect(dots(page).nth(1)).toHaveAttribute('data-active', 'true')
  await expect(dots(page).nth(0)).toHaveAttribute('data-active', 'false')
  // scroll-snap is set up (the browser does the swiping)
  const snap = await page.locator('.carousel-track').evaluate((el) => getComputedStyle(el).scrollSnapType)
  expect(snap).toContain('x')
  expect(snap).toContain('mandatory')

  // name, stars + number
  await expect(page.getByRole('heading', { level: 1, name: '三枚の店' })).toBeVisible()
  await expect(page.getByRole('img', { name: '評価 3.7' })).toBeVisible()
  await expect(page.locator('.shop-rating')).toContainText('3.7')
  await expect(page.getByText('未評価')).toHaveCount(0)

  // tags in the shop's order: genres, then uses (outlined)
  const tagList = page.getByRole('list', { name: 'タグ' })
  await expect(tagList.getByRole('listitem')).toHaveText(['ラーメン', '寿司', '個室あり'])
  await expect(tagList.getByRole('listitem').nth(2)).toHaveClass(/shop-tag-use/)

  // place: prefecture + city, then area tags
  const place = page.getByRole('region', { name: '場所' })
  await expect(place).toContainText('富山県 富山市')
  await expect(place).toContainText('総曲輪・八尾')

  // map button opens in a new tab
  const map = page.getByRole('link', { name: 'Googleマップで開く' })
  await expect(map).toHaveAttribute('href', MAP_URL)
  await expect(map).toHaveAttribute('target', '_blank')
  await expect(map).toHaveAttribute('rel', /noopener/)

  // memo keeps line breaks, and the long word does not push the page sideways
  const memo = page.getByRole('region', { name: 'メモ' }).locator('.shop-memo')
  expect(await memo.textContent()).toBe(MEMO)
  expect(await memo.evaluate((el) => getComputedStyle(el).whiteSpace)).toBe('pre-wrap')
  expect(await memo.evaluate((el) => el.getBoundingClientRect().height)).toBeGreaterThan(60)
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
  // no link inside the memo
  await expect(page.getByRole('region', { name: 'メモ' }).getByRole('link')).toHaveCount(0)

  // "編集" exists since construction 5; "送る" (construction 8) not yet; "行った！" only for wishlist shops
  await expect(page.getByRole('button', { name: '編集', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'この店を送る' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: '行った！' })).toHaveCount(0)

  // reload shows the same shop
  await page.reload()
  await expect(page.getByRole('heading', { level: 1, name: '三枚の店' })).toBeVisible()
  await expect(slides(page)).toHaveCount(3)
})

test('1 photo: no dots. 0 photos: band, no image. Empty items are not shown; unrated says so', async ({ page }) => {
  await register(page, '一枚の店', [LANDSCAPE])
  const one = await setExtra(page, '一枚の店', { rating: 50 })
  await openShop(page, one)
  await expect(slides(page)).toHaveCount(1)
  await expect(page.getByTestId('carousel-dots')).toHaveCount(0)
  await expect(page.getByRole('img', { name: '一枚の店', exact: true })).toBeVisible()
  await expect(page.getByRole('img', { name: '評価 5.0' })).toBeVisible()

  await register(page, '写真なしの店')
  const none = await setExtra(page, '写真なしの店', {})
  await openShop(page, none)
  await expect(page.getByTestId('photo-band')).toBeVisible()
  await expect(page.getByTestId('photo-carousel')).toHaveCount(0)
  await expect(page.locator('img')).toHaveCount(0)
  await expect(page.locator('.shop-rating')).toHaveText('未評価')
  await expect(page.getByRole('img', { name: /^評価/ })).toHaveCount(0)
  // empty items: no heading, no list, no button
  await expect(page.getByRole('list', { name: 'タグ' })).toHaveCount(0)
  await expect(page.getByRole('region', { name: '場所' })).toHaveCount(0)
  await expect(page.getByRole('region', { name: 'メモ' })).toHaveCount(0)
  await expect(page.getByText('場所', { exact: true })).toHaveCount(0)
  await expect(page.getByText('メモ', { exact: true })).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'Googleマップで開く' })).toHaveCount(0)
})

test('only the parts that exist: city only, area only, genre only', async ({ page }) => {
  await register(page, '一部だけの店')
  const id = await setExtra(page, '一部だけの店', { city: '高岡市', genres: ['カフェ'] })
  await openShop(page, id)
  await expect(page.getByRole('region', { name: '場所' }).locator('.shop-place')).toHaveText('高岡市')
  await expect(page.getByRole('list', { name: 'タグ' }).getByRole('listitem')).toHaveText(['カフェ'])

  await setExtra(page, '一部だけの店', { areas: ['八尾'] })
  await page.reload()
  await expect(page.getByRole('region', { name: '場所' }).locator('.shop-place')).toHaveText('八尾')
  await expect(page.getByRole('list', { name: 'タグ' })).toHaveCount(0)
})

test('map button only for http(s): javascript: and broken URLs get no button', async ({ page }) => {
  await register(page, '地図の店')
  const id = await setExtra(page, '地図の店', { mapUrl: 'javascript:alert(1)' })
  await openShop(page, id)
  await expect(page.getByRole('link', { name: 'Googleマップで開く' })).toHaveCount(0)

  await setExtra(page, '地図の店', { mapUrl: 'maps.google.com/xyz' })
  await page.reload()
  await expect(page.locator('.shop-name')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Googleマップで開く' })).toHaveCount(0)

  await setExtra(page, '地図の店', { mapUrl: '  http://maps.app.goo.gl/abc  ' })
  await page.reload()
  await expect(page.getByRole('link', { name: 'Googleマップで開く' })).toHaveAttribute('href', 'http://maps.app.goo.gl/abc')
})

test('delete returns to the list without the shop; unknown id shows a message', async ({ page }) => {
  await register(page, '残す店')
  await register(page, '消す店', [LANDSCAPE])
  await page.getByRole('button', { name: '消す店', exact: true }).click()
  await expect(page.getByRole('heading', { level: 1, name: '消す店' })).toBeVisible()
  page.on('dialog', (d) => void d.accept())
  await page.getByRole('button', { name: 'この店を削除' }).click()
  await expect(page).toHaveURL(/#\/$/)
  await expect(page.getByRole('button', { name: '消す店', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: '残す店', exact: true })).toBeVisible()

  await page.goto('/#/shop/does-not-exist')
  await expect(page.getByText('この店は見つかりません')).toBeVisible()
})

test('fixed look 4:5 x overlay: photo from the top, floating back button, no bar', async ({ page }) => {
  await register(page, '見た目の店', [LANDSCAPE, PORTRAIT_PNG])
  await register(page, '帯の店')
  await page.getByRole('button', { name: '見た目の店', exact: true }).click()
  await expect(page.getByRole('heading', { level: 1, name: '見た目の店' })).toBeVisible()

  // photo: full width, from the very top, 4:5
  const box = (await slides(page).first().boundingBox())!
  expect(box.x).toBe(0)
  expect(box.y).toBe(0)
  expect(box.width).toBe(390)
  expect(box.height).toBeCloseTo(390 * 1.25, 0)

  // no top bar, no look chips; the floating back button is top-left and stays on scroll
  await expect(page.getByRole('button', { name: '← 戻る' })).toHaveCount(0)
  await expect(page.locator('.topbar')).toHaveCount(0)
  await expect(page.getByTestId('dev-shop-look')).toHaveCount(0)
  const back = page.getByRole('button', { name: '戻る', exact: true })
  await expect(back).toBeVisible()
  const before = (await back.boundingBox())!
  expect(before.x).toBeLessThan(40)
  expect(before.y).toBeLessThan(40)
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0)
  expect((await back.boundingBox())!.y).toBe(before.y)
  await back.click()
  await expect(page).toHaveURL(/#\/$/)

  // no-photo shop: the band starts at the top and the button sits on it
  await page.getByRole('button', { name: '帯の店', exact: true }).click()
  await expect(page.getByRole('heading', { level: 1, name: '帯の店' })).toBeVisible()
  const band = (await page.getByTestId('photo-band').boundingBox())!
  expect(band.y).toBe(0)
  const b2 = (await back.boundingBox())!
  expect(b2.y).toBeGreaterThanOrEqual(band.y)
  expect(b2.y + b2.height).toBeLessThanOrEqual(band.y + band.height)
  await back.click()
  await expect(page).toHaveURL(/#\/$/)

  // unknown shop: the button does not overlap the message or "一覧へ戻る"
  await page.goto('/#/shop/does-not-exist')
  await expect(page.getByText('この店は見つかりません')).toBeVisible()
  const b3 = (await back.boundingBox())!
  for (const other of [page.getByText('この店は見つかりません'), page.getByRole('button', { name: '一覧へ戻る' })]) {
    const o = (await other.boundingBox())!
    const overlap = b3.x < o.x + o.width && o.x < b3.x + b3.width && b3.y < o.y + o.height && o.y < b3.y + b3.height
    expect(overlap).toBe(false)
  }
  await back.click()
  await expect(page).toHaveURL(/#\/$/)
})

test('pale tones are the same on the no-photo tile and the no-photo band (6 tones)', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByTestId('tile-grid')).toBeVisible()
  const expected = [
    'linear-gradient(135deg, rgb(253, 235, 220), rgb(248, 217, 196))',
    'linear-gradient(135deg, rgb(251, 241, 211), rgb(245, 227, 176))',
    'linear-gradient(135deg, rgb(227, 241, 221), rgb(207, 230, 198))',
    'linear-gradient(135deg, rgb(220, 236, 246), rgb(199, 221, 238))',
    'linear-gradient(135deg, rgb(236, 227, 245), rgb(220, 205, 238))',
    'linear-gradient(135deg, rgb(248, 224, 230), rgb(240, 201, 211))',
  ]
  // both stylesheets are loaded on the list page (App imports every screen)
  const got = await page.evaluate(() => {
    const read = (html: string) => {
      const d = document.createElement('div')
      d.innerHTML = html
      document.body.append(d)
      const bg = getComputedStyle(d.firstElementChild!).backgroundImage
      d.remove()
      return bg
    }
    return Array.from({ length: 6 }, (_, i) => ({
      tile: read(`<button class="tile tile-nophoto" data-tone="${i}"></button>`),
      band: read(`<div class="photo-band" data-tone="${i}"></div>`),
    }))
  })
  expect(got.map((g) => g.tile)).toEqual(expected)
  expect(got.map((g) => g.band)).toEqual(expected)
})
