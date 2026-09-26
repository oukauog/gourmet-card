// Register / edit form (construction 5). Phone size 390x844.
// DB checks import the public data API (/src/db/...) from the dev server inside the page.
// page.evaluate() callbacks run in the browser and use DOM APIs.
/// <reference lib="dom" />
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, test, type Page } from '@playwright/test'

const fixtures = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures')
const LANDSCAPE = path.join(fixtures, 'landscape-3000x2000.jpg') // large 1800 wide, small 600
const PORTRAIT_PNG = path.join(fixtures, 'portrait-800x1200.png') // large 800 wide, small 400
const EXIF6 = path.join(fixtures, 'exif-orient6-2000x1500.jpg') // large 1350 wide, small 450

interface DbShop {
  id: string
  name: string
  status: string
  rating?: number
  prefecture?: string
  city?: string
  stationId?: string
  mapUrl?: string
  memo?: string
  photoIds: string[]
  genres: string[]
  uses: string[]
  areas: string[]
}

/** The shop with this name, with tag names resolved (undefined if none). */
async function dbShop(page: Page, name: string): Promise<DbShop | undefined> {
  return page.evaluate(async (name) => {
    const load = (p: string) => import(/* @vite-ignore */ p)
    const shops = await load('/src/db/shops.ts')
    const tags = await load('/src/db/tags.ts')
    const s = (await shops.listShops()).find((x: { name: string }) => x.name === name)
    if (!s) return undefined
    const byId = new Map((await tags.listTags()).map((t: { id: string; name: string }) => [t.id, t.name]))
    const names = (ids: string[]) => ids.map((id) => byId.get(id) as string)
    return { ...s, genres: names(s.genreTagIds), uses: names(s.useTagIds), areas: names(s.areaTagIds) }
  }, name)
}

async function tagNames(page: Page, kind: string): Promise<string[]> {
  return page.evaluate(async (kind) => {
    const tags = await import(/* @vite-ignore */ '/src/db/tags.ts' as string)
    return (await tags.listTags(kind)).map((t: { name: string }) => t.name)
  }, kind)
}

/** Create a shop straight through the API (for states the form cannot make, e.g. a city). */
async function apiShop(page: Page, input: Record<string, unknown>): Promise<string> {
  return page.evaluate(async (input) => {
    const shops = await import(/* @vite-ignore */ '/src/db/shops.ts' as string)
    return (await shops.createShop(input)).id as string
  }, input)
}

/** Set the slider like a user would (React listens to the input event). */
async function setSlider(page: Page, value: number) {
  await page.getByRole('slider', { name: '評価' }).evaluate((el: HTMLInputElement, v) => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(el, String(v))
    el.dispatchEvent(new Event('input', { bubbles: true }))
  }, value)
}

async function waitPhotos(page: Page, count: number) {
  for (let i = 1; i <= count; i++) await expect(page.getByRole('img', { name: `写真${i}`, exact: true })).toBeVisible({ timeout: 15_000 })
  await expect(page.getByText('処理中…')).toHaveCount(0)
}

const ratingValue = (page: Page) => page.getByTestId('rating-value')
const shopHeading = (page: Page, name: string) => page.getByRole('heading', { level: 1, name, exact: true })
const carouselWidths = (page: Page) =>
  page.locator('.carousel-img').evaluateAll((ims) => ims.map((im) => ((im as HTMLImageElement).complete ? (im as HTMLImageElement).naturalWidth : 0)))

async function openRegister(page: Page) {
  await page.goto('/')
  await page.getByRole('button', { name: 'お店を登録' }).click()
  await expect(page.getByRole('heading', { name: 'お店を登録' })).toBeVisible()
}

