import { execSync } from 'node:child_process'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

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
    plugins: [react()],
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
