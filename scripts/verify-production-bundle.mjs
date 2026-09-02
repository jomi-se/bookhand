import { readdir, readFile } from 'node:fs/promises'
import { extname, join, resolve } from 'node:path'

const distributionDirectory = resolve('dist')
const forbiddenTokens = [
  '__BOOKHAND_TEST_CONTROLS__',
  'force-opfs-initialization-failure',
  'delay-stale-open',
  'leave-book-open-unresolved',
  'leave-library-list-unresolved',
  'fail-library-list-immediately',
  'fail-section-load',
  'dump-raw-state',
  'indexPauseAfterCommittedBatch',
  'indexFailBeforeChunk',
  'Injected OPFS initialization failure',
  'Injected library-list failure',
  'Injected section-load failure',
]

async function filesBelow(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = await Promise.all(
    entries.map((entry) => {
      const path = join(directory, entry.name)
      return entry.isDirectory() ? filesBelow(path) : [path]
    }),
  )
  return files.flat()
}

const inspectedFiles = (await filesBelow(distributionDirectory)).filter((path) =>
  ['.html', '.js', '.css', '.json', '.map'].includes(extname(path)),
)
const violations = []

const sqliteWasm = await readFile(join(distributionDirectory, 'assets/sqlite3.wasm'))
if (sqliteWasm.subarray(0, 4).toString('hex') !== '0061736d') {
  violations.push('dist/assets/sqlite3.wasm: invalid WebAssembly magic')
}
await readFile(join(distributionDirectory, 'assets/sqlite3-opfs-async-proxy.js'))

for (const path of inspectedFiles) {
  const contents = await readFile(path, 'utf8')
  for (const token of forbiddenTokens) {
    if (contents.includes(token)) violations.push(`${path}: ${token}`)
  }
}

if (violations.length) {
  throw new Error(`Production bundle contains test controls:\n${violations.join('\n')}`)
}

console.log(`production bundle excludes ${forbiddenTokens.length} test-control tokens`)
