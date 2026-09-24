// Screenshot run for the tile look comparison (construction 3). Not part of `npm run e2e`.
// Run: npm run shots  -> writes reports/工事03_見本/*.png
import { defineConfig } from '@playwright/test'
import base from '../playwright.config.ts'

export default defineConfig({
  ...base,
  testDir: '.',
  testMatch: '*.shots.ts',
  fullyParallel: false,
  workers: 1,
})
