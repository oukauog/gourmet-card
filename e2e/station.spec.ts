// Station / city (construction 7). Phone size 390x844.
// Shops are prepared with the public data API (/src/db/...) and station ids are looked up in the
// master (/src/data/geoMaster.ts) from the dev server inside the page.
/// <reference lib="dom" />
import { expect, test, type Page } from '@playwright/test'

interface DbShop {
  id: string
  name: string
  prefecture?: string
  city?: string
  stationId?: string
}

async function dbShop(page: Page, name: string): Promise<DbShop | undefined> {
  return page.evaluate(async (name) => {
    const shops = await import(/* @vite-ignore */ '/src/db/shops.ts' as string)
    return (await shops.listShops()).find((x: { name: string }) => x.name === name)
  }, name)
}

/** Id of the station with this name in this prefecture. */
async function stationId(page: Page, name: string, prefecture: string): Promise<string> {
  const id = await page.evaluate(
    async ({ name, prefecture }) => {
      const geo = await import(/* @vite-ignore */ '/src/data/geoMaster.ts' as string)
      const m = await geo.loadStationMaster()
      return m.stations.find((s: { name: string; prefecture: string }) => s.name === name && s.prefecture === prefecture)?.id as string | undefined
    },
    { name, prefecture },
  )
  if (!id) throw new Error(`no station ${name} in ${prefecture}`)
  return id
}

async function apiShop(page: Page, input: Record<string, unknown>): Promise<string> {
  return page.evaluate(async (input) => {
    const shops = await import(/* @vite-ignore */ '/src/db/shops.ts' as string)
    const s = await shops.createShop(input)
    await new Promise((r) => setTimeout(r, 2)) // distinct createdAt
    return s.id as string
  }, input)
}

const stationBox = (page: Page) => page.getByLabel('最寄り駅', { exact: true })
const candidates = (page: Page) => page.getByRole('group', { name: '最寄り駅の候補' }).getByRole('button')
const candidate = (page: Page, label: string) => candidates(page).filter({ has: page.locator('.station-candidate-name', { hasText: new RegExp(`^${label}$`) }) })
const chosen = (page: Page) => page.getByTestId('station-chosen')
const pref = (page: Page) => page.getByLabel('県', { exact: true })
const city = (page: Page) => page.getByLabel('市', { exact: true })
const place = (page: Page) => page.getByRole('region', { name: '場所' }).locator('.shop-place')

async function openRegister(page: Page) {
  await page.goto('/#/register')
  await expect(stationBox(page)).toBeEnabled({ timeout: 15_000 }) // the master is loaded
}

async function save(page: Page, name: string) {
  await page.getByPlaceholder('店名（必須）').fill(name)
  await page.getByRole('button', { name: '保存', exact: true }).click()
  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible()
}

test('富山 -> 富山駅 (富山県富山市) fills prefecture and city; saved and shown on the shop page', async ({ page }) => {
  await openRegister(page)
  // order: 使い道 -> 最寄り駅 -> 県 -> 市 -> エリア
  const labels = await page.locator('.shop-form .form-label').allTextContents()
  const at = (s: string) => labels.findIndex((l) => l.trim() === s)
  const u = at('使い道')
  expect(u).toBeGreaterThan(0)
  expect([at('最寄り駅'), at('県'), at('市'), at('エリア')]).toEqual([u + 1, u + 2, u + 3, u + 4])

  await stationBox(page).fill('富山')
  const first = candidates(page).first()
  await expect(first.locator('.station-candidate-name')).toHaveText('富山駅')
  await expect(first.locator('.station-candidate-place')).toHaveText('富山県富山市')
  expect(await candidates(page).count()).toBeLessThanOrEqual(8)
  await first.click()

  await expect(chosen(page)).toHaveText('富山駅')
  await expect(pref(page)).toHaveValue('富山県')
  await expect(city(page)).toHaveValue('富山市')
  await save(page, '駅の店')
  await expect(place(page)).toContainText('富山県 富山市')
  await expect(place(page).locator('.shop-station')).toHaveText('富山駅')
  expect(await dbShop(page, '駅の店')).toMatchObject({ prefecture: '富山県', city: '富山市', stationId: await stationId(page, '富山', '富山県') })
})

