// Selection mode of the list: choose several shops and send them in one file (construction 8b).
// Phone size 390x844 (one test at 375x667). "Another phone" = a new browser context.
/// <reference lib="dom" />
import { expect, test, type Browser, type Page, type TestInfo } from '@playwright/test'

interface Seed {
  name: string
  status?: 'visited' | 'wishlist'
  rating?: number
  prefecture?: string
  photos?: number
}

/** Create the shops in this order (so "新しい順" is the reverse), then reload the list. */
async function seed(page: Page, shops: Seed[]) {
  await page.goto('/')
  await expect(page.getByTestId('tile-grid')).toBeVisible()
  await page.evaluate(async (shops) => {
    const create = await import(/* @vite-ignore */ '/src/db/createShopWithPhotos.ts' as string)
    const jpeg = (w: number, h: number, hue: number) =>
      new Promise<Blob>((resolve) => {
        const c = document.createElement('canvas')
        c.width = w
        c.height = h
        const g = c.getContext('2d')!
        g.fillStyle = `hsl(${hue} 70% 55%)`
        g.fillRect(0, 0, w, h)
        c.toBlob((b) => resolve(b!), 'image/jpeg', 0.8)
      })
    for (const [i, s] of shops.entries()) {
      const photos = []
      for (let k = 0; k < (s.photos ?? 0); k++) photos.push({ large: await jpeg(600, 450, i * 50 + k * 15), small: await jpeg(200, 150, i * 50 + k * 15), width: 600, height: 450 })
      await create.createShopWithPhotos({ name: s.name, status: s.status ?? 'visited', rating: s.rating, prefecture: s.prefecture }, photos)
      await new Promise((r) => setTimeout(r, 2))
    }
  }, shops)
  await page.reload()
  await expect(page.getByTestId('tile-grid')).toHaveAttribute('aria-busy', 'false')
}

const tile = (page: Page, name: string) => page.getByTestId('tile-grid').getByRole('button', { name, exact: true })
const title = (page: Page) => page.getByRole('heading', { level: 1 })
const bar = (page: Page) => page.getByTestId('select-bar')
const sheet = (page: Page) => page.getByRole('dialog')
const tab = (page: Page, name: '手札' | '行きたい') => page.getByRole('tab', { name: new RegExp(`^${name}`) })
const startSelecting = (page: Page) => page.getByRole('button', { name: '選ぶ', exact: true }).click()

async function otherPhone(browser: Browser, info: TestInfo): Promise<Page> {
  const { viewport, isMobile, hasTouch, deviceScaleFactor, baseURL } = info.project.use
  const ctx = await browser.newContext({ viewport, isMobile, hasTouch, deviceScaleFactor, baseURL, acceptDownloads: true })
  return ctx.newPage()
}

async function saveFromSheet(page: Page) {
  await expect(sheet(page).getByText(/^準備できました（.+）$/)).toBeVisible({ timeout: 20_000 })
  const [download] = await Promise.all([page.waitForEvent('download'), sheet(page).getByRole('button', { name: 'ファイルとして保存' }).click()])
  return { path: (await download.path())!, name: download.suggestedFilename() }
}

/** navigator.canShare / share replaced; share() resolves ('ok') or throws AbortError ('abort'). */
async function fakeShare(page: Page, mode: 'ok' | 'abort') {
  await page.addInitScript((mode) => {
    const w = window as unknown as { __shares: { name: string; type: string; count: number }[] }
    w.__shares = []
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: (d: ShareData) => Array.isArray(d?.files) && d.files.length > 0 })
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: async (d: ShareData) => {
        w.__shares.push({ name: d.files![0].name, type: d.files![0].type, count: d.files!.length })
        if (mode === 'abort') throw new DOMException('closed', 'AbortError')
      },
    })
  }, mode)
}
const shares = (page: Page) => page.evaluate(() => (window as unknown as { __shares: { name: string; type: string; count: number }[] }).__shares)

