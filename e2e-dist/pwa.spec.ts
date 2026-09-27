// The PWA of the published build (construction 9): manifest, service worker, offline.
// Runs against `vite preview` of the production build under /gourmet-card/.
/// <reference lib="dom" />
import { expect, test, type Page } from '@playwright/test'

/** Open the list and wait until the service worker controls the page. */
async function controlled(page: Page) {
  await page.goto('./')
  await expect(page.getByTestId('tile-grid')).toHaveAttribute('aria-busy', 'false')
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready
  })
  await page.reload()
  await expect(page.getByTestId('tile-grid')).toHaveAttribute('aria-busy', 'false')
  await expect.poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null)).toBe(true)
}

test('manifest: name, start_url, scope, display, icons (every icon 200)', async ({ page, request }) => {
  await page.goto('./')
  const href = await page.locator('link[rel="manifest"]').getAttribute('href')
  expect(href).toBe('/gourmet-card/manifest.webmanifest')
  const url = new URL(href!, page.url()).toString()
  const res = await request.get(url)
  expect(res.status()).toBe(200)
  const m = await res.json()
  expect(m).toMatchObject({ name: 'グルメカード', short_name: 'グルメカード', lang: 'ja', start_url: '/gourmet-card/', scope: '/gourmet-card/', display: 'standalone' })
  expect(m.orientation).toBeUndefined()
  expect(m.icons.map((i: { src: string; sizes: string; purpose?: string }) => `${i.src} ${i.sizes} ${i.purpose ?? ''}`.trim())).toEqual([
    'pwa-192.png 192x192',
    'pwa-512.png 512x512',
    'pwa-maskable-512.png 512x512 maskable',
  ])
  for (const icon of [...m.icons.map((i: { src: string }) => i.src), 'apple-touch-icon.png', 'favicon.svg']) {
    const r = await request.get(new URL(icon, url).toString())
    expect(r.status(), icon).toBe(200)
  }
  // iPhone home screen
  expect(await page.locator('link[rel="apple-touch-icon"]').getAttribute('href')).toBe('/gourmet-card/apple-touch-icon.png')
  expect(await page.locator('meta[name="apple-mobile-web-app-title"]').getAttribute('content')).toBe('グルメカード')
  expect(await page.locator('meta[name="apple-mobile-web-app-status-bar-style"]').getAttribute('content')).toBe('default')
})

test('the service worker is registered and controls the page after a reload', async ({ page }) => {
  await controlled(page)
  const scope = await page.evaluate(async () => (await navigator.serviceWorker.getRegistration())?.scope)
  expect(new URL(scope!).pathname).toBe('/gourmet-card/')
  const script = await page.evaluate(() => navigator.serviceWorker.controller?.scriptURL)
  expect(new URL(script!).pathname).toBe('/gourmet-card/sw.js')
})

test('offline: the list opens and the station candidates work (the masters are precached)', async ({ page, context }) => {
  await controlled(page)
  await context.setOffline(true)
  await page.reload()
  await expect(page.getByRole('heading', { name: 'グルメカード' })).toBeVisible()
  await expect(page.getByTestId('tile-grid')).toHaveAttribute('aria-busy', 'false')
  await page.getByRole('button', { name: 'お店を登録' }).click()
  const box = page.getByLabel('最寄り駅', { exact: true })
  await expect(box).toBeEnabled({ timeout: 15_000 })
  await box.fill('富山')
  await expect(page.getByRole('group', { name: '最寄り駅の候補' }).getByRole('button').first().locator('.station-candidate-name')).toHaveText('富山駅')
  // and a shop can be saved offline
  await page.getByPlaceholder('店名（必須）').fill('電波の無い店')
  await page.getByRole('button', { name: '保存', exact: true }).click()
  await expect(page.getByRole('heading', { level: 1, name: '電波の無い店' })).toBeVisible()
  await context.setOffline(false)
})