test('a prefecture already chosen is never overwritten (石川県 + 富山駅 -> 石川県, no city)', async ({ page }) => {
  await openRegister(page)
  await pref(page).selectOption('石川県')
  await stationBox(page).fill('富山')
  await candidate(page, '富山駅').click()
  await expect(chosen(page)).toHaveText('富山駅')
  await expect(pref(page)).toHaveValue('石川県')
  await expect(city(page)).toHaveValue('')
})

test('city: disabled without a prefecture; changing the prefecture empties the city but keeps the station', async ({ page }) => {
  await openRegister(page)
  await expect(city(page)).toBeDisabled()
  await pref(page).selectOption('富山県')
  await expect(city(page)).toBeEnabled()
  const options = await city(page).locator('option').allTextContents()
  expect(options[0]).toBe('選択しない')
  expect(options.slice(1, 4)).toEqual(['富山市', '高岡市', '魚津市']) // code order
  expect(options).toHaveLength(1 + 15)
  await city(page).selectOption('高岡市')

  await stationBox(page).fill('高岡')
  await candidates(page).first().click()
  await expect(city(page)).toHaveValue('高岡市') // same city, already set

  await pref(page).selectOption('石川県')
  await expect(city(page)).toHaveValue('')
  await expect(chosen(page)).toHaveText(/駅$/)
  expect(await city(page).locator('option').allTextContents()).toContain('金沢市')
  await pref(page).selectOption('')
  await expect(city(page)).toBeDisabled()
})

test('府中 lists 府中駅（東京都） and 府中駅（広島県） separately', async ({ page }) => {
  await openRegister(page)
  await stationBox(page).fill('府中')
  await expect(candidate(page, '府中駅（東京都）')).toHaveCount(1)
  await expect(candidate(page, '府中駅（広島県）')).toHaveCount(1)
  await expect(candidate(page, '府中駅（東京都）').locator('.station-candidate-place')).toHaveText('東京都府中市')
  // the chosen prefecture comes first
  await pref(page).selectOption('広島県')
  await stationBox(page).fill('府中')
  await expect(candidates(page).first().locator('.station-candidate-name')).toHaveText('府中駅（広島県）')
})

test('黒部宇奈月温泉 (extra Shinkansen station) fills 富山県 / 黒部市', async ({ page }) => {
  await openRegister(page)
  await stationBox(page).fill('黒部宇奈月温泉駅')
  await candidate(page, '黒部宇奈月温泉駅').click()
  await expect(pref(page)).toHaveValue('富山県')
  await expect(city(page)).toHaveValue('黒部市')
  await save(page, '新幹線の店')
  expect(await dbShop(page, '新幹線の店')).toMatchObject({ stationId: 'x09', city: '黒部市' })
})

test('kana only -> "漢字で入力すると候補が出ます"', async ({ page }) => {
  await openRegister(page)
  await stationBox(page).fill('とやま')
  await expect(page.getByText('漢字で入力すると候補が出ます')).toBeVisible()
  await expect(candidates(page)).toHaveCount(0)
  await stationBox(page).fill('富山')
  await expect(page.getByText('漢字で入力すると候補が出ます')).toHaveCount(0)
})

test('x removes the station and keeps prefecture / city; editing station and city is saved', async ({ page }) => {
  await page.goto('/')
  const toyama = await stationId(page, '富山', '富山県')
  const id = await apiShop(page, { name: '編集する店', prefecture: '富山県', city: '富山市', stationId: toyama })
  await page.goto(`/#/shop/${id}/edit`)
  await expect(chosen(page)).toHaveText('富山駅', { timeout: 15_000 })
  await page.getByRole('button', { name: '最寄り駅を外す' }).click()
  await expect(chosen(page)).toHaveCount(0)
  await expect(pref(page)).toHaveValue('富山県')
  await expect(city(page)).toHaveValue('富山市')

  // cancel asks (the station changed)
  page.once('dialog', (d) => void d.dismiss())
  await page.getByRole('button', { name: 'キャンセル' }).click()
  await expect(stationBox(page)).toBeVisible()

  await stationBox(page).fill('高岡')
  await candidates(page).first().click()
  await expect(city(page)).toHaveValue('富山市') // not overwritten
  await city(page).selectOption('高岡市')
  await page.getByRole('button', { name: '保存', exact: true }).click()
  await expect(page.getByRole('heading', { level: 1, name: '編集する店' })).toBeVisible()
  await expect(place(page)).toContainText('富山県 高岡市')
  await expect(place(page).locator('.shop-station')).toHaveText('高岡駅')
  expect(await dbShop(page, '編集する店')).toMatchObject({ city: '高岡市', stationId: await stationId(page, '高岡', '富山県') })
})

