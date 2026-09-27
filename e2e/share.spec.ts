// Send / back up / import (construction 8). Phone size 390x844.
// "Another phone" = a new browser context (empty IndexedDB). Files go through real downloads.
// page.evaluate() callbacks run in the browser and use DOM APIs.
/// <reference lib="dom" />
import { expect, test, type Browser, type Page, type TestInfo } from '@playwright/test'

interface Seed {
  name: string
  status?: 'visited' | 'wishlist'
  rating?: number
  memo?: string
  genres?: string[]
  photos?: number
}

/** Create shops through the public API; photos are real JPEGs drawn on a canvas. */
async function seed(page: Page, shops: Seed[]): Promise<string[]> {
  await page.goto('/')
  await expect(page.getByTestId('tile-grid')).toBeVisible()
  return page.evaluate(async (shops) => {
    const load = (p: string) => import(/* @vite-ignore */ p)
    const create = await load('/src/db/createShopWithPhotos.ts')
    const tags = await load('/src/db/tags.ts')
    const jpeg = (w: number, h: number, hue: number) =>
      new Promise<Blob>((resolve) => {
        const c = document.createElement('canvas')
        c.width = w
        c.height = h
        const g = c.getContext('2d')!
        g.fillStyle = `hsl(${hue} 70% 55%)`
        g.fillRect(0, 0, w, h)
        g.fillStyle = '#fff'
        g.fillRect(w / 4, h / 4, w / 2, h / 2)
        c.toBlob((b) => resolve(b!), 'image/jpeg', 0.8)
      })
    const ids: string[] = []
    for (const [i, s] of shops.entries()) {
      const photos = []
      for (let k = 0; k < (s.photos ?? 0); k++) photos.push({ large: await jpeg(900, 675, i * 60 + k * 20), small: await jpeg(300, 225, i * 60 + k * 20), width: 900, height: 675 })
      const genreTagIds = []
      for (const g of s.genres ?? []) genreTagIds.push((await tags.findOrCreateTag('genre', g)).id)
      const shop = await create.createShopWithPhotos({ name: s.name, status: s.status ?? 'visited', rating: s.rating, memo: s.memo, genreTagIds }, photos)
      ids.push(shop.id)
      await new Promise((r) => setTimeout(r, 2))
    }
    return ids
  }, shops)
}

/** A fresh "phone": new context, same phone size and base URL. */
async function otherPhone(browser: Browser, info: TestInfo): Promise<Page> {
  const { viewport, isMobile, hasTouch, deviceScaleFactor, baseURL } = info.project.use
  const ctx = await browser.newContext({ viewport, isMobile, hasTouch, deviceScaleFactor, baseURL, acceptDownloads: true })
  return ctx.newPage()
}

const sheet = (page: Page) => page.getByRole('dialog')

/** Tap a "send" button, wait until the file is ready, save it; returns the downloaded path and name. */
async function saveFrom(page: Page, openButton: string) {
  await page.getByRole('button', { name: openButton }).click()
  await expect(sheet(page).getByText(/^準備できました（.+）$/)).toBeVisible({ timeout: 20_000 })
  const [download] = await Promise.all([page.waitForEvent('download'), sheet(page).getByRole('button', { name: 'ファイルとして保存' }).click()])
  const path = await download.path()
  return { path: path!, name: download.suggestedFilename() }
}

async function importFile(page: Page, path: string) {
  await page.goto('/#/data')
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.getByRole('button', { name: 'ファイルから取り込む' }).click()])
  await chooser.setFiles(path)
  await expect(sheet(page)).toBeVisible()
}

const tabCount = async (page: Page, name: string) => {
  await expect(page.getByTestId('tile-grid')).toHaveAttribute('aria-busy', 'false')
  return (await page.getByRole('tab', { name: new RegExp(`^${name}`) }).textContent())?.replace(name, '').trim()
}

