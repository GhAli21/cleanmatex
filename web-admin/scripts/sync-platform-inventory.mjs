/**
 * Copy platform-info-inventory.json into web-admin/data for production deploys.
 * Run automatically after ingest; also wired as web-admin prebuild fallback.
 * Build fails if neither docs source nor committed runtime copy exists.
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const webAdminRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dest = path.join(webAdminRoot, 'data/platform/platform-info-inventory.json')
const docsSource = path.join(webAdminRoot, '..', 'docs/platform/inventories/platform-info-inventory.json')

if (fs.existsSync(docsSource)) {
  fs.mkdirSync(path.dirname(dest), { recursive: true })
  fs.copyFileSync(docsSource, dest)
  console.log(`[sync-platform-inventory] ${docsSource} → ${dest}`)
  process.exit(0)
}

if (fs.existsSync(dest)) {
  console.log(
    `[sync-platform-inventory] docs source missing; using committed runtime copy at ${dest}`
  )
  process.exit(0)
}

console.error('[sync-platform-inventory] ERROR: no inventory file found.')
console.error(`  expected docs source: ${docsSource}`)
console.error(`  or runtime copy:      ${dest}`)
console.error('  Run from repo root: npm run rebuild:platform-info-inventories')
process.exit(1)