test('unknown station id: form shows （見つからない駅）, shop page shows no station; station only still has a place section', async ({ page }) => {
  await page.goto('/')
  const unknown = await apiShop(page, { name: '謎の駅の店', stationId: 'no-such-station' })
  await page.goto(`/#/shop/${unknown}`)
  await expect(page.getByRole('heading', { level: 1, name: '謎の駅の店' })).toBeVisible()
  await page.waitForTimeout(300)
  await expect(page.getByRole('region', { name: '場所' })).toHaveCount(0)
  await page.goto(`/#/shop/${unknown}/edit`)
  await expect(chosen(page)).toHaveText('（見つからない駅）', { timeout: 15_000 })

  const only = await apiShop(page, { name: '駅だけの店', stationId: 'x09' })
  await page.goto(`/#/shop/${only}`)
  await expect(place(page)).toHaveText('黒部宇奈月温泉駅')
})

test('the list does not read the station master unless a shop of the tab has a station', async ({ page }) => {
  const requests: string[] = []
  page.on('request', (r) => requests.push(r.url()))
  await page.goto('/')
  await apiShop(page, { name: '駅なしの店', prefecture: '富山県' })
  requests.length = 0
  await page.reload()
  await expect(page.getByTestId('tile-grid')).toHaveAttribute('aria-busy', 'false')
  await page.waitForTimeout(500)
  expect(requests.filter((u) => u.includes('stations.json'))).toEqual([])
  await page.getByRole('button', { name: 'お店を登録' }).click()
  await expect(stationBox(page)).toBeEnabled({ timeout: 15_000 })
  expect(requests.filter((u) => u.includes('stations.json')).length).toBeGreaterThan(0)
})

// ---------- construction 7a: other names of a station group ----------

test('淡路町 (in the 御茶ノ水 group) is a station of its own: 東京都 / 千代田区, shown on the shop page', async ({ page }) => {
  await openRegister(page)
  await stationBox(page).fill('淡路町')
  const row = candidate(page, '淡路町駅')
  await expect(row).toHaveCount(1)
  await expect(row.locator('.station-candidate-place')).toHaveText('東京都千代田区')
  await row.click()
  await expect(chosen(page)).toHaveText('淡路町駅')
  await expect(pref(page)).toHaveValue('東京都')
  await expect(city(page)).toHaveValue('千代田区')
  await save(page, '淡路町の店')
  await expect(place(page)).toContainText('東京都 千代田区')
  await expect(place(page).locator('.shop-station')).toHaveText('淡路町駅')
  expect(await dbShop(page, '淡路町の店')).toMatchObject({ stationId: await stationId(page, '淡路町', '東京都') })
})

test('小川町 lists 東京都 and 埼玉県 separately', async ({ page }) => {
  await openRegister(page)
  await stationBox(page).fill('小川町')
  await expect(candidate(page, '小川町駅（東京都）')).toHaveCount(1)
  await expect(candidate(page, '小川町駅（埼玉県）')).toHaveCount(1)
  await expect(candidate(page, '小川町駅（東京都）').locator('.station-candidate-place')).toHaveText('東京都千代田区')
  await expect(candidate(page, '小川町駅（埼玉県）').locator('.station-candidate-place')).toHaveText('埼玉県小川町')
})

// ---------- filter ----------

