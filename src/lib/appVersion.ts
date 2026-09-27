// The app's build for the card file's manifest (construction 8): the commit hash, or "開発版".
// __APP_BUILD__ is replaced at build time (vite.config.ts); undefined on the dev server / Vitest.
const BUILD = typeof __APP_BUILD__ === 'undefined' ? undefined : __APP_BUILD__

export function appVersion(): string {
  return BUILD ? BUILD.hash : '開発版'
}
