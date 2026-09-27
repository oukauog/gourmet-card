// PWA bars and the data screen (construction 9). Dev server, phone size 390x844.
// The service worker itself is only in the build (e2e-dist/pwa.spec.ts).
/// <reference lib="dom" />
import { expect, test, type Page } from '@playwright/test'

const IPHONE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'
const DAY = 86_400_000

/** Settings and shops through the public API, then reload the list. */
async function prepare(page: Page, opts: { shops?: number; settings?: Record<string, string> }) {
  await page.goto('/')
  await expect(page.getByTestId('tile-grid')).toBeVisible()
  await page.evaluate(async ({ shops, settings }) => {
    const s = await import(/* @vite-ignore */ '/src/db/settings.ts' as string)
    const db = await import(/* @vite-ignore */ '/src/db/shops.ts' as string)
    for (const [k, v] of Object.entries(settings)) await s.setSetting(k, v)
    for (let i = 0; i < shops; i++) await db.createShop({ name: `店${i + 1}` })
  }, { shops: opts.shops ?? 0, settings: opts.settings ?? {} })
  await page.reload()
  await expect(page.getByTestId('tile-grid')).toHaveAttribute('aria-busy', 'false')
}
const daysAgo = (d: number) => new Date(Date.now() - d * DAY - 60_000).toISOString()
const banner = (page: Page, kind?: string) => page.locator(kind ? `[data-banner="${kind}"]` : '[data-banner]')
/** Wait until the setting is written (the tests reload right after tapping ×). */
const settingSaved = (page: Page, key: string) =>
  expect.poll(() => page.evaluate(async (key) => (await (await import(/* @vite-ignore */ '/src/db/settings.ts' as string)).getSetting(key)) as string | undefined, key)).toBeTruthy()

