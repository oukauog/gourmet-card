// Publish dist/ to the gh-pages branch of origin (construction 8p). Run by `npm run deploy`
// AFTER `npm run build` succeeded (the npm script stops on a failed build).
// The branch holds only the build: every file (dotfiles too) is replaced each time.
// Console output is ASCII only (Japanese Windows).
import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import ghpages from 'gh-pages'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dist = path.join(root, 'dist')
if (!fs.existsSync(path.join(dist, 'index.html'))) {
  console.error('ERROR: dist/index.html not found (build first)')
  process.exit(1)
}

let hash = 'unknown'
try {
  hash = execSync('git rev-parse --short HEAD', { cwd: root, encoding: 'utf8' }).trim()
  if (execSync('git status --porcelain', { cwd: root, encoding: 'utf8' }).trim() !== '') hash += '+'
} catch {
  // no git: keep "unknown"
}
if (hash.endsWith('+')) console.warn('WARNING: the working tree has changes; the version shows "+"')

ghpages.publish(
  dist,
  {
    branch: 'gh-pages',
    dotfiles: true,
    nojekyll: true, // GitHub Pages must not run Jekyll (it drops files starting with "_")
    // gh-pages matches its clean-up pattern without dotfiles; list them explicitly so that
    // nothing from another branch stays on gh-pages
    remove: ['**/*', '**/.*'],
    message: `Deploy ${hash}`,
  },
  (err) => {
    if (err) {
      console.error(`ERROR: publish failed: ${err.message ?? err}`)
      process.exit(1)
    }
    console.log(`Published ${hash} to gh-pages`)
  },
)
