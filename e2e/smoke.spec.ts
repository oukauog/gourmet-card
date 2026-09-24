import { expect, test } from '@playwright/test'

test('shows app name on phone-width screen', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveTitle('グルメカード')
  await expect(page.getByText('グルメカード')).toBeVisible()
  const size = page.viewportSize()
  expect(size).toEqual({ width: 390, height: 844 })
})
