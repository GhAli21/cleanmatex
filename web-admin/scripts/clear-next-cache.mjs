/**
 * Drop a restored webpack cache before the production compile.
 * Vercel restores `.next/cache` into an 8 GB builder; replaying it during
 * `next build` is what fills that machine and gets the process SIGKILL'd.
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const cacheDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '.next', 'cache')
fs.rmSync(cacheDir, { recursive: true, force: true })
console.log(`[clear-next-cache] removed ${cacheDir}`)
