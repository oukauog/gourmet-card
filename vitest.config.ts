import { defineConfig } from 'vitest/config'

// Unit tests (logic only). E2E tests live in e2e/ and run with Playwright.
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    environment: 'node',
    // In-memory IndexedDB for Dexie tests. Loaded before any test file imports Dexie.
    setupFiles: ['fake-indexeddb/auto'],
  },
})