test('send one shop -> save the file -> another phone imports it as 行きたい / もらったお店, with its photos', async ({ page, browser }, info) => {
  const [id] = await seed(page, [{ name: '白えび亭', rating: 42, memo: '天丼が名物', genres: ['天ぷら'], photos: 2 }])
  await page.goto(`/#/shop/${id}`)
  // 編集 -> この店を送る -> この店を削除 (top to bottom)
  const y = async (name: string) => (await page.getByRole('button', { name, exact: true }).boundingBox())!.y
  expect(await y('編集')).toBeLessThan(await y('この店を送る'))
  expect(await y('この店を送る')).toBeLessThan(await y('この店を削除'))
  const file = await saveFrom(page, 'この店を送る')
  expect(file.name).toBe('グルメカード_白えび亭.zip')

  const p2 = await otherPhone(browser, info)
  await importFile(p2, file.path)
  await expect(sheet(p2).getByTestId('import-kind')).toHaveText('お裾分け（友人から）')
  await expect(sheet(p2).getByText('新しいお店 1件')).toBeVisible()
  await expect(sheet(p2).getByText('「行きたい」として取り込みます')).toBeVisible()
  await expect(sheet(p2).getByText(/もう入っているお店/)).toHaveCount(0)
  await sheet(p2).getByRole('button', { name: '取り込む（1件）' }).click()
  await expect(sheet(p2).getByTestId('import-result')).toHaveText('1件取り込みました')
  await sheet(p2).getByRole('button', { name: 'お店を見る' }).click()

  await expect(p2.getByRole('heading', { level: 1, name: '白えび亭' })).toBeVisible()
  await expect(p2.getByText('もらったお店')).toBeVisible()
  await expect(p2.getByText('4.2')).toBeVisible()
  await expect(p2.getByRole('region', { name: 'メモ' })).toContainText('天丼が名物')
  const img = p2.locator('.shop-photos img').first()
  await expect(img).toBeVisible()
  expect(await img.evaluate((el: HTMLImageElement) => el.naturalWidth)).toBe(900)
  await p2.getByRole('button', { name: '戻る' }).click()
  expect(await tabCount(p2, '行きたい')).toBe('1')
  expect(await tabCount(p2, '手札')).toBe('0')
  await p2.context().close()
})

test('back up every shop -> another phone restores them into 手札 / 行きたい; "最後のバックアップ" is shown', async ({ page, browser }, info) => {
  await seed(page, [{ name: '一の店', photos: 1 }, { name: '二の店', status: 'wishlist' }, { name: '三の店', rating: 30, photos: 3 }])
  await page.getByRole('button', { name: 'メニュー' }).click()
  await expect(page).toHaveURL(/#\/data$/)
  await expect(page.getByRole('heading', { level: 1, name: 'バックアップと取り込み' })).toBeVisible()
  await expect(page.getByTestId('last-backup')).toHaveText('まだバックアップしていません')
  const file = await saveFrom(page, '全店のバックアップを作る（3件）')
  expect(file.name).toMatch(/^グルメカード_バックアップ_\d{8}-\d{4}\.zip$/)
  await sheet(page).press('Escape')
  await expect(page.getByTestId('last-backup')).toHaveText(/^最後のバックアップ：\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/)

  const p2 = await otherPhone(browser, info)
  // the list was seen empty first: the list kept in memory must not come back after the import
  await p2.goto('/')
  expect(await tabCount(p2, '手札')).toBe('0')
  await importFile(p2, file.path)
  await expect(sheet(p2).getByTestId('import-kind')).toHaveText('バックアップ（自分の端末の復元用）')
  await expect(sheet(p2).getByText('新しいお店 3件')).toBeVisible()
  await expect(sheet(p2).getByText('「行きたい」として取り込みます')).toHaveCount(0)
  await sheet(p2).getByRole('button', { name: '取り込む（3件）' }).click()
  await expect(sheet(p2).getByTestId('import-result')).toHaveText('3件取り込みました')
  await sheet(p2).getByRole('button', { name: '一覧を見る' }).click()
  await expect(p2).toHaveURL(/#\/$/)
  expect(await tabCount(p2, '手札')).toBe('2')
  expect(await tabCount(p2, '行きたい')).toBe('1')
  const names = await p2.getByTestId('tile-grid').getByRole('button').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')))
  expect(names.sort()).toEqual(['一の店', '三の店'].sort())
  await p2.context().close()
})

test('the same file twice: "もう入っているお店 1件", kept by default; 上書きする can be chosen', async ({ page, browser }, info) => {
  const [id] = await seed(page, [{ name: '二度来る店', photos: 1 }])
  await page.goto(`/#/shop/${id}`)
  const file = await saveFrom(page, 'この店を送る')
  const p2 = await otherPhone(browser, info)
  await importFile(p2, file.path)
  await sheet(p2).getByRole('button', { name: '取り込む（1件）' }).click()
  await expect(sheet(p2).getByTestId('import-result')).toHaveText('1件取り込みました')
  await sheet(p2).getByRole('button', { name: '閉じる' }).click()

  await importFile(p2, file.path)
  await expect(sheet(p2).getByText('新しいお店 0件')).toBeVisible()
  await expect(sheet(p2).getByText('もう入っているお店 1件')).toBeVisible()
  await expect(sheet(p2).getByRole('radio', { name: '取り込まない' })).toHaveAttribute('aria-checked', 'true')
  await expect(sheet(p2).getByRole('button', { name: '取り込む', exact: true })).toBeDisabled()
  await sheet(p2).getByRole('radio', { name: '上書きする' }).click()
  await sheet(p2).getByRole('button', { name: '取り込む（1件）' }).click()
  await expect(sheet(p2).getByTestId('import-result')).toHaveText('1件取り込みました（1件は上書きしました）')
  expect(await p2.evaluate(async () => (await (await import(/* @vite-ignore */ '/src/db/shops.ts' as string)).listShops()).length)).toBe(1)
  await p2.context().close()
})

test('a file that is not a card file is refused with a message', async ({ page }, info) => {
  await page.goto('/#/data')
  const path = info.outputPath('not-a-card.gcard')
  const fs = await import('node:fs')
  fs.writeFileSync(path, 'hello')
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.getByRole('button', { name: 'ファイルから取り込む' }).click()])
  await chooser.setFiles(path)
  await expect(page.getByRole('alert')).toHaveText('グルメカードのファイルではありません')
  await expect(sheet(page)).toHaveCount(0)
})

