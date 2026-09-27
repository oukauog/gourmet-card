import { defineConfig, devices } from '@playwright/test'

// The PUBLISHED build (construction 8p): `npm run build` + `vite preview`, served under
// /gourmet-card/ like GitHub Pages. Separate from playwright.config.ts (dev server on 5173).
const PORT = 4173
const BASE_URL = `http://localhost:${PORT}/gourmet-card/`

export default defineConfig({
  testDir: './e2e-dist',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'mobile-chromium-dist',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 3,
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
  webServer: {
    // always a fresh build, so the test sees what `npm run deploy` would publish
    command: `npm run build && npx vite preview --port ${PORT} --strictPort`,
    url: BASE_URL,
    reuseExistingServer: false,
    timeout: 180_000,
  },
})