test('entry and basics: 選ぶ -> select / unselect -> キャンセル back to the normal list', async ({ page }) => {
  await seed(page, [{ name: '一の店' }, { name: '二の店', photos: 1 }, { name: '三の店' }])
  // top bar order: columns -> 選ぶ -> menu
  const x = async (name: string) => (await page.getByRole('button', { name, exact: true }).boundingBox())!.x
  const colsX = (await page.locator('.cols-toggle').boundingBox())!.x
  expect(colsX).toBeLessThan(await x('選ぶ'))
  expect(await x('選ぶ')).toBeLessThan(await x('メニュー'))

  await startSelecting(page)
  await expect(title(page)).toHaveText('お店を選んでください')
  await expect(page.getByRole('button', { name: 'お店を登録' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'メニュー' })).toHaveCount(0)
  await expect(page.locator('.cols-toggle')).toHaveCount(0)
  await expect(bar(page).getByRole('button', { name: '送る' })).toBeDisabled()
  await expect(tile(page, '一の店')).toHaveAttribute('aria-pressed', 'false')

  await tile(page, '一の店').click()
  await tile(page, '二の店').click()
  await expect(title(page)).toHaveText('2店を選択中')
  await expect(bar(page).getByRole('button', { name: '2店を送る' })).toBeEnabled()
  await expect(tile(page, '一の店')).toHaveAttribute('aria-pressed', 'true')
  await tile(page, '一の店').click()
  await expect(title(page)).toHaveText('1店を選択中')
  await expect(tile(page, '一の店')).toHaveAttribute('aria-pressed', 'false')

  await page.getByRole('button', { name: 'キャンセル' }).click()
  await expect(title(page)).toHaveText('グルメカード')
  await expect(bar(page)).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'お店を登録' })).toBeVisible()
  await expect(tile(page, '二の店')).not.toHaveAttribute('aria-pressed', /.*/)
  // the selection is gone: selecting again starts from zero
  await startSelecting(page)
  await expect(title(page)).toHaveText('お店を選んでください')
  await page.getByRole('button', { name: 'キャンセル' }).click()
  // a tap opens the shop page again
  await tile(page, '二の店').click()
  await expect(page).toHaveURL(/#\/shop\//)
})

test('in selection mode a tap never opens the shop page (URL and history stay)', async ({ page }) => {
  await seed(page, [{ name: '開かない店' }])
  const url = page.url()
  const len = await page.evaluate(() => history.length)
  await startSelecting(page)
  await tile(page, '開かない店').click()
  await tile(page, '開かない店').click()
  await tile(page, '開かない店').click()
  expect(page.url()).toBe(url)
  expect(await page.evaluate(() => history.length)).toBe(len)
  await expect(title(page)).toHaveText('1店を選択中')
})

test('表示中をすべて選ぶ / 外す with a filter; the selection stays when the filter changes; "うちN店は今の表示の外"', async ({ page }) => {
  await seed(page, [
    { name: '富山A', prefecture: '富山県' },
    { name: '石川B', prefecture: '石川県' },
    { name: '富山C', prefecture: '富山県' },
    { name: '石川D', prefecture: '石川県' },
  ])
  await startSelecting(page)
  // filter: 富山県
  await page.getByTestId('filter-chips').locator('[data-kind="place"]').click()
  await sheet(page).getByRole('button', { name: /^富山県/ }).click()
  await sheet(page).getByRole('button', { name: /件を表示$/ }).click()
  await page.getByRole('button', { name: '表示中をすべて選ぶ' }).click()
  await expect(title(page)).toHaveText('2店を選択中')
  await expect(page.getByRole('button', { name: '表示中をすべて外す' })).toBeVisible()
  await expect(bar(page).getByText(/今の表示の外/)).toHaveCount(0)

  // clear the filter: still selected, the button is back to "選ぶ"
  await page.getByRole('button', { name: '条件を解除' }).first().click()
  await expect(title(page)).toHaveText('2店を選択中')
  await expect(page.getByRole('button', { name: '表示中をすべて選ぶ' })).toBeVisible()
  await expect(tile(page, '富山A')).toHaveAttribute('aria-pressed', 'true')
  await expect(tile(page, '石川B')).toHaveAttribute('aria-pressed', 'false')

  // 石川県 only: the two 富山 shops are out of view
  await page.getByTestId('filter-chips').locator('[data-kind="place"]').click()
  await sheet(page).getByRole('button', { name: /^石川県/ }).click()
  await sheet(page).getByRole('button', { name: /件を表示$/ }).click()
  await expect(bar(page)).toContainText('うち2店は今の表示の外')
  await page.getByRole('button', { name: '表示中をすべて選ぶ' }).click()
  await expect(title(page)).toHaveText('4店を選択中')
  // 外す removes the shown ones only
  await page.getByRole('button', { name: '表示中をすべて外す' }).click()
  await expect(title(page)).toHaveText('2店を選択中')
  await expect(bar(page)).toContainText('うち2店は今の表示の外')
})

