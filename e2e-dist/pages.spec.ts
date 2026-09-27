// The published build under /gourmet-card/ (construction 8p). Phone size 390x844.
// Runs against `vite preview` of the production build (playwright.dist.config.ts).
/// <reference lib="dom" />
import { expect, test, type Page } from '@playwright/test'

/** Collect console errors and failed / 4xx-5xx requests of the page. */
function watch(page: Page) {
  const problems: string[] = []
  page.on('console', (m) => {
    if (m.type() === 'error') problems.push(`console: ${m.text()}`)
  })
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`))
  page.on('requestfailed', (r) => problems.push(`failed: ${r.url()}`))
  page.on('response', (r) => {
    if (r.status() >= 400) problems.push(`${r.status()}: ${r.url()}`)
  })
  return problems
}

test('the list opens under /gourmet-card/ without errors or 404s; no sample data buttons', async ({ page }) => {
  const problems = watch(page)
  const urls: string[] = []
  page.on('request', (r) => urls.push(new URL(r.url()).pathname))
  await page.goto('./')
  await expect(page.getByRole('heading', { name: 'グルメカード' })).toBeVisible()
  await expect(page.getByTestId('tile-grid')).toHaveAttribute('aria-busy', 'false')
  await expect(page.getByText('＋から最初のお店を登録')).toBeVisible()
  await expect(page.getByRole('button', { name: '見本用に増やす' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: '見本データを消す' })).toHaveCount(0)
  expect(urls.filter((u) => !u.startsWith('/gourmet-card/'))).toEqual([])
  expect(urls.some((u) => /\/gourmet-card\/assets\/index-.*\.js$/.test(u))).toBe(true)
  expect(problems).toEqual([])
})

test('register with the name only -> shop page -> survives a reload', async ({ page }) => {
  const problems = watch(page)
  await page.goto('./')
  await page.getByRole('button', { name: 'お店を登録' }).click()
  await expect(page).toHaveURL(/\/gourmet-card\/#\/register$/)
  await page.getByPlaceholder('店名（必須）').fill('公開版の店')
  await page.getByRole('button', { name: '保存', exact: true }).click()
  await expect(page.getByRole('heading', { level: 1, name: '公開版の店' })).toBeVisible()
  await expect(page).toHaveURL(/\/gourmet-card\/#\/shop\//)
  await page.reload()
  await expect(page.getByRole('heading', { level: 1, name: '公開版の店' })).toBeVisible()
  await page.getByRole('button', { name: '戻る' }).click()
  await expect(page.getByRole('button', { name: /公開版の店/ })).toBeVisible()
  expect(problems).toEqual([])
})

test('station candidates: the master file is read from /gourmet-card/assets/', async ({ page }) => {
  const problems = watch(page)
  const masters: string[] = []
  page.on('response', (r) => {
    if (/\/(stations|cities)-[^/]+\.js$/.test(r.url())) masters.push(`${r.status()} ${new URL(r.url()).pathname}`)
  })
  await page.goto('./#/register')
  const box = page.getByLabel('最寄り駅', { exact: true })
  await expect(box).toBeEnabled({ timeout: 15_000 })
  await box.fill('富山')
  const first = page.getByRole('group', { name: '最寄り駅の候補' }).getByRole('button').first()
  await expect(first.locator('.station-candidate-name')).toHaveText('富山駅')
  await first.click()
  await expect(page.getByLabel('県', { exact: true })).toHaveValue('富山県')
  expect(masters.some((m) => /^200 \/gourmet-card\/assets\/stations-.+\.js$/.test(m))).toBe(true)
  expect(masters.some((m) => /^200 \/gourmet-card\/assets\/cities-.+\.js$/.test(m))).toBe(true)
  expect(problems).toEqual([])
})

test('the form shows the build version (not 開発版)', async ({ page }) => {
  await page.goto('./#/register')
  const v = page.getByTestId('app-version')
  await expect(v).toHaveText(/^版 ([0-9a-f]{7,}\+?|unknown)（\d{4}-\d{2}-\d{2} \d{2}:\d{2}）$/)
  await expect(v).not.toHaveText(/開発版/)
  // right under the data credits
  const credits = await page.locator('footer.geo-credits').boundingBox()
  const box = await v.boundingBox()
  expect(box!.y).toBeGreaterThan(credits!.y + credits!.height - 1)
})

test('the menu of the list opens "バックアップと取り込み" (construction 8)', async ({ page }) => {
  const problems = watch(page)
  await page.goto('./')
  await expect(page.getByTestId('tile-grid')).toHaveAttribute('aria-busy', 'false')
  await page.getByRole('button', { name: 'メニュー' }).click()
  await expect(page).toHaveURL(/\/gourmet-card\/#\/data$/)
  await expect(page.getByRole('heading', { level: 1, name: 'バックアップと取り込み' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'ファイルから取り込む' })).toBeVisible()
  await expect(page.getByTestId('last-backup')).toHaveText('まだバックアップしていません')
  expect(problems).toEqual([])
})