test.describe('backup reminder', () => {
  test('31 days after the last backup -> the bar -> バックアップする opens #/data; × hides it (also after reload)', async ({ page }) => {
    await prepare(page, { shops: 1, settings: { lastBackupAt: daysAgo(31) } })
    await expect(banner(page, 'backup')).toContainText('最後のバックアップから31日たちました')
    await expect(banner(page)).toHaveCount(1)
    // between the top bar and the tabs
    const barY = (await banner(page, 'backup').boundingBox())!.y
    expect(barY).toBeGreaterThan((await page.locator('.home-topbar').boundingBox())!.y)
    expect(barY).toBeLessThan((await page.getByRole('tablist').boundingBox())!.y)
    await banner(page, 'backup').getByRole('button', { name: 'バックアップする' }).click()
    await expect(page).toHaveURL(/#\/data$/)
    await page.getByRole('button', { name: '← 戻る' }).click()
    await banner(page, 'backup').getByRole('button', { name: '閉じる' }).click()
    await expect(banner(page)).toHaveCount(0)
    await settingSaved(page, 'backupReminderDismissedAt')
    await page.reload()
    await expect(page.getByTestId('tile-grid')).toHaveAttribute('aria-busy', 'false')
    await page.waitForTimeout(300)
    await expect(banner(page)).toHaveCount(0)
  })

  test('29 days: no bar; no shop: no bar', async ({ page }) => {
    await prepare(page, { shops: 1, settings: { lastBackupAt: daysAgo(29) } })
    await page.waitForTimeout(300)
    await expect(banner(page)).toHaveCount(0)
    await page.evaluate(async () => {
      const db = await import(/* @vite-ignore */ '/src/db/shops.ts' as string)
      for (const s of await db.listShops()) await db.deleteShop(s.id)
      const set = await import(/* @vite-ignore */ '/src/db/settings.ts' as string)
      await set.setSetting('lastBackupAt', new Date(Date.now() - 90 * 86_400_000).toISOString())
    })
    await page.reload()
    await expect(page.getByTestId('tile-grid')).toHaveAttribute('aria-busy', 'false')
    await page.waitForTimeout(300)
    await expect(banner(page)).toHaveCount(0)
  })

  test('never backed up, firstShopAt 31 days ago -> "まだバックアップしていません"; firstShopAt is recorded when missing', async ({ page }) => {
    await prepare(page, { shops: 2, settings: { firstShopAt: daysAgo(31) } })
    await expect(banner(page, 'backup')).toContainText('まだバックアップしていません')

    // a new device: no firstShopAt yet -> recorded now, so no bar
    await page.evaluate(async () => {
      const { db } = await import(/* @vite-ignore */ '/src/db/db.ts' as string)
      await db.settings.delete('firstShopAt')
    })
    await page.reload()
    await expect(page.getByTestId('tile-grid')).toHaveAttribute('aria-busy', 'false')
    await expect
      .poll(() => page.evaluate(async () => (await (await import(/* @vite-ignore */ '/src/db/settings.ts' as string)).getSetting('firstShopAt')) as string | undefined))
      .toBeTruthy()
    await expect(banner(page)).toHaveCount(0)
  })
})

test.describe('add to home screen guide (iPhone)', () => {
  test.use({ userAgent: IPHONE_UA })

  test('the bar -> the iPhone steps; with shops the note and the button to #/data; × never again', async ({ page }) => {
    await prepare(page, { shops: 1 })
    await expect(banner(page, 'install')).toContainText('ホーム画面に追加するとアプリとして使えます')
    await banner(page, 'install').getByRole('button', { name: /ホーム画面に追加すると/ }).click()
    const sheet = page.getByRole('dialog')
    await expect(sheet.getByRole('heading', { name: 'ホーム画面に追加する' })).toBeVisible()
    await expect(sheet.getByRole('listitem')).toHaveText(['画面下の共有ボタン（□に↑）を押す', '「ホーム画面に追加」を選ぶ', 'ホーム画面のアイコンから開く'])
    await expect(sheet).toContainText('Safari 等で入れたお店はホーム画面のアプリには出ません')
    await sheet.getByRole('button', { name: 'バックアップと取り込みへ' }).click()
    await expect(page).toHaveURL(/#\/data$/)
    await page.getByRole('button', { name: '← 戻る' }).click()
    await banner(page, 'install').getByRole('button', { name: '閉じる' }).click()
    await expect(banner(page)).toHaveCount(0)
    await settingSaved(page, 'installGuideDismissedAt')
    await page.reload()
    await expect(page.getByTestId('tile-grid')).toHaveAttribute('aria-busy', 'false')
    await page.waitForTimeout(300)
    await expect(banner(page)).toHaveCount(0)
  })

  test('no shop: the steps only (no note, no button)', async ({ page }) => {
    await prepare(page, {})
    await banner(page, 'install').getByRole('button', { name: /ホーム画面に追加すると/ }).click()
    const sheet = page.getByRole('dialog')
    await expect(sheet.getByRole('listitem')).toHaveCount(3)
    await expect(sheet.getByText(/Safari 等で入れたお店/)).toHaveCount(0)
    await expect(sheet.getByRole('button', { name: 'バックアップと取り込みへ' })).toHaveCount(0)
  })

  test('opened from the home screen (standalone): no guide', async ({ page }) => {
    await page.addInitScript(() => {
      const real = window.matchMedia.bind(window)
      window.matchMedia = (q: string) => (q.includes('display-mode: standalone') ? ({ matches: true, media: q } as MediaQueryList) : real(q))
    })
    await prepare(page, { shops: 1 })
    await page.waitForTimeout(300)
    await expect(banner(page)).toHaveCount(0)
  })

  test('install guide and backup reminder both due: only the guide; selection mode hides it', async ({ page }) => {
    await prepare(page, { shops: 2, settings: { lastBackupAt: daysAgo(40) } })
    await expect(banner(page, 'install')).toBeVisible()
    await expect(banner(page)).toHaveCount(1)
    await page.getByRole('button', { name: '選ぶ', exact: true }).click()
    await expect(banner(page)).toHaveCount(0)
    await page.getByRole('button', { name: 'キャンセル' }).click()
    await expect(banner(page, 'install')).toBeVisible()
  })
})

test('a PC browser gets no install guide', async ({ page }) => {
  await prepare(page, { shops: 1 })
  await page.waitForTimeout(300)
  await expect(banner(page, 'install')).toHaveCount(0)
})

test('update bar (DEV fake): on the list and the data screen, not on the register screen; 更新 calls the update once', async ({ page }) => {
  await prepare(page, { shops: 1, settings: { lastBackupAt: daysAgo(40) } })
  await expect(banner(page, 'backup')).toBeVisible()
  await expect.poll(() => page.evaluate(() => typeof (window as unknown as { __gourmetDevFakeUpdate?: unknown }).__gourmetDevFakeUpdate)).toBe('function')
  await page.evaluate(() => (window as unknown as { __gourmetDevFakeUpdate: () => void }).__gourmetDevFakeUpdate())
  // the update wins over the reminder
  await expect(banner(page, 'update')).toContainText('新しい版があります')
  await expect(banner(page)).toHaveCount(1)
  await page.getByRole('button', { name: 'メニュー' }).click()
  await expect(banner(page, 'update')).toBeVisible()
  await page.getByRole('button', { name: '← 戻る' }).click()
  await page.getByRole('button', { name: 'お店を登録' }).click()
  await expect(page.getByPlaceholder('店名（必須）')).toBeVisible()
  await expect(banner(page)).toHaveCount(0)
  await page.getByRole('button', { name: 'キャンセル' }).click()
  await banner(page, 'update').getByRole('button', { name: '更新' }).click()
  expect(await page.evaluate(() => (window as unknown as { __gourmetDevUpdateCalls: number }).__gourmetDevUpdateCalls)).toBe(1)
})

test('data screen: "この端末での保存" (protection, usage, how to use from the home screen) and the version at the bottom', async ({ page }) => {
  await prepare(page, { shops: 1 })
  await page.goto('/#/data')
  const section = page.getByRole('region', { name: 'この端末での保存' })
  await expect(section.getByTestId('storage-persisted')).toHaveText(/^保護されています$|^保護されていません$/)
  await expect(section.getByTestId('storage-usage')).toHaveText(/^使用量の目安：約 \d+(KB|MB)$/)
  await expect(section.getByRole('heading', { name: 'ホーム画面で使う' })).toBeVisible()
  await expect(section).toContainText('「ホーム画面に追加」を選ぶ')
  await expect(section).toContainText('「ホーム画面に追加」または「アプリをインストール」を選ぶ')
  await expect(section).toContainText('Safari 等で入れたお店はホーム画面のアプリには出ません。バックアップして、ホーム画面のアプリで取り込んでください')
  await expect(section).toContainText('ホーム画面のアイコンを削除すると、そのアプリのお店も消えます。先にバックアップしてください')
  await expect(page.getByTestId('data-version')).toHaveText('開発版')
  // the version is below the sections
  const v = (await page.getByTestId('data-version').boundingBox())!
  expect(v.y).toBeGreaterThan((await section.boundingBox())!.y)
})
