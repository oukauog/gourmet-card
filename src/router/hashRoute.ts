// Hash routes (pure; no window access). Works on GitHub Pages without server rewrites.
//   #/            home
//   #/register    register screen
//   #/shop/<id>   shop page (id is URI-encoded)

export type Route = { screen: 'home' } | { screen: 'register' } | { screen: 'shop'; id: string }

const HOME: Route = { screen: 'home' }

/** Parse location.hash. Unknown or broken forms fall back to home (never throws). */
export function parseHash(hash: string): Route {
  const path = hash.startsWith('#') ? hash.slice(1) : hash
  if (path === '' || path === '/') return HOME
  if (path === '/register') return { screen: 'register' }
  const m = /^\/shop\/([^/]+)$/.exec(path)
  if (m) {
    try {
      const id = decodeURIComponent(m[1])
      if (id !== '') return { screen: 'shop', id }
    } catch {
      // malformed escape (e.g. "%E0%A4%A") -> home
    }
  }
  return HOME
}

/** Route -> hash. parseHash(formatHash(r)) equals r for any non-empty shop id. */
export function formatHash(route: Route): string {
  switch (route.screen) {
    case 'home':
      return '#/'
    case 'register':
      return '#/register'
    case 'shop':
      return `#/shop/${encodeURIComponent(route.id)}`
  }
}
