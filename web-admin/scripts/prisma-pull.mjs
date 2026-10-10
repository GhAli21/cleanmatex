#!/usr/bin/env node
/**
 * Full Prisma introspect: db pull → post-pull patch → validate.
 *
 * Source: --source=local (default; uses DATABASE_URL as already set in .env/.env.local)
 *         --source=remote (overrides DATABASE_URL with REMOTE_DATABASE_URL for this run only)
 *
 * If validate still fails after the patch: STOP. Print the errors and
 * the next-step policy. Do not retry this script in a loop.
 */
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')

// Plain `node scripts/prisma-pull.mjs` does not auto-load .env files the way
// `next dev`/`next build` or the `prisma` CLI do, so this script loads them
// itself. Precedence matches Next.js: .env.local overrides .env; an already-set
// process env var always wins over either file.
function loadEnvFile(filePath, target) {
  let contents
  try {
    contents = readFileSync(filePath, 'utf8')
  } catch {
    return
  }
  for (const line of contents.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const match = trimmed.match(/^([\w.-]+)\s*=\s*(.*)$/)
    if (!match) continue
    const [, key, rawValue] = match
    let value = rawValue.trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (!(key in target)) target[key] = value
  }
}

const sourceArg = process.argv.find((arg) => arg.startsWith('--source='))
const source = sourceArg ? sourceArg.slice('--source='.length) : 'local'

if (source !== 'local' && source !== 'remote') {
  console.error(`prisma-pull: invalid --source "${source}". Use --source=local or --source=remote.`)
  process.exit(1)
}

const env = { ...process.env }
loadEnvFile(path.join(root, '.env.local'), env)
loadEnvFile(path.join(root, '.env'), env)

if (source === 'remote') {
  if (!env.REMOTE_DATABASE_URL) {
    console.error(
      'prisma-pull: --source=remote requires REMOTE_DATABASE_URL to be set (in web-admin/.env.local, gitignored). ' +
        'See the commented remote DATABASE_URL example in .env / .env.local.',
    )
    process.exit(1)
  }
  env.DATABASE_URL = env.REMOTE_DATABASE_URL
  console.log('prisma-pull: source=remote (DATABASE_URL overridden from REMOTE_DATABASE_URL for this run)')
} else {
  console.log('prisma-pull: source=local (using DATABASE_URL as set in .env/.env.local)')
}

function spawnPrisma(args, { inherit } = { inherit: false }) {
  const result = spawnSync('npx', ['prisma', ...args], {
    cwd: root,
    encoding: 'utf8',
    stdio: inherit ? 'inherit' : undefined,
    shell: process.platform === 'win32',
    env,
  })

  if (result.error) {
    console.error(`prisma-pull: failed to start npx prisma ${args.join(' ')}: ${result.error.message}`)
    return { ok: false, status: 1, result }
  }
  if (result.signal) {
    console.error(`prisma-pull: npx prisma ${args.join(' ')} killed by ${result.signal}`)
    return { ok: false, status: 1, result }
  }

  const status = result.status ?? 1
  return { ok: status === 0, status, result }
}

const pulled = spawnPrisma(['db', 'pull'], { inherit: true })
if (!pulled.ok) {
  console.error('prisma-pull: db pull failed. Stop. Do not run the post-pull patch on a failed pull.')
  process.exit(pulled.status)
}

const patched = spawnSync(process.execPath, ['scripts/prisma-patch-after-pull.mjs'], {
  cwd: root,
  encoding: 'utf8',
  stdio: 'inherit',
  env,
})
if (patched.error) {
  console.error(`prisma-pull: failed to start post-pull patch: ${patched.error.message}`)
  process.exit(1)
}
if ((patched.status ?? 1) !== 0) {
  console.error('prisma-pull: post-pull patch failed. Stop.')
  process.exit(patched.status ?? 1)
}

const validated = spawnPrisma(['validate'], { inherit: false })
if (validated.result.stdout) process.stdout.write(validated.result.stdout)
if (validated.result.stderr) process.stderr.write(validated.result.stderr)

if (validated.ok) {
  process.exit(0)
}

console.error(`
prisma-pull: schema is still invalid AFTER the post-pull patch.

STOP.
- Do not run npm run prisma:pull again in a loop.
- Do not flip org_asm_tasks_mst / org_pck_packing_lists_mst on org_orders_mst from ? to [].
- Do not make tenant_org_id optional to silence SetNull warnings.
- Do not apply database migrations.

Report the validate errors to the user. Typical leftovers:
- A new ignored view/table (not cmx_effective_permissions) → extend prisma-patch-after-pull.mjs
- New 1:1 unique/FK column-order mismatch → new SQL migration (Prisma-safe FK rule), then ask the user to apply it
- SetNull warnings only → not a failure; if validate printed P1012, that is the real error
`)
process.exit(validated.status)
