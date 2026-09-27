import { execSync } from 'node:child_process'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

/** Short commit hash (+ when the working tree has changes); "unknown" when git is not usable. */
function commitHash(): string {
  try {
    const hash = execSync('git rev-parse --short HEAD', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
    const dirty = execSync('git status --porcelain', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim() !== ''
    return hash ? hash + (dirty ? '+' : '') : 'unknown'
  } catch {
    return 'unknown'
  }
}

// https://vite.dev/config/
export default defineConfig(({ command, isPreview }) => {
  // GitHub Pages (https://oukauog.github.io/gourmet-card/): the base only for the build and
  // `vite preview`; the dev server (LAN check on the iPhone) and the e2e tests stay at "/".
  const published = command === 'build' || isPreview === true
  return {
    base: published ? '/gourmet-card/' : '/',
    plugins: [
      react(),
      // PWA (construction 9, spec 4.6). The service worker exists only in the build: the dev server
      // and the e2e tests never register one (devOptions stay off). Updates are "prompt": the app
      // shows a bar and reloads only when tapped (src/pwa/). Registration is done by src/pwa/,
      // so no auto-register script is injected.
      VitePWA({
        registerType: 'prompt',
        injectRegister: false,
        devOptions: { enabled: false },
        includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
        manifest: {
          name: 'グルメカード',
          short_name: 'グルメカード',
          lang: 'ja',
          start_url: '/gourmet-card/',
          scope: '/gourmet-card/',
          display: 'standalone',
          background_color: '#ffffff',
          theme_color: '#ffffff',
          icons: [
            { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
            { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
            { src: 'pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ],
        },
        workbox: {
          // the app, its CSS, index.html, icons, the manifest and the station / municipality
          // masters (separate JS files, construction 7). No other site is ever cached.
          globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
          cleanupOutdatedCaches: true,
          navigateFallback: 'index.html',
          runtimeCaching: [],
        },
      }),
    ],
    define: {
      // version line of the form (construction 8p); undefined on the dev server = "開発版"
      __APP_BUILD__: command === 'build' ? JSON.stringify({ hash: commitHash(), builtAt: new Date().toISOString() }) : 'undefined',
    },
    server: {
      // Allow access from phones on the same LAN (prints http://192.168.x.x:5173)
      host: true,
      port: 5173,
      strictPort: true,
    },
  }
})