test('register with every field -> shop page shows everything, also after reload', async ({ page }) => {
  await page.goto('/')
  await page.evaluate(async () => {
    const tags = await import(/* @vite-ignore */ '/src/db/tags.ts' as string)
    await tags.findOrCreateTag('genre', 'ラーメン')
  })
  await openRegister(page)
  // the initial use tags are there
  await expect(page.getByRole('button', { name: '個室あり' })).toBeVisible()
  await expect(page.getByRole('button', { name: '駐車場あり' })).toBeVisible()

  await page.getByTestId('photo-input').setInputFiles([LANDSCAPE, PORTRAIT_PNG])
  await waitPhotos(page, 2)
  await page.getByPlaceholder('店名（必須）').fill('麺屋 全部入り')
  await page.getByRole('radio', { name: '行きたい' }).click()
  await page.getByRole('button', { name: '＋0.1' }).click()
  await expect(ratingValue(page)).toHaveText('3.1')
  await setSlider(page, 37)
  await expect(ratingValue(page)).toHaveText('3.7')

  // genre: focusing the empty field shows the existing tag; one from the candidates + one new
  const genre = page.getByRole('group', { name: 'ジャンル', exact: true })
  await genre.getByRole('textbox').click()
  await page.getByRole('group', { name: 'ジャンルの候補' }).getByRole('button', { name: 'ラーメン' }).click()
  await genre.getByRole('textbox').fill('海鮮')
  await genre.getByRole('textbox').press('Enter')
  await expect(genre.locator('.tag-chip')).toHaveText(['ラーメン×', '海鮮×'])

  await page.getByRole('button', { name: '個室あり' }).click()
  await expect(page.getByRole('button', { name: '個室あり' })).toHaveAttribute('aria-pressed', 'true')
  await page.getByLabel('県').selectOption('富山県')
  const area = page.getByRole('group', { name: 'エリア', exact: true })
  await area.getByRole('textbox').fill('総曲輪')
  await area.getByRole('button', { name: '追加' }).click()
  await page.getByLabel('GoogleマップURL').fill(' https://maps.app.goo.gl/abc ')
  await page.getByLabel('メモ').fill('1行目\n2行目')
  // nothing is created before saving
  expect(await tagNames(page, 'genre')).toEqual(['ラーメン'])

  await page.getByRole('button', { name: '保存' }).click()
  await expect(page).toHaveURL(/#\/shop\/[0-9a-f-]{36}$/)
  await expect(page.getByRole('status')).toHaveText('保存しました')

  const check = async () => {
    await expect(shopHeading(page, '麺屋 全部入り')).toBeVisible()
    await expect(page.getByRole('img', { name: '評価 3.7' })).toBeVisible()
    await expect(page.getByRole('list', { name: 'タグ' }).getByRole('listitem')).toHaveText(['ラーメン', '海鮮', '個室あり'])
    await expect(page.getByRole('region', { name: '場所' })).toContainText('富山県')
    await expect(page.getByRole('region', { name: '場所' })).toContainText('総曲輪')
    await expect(page.getByRole('link', { name: 'Googleマップで開く' })).toHaveAttribute('href', 'https://maps.app.goo.gl/abc')
    expect(await page.locator('.shop-memo').textContent()).toBe('1行目\n2行目')
    await expect(page.locator('.carousel-slide')).toHaveCount(2)
    await expect(page.getByRole('button', { name: '行った！' })).toBeVisible() // 行きたい
  }
  await check()
  await page.reload()
  await check()

  const s = (await dbShop(page, '麺屋 全部入り'))!
  expect(s).toMatchObject({ status: 'wishlist', rating: 37, prefecture: '富山県', mapUrl: 'https://maps.app.goo.gl/abc', memo: '1行目\n2行目' })
  expect([s.genres, s.uses, s.areas]).toEqual([['ラーメン', '海鮮'], ['個室あり'], ['総曲輪']])
  expect(s.photoIds).toHaveLength(2)
})

test('photos + name only: saved; the first screen has 写真を追加, 店名 and 保存', async ({ page }) => {
  await openRegister(page)
  for (const el of [
    page.getByRole('button', { name: '写真を追加' }),
    page.getByPlaceholder('店名（必須）'),
    page.getByRole('button', { name: '保存' }),
  ]) {
    const b = (await el.boundingBox())!
    expect(b.y).toBeGreaterThanOrEqual(0)
    expect(b.y + b.height).toBeLessThanOrEqual(844)
  }
  await page.getByTestId('photo-input').setInputFiles([LANDSCAPE])
  await waitPhotos(page, 1)
  // still on the first screen with a photo
  const name = (await page.getByPlaceholder('店名（必須）').boundingBox())!
  expect(name.y + name.height).toBeLessThanOrEqual(844 - 76) // above the fixed save bar
  await page.getByPlaceholder('店名（必須）').fill('写真と店名だけ')
  await page.getByRole('button', { name: '保存' }).click()
  await expect(shopHeading(page, '写真と店名だけ')).toBeVisible()
  const s = (await dbShop(page, '写真と店名だけ'))!
  expect(s).toMatchObject({ status: 'visited', genres: [], uses: [], areas: [] })
  expect(s.photoIds).toHaveLength(1)
  for (const k of ['rating', 'prefecture', 'city', 'mapUrl', 'memo']) expect(k in s).toBe(false)
  await expect(page.getByText('未評価')).toBeVisible()
})

test('rating: +0.1 from unrated is 3.1, slider, stops at 0.1 / 5.0, back to unrated', async ({ page }) => {
  await openRegister(page)
  await expect(ratingValue(page)).toHaveText('未評価')
  await expect(page.getByRole('button', { name: '未評価に戻す' })).toHaveCount(0)
  await page.getByRole('button', { name: '＋0.1' }).click()
  await expect(ratingValue(page)).toHaveText('3.1')
  await expect(page.locator('.rating-input').getByRole('img', { name: '評価 3.1' })).toBeVisible()

  await setSlider(page, 1)
  await expect(ratingValue(page)).toHaveText('0.1')
  await page.getByRole('button', { name: '−0.1' }).click()
  await expect(ratingValue(page)).toHaveText('0.1')
  await setSlider(page, 50)
  await expect(ratingValue(page)).toHaveText('5.0')
  await page.getByRole('button', { name: '＋0.1' }).click()
  await expect(ratingValue(page)).toHaveText('5.0')
  await page.getByRole('button', { name: '−0.1' }).click()
  await expect(ratingValue(page)).toHaveText('4.9')

  await page.getByRole('button', { name: '未評価に戻す' }).click()
  await expect(ratingValue(page)).toHaveText('未評価')
  // "−0.1" from unrated starts at 3.0 too
  await page.getByRole('button', { name: '−0.1' }).click()
  await expect(ratingValue(page)).toHaveText('2.9')
  await page.getByRole('button', { name: '未評価に戻す' }).click()
  // touching the faded slider rates the shop
  await page.getByRole('slider', { name: '評価' }).click()
  await expect(ratingValue(page)).not.toHaveText('未評価')
  await page.getByRole('button', { name: '未評価に戻す' }).click()

  await page.getByPlaceholder('店名（必須）').fill('未評価の店')
  await page.getByRole('button', { name: '保存' }).click()
  await expect(shopHeading(page, '未評価の店')).toBeVisible()
  await expect(page.locator('.shop-rating')).toHaveText('未評価')
  expect('rating' in (await dbShop(page, '未評価の店'))!).toBe(false)
})

test('edit photos: move -> cover changes on the shop page and the tile; remove 1 + add 1', async ({ page }) => {
  await openRegister(page)
  await page.getByTestId('photo-input').setInputFiles([LANDSCAPE, PORTRAIT_PNG, EXIF6])
  await waitPhotos(page, 3)
  // reordering works on the register screen too: first slot has no "◀", last no "▶"
  await expect(page.getByRole('button', { name: '写真1を左へ' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: '写真3を右へ' })).toHaveCount(0)
  await page.getByPlaceholder('店名（必須）').fill('写真の店')
  await page.getByRole('button', { name: '保存' }).click()
  await expect(shopHeading(page, '写真の店')).toBeVisible()
  const [p1, p2, p3] = (await dbShop(page, '写真の店'))!.photoIds
  await expect.poll(() => carouselWidths(page)).toEqual([1800, 800, 1350])

  await page.getByRole('button', { name: '編集', exact: true }).click()
  await expect(page).toHaveURL(/\/edit$/)
  await expect(page.getByRole('heading', { name: '店を編集' })).toBeVisible()
  await waitPhotos(page, 3)
  await expect(page.getByText('表紙')).toHaveCount(1)
  await page.getByRole('button', { name: '写真1を右へ' }).click() // -> 2, 1, 3
  // not saved yet
  expect((await dbShop(page, '写真の店'))!.photoIds).toEqual([p1, p2, p3])
  await page.getByRole('button', { name: '保存' }).click()
  await expect(page).toHaveURL(/#\/shop\/[0-9a-f-]{36}$/)
  await expect(page.getByRole('status')).toHaveText('保存しました')
  expect((await dbShop(page, '写真の店'))!.photoIds).toEqual([p2, p1, p3])
  await expect.poll(() => carouselWidths(page)).toEqual([800, 1800, 1350])

  // the tile's cover is the PNG now (small: 400 wide)
  await page.getByRole('button', { name: '戻る', exact: true }).click()
  const tileImg = page.getByRole('button', { name: '写真の店' }).locator('img')
  await expect.poll(() => tileImg.evaluate((im: HTMLImageElement) => im.complete && im.naturalWidth)).toBe(400)

  // remove the 2nd (landscape) and add one: 2 (png), 3 (exif), new (landscape)
  await page.getByRole('button', { name: '写真の店' }).click()
  await page.getByRole('button', { name: '編集', exact: true }).click()
  await waitPhotos(page, 3)
  await page.getByRole('button', { name: '写真2を取り消す' }).click()
  await page.getByTestId('photo-input').setInputFiles([LANDSCAPE])
  await waitPhotos(page, 3)
  await page.getByRole('button', { name: '保存' }).click()
  await expect(page).toHaveURL(/#\/shop\/[0-9a-f-]{36}$/)
  const ids = (await dbShop(page, '写真の店'))!.photoIds
  expect(ids).toHaveLength(3)
  expect(ids.slice(0, 2)).toEqual([p2, p3])
  expect([p1, p2, p3]).not.toContain(ids[2])
  await expect.poll(() => carouselWidths(page)).toEqual([800, 1350, 1800])
})

test('edit then cancel (discard): DB and page unchanged, no orphan tag; no change -> no question', async ({ page }) => {
  await openRegister(page)
  await page.getByPlaceholder('店名（必須）').fill('元の名前')
  await page.getByRole('button', { name: '保存' }).click()
  await expect(shopHeading(page, '元の名前')).toBeVisible()
  const before = await dbShop(page, '元の名前')

  // no change: cancel without a question
  let asked = 0
  page.on('dialog', (d) => {
    asked++
    expect(d.message()).toBe('変更を破棄しますか？')
    void d.accept()
  })
  await page.getByRole('button', { name: '編集', exact: true }).click()
  await page.getByRole('button', { name: 'キャンセル' }).click()
  await expect(shopHeading(page, '元の名前')).toBeVisible()
  expect(asked).toBe(0)

  await page.getByRole('button', { name: '編集', exact: true }).click()
  await page.getByPlaceholder('店名（必須）').fill('変えた名前')
  const genre = page.getByRole('group', { name: 'ジャンル', exact: true })
  await genre.getByRole('textbox').fill('入れかけ')
  await genre.getByRole('textbox').press('Enter')
  await page.getByRole('radio', { name: '行きたい' }).click()
  await page.getByRole('button', { name: '＋0.1' }).click()
  await page.getByRole('button', { name: 'キャンセル' }).click()
  expect(asked).toBe(1)
  await expect(page).toHaveURL(/#\/shop\/[0-9a-f-]{36}$/)
  await expect(shopHeading(page, '元の名前')).toBeVisible()
  await expect(page.getByText('未評価')).toBeVisible()
  expect(await dbShop(page, '元の名前')).toEqual(before)
  expect(await tagNames(page, 'genre')).toEqual([])

  // the half-entered tag is not a candidate
  await page.getByRole('button', { name: '編集', exact: true }).click()
  await page.getByRole('group', { name: 'ジャンル', exact: true }).getByRole('textbox').click()
  await expect(page.getByRole('group', { name: 'ジャンルの候補' })).toHaveCount(0)
})

test('changing the prefecture clears the city; keeping it keeps the city', async ({ page }) => {
  await page.goto('/')
  const id = await apiShop(page, { name: '市のある店', prefecture: '富山県', city: '富山市', stationId: 'st-1' })
  await page.goto(`/#/shop/${id}/edit`)
  await expect(page.getByLabel('県')).toHaveValue('富山県')
  await page.getByLabel('メモ').fill('県はそのまま')
  await page.getByRole('button', { name: '保存' }).click()
  await expect(shopHeading(page, '市のある店')).toBeVisible()
  expect(await dbShop(page, '市のある店')).toMatchObject({ prefecture: '富山県', city: '富山市', stationId: 'st-1', memo: '県はそのまま' })
  await expect(page.getByRole('region', { name: '場所' })).toContainText('富山県 富山市')

  await page.getByRole('button', { name: '編集', exact: true }).click()
  await page.getByLabel('県').selectOption('石川県')
  await page.getByRole('button', { name: '保存' }).click()
  await expect(page.getByRole('region', { name: '場所' }).locator('.shop-place')).toHaveText('石川県')
  const s = (await dbShop(page, '市のある店'))!
  expect(s.prefecture).toBe('石川県')
  expect('city' in s).toBe(false)
  expect(s.stationId).toBe('st-1')
})

test('"行った！" on a wishlist shop -> edit screen; cancel keeps it 手札. 手札 shops have no button', async ({ page }) => {
  await openRegister(page)
  await page.getByPlaceholder('店名（必須）').fill('行きたい店')
  await page.getByRole('radio', { name: '行きたい' }).click()
  await page.getByRole('button', { name: '保存' }).click()
  await expect(shopHeading(page, '行きたい店')).toBeVisible()
  expect((await dbShop(page, '行きたい店'))!.status).toBe('wishlist')

  await page.getByRole('button', { name: '行った！' }).click()
  await expect(page).toHaveURL(/\/edit$/)
  await expect(page.getByRole('radio', { name: '手札' })).toHaveAttribute('aria-checked', 'true')
  await page.getByRole('button', { name: 'キャンセル' }).click()
  await expect(shopHeading(page, '行きたい店')).toBeVisible()
  await expect(page.getByRole('button', { name: '行った！' })).toHaveCount(0)
  expect((await dbShop(page, '行きたい店'))!.status).toBe('visited')
  await page.reload()
  await expect(shopHeading(page, '行きたい店')).toBeVisible()
  await expect(page.getByRole('button', { name: '行った！' })).toHaveCount(0)
})

test('edit screen opened directly (and reloaded): save -> shop page, back does not return to it', async ({ page }) => {
  await page.goto('/')
  const id = await apiShop(page, { name: '直接開く店' })
  await page.goto(`/#/shop/${id}/edit`)
  await page.reload()
  await expect(page.getByRole('heading', { name: '店を編集' })).toBeVisible()
  await expect(page.getByPlaceholder('店名（必須）')).toHaveValue('直接開く店')
  await page.getByLabel('メモ').fill('直接')
  await page.getByRole('button', { name: '保存' }).click()
  await expect(page).toHaveURL((u) => u.hash === `#/shop/${id}`)
  await expect(shopHeading(page, '直接開く店')).toBeVisible()
  await page.goBack()
  await expect(page).not.toHaveURL(/\/edit$/)
  await expect(page.getByRole('heading', { name: '店を編集' })).toHaveCount(0)

  // unknown shop
  await page.goto('/#/shop/does-not-exist/edit')
  await expect(page.getByText('この店は見つかりません')).toBeVisible()
  await page.getByRole('button', { name: '一覧へ戻る' }).click()
  await expect(page).toHaveURL(/#\/$/)
})

test('a non-http URL shows a hint but saves; the shop page has no map button', async ({ page }) => {
  await openRegister(page)
  await page.getByPlaceholder('店名（必須）').fill('URLの店')
  const url = page.getByLabel('GoogleマップURL')
  await url.fill('maps.google.com/xyz')
  await expect(page.getByText('http で始まる URL でないと、店ページにボタンが出ません')).toBeVisible()
  await url.fill('https://maps.app.goo.gl/ok')
  await expect(page.getByText('http で始まる URL でないと、店ページにボタンが出ません')).toHaveCount(0)
  await url.fill('maps.google.com/xyz')
  await page.getByRole('button', { name: '保存' }).click()
  await expect(shopHeading(page, 'URLの店')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Googleマップで開く' })).toHaveCount(0)
  expect((await dbShop(page, 'URLの店'))!.mapUrl).toBe('maps.google.com/xyz')
})