test('across tabs: one from 手札 and one from 行きたい -> 2店を選択中', async ({ page }) => {
  await seed(page, [{ name: '手札の店' }, { name: '行きたい店', status: 'wishlist' }])
  await startSelecting(page)
  await tile(page, '手札の店').click()
  await tab(page, '行きたい').click()
  await expect(title(page)).toHaveText('1店を選択中')
  await expect(bar(page)).toContainText('うち1店は今の表示の外')
  await tile(page, '行きたい店').click()
  await expect(title(page)).toHaveText('2店を選択中')
  await expect(bar(page).getByRole('button', { name: '2店を送る' })).toBeEnabled()
})

test('send 3 shops -> "…ほか2店.zip" -> the mode ends (tab kept) -> another phone gets 3 行きたい shops', async ({ page, browser }, info) => {
  await seed(page, [
    { name: '古い店', rating: 35, photos: 1 },
    { name: '中の店', status: 'wishlist', rating: 42 },
    { name: '新しい店', rating: 50, photos: 2 },
  ])
  await startSelecting(page)
  await tile(page, '古い店').click()
  await tile(page, '新しい店').click()
  await tab(page, '行きたい').click()
  await tile(page, '中の店').click()
  await bar(page).getByRole('button', { name: '3店を送る' }).click()
  await expect(sheet(page).getByRole('heading', { name: '3店を送る' })).toBeVisible()
  const file = await saveFromSheet(page)
  // the list order (newest first, both tabs), not the order of choosing
  expect(file.name).toBe('グルメカード_新しい店ほか2店.zip')
  await sheet(page).press('Escape')
  await expect(title(page)).toHaveText('グルメカード')
  await expect(tab(page, '行きたい')).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByRole('button', { name: 'お店を登録' })).toBeVisible()

  const p2 = await otherPhone(browser, info)
  await p2.goto('/#/data')
  const [chooser] = await Promise.all([p2.waitForEvent('filechooser'), p2.getByRole('button', { name: 'ファイルから取り込む' }).click()])
  await chooser.setFiles(file.path)
  await expect(sheet(p2).getByTestId('import-kind')).toHaveText('お裾分け（友人から）')
  await expect(sheet(p2).getByText('新しいお店 3件')).toBeVisible()
  await sheet(p2).getByRole('button', { name: '取り込む（3件）' }).click()
  await expect(sheet(p2).getByTestId('import-result')).toHaveText('3件取り込みました')
  await sheet(p2).getByRole('button', { name: '一覧を見る' }).click()
  await expect(p2.getByTestId('tile-grid')).toHaveAttribute('aria-busy', 'false')
  await expect(tab(p2, '行きたい')).toContainText('3')
  const got = await p2.evaluate(async () => {
    const shops = await import(/* @vite-ignore */ '/src/db/shops.ts' as string)
    return (await shops.listShops()).map((s: { name: string; rating?: number; status: string; origin: string }) => [s.name, s.rating, s.status, s.origin]).sort()
  })
  expect(got).toEqual(
    [
      ['古い店', 35, 'wishlist', 'shared'],
      ['中の店', 42, 'wishlist', 'shared'],
      ['新しい店', 50, 'wishlist', 'shared'],
    ].sort(),
  )
  await p2.context().close()
})

