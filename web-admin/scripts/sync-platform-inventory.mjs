/**
 * Copy platform-info-inventory.json into web-admin/data for production deploys.
 * Run automatically after ingest; also wired as web-admin prebuild fallback.
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const webAdminRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dest = path.join(webAdminRoot, 'data/platform/platform-info-inventory.json')
const sources = [
  path.join(webAdminRoot, '..', 'docs/platform/inventories/platform-info-inventory.json'),
  dest,
]

const source = sources.find((candidate) => fs.existsSync(candidate))
if (!source) {
  console.warn('[sync-platform-inventory] No source inventory found — skip (run rebuild from repo root).')
  process.exit(0)
}

fs.mkdirSync(path.dirname(dest), { recursive: true })
fs.copyFileSync(source, dest)
console.log(`[sync-platform-inventory] ${source} → ${dest}`)