const chip = (page: Page, kind: string) => page.getByTestId('filter-chips').locator(`[data-kind="${kind}"]`)
const sheet = (page: Page) => page.getByRole('dialog')
const section = (page: Page, title: string) => sheet(page).getByRole('region', { name: title, exact: true })
const optionNames = (page: Page, title: string) =>
  section(page, title)
    .getByRole('button')
    .evaluateAll((els) => els.map((e) => (e.firstChild?.textContent ?? '').trim()))
const tileNames = (page: Page) => page.getByTestId('tile-grid').getByRole('button').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')))

test('place panel: 県 -> 市 -> 駅 -> エリア; station filter; a chosen prefecture narrows cities and stations', async ({ page }) => {
  await page.goto('/')
  const toyama = await stationId(page, '富山', '富山県')
  const takaoka = await stationId(page, '高岡', '富山県')
  const kanazawa = await stationId(page, '金沢', '石川県')
  const fuchuTokyo = await stationId(page, '府中', '東京都')
  await apiShop(page, { name: '富山の店A', prefecture: '富山県', city: '富山市', stationId: toyama })
  await apiShop(page, { name: '富山の店B', prefecture: '富山県', city: '富山市' })
  await apiShop(page, { name: '高岡の店', prefecture: '富山県', city: '高岡市', stationId: takaoka })
  await apiShop(page, { name: '金沢の店', prefecture: '石川県', city: '金沢市', stationId: kanazawa })
  await apiShop(page, { name: '府中の店', prefecture: '東京都', city: '府中市', stationId: fuchuTokyo })
  await page.reload()
  await expect(page.getByTestId('tile-grid')).toHaveAttribute('aria-busy', 'false')

  await chip(page, 'place').click()
  await expect(sheet(page)).toBeVisible()
  await expect(section(page, '駅')).toBeVisible({ timeout: 15_000 })
  const titles = await sheet(page).locator('.sheet-section-title').allTextContents()
  expect(titles).toEqual(['県', '市', '駅'])
  const cities = await optionNames(page, '市')
  expect(cities[0]).toBe('富山市') // 2 shops
  expect(cities.slice(1).sort()).toEqual(['金沢市', '高岡市', '府中市'].sort())
  expect((await optionNames(page, '駅')).sort()).toEqual(['金沢駅', '高岡駅', '富山駅', '府中駅（東京都）'].sort())

  // station: only that shop
  await section(page, '駅').getByRole('button', { name: /^富山駅/ }).click()
  expect(await tileNames(page)).toEqual(['富山の店A'])
  await expect(chip(page, 'place').locator('.filter-chip-text')).toHaveText('富山駅')
  await expect(chip(page, 'place')).toHaveAttribute('data-active', 'true')
  // two stations: ANY
  await section(page, '駅').getByRole('button', { name: /^金沢駅/ }).click()
  expect((await tileNames(page)).sort()).toEqual(['富山の店A', '金沢の店'].sort())
  await sheet(page).getByRole('button', { name: 'クリア' }).click()

  // city: 富山市 (ANY with 高岡市)
  await section(page, '市').getByRole('button', { name: /^富山市/ }).click()
  expect((await tileNames(page)).sort()).toEqual(['富山の店A', '富山の店B'].sort())
  await section(page, '市').getByRole('button', { name: /^高岡市/ }).click()
  expect(await tileNames(page)).toHaveLength(3)
  await expect(chip(page, 'place').locator('.filter-chip-text')).toHaveText('富山市 ほか1')
  await expect(chip(page, 'place')).toHaveAttribute('data-active', 'true')
  await sheet(page).getByRole('button', { name: 'クリア' }).click()

  // prefecture chosen -> only its cities / stations
  await section(page, '県').getByRole('button', { name: /^富山県/ }).click()
  expect(await optionNames(page, '市')).toEqual(['富山市', '高岡市'])
  expect((await optionNames(page, '駅')).sort()).toEqual(['高岡駅', '富山駅'].sort())
  await section(page, '駅').getByRole('button', { name: /^高岡駅/ }).click()
  expect(await tileNames(page)).toEqual(['高岡の店'])
  await expect(chip(page, 'place').locator('.filter-chip-text')).toHaveText('富山県 ほか1')
})