// ---------- the share sheet (Web Share API replaced) ----------

/** navigator.canShare / share replaced; `mode` decides what share() does. */
async function fakeShare(page: Page, mode: 'ok' | 'abort' | 'fail') {
  await page.addInitScript((mode) => {
    const w = window as unknown as { __shares: { name: string; type: string; size: number; count: number }[] }
    w.__shares = []
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: (d: ShareData) => Array.isArray(d?.files) && d.files.length > 0 })
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: async (d: ShareData) => {
        const f = d.files![0]
        w.__shares.push({ name: f.name, type: f.type, size: f.size, count: d.files!.length })
        if (mode === 'abort') throw new DOMException('closed', 'AbortError')
        if (mode === 'fail') throw new DOMException('no', 'NotAllowedError')
      },
    })
  }, mode)
}
const shares = (page: Page) => page.evaluate(() => (window as unknown as { __shares: unknown[] }).__shares)

test('share sheet: "共有メニューを開く" only after preparing, with one .zip File; backup records the time', async ({ page }) => {
  await fakeShare(page, 'ok')
  const [id] = await seed(page, [{ name: '共有する店', photos: 1 }])
  await page.goto(`/#/shop/${id}`)
  await page.getByRole('button', { name: 'この店を送る' }).click()
  await expect(sheet(page).getByRole('button', { name: '共有メニューを開く' })).toBeVisible({ timeout: 20_000 })
  // the tap that prepared the file did not call share()
  expect(await shares(page)).toEqual([])
  await sheet(page).getByRole('button', { name: '共有メニューを開く' }).click()
  await expect(sheet(page).getByText('送りました')).toBeVisible()
  await expect(sheet(page)).toHaveCount(0)
  const got = (await shares(page)) as { name: string; type: string; size: number; count: number }[]
  expect(got).toHaveLength(1)
  expect(got[0]).toMatchObject({ name: 'グルメカード_共有する店.zip', type: 'application/zip', count: 1 })
  expect(got[0].size).toBeGreaterThan(1000)

  // a single shop does not count as a backup
  await page.goto('/#/data')
  await expect(page.getByTestId('last-backup')).toHaveText('まだバックアップしていません')
  await page.getByRole('button', { name: /^全店のバックアップを作る/ }).click()
  await sheet(page).getByRole('button', { name: '共有メニューを開く' }).click()
  await expect(page.getByTestId('last-backup')).toHaveText(/^最後のバックアップ：/)
})

test('share sheet: closing the share menu (AbortError) keeps the sheet quietly; other errors point to "ファイルとして保存"', async ({ page }) => {
  await fakeShare(page, 'abort')
  const [id] = await seed(page, [{ name: '閉じる店' }])
  await page.goto('/#/data')
  await page.getByRole('button', { name: /^全店のバックアップを作る/ }).click()
  await sheet(page).getByRole('button', { name: '共有メニューを開く' }).click()
  await expect.poll(async () => ((await shares(page)) as unknown[]).length).toBe(1)
  await expect(sheet(page).getByRole('button', { name: '共有メニューを開く' })).toBeVisible()
  await expect(sheet(page).getByRole('alert')).toHaveCount(0)
  await sheet(page).press('Escape')
  // closing the share menu is not a backup
  await expect(page.getByTestId('last-backup')).toHaveText('まだバックアップしていません')

  const p = await page.context().newPage()
  await fakeShare(p, 'fail')
  await p.goto(`/#/shop/${id}`)
  await p.getByRole('button', { name: 'この店を送る' }).click()
  await sheet(p).getByRole('button', { name: '共有メニューを開く' }).click()
  await expect(sheet(p).getByRole('alert')).toContainText('共有できませんでした。「ファイルとして保存」をお試しください')
  await expect(sheet(p).getByRole('alert')).toContainText('NotAllowedError')
  await expect(sheet(p).getByRole('button', { name: 'ファイルとして保存' })).toBeVisible()
})