test('share menu: not called when preparing; one .zip File; "送りました" ends the mode; no backup time', async ({ page }) => {
  await fakeShare(page, 'ok')
  await seed(page, [{ name: '共有A' }, { name: '共有B' }])
  await startSelecting(page)
  await tile(page, '共有A').click()
  await tile(page, '共有B').click()
  await bar(page).getByRole('button', { name: '2店を送る' }).click()
  await expect(sheet(page).getByRole('button', { name: '共有メニューを開く' })).toBeVisible({ timeout: 20_000 })
  expect(await shares(page)).toEqual([])
  await sheet(page).getByRole('button', { name: '共有メニューを開く' }).click()
  await expect(sheet(page).getByText('送りました')).toBeVisible()
  await expect(sheet(page)).toHaveCount(0)
  await expect(title(page)).toHaveText('グルメカード')
  const got = await shares(page)
  expect(got).toHaveLength(1)
  expect(got[0]).toMatchObject({ type: 'application/zip', count: 1 })
  expect(got[0].name).toMatch(/^グルメカード_共有Bほか1店\.zip$/)
  await page.goto('/#/data')
  await expect(page.getByTestId('last-backup')).toHaveText('まだバックアップしていません')
})

test('share menu closed (AbortError): still selecting, the selection kept; no backup time', async ({ page }) => {
  await fakeShare(page, 'abort')
  await seed(page, [{ name: '閉じA' }, { name: '閉じB' }])
  await startSelecting(page)
  await tile(page, '閉じA').click()
  await tile(page, '閉じB').click()
  await bar(page).getByRole('button', { name: '2店を送る' }).click()
  await sheet(page).getByRole('button', { name: '共有メニューを開く' }).click()
  await expect.poll(async () => (await shares(page)).length).toBe(1)
  await expect(sheet(page).getByRole('button', { name: '共有メニューを開く' })).toBeVisible()
  await sheet(page).press('Escape')
  await expect(sheet(page)).toHaveCount(0)
  await expect(title(page)).toHaveText('2店を選択中')
  await expect(tile(page, '閉じA')).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: 'キャンセル' }).click()
  await page.getByRole('button', { name: 'メニュー' }).click()
  await expect(page.getByTestId('last-backup')).toHaveText('まだバックアップしていません')
})

test('one shop selected: the file is named like the shop page (グルメカード_<店名>.zip)', async ({ page }) => {
  await seed(page, [{ name: 'ひとつの店', photos: 1 }, { name: 'ほかの店' }])
  await startSelecting(page)
  await tile(page, 'ひとつの店').click()
  await bar(page).getByRole('button', { name: '1店を送る' }).click()
  await expect(sheet(page).getByRole('heading', { name: '1店を送る' })).toBeVisible()
  const file = await saveFromSheet(page)
  expect(file.name).toBe('グルメカード_ひとつの店.zip')
})

test.describe('375px wide (iPhone SE / mini)', () => {
  test.use({ viewport: { width: 375, height: 667 } })
  test('the top bar keeps one line; "選ぶ" is in the count row, left of the sort order', async ({ page }) => {
    await seed(page, [{ name: '狭い画面の店' }])
    expect((await page.locator('.home-topbar').boundingBox())!.height).toBeLessThanOrEqual(52)
    const select = page.getByRole('button', { name: '選ぶ', exact: true })
    await expect(select).toHaveCount(1)
    const s = (await select.boundingBox())!
    const sort = (await page.locator('.list-sort').boundingBox())!
    const count = (await page.getByTestId('list-count').boundingBox())!
    expect(Math.abs(s.y + s.height / 2 - (sort.y + sort.height / 2))).toBeLessThan(4) // same row
    expect(s.x + s.width).toBeLessThanOrEqual(sort.x)
    expect(s.x).toBeGreaterThan(count.x)
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375)
    await select.click()
    await expect(title(page)).toHaveText('お店を選んでください')
  })
})