test('without navigator.canShare there is no share button, only "ファイルとして保存"', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: undefined })
    Object.defineProperty(navigator, 'share', { configurable: true, value: undefined })
  })
  const [id] = await seed(page, [{ name: '保存だけの店' }])
  await page.goto(`/#/shop/${id}`)
  await page.getByRole('button', { name: 'この店を送る' }).click()
  await expect(sheet(page).getByRole('button', { name: 'ファイルとして保存' })).toBeVisible({ timeout: 20_000 })
  await expect(sheet(page).getByRole('button', { name: '共有メニューを開く' })).toHaveCount(0)
})

// construction 8a: the extension is fixed to .zip; the trial switch is gone
test('.zip only: one shop and the backup are .zip (application/zip); no trial switch; a file named .gcard still imports', async ({ page, browser }, info) => {
  await fakeShare(page, 'ok')
  const [id] = await seed(page, [{ name: 'ZIPの店', photos: 1 }])
  await page.goto('/#/data')
  await expect(page.getByRole('heading', { level: 1, name: 'バックアップと取り込み' })).toBeVisible()
  await expect(page.getByText('送るファイルの形式（試験用）')).toHaveCount(0)
  await expect(page.getByRole('radio', { name: '.gcard' })).toHaveCount(0)
  await expect(page.getByRole('radio', { name: '.zip' })).toHaveCount(0)
  await expect(page.getByText(/選ぶ画面の「最近使った項目」か、検索で「グルメカード」と入れると見つかります/)).toBeVisible()

  // the backup through the share sheet
  await page.getByRole('button', { name: /^全店のバックアップを作る/ }).click()
  await sheet(page).getByRole('button', { name: '共有メニューを開く' }).click()
  await expect(sheet(page)).toHaveCount(0)
  // one shop through the share sheet
  await page.goto(`/#/shop/${id}`)
  await page.getByRole('button', { name: 'この店を送る' }).click()
  await sheet(page).getByRole('button', { name: '共有メニューを開く' }).click()
  await expect(sheet(page)).toHaveCount(0)
  const got = (await shares(page)) as { name: string; type: string }[]
  expect(got).toHaveLength(2)
  expect(got[0].name).toMatch(/^グルメカード_バックアップ_\d{8}-\d{4}\.zip$/)
  expect(got[1].name).toBe('グルメカード_ZIPの店.zip')
  expect(got.map((g) => g.type)).toEqual(['application/zip', 'application/zip'])

  // saved: .zip; the same bytes under a .gcard name (a file kept from construction 8) import too
  const file = await saveFrom(page, 'この店を送る')
  expect(file.name).toBe('グルメカード_ZIPの店.zip')
  const fs = await import('node:fs')
  const old = info.outputPath('グルメカード_ZIPの店.gcard')
  fs.copyFileSync(file.path, old)
  const p2 = await otherPhone(browser, info)
  await importFile(p2, old)
  await expect(sheet(p2).getByText('新しいお店 1件')).toBeVisible()
  await sheet(p2).getByRole('button', { name: '取り込む（1件）' }).click()
  await expect(sheet(p2).getByTestId('import-result')).toHaveText('1件取り込みました')
  await p2.context().close()
})

test('not a card file: the message, and under it how to pick the .zip itself (not the folder the Files app made)', async ({ page }, info) => {
  await page.goto('/#/data')
  const path = info.outputPath('memo.txt')
  const fs = await import('node:fs')
  fs.writeFileSync(path, 'hello')
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.getByRole('button', { name: 'ファイルから取り込む' }).click()])
  await chooser.setFiles(path)
  await expect(page.getByRole('alert')).toHaveText('グルメカードのファイルではありません')
  const hint = page.getByText('「ファイル」アプリで .zip をタップすると中身のフォルダができます。取り込むのはフォルダの中ではなく、.zip のファイルそのものです')
  await expect(hint).toBeVisible()
  // under the message, in small text
  const a = (await page.getByRole('alert').boundingBox())!
  const h = (await hint.boundingBox())!
  expect(h.y).toBeGreaterThanOrEqual(a.y + a.height - 1)
  expect(await hint.evaluate((el) => parseFloat(getComputedStyle(el).fontSize))).toBeLessThan(14)
})
